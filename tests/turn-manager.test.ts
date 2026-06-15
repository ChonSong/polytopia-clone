import { describe, it, expect, beforeEach } from 'vitest';
import { TurnManager, TurnPhase, Action } from '../src/entities/TurnManager';
import { Tribe } from '../src/entities/Tribe';
import { HexCoord } from '../src/hex/HexCoord';
import { City } from '../src/entities/City';

function makeTribe(id: string, cityCount: number = 1, unitCount: number = 0): Tribe {
  const tribe = new Tribe({ id, name: id, color: 0xffffff });
  for (let i = 0; i < cityCount; i++) {
    tribe.cities.push(new City(new HexCoord(i * 3, i * 3), `${id}-city-${i}`, id));
  }
  return tribe;
}

describe('TurnManager', () => {
  let tm: TurnManager;

  beforeEach(() => {
    tm = new TurnManager();
  });

  // -----------------------------------------------------------------------
  // Phase lifecycle
  // -----------------------------------------------------------------------

  it('starts in EXPLORE phase', () => {
    expect(tm.getPhase()).toBe(TurnPhase.EXPLORE);
  });

  it('advances through all phases in order', () => {
    expect(tm.getPhase()).toBe(TurnPhase.EXPLORE);

    tm.advancePhase();
    expect(tm.getPhase()).toBe(TurnPhase.BUILD);

    tm.advancePhase();
    expect(tm.getPhase()).toBe(TurnPhase.MOVE);

    tm.advancePhase();
    expect(tm.getPhase()).toBe(TurnPhase.ATTACK);

    tm.advancePhase();
    expect(tm.getPhase()).toBe(TurnPhase.END);
  });

  it('stays at END when advancing past last phase', () => {
    tm.advancePhase(); // EXPLORE -> BUILD
    tm.advancePhase(); // BUILD -> MOVE
    tm.advancePhase(); // MOVE -> ATTACK
    tm.advancePhase(); // ATTACK -> END
    expect(tm.getPhase()).toBe(TurnPhase.END);

    tm.advancePhase();
    expect(tm.getPhase()).toBe(TurnPhase.END); // stays at END
  });

  it('completeTurn jumps to END phase', () => {
    tm.completeTurn();
    expect(tm.getPhase()).toBe(TurnPhase.END);
  });

  it('resetForNextTurn returns to EXPLORE', () => {
    tm.completeTurn();
    expect(tm.getPhase()).toBe(TurnPhase.END);

    tm.resetForNextTurn();
    expect(tm.getPhase()).toBe(TurnPhase.EXPLORE);
  });

  // -----------------------------------------------------------------------
  // Action validation
  // -----------------------------------------------------------------------

  it('disallows any action in EXPLORE phase', () => {
    const actions: Action[] = [
      { type: 'MOVE', params: {} },
      { type: 'ATTACK', params: {} },
      { type: 'BUILD', params: {} },
      { type: 'TRAIN', params: {} },
      { type: 'UPGRADE', params: {} },
    ];
    for (const a of actions) {
      expect(tm.isValidAction(a)).toBe(false);
    }
  });

  it('allows BUILD/TRAIN/UPGRADE in BUILD phase', () => {
    tm.advancePhase(); // -> BUILD
    expect(tm.isValidAction({ type: 'BUILD', params: {} })).toBe(true);
    expect(tm.isValidAction({ type: 'TRAIN', params: {} })).toBe(true);
    expect(tm.isValidAction({ type: 'UPGRADE', params: {} })).toBe(true);
    expect(tm.isValidAction({ type: 'MOVE', params: {} })).toBe(false);
    expect(tm.isValidAction({ type: 'ATTACK', params: {} })).toBe(false);
  });

  it('allows only MOVE in MOVE phase', () => {
    tm.advancePhase(); // -> BUILD
    tm.advancePhase(); // -> MOVE
    expect(tm.isValidAction({ type: 'MOVE', params: {} })).toBe(true);
    expect(tm.isValidAction({ type: 'ATTACK', params: {} })).toBe(false);
    expect(tm.isValidAction({ type: 'BUILD', params: {} })).toBe(false);
    expect(tm.isValidAction({ type: 'TRAIN', params: {} })).toBe(false);
    expect(tm.isValidAction({ type: 'UPGRADE', params: {} })).toBe(false);
  });

  it('allows only ATTACK in ATTACK phase', () => {
    tm.advancePhase(); // -> BUILD
    tm.advancePhase(); // -> MOVE
    tm.advancePhase(); // -> ATTACK
    expect(tm.isValidAction({ type: 'ATTACK', params: {} })).toBe(true);
    expect(tm.isValidAction({ type: 'MOVE', params: {} })).toBe(false);
    expect(tm.isValidAction({ type: 'BUILD', params: {} })).toBe(false);
  });

  it('disallows any action in END phase', () => {
    tm.completeTurn();
    const actions: Action[] = [
      { type: 'MOVE', params: {} },
      { type: 'ATTACK', params: {} },
      { type: 'BUILD', params: {} },
      { type: 'TRAIN', params: {} },
      { type: 'UPGRADE', params: {} },
    ];
    for (const a of actions) {
      expect(tm.isValidAction(a)).toBe(false);
    }
  });

  // -----------------------------------------------------------------------
  // Win condition
  // -----------------------------------------------------------------------

  it('returns null when multiple tribes are alive with cities', () => {
    const tribes = [makeTribe('t1'), makeTribe('t2')];
    expect(tm.checkWinCondition(tribes)).toBeNull();
  });

  it('returns the winning tribe when only one remains', () => {
    const winner = makeTribe('t1', 1, 0); // has a city => not defeated
    const loser = makeTribe('t2', 0, 0);  // no cities, no units => defeated
    expect(tm.checkWinCondition([winner, loser])).toBe(winner);
  });

  it('returns null for a draw when all tribes are defeated', () => {
    const t1 = makeTribe('t1', 0, 0); // no cities, no units
    const t2 = makeTribe('t2', 0, 0);
    expect(tm.checkWinCondition([t1, t2])).toBeNull();
  });

  it('returns null when all alive tribes have no cities and no units', () => {
    const t1 = makeTribe('t1', 0, 0);
    const t2 = makeTribe('t2', 0, 0);
    expect(tm.checkWinCondition([t1, t2])).toBeNull();
  });

  it('detects no win mid-game with multiple tribes alive', () => {
    const tribes = [
      makeTribe('red', 1),
      makeTribe('blue', 1),
      makeTribe('green', 1),
    ];
    expect(tm.checkWinCondition(tribes)).toBeNull();
  });

  it('detects win when enemy has lost all cities', () => {
    const winner = makeTribe('t1', 2); // 2 cities
    const loser = makeTribe('t2', 0);  // no cities => defeated
    expect(tm.checkWinCondition([winner, loser])).toBe(winner);
  });
});
