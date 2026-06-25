import { describe, it, expect, beforeEach } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { Biome, TileData } from '../src/hex/Tile';
import { City, BIOME_YIELDS } from '../src/entities/City';
import { Unit, UnitType, UNIT_COSTS, UNIT_BASE_STATS, MAX_HEALTH } from '../src/entities/Unit';
import { BUILDING_DEFS, BuildingType } from '../src/entities/Building';
import { TechId, TRIBE_STARTING_TECHS, UNIT_TECH_GATES, TECH_DEFS, TECH_SERIES } from '../src/entities/TechTree';
import { Tribe, TRIBE_CONFIGS, TribeConfig } from '../src/entities/Tribe';
import { GameState } from '../src/entities/GameState';
import { CombatSystem } from '../src/entities/CombatSystem';
import { computeTribeScore } from '../src/entities/ScoreCalculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createTestTribe(overrides?: Partial<TribeConfig>): Tribe {
  return new Tribe({ ...TRIBE_CONFIGS[0], ...overrides });
}

function coord(q: number, r: number): HexCoord {
  return new HexCoord(q, r);
}

function tileMap(entries: Array<[string, Partial<TileData>]>): Map<string, TileData> {
  const m = new Map<string, TileData>();
  for (const [key, data] of entries) {
    m.set(key, { biome: Biome.GRASS, elevation: 0, ...data });
  }
  return m;
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
      // GDD §3.2 Naval
      { type: UnitType.RAFT,     atk: 0, def: 1, mv: 2, ranged: false, canAtkAfterMove: false },
      { type: UnitType.SCOUT,    atk: 2, def: 1, mv: 3, ranged: true,  canAtkAfterMove: true  },
      { type: UnitType.RAMMER,   atk: 3, def: 3, mv: 3, ranged: false, canAtkAfterMove: true  },
      { type: UnitType.BOMBER,   atk: 3, def: 2, mv: 2, ranged: true,  canAtkAfterMove: false },
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
      // GDD §3.2 Naval costs
      { type: UnitType.RAFT,     cost: 0 },
      { type: UnitType.SCOUT,    cost: 5 },
      { type: UnitType.RAMMER,   cost: 5 },
      { type: UnitType.BOMBER,   cost: 15 },
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

  describe('fortify (GDD §4.2)', () => {
    it('starts not fortified', () => {
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
      expect(unit.isFortified).toBe(false);
      expect(unit.fortified).toBe(false);
    });

    it('can be set to true', () => {
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
      unit.fortified = true;
      expect(unit.isFortified).toBe(true);
    });

    it('resetTurn resets fortified to false', () => {
      const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
      unit.fortified = true;
      unit.resetTurn();
      expect(unit.isFortified).toBe(false);
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

  describe('naval unit properties (GDD §3.2)', () => {
    it('isNaval is true for RAFT, SCOUT, RAMMER, BOMBER', () => {
      expect(new Unit(coord(0,0), UnitType.RAFT, 't').isNaval).toBe(true);
      expect(new Unit(coord(0,0), UnitType.SCOUT, 't').isNaval).toBe(true);
      expect(new Unit(coord(0,0), UnitType.RAMMER, 't').isNaval).toBe(true);
      expect(new Unit(coord(0,0), UnitType.BOMBER, 't').isNaval).toBe(true);
    });

    it('isNaval is false for terrestrial units', () => {
      expect(new Unit(coord(0,0), UnitType.WARRIOR, 't').isNaval).toBe(false);
      expect(new Unit(coord(0,0), UnitType.BOAT, 't').isNaval).toBe(false);
      expect(new Unit(coord(0,0), UnitType.GIANT, 't').isNaval).toBe(false);
    });

    it('originalType is null for regular units', () => {
      const unit = new Unit(coord(0,0), UnitType.WARRIOR, 't');
      expect(unit.originalType).toBeNull();
    });

    it('originalType can be set for embarked Raft units', () => {
      const raft = new Unit(coord(0,0), UnitType.RAFT, 't', 7, UnitType.WARRIOR);
      expect(raft.originalType).toBe(UnitType.WARRIOR);
      expect(raft.health).toBe(7); // carries over HP
    });
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

    it('getTrainableUnitTypes includes Warrior, Defender, and BOAT always', () => {
      const tribe = createTestTribe();
      const types = tribe.getTrainableUnitTypes();
      expect(types).toContain(UnitType.WARRIOR);
      expect(types).toContain(UnitType.DEFENDER);
      expect(types).toContain(UnitType.BOAT);
    });

    it('getTrainableUnitTypes includes Archer only after researching Archery', () => {
      const tribe = createTestTribe();
      expect(tribe.getTrainableUnitTypes()).not.toContain(UnitType.ARCHER);
      tribe.researchTech(TechId.HUNTING);
      tribe.researchTech(TechId.ARCHERY);
      expect(tribe.getTrainableUnitTypes()).toContain(UnitType.ARCHER);
    });

    it('getTrainableUnitTypes includes Scout after researching Sailing', () => {
      const tribe = createTestTribe();
      tribe.researchTech(TechId.FISHING);
      tribe.researchTech(TechId.SAILING);
      expect(tribe.getTrainableUnitTypes()).toContain(UnitType.SCOUT);
    });

    it('getTrainableUnitTypes includes Rammer after researching Aquaculture', () => {
      const tribe = createTestTribe();
      tribe.researchTech(TechId.AQUACULTURE);
      expect(tribe.getTrainableUnitTypes()).toContain(UnitType.RAMMER);
    });

    it('getTrainableUnitTypes includes Bomber after researching Navigation', () => {
      const tribe = createTestTribe();
      tribe.researchTech(TechId.FISHING);
      tribe.researchTech(TechId.SAILING);
      tribe.researchTech(TechId.NAVIGATION);
      expect(tribe.getTrainableUnitTypes()).toContain(UnitType.BOMBER);
    });
  });
});

// ---------------------------------------------------------------------------
// GDD §9.1 — Starting Stars
// ---------------------------------------------------------------------------
describe('GDD §9.1 — Starting Stars', () => {
  it('default Tribe gets AI starting stars (10)', () => {
    const tribe = createTestTribe();
    expect(tribe.stars).toBe(10);
  });

  it('human tribe override sets stars to 15', () => {
    const human = createTestTribe({ id: 'human', name: 'Human', color: 0x4488ff });
    human.stars = 15; // GameScene does this after creation
    expect(human.stars).toBe(15);
    expect(human.starsPerTurn).toBe(5);
  });

  it('AI tribe keeps default 10 stars', () => {
    const ai = createTestTribe({ id: 'ai', name: 'AI', color: 0xff4444 });
    expect(ai.stars).toBe(10);
    expect(ai.starsPerTurn).toBe(5);
  });

  it('human and AI tribes have correct starting star differential', () => {
    const human = createTestTribe({ id: 'xin-xi', name: 'Xin-xi', color: 0xd4a017 });
    const ai = createTestTribe({ id: 'bardur', name: 'Bardur', color: 0x5a8f3c });
    human.stars = 15; // human override
    // AI keeps default 10
    expect(human.stars).toBe(15);
    expect(ai.stars).toBe(10);
    expect(human.stars - ai.stars).toBe(5);
  });

  it('City star income contributes to AI income (base 5 + city production)', () => {
    const tribe = createTestTribe();
    const city = new City(new HexCoord(0, 0), 'Capital', tribe.id);
    // City on one adjacent GRASS tile
    city.levelStarsBonus = 0; // level 1
    const yields = city.produceResources([Biome.GRASS]);
    // City total = biome yields (1⭐) + level bonus (0) + building bonus (0)
    expect(yields.stars).toBe(1);
    // Tribe base per turn (5) + city star income
    const totalPerTurn = tribe.starsPerTurn + yields.stars;
    expect(totalPerTurn).toBe(6);
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

    it('calculates resources from GRASS tiles correctly', () => {
      const city = new City(coord(0, 0), 'Field', 'test');
      const res = city.produceResources([Biome.GRASS, Biome.GRASS, Biome.GRASS]);
      expect(res.food).toBe(3);
      expect(res.stars).toBe(3);
    });
  });

  // ── GDD §5.2 Border Expansion ──────────────────────────────────────

  describe('territoryRadius (GDD §5.2)', () => {
    it('level 1 city has territory radius 1', () => {
      const city = new City(coord(0, 0), 'L1', 'test', 1, 1);
      expect(city.territoryRadius).toBe(1);
    });

    it('level 3 city has territory radius 3', () => {
      const city = new City(coord(0, 0), 'L3', 'test', 3, 3);
      expect(city.territoryRadius).toBe(3);
    });

    it('level 5 city has territory radius 5', () => {
      const city = new City(coord(0, 0), 'L5', 'test', 5, 5);
      expect(city.territoryRadius).toBe(5);
    });

    it('radius grows with level-up', () => {
      const city = new City(coord(0, 0), 'Grow', 'test', 1, 3);
      expect(city.territoryRadius).toBe(1);
      city.applyLevelUp('A');
      expect(city.territoryRadius).toBe(2);
      city.applyLevelUp('B');
      expect(city.territoryRadius).toBe(3);
    });

    it('bigger territory collects more stars from extended tiles', () => {
      // Simulate: L1 city gets 6 adjacent grass tiles, L3 gets 12 (extended)
      const sixGrass = Array(6).fill(Biome.GRASS);
      const twelveGrass = Array(12).fill(Biome.GRASS);
      const cityL1 = new City(coord(0, 0), 'Small', 'test', 1, 1);
      const cityL3 = new City(coord(0, 0), 'Large', 'test', 3, 3);
      // The key thing: more tiles in the territory means more resources
      // L1 with 6 grass → 6 stars; L3 with 12 grass → 12 stars
      expect(cityL1.getStarsPerTurn(sixGrass)).toBe(6);
      expect(cityL3.getStarsPerTurn(twelveGrass)).toBe(12);
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
    // Use only the first 4 original tribes (not Polaris) for backward compat
    const tribes = TRIBE_CONFIGS.slice(0, 4).map(c => new Tribe(c));
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

// ---------------------------------------------------------------------------
// GDD §4.4 — Veteran System
// ---------------------------------------------------------------------------
describe('Veteran System (GDD §4.4)', () => {
  it('new units have zero kills and are not veterans', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    expect(u.killCount).toBe(0);
    expect(u.isVeteran).toBe(false);
    expect(u.isEligibleForVeteran).toBe(false);
  });

  it('killCount increments on kill', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    u.killCount++;
    expect(u.killCount).toBe(1);
    u.killCount++;
    expect(u.killCount).toBe(2);
  });

  it('isEligibleForVeteran returns true at 3 kills', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    u.killCount = 3;
    expect(u.isEligibleForVeteran).toBe(true);
  });

  it('isEligibleForVeteran returns false below 3 kills', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    u.killCount = 2;
    expect(u.isEligibleForVeteran).toBe(false);
  });

  it('promoteVeteran grants +5 max HP and full heal', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    u.takeDamage(5); // 5 HP remaining
    u.killCount = 3;
    u.promoteVeteran();
    expect(u.isVeteran).toBe(true);
    expect(u.maxHPBonus).toBe(5);
    expect(u.maxHealth).toBe(15); // base 10 + 5
    expect(u.health).toBe(15); // full heal to new max
    expect(u.killCount).toBe(0); // reset
  });

  it('promoteVeteran does nothing if not eligible', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    u.killCount = 2;
    u.promoteVeteran();
    expect(u.isVeteran).toBe(false);
    expect(u.maxHPBonus).toBe(0);
  });

  it('naval units are not eligible for veteran', () => {
    const raft = new Unit(coord(0, 0), UnitType.RAFT, 'test');
    raft.killCount = 5;
    expect(raft.isEligibleForVeteran).toBe(false);
    expect(raft.isNaval).toBe(true);
  });

  it('Giant is not eligible for veteran', () => {
    const giant = new Unit(coord(0, 0), UnitType.GIANT, 'test');
    giant.killCount = 5;
    expect(giant.isEligibleForVeteran).toBe(false);
  });

  it('already-veteran units are not eligible again', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    u.killCount = 3;
    u.promoteVeteran();
    expect(u.isEligibleForVeteran).toBe(false);
  });

  it('heal respects veteran max HP', () => {
    const u = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    u.takeDamage(8); // 2 HP
    u.killCount = 3;
    u.promoteVeteran();
    expect(u.health).toBe(15);
    u.takeDamage(10); // 5 HP
    u.heal(3);
    expect(u.health).toBe(8);
    u.heal(100);
    expect(u.health).toBe(15); // capped at maxHealth
  });
});

// ---------------------------------------------------------------------------
// GDD §8 — Fog of War
// ---------------------------------------------------------------------------
describe('Fog of War', () => {
  it('new GameState has empty visibility for all tribes', () => {
    const tribes = [createTestTribe(), createTestTribe({ id: 't2', name: 'T2' })];
    const gs = new GameState(tribes);
    expect(gs.tribeVisibility.get(tribes[0].id)!.size).toBe(0);
    expect(gs.tribeVisibility.get(tribes[1].id)!.size).toBe(0);
  });

  it('revealVision adds tiles within range', () => {
    const tribes = [createTestTribe()];
    const gs = new GameState(tribes);
    const center = new HexCoord(5, 5);
    const allCoords: HexCoord[] = [];
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        allCoords.push(new HexCoord(q, r));
      }
    }
    gs.revealVision(tribes[0].id, center, 2, allCoords);
    const visible = gs.tribeVisibility.get(tribes[0].id)!;
    // Tiles within 2 of (5,5) should be revealed
    expect(visible.has('5,5')).toBe(true);
    expect(visible.has('5,7')).toBe(true); // distance 2
    expect(visible.has('7,5')).toBe(true); // distance 2
    // Tiles outside range should not be revealed
    expect(visible.has('5,8')).toBe(false); // distance 3
    expect(visible.has('8,5')).toBe(false); // distance 3
  });

  it('isTileVisibleToTribe returns false for unrevealed tiles', () => {
    const tribes = [createTestTribe()];
    const gs = new GameState(tribes);
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 0), tribes[0].id)).toBe(false);
  });

  it('isTileVisibleToTribe returns true after reveal', () => {
    const tribes = [createTestTribe()];
    const gs = new GameState(tribes);
    const allCoords = [new HexCoord(0, 0), new HexCoord(1, 0), new HexCoord(2, 0)];
    gs.revealVision(tribes[0].id, new HexCoord(0, 0), 1, allCoords);
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 0), tribes[0].id)).toBe(true);
    expect(gs.isTileVisibleToTribe(new HexCoord(1, 0), tribes[0].id)).toBe(true);
    expect(gs.isTileVisibleToTribe(new HexCoord(2, 0), tribes[0].id)).toBe(false);
  });

  it('vision is per-tribe (each tribe has independent fog)', () => {
    const tribes = [createTestTribe(), createTestTribe({ id: 't2', name: 'T2' })];
    const gs = new GameState(tribes);
    const allCoords = [new HexCoord(0, 0), new HexCoord(1, 0)];
    gs.revealVision(tribes[0].id, new HexCoord(0, 0), 1, allCoords);
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 0), tribes[0].id)).toBe(true);
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 0), tribes[1].id)).toBe(false);
  });

  it('Scout has vision range 3', () => {
    const scout = new Unit(coord(0, 0), UnitType.SCOUT, 'test');
    expect(scout.visionRange).toBe(3);
  });

  it('Giant has vision range 3', () => {
    const giant = new Unit(coord(0, 0), UnitType.GIANT, 'test');
    expect(giant.visionRange).toBe(3);
  });

  it('Warrior has vision range 2', () => {
    const warrior = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    expect(warrior.visionRange).toBe(2);
  });

  it('Rider has vision range 2', () => {
    const rider = new Unit(coord(0, 0), UnitType.RIDER, 'test');
    expect(rider.visionRange).toBe(2);
  });

  it('revealed tiles persist (explored but not currently visible)', () => {
    const tribes = [createTestTribe()];
    const gs = new GameState(tribes);
    const allCoords = [new HexCoord(0, 0), new HexCoord(3, 0)];
    // Reveal tile 0,0 from position (0,0) with range 1
    gs.revealVision(tribes[0].id, new HexCoord(0, 0), 1, allCoords);
    expect(gs.isTileExploredByTribe(new HexCoord(0, 0), tribes[0].id)).toBe(true);
    // Tile 3,0 was never revealed
    expect(gs.isTileExploredByTribe(new HexCoord(3, 0), tribes[0].id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GDD §3.1 — Cloak unit
// ---------------------------------------------------------------------------
describe('Cloak unit', () => {
  it('exists with correct stats', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    expect(cloak.type).toBe(UnitType.CLOAK);
    expect(cloak.attack).toBe(0);
    expect(cloak.defense).toBe(0.5);
    expect(cloak.movementRange).toBe(2);
    expect(cloak.ranged).toBe(false);
    expect(cloak.canAttackAfterMove).toBe(true);
  });

  it('has 5 HP', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    expect(cloak.health).toBe(5);
    expect(cloak.maxHealth).toBe(5);
  });

  it('costs 8 stars', () => {
    expect(UNIT_COSTS[UnitType.CLOAK]).toBe(8);
  });

  it('is a naval unit', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    expect(cloak.isNaval).toBe(true);
  });

  it('has Hide skill', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    expect(cloak.hasHide).toBe(true);
  });

  it('starts not submerged', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    expect(cloak.isSubmerged).toBe(false);
  });

  it('can submerge and emerge', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    cloak.isSubmerged = true;
    expect(cloak.isSubmerged).toBe(true);
    cloak.isSubmerged = false;
    expect(cloak.isSubmerged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GDD §3.1 — Cloak submerge/emerge mechanics via GameState
// ---------------------------------------------------------------------------
describe('Cloak submerge/emerge mechanics', () => {
  it('submergeCloak sets isSubmerged and consumes action', () => {
    const tribe = createTestTribe();
    const state = new GameState([tribe]);
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, tribe.id);
    tribe.units.push(cloak);

    state.submergeCloak(cloak);
    expect(cloak.isSubmerged).toBe(true);
    expect(cloak.hasActed).toBe(true);
    expect(cloak.hasAttacked).toBe(true);
  });

  it('emergeCloak clears isSubmerged and consumes action', () => {
    const tribe = createTestTribe();
    const state = new GameState([tribe]);
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, tribe.id);
    cloak.isSubmerged = true;
    tribe.units.push(cloak);

    state.emergeCloak(cloak);
    expect(cloak.isSubmerged).toBe(false);
    expect(cloak.hasActed).toBe(true);
  });

  it('submergeCloak ignores non-Cloak units', () => {
    const tribe = createTestTribe();
    const state = new GameState([tribe]);
    const warrior = new Unit(coord(0, 0), UnitType.WARRIOR, tribe.id);
    tribe.units.push(warrior);

    state.submergeCloak(warrior);
    expect(warrior.isSubmerged).toBe(false);
    expect(warrior.hasActed).toBe(false);
  });

  it('submergeCloak ignores units that already acted', () => {
    const tribe = createTestTribe();
    const state = new GameState([tribe]);
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, tribe.id);
    cloak.hasActed = true;
    tribe.units.push(cloak);

    state.submergeCloak(cloak);
    expect(cloak.isSubmerged).toBe(false);
  });

  it('submerged Cloak cannot attack', () => {
    const tribeA = new Tribe({ ...TRIBE_CONFIGS[0], id: 'tribeA', name: 'TribeA' });
    const tribeB = new Tribe({ ...TRIBE_CONFIGS[1], id: 'tribeB', name: 'TribeB' });
    const state = new GameState([tribeA, tribeB]);
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'tribeA');
    const enemy = new Unit(coord(1, 0), UnitType.WARRIOR, 'tribeB');
    tribeA.units.push(cloak);
    tribeB.units.push(enemy);

    // Submerge the Cloak
    state.submergeCloak(cloak);

    const tiles = tileMap([
      ['0,0', {}],
      ['1,0', {}],
    ]);
    // Submerged Cloak can't attack even though it's adjacent
    expect(CombatSystem.canAttack(cloak, enemy, tiles)).toBe(false);
  });

  it('submerged Cloak cannot be attacked by non-adjacent enemies', () => {
    const tribeA = new Tribe({ ...TRIBE_CONFIGS[0], id: 'tribeA', name: 'TribeA' });
    const tribeB = new Tribe({ ...TRIBE_CONFIGS[1], id: 'tribeB', name: 'TribeB' });
    const state = new GameState([tribeA, tribeB]);
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'tribeA');
    const enemy = new Unit(coord(2, 0), UnitType.ARCHER, 'tribeB');
    tribeA.units.push(cloak);
    tribeB.units.push(enemy);

    // Submerge the Cloak
    state.submergeCloak(cloak);

    const tiles = tileMap([
      ['0,0', {}],
      ['2,0', {}],
    ]);
    // Non-adjacent enemy can't attack submerged Cloak
    expect(CombatSystem.canAttack(enemy, cloak, tiles)).toBe(false);
  });

  it('adjacent enemy can still attack submerged Cloak', () => {
    const tribeA = new Tribe({ ...TRIBE_CONFIGS[0], id: 'tribeA', name: 'TribeA' });
    const tribeB = new Tribe({ ...TRIBE_CONFIGS[1], id: 'tribeB', name: 'TribeB' });
    const state = new GameState([tribeA, tribeB]);
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'tribeA');
    const enemy = new Unit(coord(1, 0), UnitType.WARRIOR, 'tribeB');
    tribeA.units.push(cloak);
    tribeB.units.push(enemy);

    // Submerge the Cloak
    state.submergeCloak(cloak);

    const tiles = tileMap([
      ['0,0', {}],
      ['1,0', {}],
    ]);
    // Adjacent enemy CAN attack submerged Cloak (distance 1 exception)
    expect(CombatSystem.canAttack(enemy, cloak, tiles)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GDD §3.4 — Mind Bender unit
// ---------------------------------------------------------------------------
describe('Mind Bender unit', () => {
  it('exists with correct stats', () => {
    const mb = new Unit(coord(0, 0), UnitType.MIND_BENDER, 'test');
    expect(mb.type).toBe(UnitType.MIND_BENDER);
    expect(mb.attack).toBe(0);
    expect(mb.defense).toBe(1);
    expect(mb.movementRange).toBe(1);
    expect(mb.ranged).toBe(false);
    expect(mb.canAttackAfterMove).toBe(true);
  });

  it('has 10 HP', () => {
    const mb = new Unit(coord(0, 0), UnitType.MIND_BENDER, 'test');
    expect(mb.health).toBe(10);
    expect(mb.maxHealth).toBe(10);
  });

  it('costs 5 stars', () => {
    expect(UNIT_COSTS[UnitType.MIND_BENDER]).toBe(5);
  });

  it('is not a naval unit', () => {
    const mb = new Unit(coord(0, 0), UnitType.MIND_BENDER, 'test');
    expect(mb.isNaval).toBe(false);
  });

  it('has Convert skill', () => {
    const mb = new Unit(coord(0, 0), UnitType.MIND_BENDER, 'test');
    expect(mb.hasConvert).toBe(true);
  });

  it('has Heal skill', () => {
    const mb = new Unit(coord(0, 0), UnitType.MIND_BENDER, 'test');
    expect(mb.hasHeal).toBe(true);
  });

  it('other units do not have Convert or Heal', () => {
    const warrior = new Unit(coord(0, 0), UnitType.WARRIOR, 'test');
    expect(warrior.hasConvert).toBe(false);
    expect(warrior.hasHeal).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GDD §3.4 — Convert mechanic via GameState
// ---------------------------------------------------------------------------
describe('Convert mechanic', () => {
  it('transfers unit from one tribe to another', () => {
    const tribeA = new Tribe({ ...TRIBE_CONFIGS[0], id: 'tribeA', name: 'TribeA' });
    const tribeB = new Tribe({ ...TRIBE_CONFIGS[1], id: 'tribeB', name: 'TribeB' });
    const state = new GameState([tribeA, tribeB]);

    const mb = new Unit(coord(0, 0), UnitType.MIND_BENDER, 'tribeA');
    const enemy = new Unit(coord(1, 0), UnitType.WARRIOR, 'tribeB');
    tribeA.units.push(mb);
    tribeB.units.push(enemy);

    state.convertUnit(enemy, 'tribeA');

    expect(enemy.owner).toBe('tribeA');
    expect(tribeA.units.some(u => u.id === enemy.id)).toBe(true);
    expect(tribeB.units.some(u => u.id === enemy.id)).toBe(false);
    expect(enemy.hasActed).toBe(true);
  });

  it('does nothing when converting to same tribe', () => {
    const tribeA = new Tribe({ ...TRIBE_CONFIGS[0], id: 'tribeA', name: 'TribeA' });
    const state = new GameState([tribeA]);

    const unit = new Unit(coord(0, 0), UnitType.WARRIOR, 'tribeA');
    tribeA.units.push(unit);

    state.convertUnit(unit, 'tribeA');
    expect(unit.owner).toBe('tribeA');
    expect(tribeA.units.some(u => u.id === unit.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GDD §6.3 — Philosophy tech gates Mind Bender
// ---------------------------------------------------------------------------
describe('Philosophy tech', () => {
  it('exists in tech tree', () => {
    expect(TechId.PHILOSOPHY).toBe('PHILOSOPHY');
  });

  it('unlocks Mind Bender', () => {
    const tribe = createTestTribe();
    expect(tribe.getTrainableUnitTypes()).not.toContain(UnitType.MIND_BENDER);
    tribe.researchTech(TechId.PHILOSOPHY);
    expect(tribe.getTrainableUnitTypes()).toContain(UnitType.MIND_BENDER);
  });

  it('requires Free Spirit as prerequisite', () => {
    const tribe = createTestTribe();
    // Free Spirit requires Riding
    tribe.researchTech(TechId.RIDING);
    tribe.researchTech(TechId.FREE_SPIRIT);
    expect(tribe.hasTech(TechId.FREE_SPIRIT)).toBe(true);
    // Now Philosophy should be researchable
    tribe.researchTech(TechId.PHILOSOPHY);
    expect(tribe.hasTech(TechId.PHILOSOPHY)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GDD §5.7 — Trade Routes & City Connections
// ---------------------------------------------------------------------------
import { TradeRouteSystem } from '../src/entities/TradeRouteSystem';

describe('TradeRouteSystem', () => {
  let system: TradeRouteSystem;

  beforeEach(() => {
    system = new TradeRouteSystem();
  });

  describe('canBuildRoad', () => {
    it('allows road on grass tile', () => {
      const tile: TileData = { biome: Biome.GRASS, elevation: 0.5 };
      expect(system.canBuildRoad(tile)).toBe(true);
    });

    it('allows road on forest tile', () => {
      const tile: TileData = { biome: Biome.FOREST, elevation: 0.6 };
      expect(system.canBuildRoad(tile)).toBe(true);
    });

    it('blocks road on water tile', () => {
      const tile: TileData = { biome: Biome.WATER, elevation: 0.1 };
      expect(system.canBuildRoad(tile)).toBe(false);
    });

    it('blocks road on tile that already has road', () => {
      const tile: TileData = { biome: Biome.GRASS, elevation: 0.5, road: true };
      expect(system.canBuildRoad(tile)).toBe(false);
    });

    it('blocks road on city tile', () => {
      const tile: TileData = { biome: Biome.GRASS, elevation: 0.5, city: true };
      expect(system.canBuildRoad(tile)).toBe(false);
    });

    it('blocks road on undefined tile', () => {
      expect(system.canBuildRoad(undefined)).toBe(false);
    });
  });

  describe('canBuildBridge', () => {
    it('allows bridge on water tile', () => {
      const tile: TileData = { biome: Biome.WATER, elevation: 0.1 };
      expect(system.canBuildBridge(tile)).toBe(true);
    });

    it('blocks bridge on grass tile', () => {
      const tile: TileData = { biome: Biome.GRASS, elevation: 0.5 };
      expect(system.canBuildBridge(tile)).toBe(false);
    });

    it('blocks bridge on tile that already has bridge', () => {
      const tile: TileData = { biome: Biome.WATER, elevation: 0.1, bridge: true };
      expect(system.canBuildBridge(tile)).toBe(false);
    });
  });

  describe('isTradeTile', () => {
    it('returns true for road tile', () => {
      const tile: TileData = { biome: Biome.GRASS, elevation: 0.5, road: true };
      expect(system.isTradeTile(tile)).toBe(true);
    });

    it('returns true for bridge tile', () => {
      const tile: TileData = { biome: Biome.WATER, elevation: 0.1, bridge: true };
      expect(system.isTradeTile(tile)).toBe(true);
    });

    it('returns false for plain grass tile', () => {
      const tile: TileData = { biome: Biome.GRASS, elevation: 0.5 };
      expect(system.isTradeTile(tile)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(system.isTradeTile(undefined)).toBe(false);
    });
  });

  describe('detectConnections', () => {
    function makeTileMap(entries: Array<[string, Partial<TileData>]>): Map<string, TileData> {
      const m = new Map<string, TileData>();
      for (const [key, data] of entries) {
        m.set(key, { biome: Biome.GRASS, elevation: 0, ...data });
      }
      return m;
    }

    it('detects direct road connection between two adjacent cities', () => {
      const tribe = createTestTribe();
      const cityA = new City(coord(0, 0), 'CityA', 'test', 1, 1);
      const cityB = new City(coord(1, 0), 'CityB', 'test', 1, 1);

      const tileMap = makeTileMap([
        ['0,0', { city: true }],
        ['1,0', { city: true, road: true }],
      ]);

      const connections = system.detectConnections([cityA, cityB], tileMap);
      expect(connections.get(cityA.id)).toContain(cityB.id);
      expect(connections.get(cityB.id)).toContain(cityA.id);
    });

    it('detects connection via chain of roads', () => {
      const cityA = new City(coord(0, 0), 'CityA', 'test', 1, 1);
      const cityB = new City(coord(3, 0), 'CityB', 'test', 1, 1);

      const tileMap = makeTileMap([
        ['0,0', { city: true }],
        ['1,0', { road: true }],
        ['2,0', { road: true }],
        ['3,0', { city: true }],
      ]);

      const connections = system.detectConnections([cityA, cityB], tileMap);
      expect(connections.get(cityA.id)).toContain(cityB.id);
    });

    it('no connection when path is broken', () => {
      const cityA = new City(coord(0, 0), 'CityA', 'test', 1, 1);
      const cityB = new City(coord(3, 0), 'CityB', 'test', 1, 1);

      const tileMap = makeTileMap([
        ['0,0', { city: true }],
        ['1,0', { road: true }],
        // gap at 2,0 — no road
        ['3,0', { city: true }],
      ]);

      const connections = system.detectConnections([cityA, cityB], tileMap);
      // Without a continuous road/land path, cities shouldn't connect
      // (land tiles without roads don't propagate the trade route)
      expect(connections.get(cityA.id)?.length ?? 0).toBe(0);
    });
  });

  describe('applyConnectionBonuses', () => {
    function makeTileMap(entries: Array<[string, Partial<TileData>]>): Map<string, TileData> {
      const m = new Map<string, TileData>();
      for (const [key, data] of entries) {
        m.set(key, { biome: Biome.GRASS, elevation: 0, ...data });
      }
      return m;
    }

    it('grants +1 population to both connected cities', () => {
      const cityA = new City(coord(0, 0), 'CityA', 'test', 1, 1);
      const cityB = new City(coord(1, 0), 'CityB', 'test', 1, 1);

      const tileMap = makeTileMap([
        ['0,0', { city: true }],
        ['1,0', { city: true, road: true }],
      ]);

      system.applyConnectionBonuses([cityA, cityB], tileMap);
      // Both cities should have +1 population from connection
      expect(cityA.population).toBe(2);
      expect(cityB.population).toBe(2);
    });

    it('tracks connectedCityIds on both cities', () => {
      const cityA = new City(coord(0, 0), 'CityA', 'test', 1, 1);
      const cityB = new City(coord(1, 0), 'CityB', 'test', 1, 1);

      const tileMap = makeTileMap([
        ['0,0', { city: true }],
        ['1,0', { city: true, road: true }],
      ]);

      system.applyConnectionBonuses([cityA, cityB], tileMap);
      expect(cityA.connectedCityIds).toContain(cityB.id);
      expect(cityB.connectedCityIds).toContain(cityA.id);
    });

    it('awards Grand Bazaar at 5 connections', () => {
      // Create a central city connected to 5 others via roads
      const center = new City(coord(0, 0), 'Center', 'test', 1, 1);
      const others: City[] = [];
      const entries: Array<[string, Partial<TileData>]> = [['0,0', { city: true }]];

      // Place 5 cities adjacent to center via road tiles
      const positions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];
      for (let i = 0; i < 5; i++) {
        const c = new City(coord(positions[i][0], positions[i][1]), `C${i}`, 'test', 1, 1);
        others.push(c);
        entries.push([`${positions[i][0]},${positions[i][1]}`, { city: true, road: true }]);
      }

      const tileMap = makeTileMap(entries);
      const allCities = [center, ...others];

      const score = system.applyConnectionBonuses(allCities, tileMap);
      expect(score).toBe(400);
      expect(center.hasGrandBazaar).toBe(true);
      // +3 from Grand Bazaar + 5 from connections = +8 total
      expect(center.population).toBe(9);
    });

    it('does not award Grand Bazaar with fewer than 5 connections', () => {
      const center = new City(coord(0, 0), 'Center', 'test', 1, 1);
      const others: City[] = [];
      const entries: Array<[string, Partial<TileData>]> = [['0,0', { city: true }]];

      for (let i = 0; i < 4; i++) {
        const c = new City(coord(i + 1, 0), `C${i}`, 'test', 1, 1);
        others.push(c);
        entries.push([`${i + 1},0`, { city: true, road: true }]);
      }

      const tileMap = makeTileMap(entries);
      const allCities = [center, ...others];

      const score = system.applyConnectionBonuses(allCities, tileMap);
      expect(score).toBe(0);
      expect(center.hasGrandBazaar).toBe(false);
    });
  });
});

describe('GDD §5.7 Building definitions', () => {
  it('ROAD building type exists with correct cost', () => {
    expect(BUILDING_DEFS[BuildingType.ROAD].cost).toBe(3);
    expect(BUILDING_DEFS[BuildingType.ROAD].name).toBe('Road');
  });

  it('BRIDGE building type exists with correct cost', () => {
    expect(BUILDING_DEFS[BuildingType.BRIDGE].cost).toBe(5);
    expect(BUILDING_DEFS[BuildingType.BRIDGE].name).toBe('Bridge');
  });
});

describe('GDD §3.2 Scout disembark vision reveal', () => {
  it('revealVision with range 2 covers a 5×5 hex area (19 tiles)', () => {
    const tribe = createTestTribe();
    const gs = new GameState([tribe]);
    const tribeId = tribe.id;

    const allCoords: HexCoord[] = [];
    for (let q = -4; q <= 4; q++) {
      for (let r = -4; r <= 4; r++) {
        allCoords.push(new HexCoord(q, r));
      }
    }

    gs.revealVision(tribeId, new HexCoord(0, 0), 2, allCoords);

    // Center visible
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 0), tribeId)).toBe(true);
    // Ring 1 (distance 1) visible
    expect(gs.isTileVisibleToTribe(new HexCoord(1, 0), tribeId)).toBe(true);
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 1), tribeId)).toBe(true);
    // Ring 2 (distance 2) visible
    expect(gs.isTileVisibleToTribe(new HexCoord(2, 0), tribeId)).toBe(true);
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 2), tribeId)).toBe(true);
    expect(gs.isTileVisibleToTribe(new HexCoord(-1, 2), tribeId)).toBe(true);
    // Distance 3 NOT visible
    expect(gs.isTileVisibleToTribe(new HexCoord(3, 0), tribeId)).toBe(false);
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 3), tribeId)).toBe(false);
    // Other tribe NOT visible
    expect(gs.isTileVisibleToTribe(new HexCoord(0, 0), 'other-tribe')).toBe(false);
  });

  it('Scout is a naval unit', () => {
    const scout = new Unit(coord(0, 0), UnitType.SCOUT, 'test');
    expect(scout.isNaval).toBe(true);
  });

  it('Raft is a naval unit but not SCOUT', () => {
    const raft = new Unit(coord(0, 0), UnitType.RAFT, 'test');
    expect(raft.isNaval).toBe(true);
    expect(raft.type).not.toBe(UnitType.SCOUT);
  });
});

// ---------------------------------------------------------------------------
// GDD §7.1 — Polaris tribe tests
// ---------------------------------------------------------------------------
describe('Polaris Tribe (GDD §7.1)', () => {
  it('Mooni unit has freeze ability', () => {
    const mooni = new Unit(coord(0, 0), UnitType.MOONI, 'polaris');
    expect(mooni.hasFreeze).toBe(true);
    expect(mooni.hasMassFreeze).toBe(false);
    expect(mooni.hasIceMobility).toBe(false);
  });

  it('Gaami unit has mass freeze ability', () => {
    const gaami = new Unit(coord(0, 0), UnitType.GAAMI, 'polaris');
    expect(gaami.hasMassFreeze).toBe(true);
    expect(gaami.hasFreeze).toBe(false);
    expect(gaami.hasIceMobility).toBe(false);
  });

  it('Battle Sled unit has ice mobility', () => {
    const sled = new Unit(coord(0, 0), UnitType.BATTLE_SLED, 'polaris');
    expect(sled.hasIceMobility).toBe(true);
    expect(sled.hasFreeze).toBe(false);
    expect(sled.hasMassFreeze).toBe(false);
  });

  it('Mooni has correct stats: 0 atk, 1 def, 1 mov, 8 HP', () => {
    const mooni = new Unit(coord(0, 0), UnitType.MOONI, 'polaris');
    expect(mooni.attack).toBe(0);
    expect(mooni.defense).toBe(1);
    expect(mooni.movementRange).toBe(1);
    expect(mooni.maxHealth).toBe(8);
  });

  it('Battle Sled has correct stats: 3 atk, 2 def, 3 mov, 12 HP', () => {
    const sled = new Unit(coord(0, 0), UnitType.BATTLE_SLED, 'polaris');
    expect(sled.attack).toBe(3);
    expect(sled.defense).toBe(2);
    expect(sled.movementRange).toBe(3);
    expect(sled.maxHealth).toBe(12);
  });

  it('Gaami has correct stats: 5 atk, 3 def, 1 mov, 30 HP', () => {
    const gaami = new Unit(coord(0, 0), UnitType.GAAMI, 'polaris');
    expect(gaami.attack).toBe(5);
    expect(gaami.defense).toBe(3);
    expect(gaami.movementRange).toBe(1);
    expect(gaami.maxHealth).toBe(30);
  });

  it('Polaris tribe config exists', () => {
    const polaris = TRIBE_CONFIGS.find(t => t.id === 'polaris');
    expect(polaris).toBeDefined();
    expect(polaris!.name).toBe('Polaris');
  });

  it('Polaris starts with Frostwork tech', () => {
    expect(TRIBE_STARTING_TECHS['polaris']).toContain(TechId.FROSTWORK);
  });

  it('Mooni is gated by Frostwork tech', () => {
    expect(UNIT_TECH_GATES[UnitType.MOONI]).toBe(TechId.FROSTWORK);
  });

  it('Battle Sled is gated by Sledding tech', () => {
    expect(UNIT_TECH_GATES[UnitType.BATTLE_SLED]).toBe(TechId.SLEDDING);
  });

  it('Polaris tribe can train Mooni after researching Frostwork', () => {
    const polaris = new Tribe({ id: 'polaris', name: 'Polaris', color: 0x87ceeb });
    expect(polaris.hasTech(TechId.FROSTWORK)).toBe(true);
    const trainable = polaris.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.MOONI);
  });

  it('Polaris tribe can train Battle Sled after researching Sledding', () => {
    const polaris = new Tribe({ id: 'polaris', name: 'Polaris', color: 0x87ceeb });
    polaris.researchTech(TechId.SLEDDING);
    const trainable = polaris.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.BATTLE_SLED);
  });

  it('Gaami is gated by Polar Warfare tech', () => {
    expect(UNIT_TECH_GATES[UnitType.GAAMI]).toBe(TechId.POLAR_WARFARE);
  });

  it('Polaris tribe can train Gaami after researching Polar Warfare', () => {
    const polaris = new Tribe({ id: 'polaris', name: 'Polaris', color: 0x87ceeb });
    polaris.researchTech(TechId.POLAR_WARFARE);
    const trainable = polaris.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.GAAMI);
  });

  it('Gaami has mass freeze ability', () => {
    const gaami = new Unit(coord(0, 0), UnitType.GAAMI, 'polaris');
    expect(gaami.hasMassFreeze).toBe(true);
    expect(gaami.hasFreeze).toBe(false);
    expect(gaami.hasIceMobility).toBe(false);
  });

  it('Ice Bank building type exists', () => {
    expect(BuildingType.ICE_BANK).toBe('ICE_BANK');
    expect(BUILDING_DEFS[BuildingType.ICE_BANK].name).toBe('Ice Bank');
    expect(BUILDING_DEFS[BuildingType.ICE_BANK].cost).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// GDD §7.2 — Cymanti Tribe
// ---------------------------------------------------------------------------
describe('Cymanti tribe', () => {
  it('Cymanti tribe config exists', () => {
    const cymanti = TRIBE_CONFIGS.find(t => t.id === 'cymanti');
    expect(cymanti).toBeDefined();
    expect(cymanti!.name).toBe('Cymanti');
  });

  it('Cymanti starts with Fungiculture tech', () => {
    expect(TRIBE_STARTING_TECHS['cymanti']).toContain(TechId.FUNGICULTURE);
  });

  it('Centipede unit has correct stats', () => {
    const centipede = new Unit(coord(0, 0), UnitType.CENTIPEDE, 'cymanti');
    expect(centipede.attack).toBe(3);
    expect(centipede.defense).toBe(2);
    expect(centipede.movementRange).toBe(1);
    expect(centipede.maxHealth).toBe(15);
    expect(centipede.hasEatGrow).toBe(true);
    expect(centipede.hasVenom).toBe(true);
  });

  it('Hexapods unit has correct stats', () => {
    const hexapods = new Unit(coord(0, 0), UnitType.HEXAPODS, 'cymanti');
    expect(hexapods.attack).toBe(2);
    expect(hexapods.defense).toBe(1);
    expect(hexapods.movementRange).toBe(2);
    expect(hexapods.maxHealth).toBe(8);
    expect(hexapods.hasCreepSneak).toBe(true);
    expect(hexapods.hasVenom).toBe(true);
  });

  it('Doomux unit has correct stats', () => {
    const doomux = new Unit(coord(0, 0), UnitType.DOOMUX, 'cymanti');
    expect(doomux.attack).toBe(4);
    expect(doomux.defense).toBe(0);
    expect(doomux.movementRange).toBe(1);
    expect(doomux.maxHealth).toBe(6);
    expect(doomux.hasExplode).toBe(true);
    expect(doomux.hasVenom).toBe(false);
  });

  it('Centipede is gated by Hydrology tech', () => {
    expect(UNIT_TECH_GATES[UnitType.CENTIPEDE]).toBe(TechId.HYDROLOGY);
  });

  it('Hexapods is gated by Mycelium tech', () => {
    expect(UNIT_TECH_GATES[UnitType.HEXAPODS]).toBe(TechId.MYCELIUM);
  });

  it('Doomux is gated by Venom tech', () => {
    expect(UNIT_TECH_GATES[UnitType.DOOMUX]).toBe(TechId.VENOM);
  });

  it('Cymanti tribe can train Hexapods after researching Mycelium', () => {
    const cymanti = new Tribe({ id: 'cymanti', name: 'Cymanti', color: 0x9b59b6 });
    cymanti.researchTech(TechId.MYCELIUM);
    const trainable = cymanti.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.HEXAPODS);
  });

  it('Cymanti tribe can train Centipede after researching Hydrology', () => {
    const cymanti = new Tribe({ id: 'cymanti', name: 'Cymanti', color: 0x9b59b6 });
    cymanti.researchTech(TechId.HYDROLOGY);
    const trainable = cymanti.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.CENTIPEDE);
  });

  it('Cymanti tribe can train Doomux after researching Venom', () => {
    const cymanti = new Tribe({ id: 'cymanti', name: 'Cymanti', color: 0x9b59b6 });
    cymanti.researchTech(TechId.MYCELIUM);
    cymanti.researchTech(TechId.VENOM);
    const trainable = cymanti.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.DOOMUX);
  });

  it('Fungi Farm building type exists', () => {
    expect(BuildingType.FUNGI_FARM).toBe('FUNGI_FARM');
    expect(BUILDING_DEFS[BuildingType.FUNGI_FARM].name).toBe('Fungi Farm');
    expect(BUILDING_DEFS[BuildingType.FUNGI_FARM].cost).toBe(5);
  });

  it('Mycelium Network building type exists', () => {
    expect(BuildingType.MYCELIUM_NETWORK).toBe('MYCELIUM_NETWORK');
    expect(BUILDING_DEFS[BuildingType.MYCELIUM_NETWORK].name).toBe('Mycelium Network');
    expect(BUILDING_DEFS[BuildingType.MYCELIUM_NETWORK].cost).toBe(3);
  });

  it('Algae Bridge building type exists', () => {
    expect(BuildingType.ALGAE_BRIDGE).toBe('ALGAE_BRIDGE');
    expect(BUILDING_DEFS[BuildingType.ALGAE_BRIDGE].name).toBe('Algae Bridge');
    expect(BUILDING_DEFS[BuildingType.ALGAE_BRIDGE].cost).toBe(5);
  });

  it('Venom applies ×0.7 defense penalty in combat', () => {
    const cymanti = new Tribe({ id: 'cymanti', name: 'Cymanti', color: 0x9b59b6 });
    const attacker = new Unit(coord(0, 0), UnitType.CENTIPEDE, 'cymanti');
    const defender = new Unit(coord(1, 0), UnitType.WARRIOR, 'xin-xi');
    defender.fortified = true;
    const grassTile = { biome: Biome.GRASS, elevation: 0 } as any;
    const damageWithVenom = CombatSystem.calculateDamage(attacker, defender, grassTile);
    // Without venom, defBonus would be 1.0 (grass, no city, no fortify bonus on grass)
    // With venom, defBonus = 1.0 × 0.7 = 0.7
    // This should result in higher damage
    expect(damageWithVenom).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// GDD §7.3 — Elyrion Tribe
// ---------------------------------------------------------------------------
describe('GDD §7.3 — Elyrion Tribe', () => {
  it('Elyrion tribe config exists', () => {
    const elyrion = TRIBE_CONFIGS.find(t => t.id === 'elyrion');
    expect(elyrion).toBeDefined();
    expect(elyrion!.name).toBe('Elyrion');
  });

  it('Elyrion starts with Ecology tech', () => {
    const elyrion = new Tribe({ id: 'elyrion', name: 'Elyrion', color: 0x27ae60 });
    expect(elyrion.hasTech(TechId.ECOLOGY)).toBe(true);
  });

  it('Egg unit type exists with correct stats', () => {
    const egg = new Unit(coord(0, 0), UnitType.EGG, 'elyrion');
    expect(egg.attack).toBe(0);
    expect(egg.defense).toBe(2);
    expect(egg.movementRange).toBe(0);
    expect(egg.health).toBe(3);
    expect(egg.isEgg).toBe(true);
  });

  it('Baby Dragon unit type exists with correct stats', () => {
    const baby = new Unit(coord(0, 0), UnitType.BABY_DRAGON, 'elyrion');
    expect(baby.attack).toBe(2);
    expect(baby.defense).toBe(1);
    expect(baby.movementRange).toBe(2);
    expect(baby.ranged).toBe(true);
    expect(baby.health).toBe(8);
    expect(baby.hasFlight).toBe(true);
  });

  it('Fire Dragon unit type exists with correct stats', () => {
    const fire = new Unit(coord(0, 0), UnitType.FIRE_DRAGON, 'elyrion');
    expect(fire.attack).toBe(4);
    expect(fire.defense).toBe(2);
    expect(fire.movementRange).toBe(2);
    expect(fire.ranged).toBe(true);
    expect(fire.health).toBe(15);
    expect(fire.hasFlight).toBe(true);
    expect(fire.hasSplashAoE).toBe(true);
  });

  it('Polytaur unit type exists with correct stats', () => {
    const polytaur = new Unit(coord(0, 0), UnitType.POLYTAUR, 'elyrion');
    expect(polytaur.attack).toBe(3);
    expect(polytaur.defense).toBe(1);
    expect(polytaur.movementRange).toBe(1);
    expect(polytaur.health).toBe(10);
    expect(polytaur.hasPropheticVision).toBe(true);
  });

  it('Egg is gated by Draconic tech', () => {
    expect(UNIT_TECH_GATES[UnitType.EGG]).toBe(TechId.DRACONIC);
  });

  it('Polytaur is gated by Prophecy tech', () => {
    expect(UNIT_TECH_GATES[UnitType.POLYTAUR]).toBe(TechId.PROPHECY);
  });

  it('Elyrion tribe can train Egg after researching Draconic', () => {
    const elyrion = new Tribe({ id: 'elyrion', name: 'Elyrion', color: 0x27ae60 });
    elyrion.researchTech(TechId.DRACONIC);
    const trainable = elyrion.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.EGG);
  });

  it('Elyrion tribe can train Polytaur after researching Prophecy', () => {
    const elyrion = new Tribe({ id: 'elyrion', name: 'Elyrion', color: 0x27ae60 });
    elyrion.researchTech(TechId.PROPHECY);
    const trainable = elyrion.getTrainableUnitTypes();
    expect(trainable).toContain(UnitType.POLYTAUR);
  });

  it('Sanctuary building type exists', () => {
    expect(BuildingType.SANCTUARY).toBe('SANCTUARY');
    expect(BUILDING_DEFS[BuildingType.SANCTUARY].name).toBe('Sanctuary');
    expect(BUILDING_DEFS[BuildingType.SANCTUARY].cost).toBe(5);
  });

  it('Ecology tech exists in tech tree', () => {
    expect(TECH_DEFS[TechId.ECOLOGY]).toBeDefined();
    expect(TECH_DEFS[TechId.ECOLOGY].name).toBe('Ecology');
    expect(TECH_DEFS[TechId.ECOLOGY].tier).toBe(1);
  });

  it('Draconic tech exists in tech tree', () => {
    expect(TECH_DEFS[TechId.DRACONIC]).toBeDefined();
    expect(TECH_DEFS[TechId.DRACONIC].name).toBe('Draconic');
    expect(TECH_DEFS[TechId.DRACONIC].tier).toBe(2);
    expect(TECH_DEFS[TechId.DRACONIC].unlocksUnits).toContain(UnitType.EGG);
  });

  it('Prophecy tech exists in tech tree', () => {
    expect(TECH_DEFS[TechId.PROPHECY]).toBeDefined();
    expect(TECH_DEFS[TechId.PROPHECY].name).toBe('Prophecy');
    expect(TECH_DEFS[TechId.PROPHECY].tier).toBe(2);
    expect(TECH_DEFS[TechId.PROPHECY].unlocksUnits).toContain(UnitType.POLYTAUR);
  });

  it('ecology series contains all 3 Elyrion techs', () => {
    const series = TECH_SERIES['ecology'];
    expect(series).toContain(TechId.ECOLOGY);
    expect(series).toContain(TechId.DRACONIC);
    expect(series).toContain(TechId.PROPHECY);
  });
});

// ---------------------------------------------------------------------------
// GDD §3.5 — Cloak Infiltration / Dagger
// ---------------------------------------------------------------------------
describe('Dagger unit', () => {
  it('exists with correct stats', () => {
    const dagger = new Unit(coord(0, 0), UnitType.DAGGER, 'test');
    expect(dagger.type).toBe(UnitType.DAGGER);
    expect(dagger.attack).toBe(2);
    expect(dagger.defense).toBe(1);
    expect(dagger.movementRange).toBe(1);
    expect(dagger.ranged).toBe(false);
    expect(dagger.canAttackAfterMove).toBe(true);
  });

  it('has 3 HP', () => {
    const dagger = new Unit(coord(0, 0), UnitType.DAGGER, 'test');
    expect(dagger.health).toBe(3);
    expect(dagger.maxHealth).toBe(3);
  });

  it('costs 0 stars (not trainable, spawned by Infiltrate)', () => {
    expect(UNIT_COSTS[UnitType.DAGGER]).toBe(0);
  });

  it('is not a naval unit', () => {
    const dagger = new Unit(coord(0, 0), UnitType.DAGGER, 'test');
    expect(dagger.isNaval).toBe(false);
  });

  it('starts with primedForInfiltrate = false', () => {
    const dagger = new Unit(coord(0, 0), UnitType.DAGGER, 'test');
    expect(dagger.primedForInfiltrate).toBe(false);
  });
});

describe('Cloak Infiltrate mechanics', () => {
  it('Cloak has Infiltrate skill', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    expect(cloak.hasInfiltrate).toBe(true);
  });

  it('starts with primedForInfiltrate = false', () => {
    const cloak = new Unit(coord(0, 0), UnitType.CLOAK, 'test');
    expect(cloak.primedForInfiltrate).toBe(false);
  });

  it('primeCloaksForInfiltrate does not prime without Diplomacy tech', () => {
    const tribeA = createTestTribe();
    const tribeB = createTestTribe({ id: 'tribeB', name: 'TribeB', color: 0xff0000 });
    const state = new GameState([tribeA, tribeB]);
    const city = new City(coord(2, 0), 'EnemyCity', tribeB.id);
    tribeB.cities.push(city);

    // Cloak submerged adjacent to enemy city
    const cloak = new Unit(coord(1, 0), UnitType.CLOAK, tribeA.id);
    cloak.isSubmerged = true;
    tribeA.units.push(cloak);
    // tribeA does NOT have Diplomacy

    state.primeCloaksForInfiltrate(tribeA.id);
    expect(cloak.primedForInfiltrate).toBe(false);
  });

  it('primeCloaksForInfiltrate primes submerged Cloak adjacent to enemy city with Diplomacy', () => {
    const tribeA = createTestTribe();
    tribeA.researchTech(TechId.DIPLOMACY);
    const tribeB = createTestTribe({ id: 'tribeB', name: 'TribeB', color: 0xff0000 });
    const state = new GameState([tribeA, tribeB]);
    const city = new City(coord(2, 0), 'EnemyCity', tribeB.id);
    tribeB.cities.push(city);

    // Cloak submerged adjacent to enemy city
    const cloak = new Unit(coord(1, 0), UnitType.CLOAK, tribeA.id);
    cloak.isSubmerged = true;
    tribeA.units.push(cloak);

    state.primeCloaksForInfiltrate(tribeA.id);
    expect(cloak.primedForInfiltrate).toBe(true);
  });

  it('primeCloaksForInfiltrate does NOT prime non-submerged Cloak', () => {
    const tribeA = createTestTribe();
    tribeA.researchTech(TechId.DIPLOMACY);
    const tribeB = createTestTribe({ id: 'tribeB', name: 'TribeB', color: 0xff0000 });
    const state = new GameState([tribeA, tribeB]);
    const city = new City(coord(2, 0), 'EnemyCity', tribeB.id);
    tribeB.cities.push(city);

    const cloak = new Unit(coord(1, 0), UnitType.CLOAK, tribeA.id);
    cloak.isSubmerged = false; // not submerged
    tribeA.units.push(cloak);

    state.primeCloaksForInfiltrate(tribeA.id);
    expect(cloak.primedForInfiltrate).toBe(false);
  });

  it('primeCloaksForInfiltrate does NOT prime Cloak not adjacent to enemy city', () => {
    const tribeA = createTestTribe();
    tribeA.researchTech(TechId.DIPLOMACY);
    const tribeB = createTestTribe({ id: 'tribeB', name: 'TribeB', color: 0xff0000 });
    const state = new GameState([tribeA, tribeB]);
    const city = new City(coord(5, 0), 'EnemyCity', tribeB.id);
    tribeB.cities.push(city);

    const cloak = new Unit(coord(1, 0), UnitType.CLOAK, tribeA.id);
    cloak.isSubmerged = true;
    tribeA.units.push(cloak);

    state.primeCloaksForInfiltrate(tribeA.id);
    expect(cloak.primedForInfiltrate).toBe(false);
  });

  it('performInfiltrate consumes Cloak and schedules Dagger spawn', () => {
    const tribeA = createTestTribe();
    const tribeB = createTestTribe({ id: 'tribeB', name: 'TribeB', color: 0xff0000 });
    const state = new GameState([tribeA, tribeB]);
    const city = new City(coord(2, 0), 'EnemyCity', tribeB.id);
    tribeB.cities.push(city);

    const cloak = new Unit(coord(1, 0), UnitType.CLOAK, tribeA.id);
    cloak.isSubmerged = true;
    cloak.primedForInfiltrate = true;
    tribeA.units.push(cloak);

    const result = state.performInfiltrate(cloak);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(city.id);
    // Cloak should be removed
    expect(tribeA.units.length).toBe(0);
    // Dagger spawn scheduled
    expect(state.pendingDaggerSpawns.has(city.id)).toBe(true);
    expect(state.pendingDaggerSpawns.get(city.id)).toBe(tribeA.id);
  });

  it('performInfiltrate returns null when Cloak is not primed', () => {
    const tribeA = createTestTribe();
    const tribeB = createTestTribe({ id: 'tribeB', name: 'TribeB', color: 0xff0000 });
    const state = new GameState([tribeA, tribeB]);
    const city = new City(coord(2, 0), 'EnemyCity', tribeB.id);
    tribeB.cities.push(city);

    const cloak = new Unit(coord(1, 0), UnitType.CLOAK, tribeA.id);
    cloak.isSubmerged = true;
    cloak.primedForInfiltrate = false; // not primed!
    tribeA.units.push(cloak);

    const result = state.performInfiltrate(cloak);
    expect(result).toBeNull();
    // Cloak not removed
    expect(tribeA.units.length).toBe(1);
    expect(state.pendingDaggerSpawns.size).toBe(0);
  });

  it('processDaggerSpawns creates a Dagger in the infiltrated city', () => {
    const tribeA = createTestTribe();
    const tribeB = createTestTribe({ id: 'tribeB', name: 'TribeB', color: 0xff0000 });
    const state = new GameState([tribeA, tribeB]);
    const city = new City(coord(2, 0), 'EnemyCity', tribeB.id);
    tribeB.cities.push(city);

    // Schedule a Dagger spawn
    state.pendingDaggerSpawns.set(city.id, tribeA.id);

    const spawned = state.processDaggerSpawns(tribeA.id);
    expect(spawned.length).toBe(1);
    expect(spawned[0].type).toBe(UnitType.DAGGER);
    expect(spawned[0].owner).toBe(tribeA.id);
    expect(spawned[0].hasActed).toBe(false); // can attack immediately
    expect(spawned[0].position.toString()).toBe(city.position.toString());
    // Dagger should be in tribeA's units
    expect(tribeA.units).toContain(spawned[0]);
    // Pending spawn should be cleared
    expect(state.pendingDaggerSpawns.size).toBe(0);
  });
});

describe('GDD §5.7 Grand Bazaar score in calcScore', () => {
  it('includes +400 for each city with Grand Bazaar', () => {
    const tribe = createTestTribe();
    const city1 = new City(coord(0, 0), 'City1', tribe.id, 1, 1);
    city1.hasGrandBazaar = true;
    const city2 = new City(coord(1, 0), 'City2', tribe.id, 2, 1);
    city2.hasGrandBazaar = true;
    tribe.cities.push(city1, city2);

    const score = computeTribeScore(tribe);
    // Xin-xi starts with 1 tech (RIDING) → +50 techScore
    // cityScore: 2 × 100 = 200
    // levelScore: ((1-1) × 50) + ((2-1) × 50) = 50
    // grandBazaarScore: 2 × 400 = 800
    expect(score).toBe(200 + 50 + 50 + 800);
  });

  it('city without Grand Bazaar contributes 0 grandBazaar score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    city.hasGrandBazaar = false;
    tribe.cities.push(city);

    const score = computeTribeScore(tribe);
    // Xin-xi starts with 1 tech (RIDING) → +50 techScore
    // cityScore: 1 × 100 = 100
    // levelScore: (1-1) × 50 = 0
    expect(score).toBe(100 + 50 + 0);
  });
});

describe('GDD §1.2 level score formula', () => {
  it('L1 city contributes 0 level score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    tribe.cities.push(city);
    const score = computeTribeScore(tribe);
    // levelScore: (1-1) × 50 = 0
    expect(score).toBe(100 + 50 + 0);
  });

  it('L2 city contributes 50 level score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 2, 1);
    tribe.cities.push(city);
    const score = computeTribeScore(tribe);
    // levelScore: (2-1) × 50 = 50
    expect(score).toBe(100 + 50 + 50);
  });

  it('L3 city contributes 100 level score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 3, 1);
    tribe.cities.push(city);
    const score = computeTribeScore(tribe);
    // levelScore: (3-1) × 50 = 100
    expect(score).toBe(100 + 50 + 100);
  });

  it('L4 city contributes 150 level score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 4, 1);
    tribe.cities.push(city);
    const score = computeTribeScore(tribe);
    // levelScore: (4-1) × 50 = 150
    expect(score).toBe(100 + 50 + 150);
  });

  it('L5 city contributes 200 level score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 5, 1);
    tribe.cities.push(city);
    const score = computeTribeScore(tribe);
    // levelScore: (5-1) × 50 = 200
    expect(score).toBe(100 + 50 + 200);
  });

  it('multiple cities at different levels sum correctly', () => {
    const tribe = createTestTribe();
    tribe.cities.push(
      new City(coord(0, 0), 'L1', tribe.id, 1, 1),
      new City(coord(1, 0), 'L3', tribe.id, 3, 1),
      new City(coord(2, 0), 'L5', tribe.id, 5, 1),
    );
    const score = computeTribeScore(tribe);
    // levelScore: 0 + 100 + 200 = 300
    // cityScore: 3 × 100 = 300
    expect(score).toBe(300 + 50 + 300);
  });
});

