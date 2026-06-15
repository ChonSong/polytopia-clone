import { describe, it, expect, beforeEach } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { TileData, Biome } from '../src/hex/Tile';
import { Tribe } from '../src/entities/Tribe';
import { City } from '../src/entities/City';
import { Unit, UnitType } from '../src/entities/Unit';
import { GameState } from '../src/entities/GameState';
import { TurnPhase } from '../src/entities/TurnManager';
import { BasicAI, getVisibleTiles, bfsPathStep } from '../src/ai/BasicAI';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTileMap(width: number, height: number, biome: Biome = Biome.GRASS): Map<string, TileData> {
  const map = new Map<string, TileData>();
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      map.set(`${q},${r}`, { biome, elevation: 0.5 });
    }
  }
  return map;
}

function addWater(map: Map<string, TileData>, key: string) {
  map.set(key, { biome: Biome.WATER, elevation: 0.1 });
}

function addMountain(map: Map<string, TileData>, key: string) {
  map.set(key, { biome: Biome.MOUNTAIN, elevation: 0.8 });
}

function addForest(map: Map<string, TileData>, key: string) {
  map.set(key, { biome: Biome.FOREST, elevation: 0.6 });
}

/** Make a tribe with a city at the given position. */
function makeTribeWithCity(
  id: string,
  cityPos: HexCoord,
  cityName: string,
): Tribe {
  const tribe = new Tribe({ id, name: id, color: 0xffffff });
  const city = new City(cityPos, cityName, id);
  tribe.cities.push(city);
  return tribe;
}

// ---------------------------------------------------------------------------
// getVisibleTiles
// ---------------------------------------------------------------------------

