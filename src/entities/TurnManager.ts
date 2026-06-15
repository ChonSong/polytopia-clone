import { Tribe } from './Tribe';

/**
 * Turn phases for a single tribe's turn.
 * EXPLORE -> BUILD -> MOVE -> ATTACK -> END
 */
export enum TurnPhase {
  EXPLORE = 'EXPLORE',
  BUILD = 'BUILD',
  MOVE = 'MOVE',
  ATTACK = 'ATTACK',
  END = 'END',
}

/** Ordered sequence of phases. */
const PHASE_ORDER: TurnPhase[] = [
  TurnPhase.EXPLORE,
  TurnPhase.BUILD,
  TurnPhase.MOVE,
  TurnPhase.ATTACK,
  TurnPhase.END,
];

/** The action types a player/AI can issue. */
export type ActionType = 'MOVE' | 'ATTACK' | 'BUILD' | 'TRAIN' | 'UPGRADE' | 'RESEARCH';

export interface Action {
  type: ActionType;
  params: Record<string, unknown>;
}

/** Which ActionTypes are legal in each TurnPhase. */
const PHASE_ACTIONS: Record<TurnPhase, ActionType[]> = {
  [TurnPhase.EXPLORE]: [],
  [TurnPhase.BUILD]:   ['BUILD', 'TRAIN', 'UPGRADE', 'RESEARCH'],
  [TurnPhase.MOVE]:    ['MOVE'],
  [TurnPhase.ATTACK]:  ['ATTACK'],
  [TurnPhase.END]:     [],
};

/**
 * Pure-functional turn state machine.
 * Manages the phase of the current tribe's turn and validates actions.
 */
export class TurnManager {
  private phase: TurnPhase;

  constructor(initialPhase: TurnPhase = TurnPhase.EXPLORE) {
    this.phase = initialPhase;
  }

  /** Get the current phase. */
  getPhase(): TurnPhase {
    return this.phase;
  }

  /** Advance to the next phase in the sequence. */
  advancePhase(): TurnPhase {
    const idx = PHASE_ORDER.indexOf(this.phase);
    if (idx >= 0 && idx < PHASE_ORDER.length - 1) {
      this.phase = PHASE_ORDER[idx + 1];
    }
    return this.phase;
  }

  /** Advance all the way to END (for end-of-turn processing). */
  completeTurn(): TurnPhase {
    this.phase = TurnPhase.END;
    return this.phase;
  }

  /** Reset the phase for the next tribe's turn. */
  resetForNextTurn(): void {
    this.phase = TurnPhase.EXPLORE;
  }

  /** Check whether `action` is legal in the current phase. */
  isValidAction(action: Action): boolean {
    return PHASE_ACTIONS[this.phase].includes(action.type);
  }

  /**
   * Determine a winner.
   * A tribe is eliminated when `isDefeated()` returns true (no cities and no alive units).
   * Returns the last remaining tribe, or null if the game is still going.
   */
  checkWinCondition(tribes: Tribe[]): Tribe | null {
    const aliveTribes = tribes.filter(t => !t.isDefeated());

    if (aliveTribes.length === 0) {
      return null; // draw / no winner
    }
    if (aliveTribes.length === 1) {
      return aliveTribes[0]; // winner
    }
    return null; // game continues
  }
}