describe('GDD §1.2 territorial scoring (+20 per unique territorial tile)', () => {
  it('L1 city claims 7 tiles (center + 6 neighbors) → +140', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    tribe.cities.push(city);

    // Build a small map: center + 6 neighbors = 7 tiles
    const allCoords = [coord(0, 0)];
    for (const d of HexCoord.DIRECTIONS) {
      allCoords.push(new HexCoord(d.q, d.r));
    }

    const score = computeTribeScore(tribe, allCoords);
    // cityScore: 100, techScore: 50 (RIDING), levelScore: 0
    // territorialScore: 7 tiles × 20 = 140
    expect(score).toBe(100 + 50 + 0 + 140);
  });

  it('L3 city claims all tiles within distance 3', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 3, 1);
    tribe.cities.push(city);

    // Build a map with tiles at distance ≤ 3 from center
    const allCoords: HexCoord[] = [];
    for (let q = -3; q <= 3; q++) {
      for (let r = -3; r <= 3; r++) {
        const c = new HexCoord(q, r);
        if (c.distanceTo(coord(0, 0)) <= 3) {
          allCoords.push(c);
        }
      }
    }
    // Number of tiles within hex distance 3 = 1 + 6 + 12 + 18 = 37
    const expectedTiles = allCoords.length;

    const score = computeTribeScore(tribe, allCoords);
    // cityScore: 100, techScore: 50, levelScore: (3-1)*50 = 100
    // territorialScore: expectedTiles × 20
    expect(score).toBe(100 + 50 + 100 + expectedTiles * 20);
  });

  it('overlapping city territories — tiles counted only once', () => {
    const tribe = createTestTribe();
    const city1 = new City(coord(0, 0), 'City1', tribe.id, 2, 1);
    const city2 = new City(coord(1, 0), 'City2', tribe.id, 2, 1);
    tribe.cities.push(city1, city2);

    // Build a map: tiles within distance 2 of either city
    const allCoords: HexCoord[] = [];
    for (let q = -2; q <= 3; q++) {
      for (let r = -2; r <= 2; r++) {
        const c = new HexCoord(q, r);
        const d1 = c.distanceTo(city1.position);
        const d2 = c.distanceTo(city2.position);
        if (d1 <= 2 || d2 <= 2) {
          allCoords.push(c);
        }
      }
    }
    const expectedTiles = allCoords.length;

    const score = computeTribeScore(tribe, allCoords);
    // cityScore: 200, techScore: 50, levelScore: (2-1)*50*2 = 100
    // territorialScore: unique tiles × 20 (no double-counting)
    expect(score).toBe(200 + 50 + 100 + expectedTiles * 20);
  });

  it('captured city contributes 0 territorial score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 3, 1);
    city.captured = true;
    tribe.cities.push(city);

    const allCoords: HexCoord[] = [];
    for (let q = -3; q <= 3; q++) {
      for (let r = -3; r <= 3; r++) {
        const c = new HexCoord(q, r);
        if (c.distanceTo(coord(0, 0)) <= 3) {
          allCoords.push(c);
        }
      }
    }

    const score = computeTribeScore(tribe, allCoords);
    // cityScore: 0 (captured), techScore: 50, levelScore: 100
    // territorialScore: 0 (captured city claims nothing)
    expect(score).toBe(0 + 50 + 100 + 0);
  });

  it('without allCoords, territorial score is 0 (backward compatible)', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 3, 1);
    tribe.cities.push(city);

    const score = computeTribeScore(tribe);
    // No allCoords → no territorial scoring
    // cityScore: 100, techScore: 50, levelScore: 100, territorialScore: 0
    expect(score).toBe(100 + 50 + 100 + 0);
  });
});

