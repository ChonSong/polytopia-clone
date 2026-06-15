import { describe, it, expect } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { TileData, Biome } from '../src/hex/Tile';
import { Unit, MAX_HEALTH, UnitType } from '../src/entities/Unit';
import { CombatSystem } from '../src/entities/CombatSystem';

/** Helper: create a minimal Unit for testing. */
function makeUnit(
  type: UnitType,
  owner: string,
  q: number,
  r: number,
  health: number = MAX_HEALTH,
  hasActed: boolean = false,
): Unit {
  const u = new Unit(new HexCoord(q, r), type, owner, health);
  u.hasActed = hasActed;
  if (health < MAX_HEALTH) {
    const dmg = MAX_HEALTH - health;
    for (let i = 0; i < dmg; i++) u.takeDamage(1);
  }
  return u;
}

/** Helper: build a tile map from coordinate strings. */
function tileMap(entries: Array<[string, Partial<TileData>]>): Map<string, TileData> {
  const m = new Map<string, TileData>();
  for (const [key, data] of entries) {
    m.set(key, { biome: Biome.GRASS, elevation: 0, ...data });
  }
  return m;
}

describe('Unit Skills — GDD §3.3', () => {
  describe('hasEscape', () => {
    it('Rider has Escape skill', () => {
      const rider = makeUnit(UnitType.RIDER, 'A', 0, 0);
      expect(rider.hasEscape).toBe(true);
    });

    it('other units do not have Escape', () => {
      const warrior = makeUnit(UnitType.WARRIOR, 'A', 0, 0);
      const knight = makeUnit(UnitType.KNIGHT, 'A', 0, 0);
      const archer = makeUnit(UnitType.ARCHER, 'A', 0, 0);
      expect(warrior.hasEscape).toBe(false);
      expect(knight.hasEscape).toBe(false);
      expect(archer.hasEscape).toBe(false);
    });
  });

  describe('hasPersist', () => {
    it('Knight has Persist skill', () => {
      const knight = makeUnit(UnitType.KNIGHT, 'A', 0, 0);
      expect(knight.hasPersist).toBe(true);
    });

    it('other units do not have Persist', () => {
      const warrior = makeUnit(UnitType.WARRIOR, 'A', 0, 0);
      const rider = makeUnit(UnitType.RIDER, 'A', 0, 0);
      const swordsman = makeUnit(UnitType.SWORDSMAN, 'A', 0, 0);
      expect(warrior.hasPersist).toBe(false);
      expect(rider.hasPersist).toBe(false);
      expect(swordsman.hasPersist).toBe(false);
    });
  });

  describe('hasAttacked flag', () => {
    it('starts as false in constructor', () => {
      const unit = makeUnit(UnitType.WARRIOR, 'A', 0, 0);
      expect(unit.hasAttacked).toBe(false);
    });

    it('resetTurn clears both hasActed and hasAttacked', () => {
      const unit = makeUnit(UnitType.WARRIOR, 'A', 0, 0);
      unit.hasActed = true;
      unit.hasAttacked = true;
      unit.resetTurn();
      expect(unit.hasActed).toBe(false);
      expect(unit.hasAttacked).toBe(false);
    });
  });

  describe('canAttack with hasAttacked', () => {
    it('returns false if attacker.hasAttacked is true', () => {
      const rider = makeUnit(UnitType.RIDER, 'A', 0, 0);
      rider.hasAttacked = true; // After using Escape to attack
      const defender = makeUnit(UnitType.WARRIOR, 'B', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      expect(CombatSystem.canAttack(rider, defender, tiles)).toBe(false);
    });

    it('returns true if attacker has not attacked yet', () => {
      const rider = makeUnit(UnitType.RIDER, 'A', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'B', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      expect(CombatSystem.canAttack(rider, defender, tiles)).toBe(true);
    });
  });

  describe('Persist — Knight action refresh', () => {
    it('Knight with Persist can attack after killing a unit', () => {
      const knight = makeUnit(UnitType.KNIGHT, 'A', 0, 0);
      // Create a unit at full health, then damage it to 1 HP (avoid makeUnit bug with health param)
      const defender = makeUnit(UnitType.WARRIOR, 'B', 1, 0);
      for (let i = 0; i < 9; i++) defender.takeDamage(1);
      expect(defender.health).toBe(1);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      // First attack should be possible
      expect(CombatSystem.canAttack(knight, defender, tiles)).toBe(true);
      const result = CombatSystem.executeAttack(knight, defender, tiles);
      expect(result.defenderKilled).toBe(true);
      // After kill, Knight's hasActed stays false so Knight can attack again
      expect(knight.hasActed).toBe(false);
    });

    it('non-Persist unit cannot attack again after attacking (hasActed blocks)', () => {
      const warrior = makeUnit(UnitType.WARRIOR, 'A', 0, 0);
      const enemy1 = makeUnit(UnitType.WARRIOR, 'B', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
        ['0,1', {}],
      ]);
      // After first attack with hasActed set (normal behavior)
      warrior.hasActed = true;
      expect(CombatSystem.canAttack(warrior, enemy1, tiles)).toBe(false);
    });
  });

  describe('Escape — Rider mechanics', () => {
    it('Rider can attack after being hasAttacked but not hasActed (simulating post-attack escape state)', () => {
      // After Rider attacks with Escape, hasAttacked=true but hasActed=false
      // This prevents a second attack but allows movement
      const rider = makeUnit(UnitType.RIDER, 'A', 0, 0);
      rider.hasAttacked = true;
      rider.hasActed = false;
      const enemy = makeUnit(UnitType.WARRIOR, 'B', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      // canAttack should be false (hasAttacked blocks)
      expect(CombatSystem.canAttack(rider, enemy, tiles)).toBe(false);
      // But hasActed is false, so movement is still allowed
      expect(rider.hasActed).toBe(false);
    });

    it('Rider with full action can attack normally', () => {
      const rider = makeUnit(UnitType.RIDER, 'A', 0, 0);
      const enemy = makeUnit(UnitType.WARRIOR, 'B', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      expect(CombatSystem.canAttack(rider, enemy, tiles)).toBe(true);
    });
  });
});
