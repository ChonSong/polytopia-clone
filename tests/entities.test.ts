import { describe, it, expect } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { Biome } from '../src/hex/Tile';
import { City, BIOME_YIELDS } from '../src/entities/City';
import { Unit, UnitType, UNIT_COSTS, UNIT_BASE_STATS, MAX_HEALTH } from '../src/entities/Unit';
import { BUILDING_DEFS, BuildingType } from '../src/entities/Building';
import { TechId } from '../src/entities/TechTree';
import { Tribe, TRIBE_CONFIGS, TribeConfig } from '../src/entities/Tribe';
import { GameState } from '../src/entities/GameState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createTestTribe(overrides?: Partial<TribeConfig>): Tribe {
  return new Tribe({ ...TRIBE_CONFIGS[0], ...overrides });
}

function coord(q: number, r: number): HexCoord {
  return new HexCoord(q, r);
}

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------
describe('Unit', () => {
  describe('base stat values for each type', () => {
    const cases: Array<{ type: UnitType; atk: number; def: number; mv: number; ranged: boolean; canAtkAfterMove: boolean }> = [
      { type: UnitType.WARRIOR,  atk: 2, def: 2, mv: 1, ranged: false, canAtkAfterMove: true  },
      { type: UnitType.RIDER,    atk: 2, def: 1, mv: 2, ranged: false, canAtkAfterMove: true  },
      { type: UnitType.DEFENDER, atk: 1, def: 3, mv: 1, ranged: false, canAtkAfterMove: true  },
      { type: UnitType.ARCHER,   atk: 2, def: 1, mv: 1, ranged: true,  canAtkAfterMove: false },
      { type: UnitType.CATAPULT, atk: 4, def: 0, mv: 1, ranged: true,  canAtkAfterMove: false },
      { type: UnitType.BOAT,     atk: 2, def: 2, mv: 2, ranged: false, canAtkAfterMove: true  },
      { type: UnitType.SWORDSMAN,atk: 3, def: 3, mv: 1, ranged: false, canAtkAfterMove: true  },
      { type: UnitType.KNIGHT,   atk: 3.5, def: 1, mv: 3, ranged: false, canAtkAfterMove: true  },
      { type: UnitType.GIANT,    atk: 5, def: 4, mv: 1, ranged: false, canAtkAfterMove: true  },
    ];

    for (const { type, atk, def, mv, ranged, canAtkAfterMove } of cases) {
      it(`${type} has atk=${atk} def=${def} move=${mv}`, () => {
        const unit = new Unit(coord(0, 0), type, 'test');
        expect(unit.attack).toBe(atk);
        expect(unit.defense).toBe(def);
        expect(unit.movementRange).toBe(mv);
        expect(unit.ranged).toBe(ranged);
        expect(unit.canAttackAfterMove).toBe(canAtkAfterMove);
      });
    }
  });

  describe('UNIT_COSTS', () => {
    const cases: Array<{ type: UnitType; cost: number }> = [
      { type: UnitType.WARRIOR,  cost: 2 },
      { type: UnitType.RIDER,    cost: 3 },
      { type: UnitType.DEFENDER, cost: 3 },
      { type: UnitType.ARCHER,   cost: 3 },
      { type: UnitType.SWORDSMAN,cost: 5 },
      { type: UnitType.KNIGHT,   cost: 8 },
      { type: UnitType.CATAPULT, cost: 8 },
      { type: UnitType.BOAT,     cost: 5 },
      { type: UnitType.GIANT,    cost: 0 },
    ];
    for (const { type, cost } of cases) {
      it(`${type} costs ${cost}⭐`, () => {
        expect(UNIT_COSTS[type]).toBe(cost);
      });
    }
  });

  it('starts with type-specific max health', () => {
    const warrior = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    expect(warrior.health).toBe(10);
    const defender = new Unit(coord(0, 0), UnitType.DEFENDER, 'test');
    expect(defender.health).toBe(15);
    const swordsman = new Unit(coord(0, 0), UnitType.SWORDSMAN, 'test');
    expect(swordsman.health).toBe(15);
  });

  it('is alive when health > 0', () => {
    const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    expect(unit.isAlive).toBe(true);
    unit.takeDamage(9);
    expect(unit.isAlive).toBe(true);
    unit.takeDamage(1);
    expect(unit.isAlive).toBe(false);
  });

  describe('hasActed tracking', () => {
    it('starts false', () => {
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
      expect(unit.hasActed).toBe(false);
    });

    it('can be set to true after acting', () => {
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
      unit.hasActed = true;
      expect(unit.hasActed).toBe(true);
    });

    it('resetTurn resets hasActed to false', () => {
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
      unit.hasActed = true;
      unit.resetTurn();
      expect(unit.hasActed).toBe(false);
    });
  });

  it('movement range is available via both method and property', () => {
    const rider = new Unit(coord(0, 0), UnitType.RIDER, 'test');
    expect(rider.movementRange).toBe(2);

    const warrior = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    expect(warrior.movementRange).toBe(1);
  });

  it('takeDamage and heal work correctly', () => {
    const unit = new Unit(coord(0, 0), UnitType.DEFENDER, 'test');
    expect(unit.health).toBe(15);
    unit.takeDamage(4);
    expect(unit.health).toBe(11);
    unit.heal(2);
    expect(unit.health).toBe(13);
    unit.heal(10); // should cap at max health (15 for DEFENDER)
    expect(unit.health).toBe(15);
    unit.takeDamage(100); // should floor at 0
    expect(unit.health).toBe(0);
  });

  it('heal respects GDD §4.5: +4 in friendly territory, +2 in neutral, capped at maxHP', () => {
    // Heal +4 from near-death (capping test)
    const unit1 = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    unit1.takeDamage(9); // HP = 1
    unit1.heal(4);
    expect(unit1.health).toBe(5);

    // Heal +2 from near-death
    const unit2 = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    unit2.takeDamage(9); // HP = 1
    unit2.heal(2);
    expect(unit2.health).toBe(3);

    // Cannot exceed max HP (10 for WARRIOR)
    const unit3 = new Unit(coord(0, 0), UnitType.DEFENDER, 'test');
    unit3.takeDamage(2); // HP = 13
    unit3.heal(4);
    expect(unit3.health).toBe(15); // capped

    // Already at max HP — heal has no effect
    const unit4 = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    unit4.heal(4);
    expect(unit4.health).toBe(10); // stays at max
  });
});