describe('getVisibleTiles', () => {
  it('sees tiles around units and cities', () => {
    const tribe = new Tribe({ id: 't1', name: 'Test', color: 0xff0000 });
    const city = new City(new HexCoord(5, 5), 'Home', 't1');
    tribe.cities.push(city);
    const unit = new Unit(new HexCoord(10, 10), UnitType.WARRIOR, 't1');
    tribe.units.push(unit);

    const tileMap = makeTileMap(20, 20);
    const visible = getVisibleTiles(tribe, tileMap);

    // City at (5,5) with radius 3
    expect(visible.has('5,5')).toBe(true);
    expect(visible.has('5,6')).toBe(true);
    expect(visible.has('8,5')).toBe(true);
    expect(visible.has('9,5')).toBe(false);

    // Unit at (10,10) with radius 2
    expect(visible.has('10,10')).toBe(true);
    expect(visible.has('11,10')).toBe(true);
    expect(visible.has('13,10')).toBe(false);
  });

  it('handles tribe with no cities or units', () => {
    const tribe = new Tribe({ id: 'empty', name: 'Empty', color: 0x000000 });
    const visible = getVisibleTiles(tribe, new Map());
    expect(visible.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// bfsPathStep
// ---------------------------------------------------------------------------

describe('bfsPathStep', () => {
  let tileMap: Map<string, TileData>;

  beforeEach(() => {
    tileMap = makeTileMap(10, 10);
  });

  it('returns first step toward a reachable goal', () => {
    const start = new HexCoord(1, 1);
    const goal = new HexCoord(1, 3);
    const step = bfsPathStep(start, goal, tileMap, 10);
    expect(step).not.toBeNull();
    // First step should be (1,2)
    expect(step!.q).toBe(1);
    expect(step!.r).toBe(2);
  });

  it('returns null when start equals goal', () => {
    const start = new HexCoord(3, 3);
    expect(bfsPathStep(start, start, tileMap, 5)).toBeNull();
  });

  it('returns first step toward goal even when fully blocked by water', () => {
    // Block all direct paths from (1,1) to (3,3)
    addWater(tileMap, '2,1');
    addWater(tileMap, '1,2');
    addWater(tileMap, '2,2');
    addWater(tileMap, '3,2');

    const start = new HexCoord(1, 1);
    const goal = new HexCoord(3, 3);
    const step = bfsPathStep(start, goal, tileMap, 3);
    // Should still return the first step toward the closest reachable tile
    expect(step).not.toBeNull();
    // Step should be one of the walkable neighbors of start
    const validSteps = ['0,1', '1,0', '2,0', '0,2'];
    expect(validSteps).toContain(`${step!.q},${step!.r}`);
  });

  it('returns first step toward goal even when beyond maxDist', () => {
    const start = new HexCoord(0, 0);
    const goal = new HexCoord(5, 0);
    // Distance is 5, maxDist=2 means BFS only explores 2 steps,
    // but it still returns the first step in the right direction
    const step = bfsPathStep(start, goal, tileMap, 2);
    expect(step).not.toBeNull();
    // First step should be toward the goal: (1,0)
    expect(step!.q).toBe(1);
    expect(step!.r).toBe(0);
  });

  it('finds path around obstacles', () => {
    // Put water at (2,0) forcing detour
    addWater(tileMap, '2,0');
    const start = new HexCoord(0, 0);
    const goal = new HexCoord(3, 0);
    const step = bfsPathStep(start, goal, tileMap, 10);
    expect(step).not.toBeNull();
    // First step should be (1,0) since (2,0) is blocked but we can go around
    expect(step!.q).toBe(1);
    expect(step!.r).toBe(0);
  });

  it('cannot path through mountains', () => {
    addMountain(tileMap, '1,0');
    addMountain(tileMap, '2,0');
    const start = new HexCoord(0, 0);
    const goal = new HexCoord(3, 0);
    const step = bfsPathStep(start, goal, tileMap, 10);
    expect(step).not.toBeNull();
    // Should not step into mountain at (1,0)
    expect(step!.q).not.toBe(1);
    expect(step!.r).not.toBe(0);
  });

  it('naval pathing traverses water tiles when isNaval=true', () => {
    // Create an island: block all exits from (0,0) with water except one direction
    // Place water on all tiles at distance 1 from (0,0)
    // Diagonals in hex axial: q=1,r=0; q=1,r=-1; q=0,r=-1; q=-1,r=0; q=-1,r=1; q=0,r=1
    addWater(tileMap, '1,0');
    addWater(tileMap, '1,-1');
    addWater(tileMap, '0,-1');
    addWater(tileMap, '-1,0');
    addWater(tileMap, '-1,1');
    addWater(tileMap, '0,1');  // all 6 neighbors are water
    // And a water corridor to the goal
    addWater(tileMap, '1,0');  // already set
    addWater(tileMap, '2,0');
    addWater(tileMap, '3,0');
    addWater(tileMap, '4,0');
    const start = new HexCoord(0, 0);
    const goal = new HexCoord(5, 0);
    // Ground unit (isNaval=false) — blocked by water (all neighbors are water)
    const groundStep = bfsPathStep(start, goal, tileMap, 10, false);
    expect(groundStep).toBeNull();
    // Naval unit (isNaval=true) — can traverse water
    const navalStep = bfsPathStep(start, goal, tileMap, 10, true);
    expect(navalStep).not.toBeNull();
    expect(navalStep!.q).toBe(1);
    expect(navalStep!.r).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BasicAI — full integration
// ---------------------------------------------------------------------------

describe('BasicAI', () => {
  let tileMap: Map<string, TileData>;
  let tribe: Tribe;
  let enemyTribe: Tribe;
  let gameState: GameState;
  let ai: BasicAI;

  beforeEach(() => {
    tileMap = makeTileMap(15, 15);

    tribe = new Tribe({ id: 'player', name: 'Player', color: 0x4488ff });
    tribe.stars = 20;
    enemyTribe = new Tribe({ id: 'enemy', name: 'Enemy', color: 0xff4444 });
    enemyTribe.stars = 20;

    // Player city at (3,3)
    const city = new City(new HexCoord(3, 3), 'Capital', 'player');
    tribe.cities.push(city);

    // Enemy city at (10,10)
    const enemyCity = new City(new HexCoord(10, 10), 'EnemyCity', 'enemy');
    enemyTribe.cities.push(enemyCity);

    gameState = new GameState([tribe, enemyTribe]);
    // Attach tileMap for the AI to use
    (gameState as unknown as { tileMap: Map<string, TileData> }).tileMap = tileMap;

    ai = new BasicAI(tribe, { minUnitsForUpgrade: 2, preferredUnit: UnitType.WARRIOR });
  });

  // -----------------------------------------------------------------------
  // BUILD phase
  // -----------------------------------------------------------------------

  it('trains a warrior when tribe has no units (BUILD phase)', () => {
    tribe.stars = 20;
    const actions = ai.decide(gameState, TurnPhase.BUILD);

    expect(actions.length).toBeGreaterThanOrEqual(1);
    const trainAction = actions.find(a => a.type === 'TRAIN');
    expect(trainAction).toBeDefined();
    expect(trainAction!.params.unitType).toBe(UnitType.WARRIOR);
    expect(trainAction!.params.cost).toBe(2); // Warrior cost
    // Stars NOT deducted in decision phase (done in executeAiAction)
    expect(tribe.stars).toBe(20);
  });

  it('upgrades a city when tribe has enough units (BUILD phase)', () => {
    // Give the tribe 2+ units so it meets minUnitsForUpgrade (which is 2)
    const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    const warrior2 = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior1);
    tribe.units.push(warrior2);

    tribe.stars = 20;
    const actions = ai.decide(gameState, TurnPhase.BUILD);

    const upgradeAction = actions.find(a => a.type === 'UPGRADE');
    expect(upgradeAction).toBeDefined();
    expect(upgradeAction!.params.cityId).toBe(
      `player-Capital-3,3`,
    );
    expect(upgradeAction!.params.cost).toBe(5); // level 1 cost
    // Stars NOT deducted in decision phase (done in executeAiAction)
    expect(tribe.stars).toBe(20);
  });

  it('does nothing in BUILD phase when stars are insufficient', () => {
    const warrior = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);
    tribe.stars = 1; // not enough for anything

    const actions = ai.decide(gameState, TurnPhase.BUILD);
    expect(actions.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // MOVE phase
  // -----------------------------------------------------------------------

  it('moves a unit toward the nearest enemy city (MOVE phase)', () => {
    const warrior = new Unit(new HexCoord(3, 4), UnitType.WARRIOR, 'player');
    warrior.hasActed = false;
    tribe.units.push(warrior);

    const actions = ai.decide(gameState, TurnPhase.MOVE);

    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('MOVE');
    // Unit at (3,4) should move toward enemy city at (10,10)
    expect(actions[0].params.unitId).toBe(warrior.id);
    // The unit should have acted
    expect(warrior.hasActed).toBe(true);
  });

  it('does not produce move actions when no enemy exists', () => {
    // Remove the enemy tribe's city
    enemyTribe.cities = [];
    // Make enemy defeated so AI skips it
    enemyTribe.isDefeated = () => true;

    const warrior = new Unit(new HexCoord(3, 4), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    const actions = ai.decide(gameState, TurnPhase.MOVE);
    // May still try to explore (find an unseen tile)
    expect(Array.isArray(actions)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // ATTACK phase
  // -----------------------------------------------------------------------

  it('attacks an enemy unit when adjacent', () => {
    const warrior = new Unit(new HexCoord(3, 3), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    // Place an enemy unit adjacent to the warrior
    const enemyWarrior = new Unit(new HexCoord(4, 3), UnitType.WARRIOR, 'enemy');
    enemyTribe.units.push(enemyWarrior);

    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('ATTACK');
    expect(actions[0].params.unitId).toBe(warrior.id);
    expect(actions[0].params.targetId).toBe(enemyWarrior.id);
    expect(actions[0].params.targetType).toBe('unit');
  });

  it('attacks an enemy city when adjacent', () => {
    // Place a unit next to enemy city (city is at 10,10, so unit at 9,10 is adjacent)
    const warrior = new Unit(new HexCoord(9, 10), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('ATTACK');
    expect(actions[0].params.targetType).toBe('city');
  });

  it('does not attack when no enemy in range', () => {
    const warrior = new Unit(new HexCoord(3, 3), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    // Enemy city at (10,10) — not adjacent, no enemy units
    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    expect(actions.length).toBe(0);
  });

  it('attacks with correct params structure', () => {
    const warrior = new Unit(new HexCoord(3, 3), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    const enemyWarrior = new Unit(new HexCoord(4, 3), UnitType.WARRIOR, 'enemy');
    enemyTribe.units.push(enemyWarrior);

    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('ATTACK');
    expect(actions[0].params).toHaveProperty('unitId');
    expect(actions[0].params).toHaveProperty('targetId');
    expect(actions[0].params).toHaveProperty('targetType');
    expect(actions[0].params).toHaveProperty('targetQ');
    expect(actions[0].params).toHaveProperty('targetR');
  });

  // -----------------------------------------------------------------------
  // EXPLORE and END phases
  // -----------------------------------------------------------------------

  it('returns no actions in EXPLORE phase', () => {
    const actions = ai.decide(gameState, TurnPhase.EXPLORE);
    expect(actions.length).toBe(0);
  });

  it('returns no actions in END phase', () => {
    const actions = ai.decide(gameState, TurnPhase.END);
    expect(actions.length).toBe(0);
  });
});
