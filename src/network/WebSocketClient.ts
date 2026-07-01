/**
 * WebSocketClient — browser-side multiplayer connection manager.
 * 
 * Handles: connect/disconnect, typed JSON messaging, event subscription,
 * auto-reconnect with exponential backoff. No Phaser dependency.
 */

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface PendingMessage {
  action: string;
  data: Record<string, unknown>;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Array<(data: any) => void>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectBaseDelay = 1000;
  private reconnectMaxDelay = 16_000;
  private _connectionState: ConnectionState = 'disconnected';
  private pendingMessages: PendingMessage[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  constructor(url: string = 'ws://localhost:3002') {
    this.url = url;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get connected(): boolean {
    return this._connectionState === 'connected';
  }

  /** Connect to the WebSocket server. Returns a promise that resolves on open. */
  connect(url?: string): Promise<void> {
    if (url) this.url = url;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve();
    }

    this.intentionalClose = false;
    this._connectionState = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this._connectionState = 'disconnected';
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this._connectionState = 'connected';
        this.reconnectAttempts = 0;

        // Start ping interval
        this.startPing();

        // Flush pending messages
        for (const msg of this.pendingMessages) {
          this.sendRaw(msg.action, msg.data);
        }
        this.pendingMessages = [];

        this.emit('__connected', {});
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          console.warn('[ws-client] Failed to parse message:', event.data);
          return;
        }

        const { action, ...data } = msg;
        this.emit(action, data);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this._connectionState = 'disconnected';
        this.stopPing();
        this.ws = null;

        this.emit('__disconnected', { code: event.code, reason: event.reason });

        // Auto-reconnect unless intentional close or max attempts reached
        if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after this — handle reconnection there
      };
    });
  }

  /** Gracefully disconnect. Stops auto-reconnect. */
  disconnect(): void {
    this.intentionalClose = true;
    this.stopPing();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this._connectionState = 'disconnected';
    this.pendingMessages = [];
  }

  /** Send a typed JSON message to the server. */
  send(action: string, data: Record<string, unknown> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRaw(action, data);
    } else {
      // Queue for when connected
      this.pendingMessages.push({ action, data });
    }
  }

  /** Subscribe to messages of a given action type. Returns unsubscribe function. */
  on(action: string, handler: (data: any) => void): () => void {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, []);
    }
    this.handlers.get(action)!.push(handler);

    return () => {
      const arr = this.handlers.get(action);
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  /** Remove all handlers. */
  removeAllListeners(): void {
    this.handlers.clear();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private sendRaw(action: string, data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...data }));
    }
  }

  private emit(action: string, data: any): void {
    const handlers = this.handlers.get(action);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[ws-client] Handler error for ${action}:`, err);
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
      this.reconnectMaxDelay,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.url).catch(() => {
        // If connect fails, onerror → onclose will schedule next retry
      });
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send('PING', {});
    }, 14_000); // slightly less than server's 15s interval
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
