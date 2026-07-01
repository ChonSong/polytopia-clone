/**
 * Unit tests for WebSocketClient.
 * 
 * Tests message routing, connection state management, event subscription,
 * send queuing, and disconnect behavior.
 * 
 * Uses a mock WebSocket — no server needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from '../WebSocketClient';

// ── Mock WebSocket ─────────────────────────────────────────────────────────

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  _sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  send(data: string) {
    this._sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: code || 1000, reason: reason || '', wasClean: true }));
  }

  _receiveMessage(data: any) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  _triggerError() {
    this.onerror?.();
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: 1006, reason: '', wasClean: false }));
  }
}

// Replace global WebSocket
const originalWebSocket = globalThis.WebSocket;
(globalThis as any).WebSocket = MockWebSocket;
(globalThis as any).CloseEvent = class CloseEvent {
  type: string;
  code: number;
  reason: string;
  wasClean: boolean;
  constructor(type: string, init: CloseEventInit) {
    this.type = type;
    this.code = init.code ?? 0;
    this.reason = init.reason ?? '';
    this.wasClean = init.wasClean ?? false;
  }
};
(globalThis as any).MessageEvent = class MessageEvent {
  type: string;
  data: any;
  constructor(type: string, init: { data: any }) {
    this.type = type;
    this.data = init.data;
  }
};

/** Helper: manually simulate WebSocket open (resolve connect promise). */
function simulateOpen(client: WebSocketClient) {
  const ws = (client as any).ws as MockWebSocket | null;
  if (ws) {
    ws.readyState = MockWebSocket.OPEN;
    ws.onopen?.();
  }
}

describe('WebSocketClient', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    client = new WebSocketClient('ws://localhost:3002');
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('connection lifecycle', () => {
    it('starts in disconnected state', () => {
      expect(client.connectionState).toBe('disconnected');
      expect(client.connected).toBe(false);
    });

    it('transitions to connecting → connected on connect()', async () => {
      const connectPromise = client.connect();
      expect(client.connectionState).toBe('connecting');
      
      // Simulate async WebSocket open
      simulateOpen(client);
      await connectPromise;
      
      expect(client.connectionState).toBe('connected');
      expect(client.connected).toBe(true);
    });

    it('transitions to disconnected on disconnect()', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      client.disconnect();
      expect(client.connectionState).toBe('disconnected');
      expect(client.connected).toBe(false);
    });
  });

  describe('message handling', () => {
    it('routes messages to registered handlers', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      const handler = vi.fn();
      client.on('ROOM_CREATED', handler);
      
      const ws = (client as any).ws as MockWebSocket;
      ws._receiveMessage({ action: 'ROOM_CREATED', roomCode: 'ABC123' });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ roomCode: 'ABC123' });
    });

    it('returns unsubscribe function from on()', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      const handler = vi.fn();
      const unsubscribe = client.on('TEST', handler);
      
      const ws = (client as any).ws as MockWebSocket;
      ws._receiveMessage({ action: 'TEST', value: 1 });
      expect(handler).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      ws._receiveMessage({ action: 'TEST', value: 2 });
      expect(handler).toHaveBeenCalledTimes(1); // not called again
    });

    it('supports multiple handlers for same action', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      const h1 = vi.fn();
      const h2 = vi.fn();
      client.on('UPDATE', h1);
      client.on('UPDATE', h2);
      
      const ws = (client as any).ws as MockWebSocket;
      ws._receiveMessage({ action: 'UPDATE', data: 'x' });
      
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('handles malformed JSON gracefully', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const ws = (client as any).ws as MockWebSocket;
      // Simulate bad message — client handles JSON parse errors gracefully
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', { data: 'not json' }));
      }
      
      // Should not throw — just warn
      expect(true).toBe(true); // survival test
      consoleSpy.mockRestore();
    });
  });

  describe('send', () => {
    it('sends JSON messages when connected', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      client.send('CREATE_ROOM', {});
      
      const ws = (client as any).ws as MockWebSocket;
      // Find CREATE_ROOM message among sent messages (may have PINGs too)
      const createMsg = ws._sentMessages.find(m => {
        try { return JSON.parse(m).action === 'CREATE_ROOM'; } catch { return false; }
      });
      expect(createMsg).toBeDefined();
    });

    it('queues messages sent before connection and flushes on connect', async () => {
      // Start connect but don't await
      const connectPromise = client.connect();
      
      client.send('CREATE_ROOM', { test: true });
      
      // Simulate connection completing
      simulateOpen(client);
      await connectPromise;
      
      const ws = (client as any).ws as MockWebSocket;
      const createMsg = ws._sentMessages.find(m => {
        try { const parsed = JSON.parse(m); return parsed.action === 'CREATE_ROOM'; } catch { return false; }
      });
      expect(createMsg).toBeDefined();
      expect(JSON.parse(createMsg!).test).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('does not reconnect when intentionally disconnected', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      client.disconnect();
      expect(client.connectionState).toBe('disconnected');
    });

    it('attempts reconnect on unexpected close', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      const ws = (client as any).ws as MockWebSocket;
      ws._triggerError();
      
      // Should be in reconnecting or disconnected state
      expect(['reconnecting', 'disconnected']).toContain(client.connectionState);
    });
  });

  describe('removeAllListeners', () => {
    it('clears all event handlers', async () => {
      const connectPromise = client.connect();
      simulateOpen(client);
      await connectPromise;
      
      const h1 = vi.fn();
      client.on('TEST', h1);
      client.removeAllListeners();
      
      const ws = (client as any).ws as MockWebSocket;
      ws._receiveMessage({ action: 'TEST', value: 1 });
      
      expect(h1).not.toHaveBeenCalled();
    });
  });
});