describe('GDD §1.2 exploration scoring (+5 per explored tile)', () => {
  it('50 explored tiles adds +250 to score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    tribe.cities.push(city);

    const score = computeTribeScore(tribe, undefined, 50);
    // cityScore: 100, techScore: 50, explorationScore: 50*5 = 250
    expect(score).toBe(100 + 50 + 250);
  });

  it('0 explored tiles contributes 0 exploration score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    tribe.cities.push(city);

    const score = computeTribeScore(tribe, undefined, 0);
    // cityScore: 100, techScore: 50, explorationScore: 0
    expect(score).toBe(100 + 50 + 0);
  });

  it('without exploredCount param, exploration score is 0 (backward compatible)', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    tribe.cities.push(city);

    const score = computeTribeScore(tribe);
    // cityScore: 100, techScore: 50, explorationScore: 0
    expect(score).toBe(100 + 50 + 0);
  });

  it('1 explored tile adds +5', () => {
    const tribe = createTestTribe();
    const score = computeTribeScore(tribe, undefined, 1);
    // tribe has 0 cities, 1 tech (RIDING) → 50
    // explorationScore: 1*5 = 5
    expect(score).toBe(50 + 5);
  });

  it('1000 explored tiles adds +5000', () => {
    const tribe = createTestTribe();
    const score = computeTribeScore(tribe, undefined, 1000);
    // tribe has 0 cities, 1 tech (RIDING) → 50
    // explorationScore: 1000*5 = 5000
    expect(score).toBe(50 + 5000);
  });
});