// ---------------------------------------------------------------------------
// Buildings (GDD §5.5)
// ---------------------------------------------------------------------------
describe('BUILDING_DEFS (GDD §5.5)', () => {
  const cases: Array<{ type: BuildingType; cost: number; popBonus: number; starsBonus: number }> = [
    { type: BuildingType.LUMBER_HUT, cost: 3,  popBonus: 1, starsBonus: 0 },
    { type: BuildingType.MINE,       cost: 5,  popBonus: 2, starsBonus: 1 },
    { type: BuildingType.FARM,       cost: 5,  popBonus: 2, starsBonus: 0 },
    { type: BuildingType.PORT,       cost: 7,  popBonus: 1, starsBonus: 2 },
  ];
  for (const { type, cost, popBonus, starsBonus } of cases) {
    it(`${type} costs ${cost}⭐, +${popBonus}pop, +${starsBonus}⭐/t`, () => {
      const def = BUILDING_DEFS[type];
      expect(def.cost).toBe(cost);
      expect(def.popBonus).toBe(popBonus);
      expect(def.starsBonus).toBe(starsBonus);
    });
  }

  it('all building names are non-empty', () => {
    for (const def of Object.values(BUILDING_DEFS)) {
      expect(def.name.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tribe
// ---------------------------------------------------------------------------
describe('Tribe', () => {
  it('has the correct initial state', () => {
    const tribe = createTestTribe({ id: 'test-tribe', name: 'Test', color: 0xff0000 });
    expect(tribe.id).toBe('test-tribe');
    expect(tribe.name).toBe('Test');
    expect(tribe.color).toBe(0xff0000);
    expect(tribe.cities).toEqual([]);
    expect(tribe.units).toEqual([]);
    expect(tribe.technologyLevel).toBe(1);
    expect(tribe.stars).toBe(10);
    expect(tribe.starsPerTurn).toBe(5);
  });

  describe('addCity', () => {
    it('adds a city to the tribe', () => {
      const tribe = createTestTribe();
      const city = new City(coord(0, 0), 'Capital', tribe.id);
      tribe.addCity(city);
      expect(tribe.cities).toHaveLength(1);
      expect(tribe.cities[0]).toBe(city);
    });
  });

  describe('addUnit', () => {
    it('adds a unit to the tribe', () => {
      const tribe = createTestTribe();
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, tribe.id);
      tribe.addUnit(unit);
      expect(tribe.units).toHaveLength(1);
      expect(tribe.units[0]).toBe(unit);
    });
  });

  describe('removeUnit', () => {
    it('removes and returns the unit by id', () => {
      const tribe = createTestTribe();
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, tribe.id);
      tribe.addUnit(unit);
      const removed = tribe.removeUnit(unit.id);
      expect(removed).toBe(unit);
      expect(tribe.units).toHaveLength(0);
    });

    it('returns undefined when unit does not exist', () => {
      const tribe = createTestTribe();
      const result = tribe.removeUnit('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('isDefeated', () => {
    it('is true when no cities and no units', () => {
      const tribe = createTestTribe();
      expect(tribe.isDefeated()).toBe(true);
    });

    it('is false when the tribe has a city', () => {
      const tribe = createTestTribe();
      tribe.addCity(new City(coord(0, 0), 'Capital', tribe.id));
      expect(tribe.isDefeated()).toBe(false);
    });

    it('is false when the tribe has an alive unit but no cities', () => {
      const tribe = createTestTribe();
      tribe.addUnit(new Unit(coord(5, 5), UnitType.WARRIOR, tribe.id));
      expect(tribe.isDefeated()).toBe(false);
    });

    it('is true when the only unit is dead and no cities remain', () => {
      const tribe = createTestTribe();
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, tribe.id);
      tribe.addUnit(unit);
      unit.takeDamage(MAX_HEALTH); // kill it
      expect(tribe.isDefeated()).toBe(true);
    });
  });

  describe('getAliveUnits', () => {
    it('filters out dead units', () => {
      const tribe = createTestTribe();
      const alive = new Unit(coord(0, 0), UnitType.WARRIOR, tribe.id);
      const dead = new Unit(coord(1, 0), UnitType.RIDER, tribe.id);
      dead.takeDamage(MAX_HEALTH);
      tribe.addUnit(alive);
      tribe.addUnit(dead);
      expect(tribe.getAliveUnits()).toHaveLength(1);
      expect(tribe.getAliveUnits()[0]).toBe(alive);
    });
  });

  describe('techs', () => {
    it('starts with tribe-specific starting techs', () => {
      const tribe = new Tribe(TRIBE_CONFIGS[0]); // Xin-xi → Riding
      expect(tribe.hasTech(TechId.RIDING)).toBe(true);
      expect(tribe.hasTech(TechId.HUNTING)).toBe(false);
    });

    it('researchTech adds a tech', () => {
      const tribe = createTestTribe();
      // Xin-xi starts with Riding, add another
      const ok = tribe.researchTech(TechId.HUNTING);
      expect(ok).toBe(true);
      expect(tribe.hasTech(TechId.HUNTING)).toBe(true);
    });

    it('researchTech returns false for already-known techs', () => {
      const tribe = createTestTribe();
      const ok = tribe.researchTech(TechId.RIDING);
      expect(ok).toBe(false);
    });

    it('getTrainableUnitTypes includes Warrior and Defender always', () => {
      const tribe = createTestTribe();
      const types = tribe.getTrainableUnitTypes();
      expect(types).toContain(UnitType.WARRIOR);
      expect(types).toContain(UnitType.DEFENDER);
    });

    it('getTrainableUnitTypes includes Archer only after researching Archery', () => {
      const tribe = createTestTribe();
      expect(tribe.getTrainableUnitTypes()).not.toContain(UnitType.ARCHER);
      tribe.researchTech(TechId.HUNTING);
      tribe.researchTech(TechId.ARCHERY);
      expect(tribe.getTrainableUnitTypes()).toContain(UnitType.ARCHER);
    });
  });
});

// ---------------------------------------------------------------------------
// City
// ---------------------------------------------------------------------------
describe('City', () => {
  it('has default level=1 and population=1', () => {
    const city = new City(coord(3, -2), 'Testopolis', 'test');
    expect(city.level).toBe(1);
    expect(city.population).toBe(1);
    expect(city.canBuildUnits).toBe(false); // need level 2+
  });

  it('canBuildUnits is true when level >= 2', () => {
    const city = new City(coord(0, 0), 'Town', 'test', 2, 2);
    expect(city.canBuildUnits).toBe(true);
  });

  describe('canGrow', () => {
    it('returns true when population >= level and level < 5', () => {
      const city = new City(coord(1, 1), 'Grower', 'test', 2, 2);
      expect(city.canGrow()).toBe(true);
    });

    it('returns false when population < level', () => {
      const city = new City(coord(1, 1), 'Stuck', 'test', 3, 2);
      expect(city.canGrow()).toBe(false);
    });

    it('returns false when level is already 5 (max)', () => {
      const city = new City(coord(1, 1), 'Maxed', 'test', 5, 10);
      expect(city.canGrow()).toBe(false);
    });

    it('returns false at level 5 even with high population', () => {
      const city = new City(coord(1, 1), 'Capped', 'test', 5, 99);
      expect(city.canGrow()).toBe(false);
    });
  });

  describe('grow', () => {
    it('increments level and enables unit building at level 2', () => {
      const city = new City(coord(2, 3), 'Growth', 'test', 1, 1);
      city.grow();
      expect(city.level).toBe(2);
      expect(city.canBuildUnits).toBe(true);
    });

    it('does nothing when canGrow is false (low pop)', () => {
      const city = new City(coord(2, 3), 'Stagnant', 'test', 3, 2);
      city.grow();
      expect(city.level).toBe(3);
    });

    it('does nothing at level 5', () => {
      const city = new City(coord(2, 3), 'Maxed', 'test', 5, 5);
      city.grow();
      expect(city.level).toBe(5);
    });
  });

  describe('produceResources', () => {
    it('returns correct yields for mixed biomes', () => {
      const city = new City(coord(0, 0), 'Prod', 'test');
      const res = city.produceResources([
        Biome.GRASS,    // 1f 1s
        Biome.FOREST,   // 2f 0s
        Biome.MOUNTAIN, // 0f 2s
        Biome.WATER,    // 1f 0s
        Biome.SAND,     // 0f 1s
      ]);
      expect(res.food).toBe(4);  // 1+2+0+1+0
      expect(res.stars).toBe(4); // 1+0+2+0+1
    });

    it('returns zeros for empty adjacent list', () => {
      const city = new City(coord(0, 0), 'Isolated', 'test');
      const res = city.produceResources([]);
      expect(res.food).toBe(0);
      expect(res.stars).toBe(0);
    });

    it('does not give any yield for SNOW biome (not in BIOME_YIELDS)', () => {
      const city = new City(coord(0, 0), 'Frozen', 'test');
      const res = city.produceResources([Biome.SNOW]);
      expect(res.food).toBe(0);
      expect(res.stars).toBe(0);
    });

    it('calculates resource from GRASS tiles correctly', () => {
      const city = new City(coord(0, 0), 'Field', 'test');
      const res = city.produceResources([Biome.GRASS, Biome.GRASS, Biome.GRASS]);
      expect(res.food).toBe(3);
      expect(res.stars).toBe(3);
    });
  });

  it('captured flag defaults to false', () => {
    const city = new City(coord(0, 0), 'City', 'test');
    expect(city.captured).toBe(false);
  });

  // ── GDD §5.3 Binary Upgrade Choices ─────────────────────────────────

  describe('upgradeChoices (GDD §5.3)', () => {
    it('starts with no upgrade choices', () => {
      const city = new City(coord(0, 0), 'Plain', 'test');
      expect(city.upgradeChoices).toEqual({});
      expect(city.hasWorkshop).toBe(false);
      expect(city.hasExplorer).toBe(false);
      expect(city.hasCityWall).toBe(false);
      expect(city.hasResources).toBe(false);
      expect(city.hasPopulationGrowth).toBe(false);
      expect(city.hasBorderGrowth).toBe(false);
      expect(city.hasPark).toBe(false);
    });

    it('applyLevelUp tracks the choice at the new level', () => {
      const city = new City(coord(0, 0), 'Choice', 'test', 1, 1);
      city.applyLevelUp('A');
      expect(city.level).toBe(2);
      expect(city.upgradeChoices[2]).toBe('A');
      expect(city.hasWorkshop).toBe(true);
      expect(city.hasExplorer).toBe(false);
    });

    it('applyLevelUp with B sets the other computed property', () => {
      const city = new City(coord(0, 0), 'Explorer', 'test', 1, 1);
      city.applyLevelUp('B');
      expect(city.level).toBe(2);
      expect(city.upgradeChoices[2]).toBe('B');
      expect(city.hasWorkshop).toBe(false);
      expect(city.hasExplorer).toBe(true);
    });

    it('applyLevelUp does nothing when canGrow is false', () => {
      const city = new City(coord(0, 0), 'Stuck', 'test', 3, 2);
      city.applyLevelUp('A');
      expect(city.level).toBe(3);
      expect(city.upgradeChoices).toEqual({});
    });

    it('applyLevelUp at level 5 does nothing', () => {
      const city = new City(coord(0, 0), 'Maxed', 'test', 5, 5);
      city.applyLevelUp('A');
      expect(city.level).toBe(5);
    });

    it('L2 choice sets Workshop getter correctly', () => {
      const city = new City(coord(0, 0), 'W', 'test', 1, 1);
      city.applyLevelUp('A');
      expect(city.hasWorkshop).toBe(true);
      // levelStarsBonus=1 + workshop=1, no biomes or buildings
      expect(city.getStarsPerTurn([])).toBe(2);
    });

    it('L3 choice A sets CityWall', () => {
      const city = new City(coord(0, 0), 'Walled', 'test', 2, 2);
      city.applyLevelUp('A');
      expect(city.level).toBe(3);
      expect(city.hasCityWall).toBe(true);
      expect(city.hasResources).toBe(false);
    });

    it('L3 choice B sets Resources', () => {
      const city = new City(coord(0, 0), 'Rich', 'test', 2, 2);
      city.applyLevelUp('B');
      expect(city.hasResources).toBe(true);
      expect(city.hasCityWall).toBe(false);
    });

    it('L4 choice A sets PopulationGrowth', () => {
      const city = new City(coord(0, 0), 'Pop', 'test', 3, 3);
      city.applyLevelUp('A');
      expect(city.hasPopulationGrowth).toBe(true);
      expect(city.hasBorderGrowth).toBe(false);
    });

    it('L4 choice B sets BorderGrowth', () => {
      const city = new City(coord(0, 0), 'Border', 'test', 3, 3);
      city.applyLevelUp('B');
      expect(city.hasBorderGrowth).toBe(true);
    });

    it('L5 choice A sets Park', () => {
      const city = new City(coord(0, 0), 'Park', 'test', 4, 4);
      city.applyLevelUp('A');
      expect(city.hasPark).toBe(true);
      expect(city.giantSpawned).toBe(false);
    });

    it('L5 choice B does not auto-spawn Giant (flag only)', () => {
      const city = new City(coord(0, 0), 'Giant', 'test', 4, 4);
      city.applyLevelUp('B');
      expect(city.hasPark).toBe(false);
      expect(city.giantSpawned).toBe(false); // Giant is summoned separately via menu
    });

    it('getStarsPerTurn includes Workshop bonus', () => {
      const city = new City(coord(0, 0), 'Workshop', 'test', 1, 1);
      city.applyLevelUp('A'); // Workshop at L2
      // levelStarsBonus = 1, workshop = 1, no buildings, no adjacent biomes
      expect(city.getStarsPerTurn([])).toBe(2);
    });

    it('getStarsPerTurn without Workshop is level bonus only', () => {
      const city = new City(coord(0, 0), 'NoWorkshop', 'test', 1, 1);
      city.applyLevelUp('B'); // Explorer at L2
      expect(city.getStarsPerTurn([])).toBe(1); // just levelStarsBonus
    });

    it('grow() picks a random choice and advances', () => {
      const city = new City(coord(0, 0), 'Random', 'test', 1, 1);
      city.grow();
      expect(city.level).toBe(2);
      expect(city.upgradeChoices[2]).toBeDefined();
      expect(['A', 'B']).toContain(city.upgradeChoices[2]);
    });
  });
});

// ---------------------------------------------------------------------------
// GameState
// ---------------------------------------------------------------------------
describe('GameState', () => {
  function createGameWithFourTribes(): GameState {
    const tribes = TRIBE_CONFIGS.map(c => new Tribe(c));
    // Give each tribe a capital so they're not defeated at start
    tribes.forEach((t, i) => {
      t.addCity(new City(coord(i * 3, 0), `Capital`, t.id));
    });
    return new GameState(tribes);
  }

  describe('initial state', () => {
    it('starts at turn 1 and currentTribeIndex 0', () => {
      const gs = createGameWithFourTribes();
      expect(gs.turn).toBe(1);
      expect(gs.currentTribeIndex).toBe(0);
    });

    it('getCurrentTribe returns the first tribe', () => {
      const gs = createGameWithFourTribes();
      expect(gs.getCurrentTribe().id).toBe('xin-xi');
    });
  });

  describe('nextTurn', () => {
    it('advances currentTribeIndex by 1', () => {
      const gs = createGameWithFourTribes();
      gs.nextTurn();
      expect(gs.currentTribeIndex).toBe(1);
      expect(gs.getCurrentTribe().id).toBe('imperius');
    });

    it('increments turn after all tribes have gone', () => {
      const gs = createGameWithFourTribes();
      gs.nextTurn(); // imperius (1)
      gs.nextTurn(); // bardur   (2)
      gs.nextTurn(); // oumaji   (3)  — still turn 1
      expect(gs.turn).toBe(1);
      gs.nextTurn(); // wrap to xin-xi (0) — now turn 2
      expect(gs.turn).toBe(2);
      expect(gs.currentTribeIndex).toBe(0);
    });

    it('skips defeated tribes', () => {
      const tribes = TRIBE_CONFIGS.map(c => new Tribe(c));
      // Only xin-xi (0) and oumaji (3) have cities
      tribes[0].addCity(new City(coord(0, 0), 'Capital', tribes[0].id));
      tribes[3].addCity(new City(coord(5, 5), 'Capital', tribes[3].id));
      // imperius (1) and bardur (2) are defeated
      const gs = new GameState(tribes);

      expect(gs.getCurrentTribe().id).toBe('xin-xi');
      gs.nextTurn(); // should skip 1,2 → land on 3 (oumaji)
      expect(gs.getCurrentTribe().id).toBe('oumaji');
      gs.nextTurn(); // wrap back to 0 → turn 2
      expect(gs.getCurrentTribe().id).toBe('xin-xi');
      expect(gs.turn).toBe(2);
    });

    it('resets hasActed on all units of the active tribe', () => {
      const gs = createGameWithFourTribes();
      const first = gs.getCurrentTribe();
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, first.id);
      first.addUnit(unit);
      unit.hasActed = true; // simulate having acted

      // advance through all 4 tribes so we come back to first
      gs.nextTurn(); // imperius
      gs.nextTurn(); // bardur
      gs.nextTurn(); // oumaji
      expect(unit.hasActed).toBe(true); // not reset yet — different tribe
      gs.nextTurn(); // back to xin-xi (turn 2)
      expect(unit.hasActed).toBe(false); // reset
    });
  });

  describe('tile ownership', () => {
    it('stores and retrieves tile ownership', () => {
      const gs = createGameWithFourTribes();
      gs.setTileOwner(coord(2, 3), 'xin-xi');
      expect(gs.getTileOwner(coord(2, 3))).toBe('xin-xi');
    });

    it('returns undefined for unowned tiles', () => {
      const gs = createGameWithFourTribes();
      expect(gs.getTileOwner(coord(99, 99))).toBeUndefined();
    });
  });

  describe('tile visibility', () => {
    it('marks tiles as visible', () => {
      const gs = createGameWithFourTribes();
      gs.setTileVisibility(coord(5, 5), true);
      expect(gs.isTileVisible(coord(5, 5), 'xin-xi')).toBe(true);
    });

    it('returns false for tiles that have not been revealed', () => {
      const gs = createGameWithFourTribes();
      expect(gs.isTileVisible(coord(10, 10), 'xin-xi')).toBe(false);
    });

    it('getVisibleTiles filters correctly', () => {
      const gs = createGameWithFourTribes();
      const tiles = [coord(0, 0), coord(1, 1), coord(2, 2)];
      gs.setTileVisibility(coord(0, 0), true);
      gs.setTileVisibility(coord(2, 2), true);
      const visible = gs.getVisibleTiles('xin-xi', tiles);
      expect(visible).toHaveLength(2);
      expect(visible[0].toString()).toBe('0,0');
      expect(visible[1].toString()).toBe('2,2');
    });
  });

  it('maintains tileOwnership as a Map with string keys', () => {
    const gs = createGameWithFourTribes();
    expect(gs.tileOwnership).toBeInstanceOf(Map);
    gs.setTileOwner(coord(0, 0), 'bardur');
    expect(gs.tileOwnership.get('0,0')).toBe('bardur');
  });
});
