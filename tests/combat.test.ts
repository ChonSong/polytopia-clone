import { describe, it, expect } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { TileData, Biome } from '../src/hex/Tile';
import { Unit, MAX_HEALTH, UnitType, UNIT_BASE_STATS } from '../src/entities/Unit';
import { CityData } from '../src/entities/CityData';
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
  // Mutate health for non-default values
  if (health < MAX_HEALTH) {
    // Unit constructor sets health; we use takeDamage to reduce
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

describe('CombatSystem', () => {
  describe('canAttack', () => {
    it('returns true for adjacent units of different tribes', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(true);
    });

    it('returns false for same tribe', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeA', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(false);
    });

    it('returns false if attacker has already acted', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0, MAX_HEALTH, true);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(false);
    });

    it('returns false if either unit is dead', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(false);
    });

    it('returns false if units are not adjacent (melee)', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 2, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['2,0', {}],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(false);
    });

    it('allows ranged units to attack from distance 2', () => {
      const attacker = makeUnit(UnitType.ARCHER, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 2, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
        ['2,0', {}],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(true);
    });

    it('denies ranged attack from distance 3', () => {
      const attacker = makeUnit(UnitType.ARCHER, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 3, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
        ['2,0', {}],
        ['3,0', {}],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(false);
    });

    it('allows BOAT attack only when both are on WATER tiles', () => {
      const attacker = makeUnit(UnitType.BOAT, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.BOAT, 'TribeB', 1, 0);
      const tiles = tileMap([
        ['0,0', { biome: Biome.WATER }],
        ['1,0', { biome: Biome.WATER }],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(true);
    });

    it('denies BOAT attack if one unit is not on WATER', () => {
      const attacker = makeUnit(UnitType.BOAT, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.BOAT, 'TribeB', 1, 0);
      const tiles = tileMap([
        ['0,0', { biome: Biome.WATER }],
        ['1,0', { biome: Biome.GRASS }],
      ]);
      expect(CombatSystem.canAttack(attacker, defender, tiles)).toBe(false);
    });
  });

  describe('calculateDamage', () => {
    it('produces damage in valid range for warrior vs warrior', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const tile: TileData = { biome: Biome.GRASS, elevation: 0 };
      const dmg = CombatSystem.calculateDamage(attacker, defender, tile, 1);
      expect(dmg).toBeGreaterThanOrEqual(1);
      // Real formula: warrior vs warrior on grass = 5 damage
      expect(dmg).toBe(5);
    });

    it('applies terrain defense bonus on FOREST', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const forestTile: TileData = { biome: Biome.FOREST, elevation: 0 };
      const grassTile: TileData = { biome: Biome.GRASS, elevation: 0 };

      const grassDmg = CombatSystem.calculateDamage(attacker, defender, grassTile, 1);
      const forestDmg = CombatSystem.calculateDamage(attacker, defender, forestTile, 1);

      // Damage on forest should be <= damage on grass (defense bonus reduces damage)
      expect(forestDmg).toBeLessThanOrEqual(grassDmg);
    });

    it('applies terrain defense bonus on MOUNTAIN', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const mountainTile: TileData = { biome: Biome.MOUNTAIN, elevation: 0 };
      const grassTile: TileData = { biome: Biome.GRASS, elevation: 0 };

      const grassDmg = CombatSystem.calculateDamage(attacker, defender, grassTile, 1);
      const mountainDmg = CombatSystem.calculateDamage(attacker, defender, mountainTile, 1);

      expect(mountainDmg).toBeLessThanOrEqual(grassDmg);
    });

    it('applies terrain defense bonus on CITY tiles', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const cityTile: TileData = { biome: Biome.GRASS, elevation: 0, city: true };
      const grassTile: TileData = { biome: Biome.GRASS, elevation: 0 };

      const grassDmg = CombatSystem.calculateDamage(attacker, defender, grassTile, 1);
      const cityDmg = CombatSystem.calculateDamage(attacker, defender, cityTile, 1);

      expect(cityDmg).toBeLessThanOrEqual(grassDmg);
    });

    it('applies ranged penalty at distance 2', () => {
      const attacker = makeUnit(UnitType.ARCHER, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const tile: TileData = { biome: Biome.GRASS, elevation: 0 };

      const meleeDmg = CombatSystem.calculateDamage(attacker, defender, tile, 1);
      const rangedDmg = CombatSystem.calculateDamage(attacker, defender, tile, 2);

      expect(rangedDmg).toBeLessThanOrEqual(meleeDmg);
    });

    it('damage increases when defender has low health', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const fullDefender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0, MAX_HEALTH);
      const hurtDefender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0, 3);
      const tile: TileData = { biome: Biome.GRASS, elevation: 0 };

      const fullDmg = CombatSystem.calculateDamage(attacker, fullDefender, tile, 1);
      const hurtDmg = CombatSystem.calculateDamage(attacker, hurtDefender, tile, 1);

      expect(hurtDmg).toBeGreaterThanOrEqual(fullDmg);
    });

    it('damage decreases when attacker has low health', () => {
      const fullAttacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0, MAX_HEALTH);
      const hurtAttacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0, 4);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const tile: TileData = { biome: Biome.GRASS, elevation: 0 };

      const fullDmg = CombatSystem.calculateDamage(fullAttacker, defender, tile, 1);
      const hurtDmg = CombatSystem.calculateDamage(hurtAttacker, defender, tile, 1);

      expect(hurtDmg).toBeLessThanOrEqual(fullDmg);
    });
  });

  describe('executeAttack', () => {
    it('both units deal damage simultaneously', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);

      const result = CombatSystem.executeAttack(attacker, defender, tiles);

      // Both should deal damage
      expect(result.attackerDamage).toBeGreaterThan(0);
      expect(result.defenderDamage).toBeGreaterThan(0);
      // Neither should be killed at full health
      expect(result.attackerKilled).toBe(false);
      expect(result.defenderKilled).toBe(false);
    });

    it('defender does not counter-attack at range 2', () => {
      const attacker = makeUnit(UnitType.ARCHER, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 2, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
        ['2,0', {}],
      ]);

      const result = CombatSystem.executeAttack(attacker, defender, tiles);

      expect(result.defenderDamage).toBeGreaterThan(0); // Attacker hits defender
      expect(result.attackerDamage).toBe(0); // No counter at range 2
    });

    it('marks defender as killed when health reaches 0', () => {
      const attacker = makeUnit(UnitType.CATAPULT, 'TribeA', 0, 0);
      // Defender with very low health
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 1, 0, 1);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);

      const result = CombatSystem.executeAttack(attacker, defender, tiles);

      expect(result.defenderKilled).toBe(true);
    });
  });

  describe('city capture', () => {
    it('canAttackCity returns true for adjacent attacker', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const city: CityData = { owner: 'TribeB', health: 10, maxHealth: 10, defenseBonus: 2, q: 1, r: 0 };

      expect(CombatSystem.canAttackCity(attacker, city)).toBe(true);
    });

    it('canAttackCity returns false for same owner', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const city: CityData = { owner: 'TribeA', health: 10, maxHealth: 10, defenseBonus: 2, q: 1, r: 0 };

      expect(CombatSystem.canAttackCity(attacker, city)).toBe(false);
    });

    it('city health decreases after assault', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const city: CityData = { owner: 'TribeB', health: 10, maxHealth: 10, defenseBonus: 2, q: 1, r: 0 };
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);

      const result = CombatSystem.executeCityAttack(attacker, city, tiles);

      expect(result.cityDamage).toBeGreaterThan(0);
      // After applying damage
      const newHealth = city.health - result.cityDamage;
      expect(newHealth).toBeLessThan(city.health);
    });

    it('city ownership transfers when health reaches 0', () => {
      const attacker = makeUnit(UnitType.CATAPULT, 'TribeA', 0, 0);
      // City with only 2 health remaining
      const city: CityData = { owner: 'TribeB', health: 2, maxHealth: 10, defenseBonus: 2, q: 1, r: 0 };
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);

      const result = CombatSystem.executeCityAttack(attacker, city, tiles);

      expect(result.cityCaptured).toBe(true);
    });

    it('city is not captured if health remains above 0', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const city: CityData = { owner: 'TribeB', health: 10, maxHealth: 10, defenseBonus: 2, q: 1, r: 0 };
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
      ]);

      const result = CombatSystem.executeCityAttack(attacker, city, tiles);

      expect(result.cityCaptured).toBe(false);
    });
  });

  describe('ranged line of sight', () => {
    it('canRangedAttack returns true with clear line of sight', () => {
      const attacker = makeUnit(UnitType.ARCHER, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 2, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
        ['2,0', {}],
      ]);

      expect(CombatSystem.canRangedAttack(attacker, defender, tiles)).toBe(true);
    });

    it('canRangedAttack returns false when a mountain blocks LOS', () => {
      const attacker = makeUnit(UnitType.ARCHER, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 2, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', { biome: Biome.MOUNTAIN }],
        ['2,0', {}],
      ]);

      expect(CombatSystem.canRangedAttack(attacker, defender, tiles)).toBe(false);
    });

    it('canRangedAttack returns false for non-ranged units', () => {
      const attacker = makeUnit(UnitType.WARRIOR, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 2, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
        ['2,0', {}],
      ]);

      expect(CombatSystem.canRangedAttack(attacker, defender, tiles)).toBe(false);
    });

    it('canRangedAttack returns false for distance > 2', () => {
      const attacker = makeUnit(UnitType.ARCHER, 'TribeA', 0, 0);
      const defender = makeUnit(UnitType.WARRIOR, 'TribeB', 3, 0);
      const tiles = tileMap([
        ['0,0', {}],
        ['1,0', {}],
        ['2,0', {}],
        ['3,0', {}],
      ]);

      expect(CombatSystem.canRangedAttack(attacker, defender, tiles)).toBe(false);
    });
  });
});