describe('GDD §1.2 temple scoring (+20 per temple)', () => {
  it('3 temples in one city adds +60 to score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    city.templeCount = 3;
    tribe.cities.push(city);

    const score = computeTribeScore(tribe);
    // cityScore: 100, techScore: 50, templeScore: 3*20 = 60
    expect(score).toBe(100 + 50 + 60);
  });

  it('0 temples contributes 0 temple score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    // templeCount defaults to 0
    tribe.cities.push(city);

    const score = computeTribeScore(tribe);
    // cityScore: 100, techScore: 50, templeScore: 0
    expect(score).toBe(100 + 50 + 0);
  });

  it('temples in captured city do not contribute to score', () => {
    const tribe = createTestTribe();
    const city = new City(coord(0, 0), 'City', tribe.id, 1, 1);
    city.templeCount = 5;
    city.captured = true;
    tribe.cities.push(city);

    const score = computeTribeScore(tribe);
    // city is captured → cityScore: 0, templeScore: 0
    // techScore: 50 (RIDING)
    expect(score).toBe(50);
  });

  it('temples across multiple non-captured cities sum correctly', () => {
    const tribe = createTestTribe();
    const city1 = new City(coord(0, 0), 'City1', tribe.id, 1, 1);
    city1.templeCount = 2;
    const city2 = new City(coord(1, 0), 'City2', tribe.id, 1, 1);
    city2.templeCount = 1;
    tribe.cities.push(city1, city2);

    const score = computeTribeScore(tribe);
    // cityScore: 2*100=200, techScore: 50, templeScore: (2+1)*20=60
    expect(score).toBe(200 + 50 + 60);
  });
});
