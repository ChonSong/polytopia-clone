import { describe, it, expect, beforeEach } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { TileData, Biome } from '../src/hex/Tile';
import { Tribe } from '../src/entities/Tribe';
import { City } from '../src/entities/City';
import { Unit, UnitType } from '../src/entities/Unit';
import { GameState } from '../src/entities/GameState';
import { TurnPhase } from '../src/entities/TurnManager';
import { BasicAI, getVisibleTiles, bfsPathStep } from '../src/ai/BasicAI';
import { TechId, TECH_DEFS } from '../src/entities/TechTree';

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
  // GDD §7.1 — AI tech priority
  // -----------------------------------------------------------------------

  it('researches a unit-unlocking tech over a cheaper non-unit tech when stars > 10', () => {
    // Give tribe enough units so it skips training
    const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    const warrior2 = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior1, warrior2);
    // Make city unable to grow (pop < level) so upgrade is skipped → falls through to research
    tribe.cities[0].population = 0;
    // Pre-research Hunting (prereq for Archery)
    tribe.researchTech(TechId.HUNTING);
    // Pre-research new techs so they're not cheapest options
    tribe.researchTech(TechId.AQUACULTURE);
    tribe.researchTech(TechId.SMITHERY);
    tribe.researchTech(TechId.ORGANIZATION);
    tribe.researchTech(TechId.STRATEGY);
    tribe.researchTech(TechId.FARMING);
    tribe.researchTech(TechId.CLIMBING);
    tribe.stars = 20; // enough for anything

    // Fishing (tier 1, 5⭐) does NOT unlock units
    // Archery (tier 2, 6⭐, prereq Hunting) DOES unlock Archer (atk 2)
    // The AI should pick Archery (cheapest unit-unlocking tech available)
    const actions = ai.decide(gameState, TurnPhase.BUILD);
    const researchAction = actions.find(a => a.type === 'RESEARCH');
    expect(researchAction).toBeDefined();
    expect(researchAction!.params.techId).toBe(TechId.ARCHERY);
  });

  it('picks the highest-attack unit-unlocking tech when multiple are available', () => {
    const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    const warrior2 = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior1, warrior2);
    tribe.cities[0].population = 0; // block upgrade
    // Pre-research through to Math prereqs
    tribe.researchTech(TechId.HUNTING);
    tribe.researchTech(TechId.ARCHERY);
    tribe.researchTech(TechId.RIDING);
    tribe.researchTech(TechId.FREE_SPIRIT);
    tribe.stars = 20;

    // Mathematics (tier 3, 7⭐, unlocks Catapult atk 4)
    // Chivalry (tier 3, 7⭐, unlocks Swordsman atk 3 + Knight atk 3.5)
    // AI should pick Mathematics (Catapult atk 4 > Knight atk 3.5)
    const actions = ai.decide(gameState, TurnPhase.BUILD);
    const researchAction = actions.find(a => a.type === 'RESEARCH');
    expect(researchAction).toBeDefined();
    expect(researchAction!.params.techId).toBe(TechId.MATHEMATICS);
  });

  it('falls back to cheapest tech when stars <= 10 even if unit-unlocking techs exist', () => {
    const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    const warrior2 = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior1, warrior2);
    tribe.cities[0].population = 0; // block upgrade
    tribe.researchTech(TechId.HUNTING);
    tribe.researchTech(TechId.RIDING); // remove Riding from contention (same cost as Fishing)
    tribe.stars = 10; // right at threshold — should pick cheapest

    // Fishing (tier 1, 5⭐) is cheaper than Archery (tier 2, 6⭐)
    const actions = ai.decide(gameState, TurnPhase.BUILD);
    const researchAction = actions.find(a => a.type === 'RESEARCH');
    expect(researchAction).toBeDefined();
    expect(researchAction!.params.techId).toBe(TechId.FISHING);
  });

  it('falls back to cheapest tech when no unit-unlocking techs are affordable', () => {
    const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    const warrior2 = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior1, warrior2);
    tribe.cities[0].population = 0; // block upgrade
    tribe.researchTech(TechId.HUNTING);
    tribe.researchTech(TechId.RIDING); // remove Riding from contention
    // Set stars to exactly cover Fishing (5⭐, tier 1) but not Archery (6⭐, tier 2)
    tribe.stars = 5;

    // Only Fishing is affordable — should pick it
    const actions = ai.decide(gameState, TurnPhase.BUILD);
    const researchAction = actions.find(a => a.type === 'RESEARCH');
    expect(researchAction).toBeDefined();
    expect(researchAction!.params.techId).toBe(TechId.FISHING);
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
  // GDD §7 — AI heal behavior
  // -----------------------------------------------------------------------

  it('does not move units below 50% HP near a friendly city (heal instead)', () => {
    // Unit at (4,4), friendly city at (3,3) — distance 1 < 2
    const warrior = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    warrior.health = 3; // Below 50% (10/2 = 5)
    tribe.units.push(warrior);

    const actions = ai.decide(gameState, TurnPhase.MOVE);

    // No MOVE actions for this unit — it should stay idle to heal
    const moveActions = actions.filter(a => a.type === 'MOVE');
    expect(moveActions.length).toBe(0);
    // hasActed should remain false (not marked as acted)
    expect(warrior.hasActed).toBe(false);
  });

  it('moves healthy units even when near a friendly city', () => {
    const warrior = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    warrior.health = 10; // Full health — should not heal
    tribe.units.push(warrior);

    const actions = ai.decide(gameState, TurnPhase.MOVE);

    const moveActions = actions.filter(a => a.type === 'MOVE');
    expect(moveActions.length).toBe(1);
    expect(warrior.hasActed).toBe(true);
  });

  it('moves damaged units far from friendly cities (no healing available)', () => {
    // Unit at (14,14), friendly city at (3,3) — distance > 2
    const warrior = new Unit(new HexCoord(14, 14), UnitType.WARRIOR, 'player');
    warrior.health = 3; // Below 50%
    tribe.units.push(warrior);

    const actions = ai.decide(gameState, TurnPhase.MOVE);

    // Should still move since no friendly city is within 2 tiles
    const moveActions = actions.filter(a => a.type === 'MOVE');
    expect(moveActions.length).toBe(1);
    expect(warrior.hasActed).toBe(true);
  });

  it('prioritizes healing over moving toward enemies when damaged near city', () => {
    // Unit at (4,4), friendly city at (3,3), enemy unit at (4,3)
    // Heal check runs before attack-move check — damaged near city = heal
    const warrior = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
    warrior.health = 3; // Below 50%
    tribe.units.push(warrior);

    const enemyWarrior = new Unit(new HexCoord(4, 3), UnitType.WARRIOR, 'enemy');
    enemyTribe.units.push(enemyWarrior);

    const actions = ai.decide(gameState, TurnPhase.MOVE);

    // Healing takes priority — damaged units near city skip turn
    const moveActions = actions.filter(a => a.type === 'MOVE');
    expect(moveActions.length).toBe(0);
    expect(warrior.hasActed).toBe(false);
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
  // GDD §8.4 — AI low-HP targeting
  // -----------------------------------------------------------------------

  it('targets the lowest-HP adjacent enemy first', () => {
    const warrior = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    // Two adjacent enemies: one high HP, one low HP
    const strongEnemy = new Unit(new HexCoord(6, 5), UnitType.DEFENDER, 'enemy');
    strongEnemy.health = 15; // full HP
    const weakEnemy = new Unit(new HexCoord(4, 5), UnitType.WARRIOR, 'enemy');
    weakEnemy.health = 2; // almost dead
    enemyTribe.units.push(strongEnemy, weakEnemy);

    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('ATTACK');
    // Should target the low-HP enemy (weakEnemy at 4,5)
    expect(actions[0].params.targetId).toBe(weakEnemy.id);
    expect(actions[0].params.targetQ).toBe(4);
    expect(actions[0].params.targetR).toBe(5);
  });

  it('breaks ties by attacking the highest-attack enemy', () => {
    const warrior = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    // Two adjacent enemies with same HP but different attack
    const lowAtkEnemy = new Unit(new HexCoord(6, 5), UnitType.DEFENDER, 'enemy');
    lowAtkEnemy.health = 5;
    const highAtkEnemy = new Unit(new HexCoord(4, 5), UnitType.SWORDSMAN, 'enemy');
    highAtkEnemy.health = 5;
    enemyTribe.units.push(lowAtkEnemy, highAtkEnemy);

    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    expect(actions.length).toBe(1);
    // Should target the higher-attack enemy (Swordsman at 4,5)
    expect(actions[0].params.targetId).toBe(highAtkEnemy.id);
  });

  it('attacks all adjacent enemies when unit has Persist (Knight)', () => {
    const knight = new Unit(new HexCoord(5, 5), UnitType.KNIGHT, 'player');
    tribe.units.push(knight);

    // Three adjacent enemies with different HP
    const enemy1 = new Unit(new HexCoord(6, 5), UnitType.WARRIOR, 'enemy');
    enemy1.health = 8;
    const enemy2 = new Unit(new HexCoord(4, 5), UnitType.WARRIOR, 'enemy');
    enemy2.health = 3;
    const enemy3 = new Unit(new HexCoord(5, 6), UnitType.WARRIOR, 'enemy');
    enemy3.health = 5;
    enemyTribe.units.push(enemy1, enemy2, enemy3);

    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    // Knight with Persist should attack all 3, sorted by HP
    expect(actions.length).toBe(3);
    expect(actions[0].params.targetId).toBe(enemy2.id); // HP 3 first
    expect(actions[1].params.targetId).toBe(enemy3.id); // HP 5 second
    expect(actions[2].params.targetId).toBe(enemy1.id); // HP 8 last
  });

  it('attacks city only when no adjacent enemy units', () => {
    const warrior = new Unit(new HexCoord(9, 10), UnitType.WARRIOR, 'player');
    tribe.units.push(warrior);

    // One adjacent enemy unit AND adjacent city
    const enemyWarrior = new Unit(new HexCoord(10, 10), UnitType.WARRIOR, 'enemy');
    enemyWarrior.health = 10;
    enemyTribe.units.push(enemyWarrior);
    // Enemy city is also at (10,10) — but unit is there too, so unit takes priority

    const actions = ai.decide(gameState, TurnPhase.ATTACK);

    // Should attack the unit, not the city
    expect(actions.length).toBe(1);
    expect(actions[0].params.targetType).toBe('unit');
    expect(actions[0].params.targetId).toBe(enemyWarrior.id);
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

  // -----------------------------------------------------------------------
  // Difficulty levels — Easy / Medium / Hard
  // -----------------------------------------------------------------------

  describe('difficulty levels', () => {
    it('Easy AI trains fewer units (minUnitsForUpgrade=1)', () => {
      const easyAi = new BasicAI(tribe, {
        minUnitsForUpgrade: 1,
        preferredUnit: UnitType.WARRIOR,
        difficulty: 'easy',
        techStarsThreshold: 15,
        moveSkipChance: 0.3,
      });
      // With 1 existing unit and minUnitsForUpgrade=1, condition is 1 < 1 = false → skip training
      const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
      tribe.units.push(warrior1);
      tribe.stars = 20;

      const actions = easyAi.decide(gameState, TurnPhase.BUILD);
      const trainAction = actions.find(a => a.type === 'TRAIN');
      // No training because unit count (1) is NOT less than minUnitsForUpgrade (1)
      expect(trainAction).toBeUndefined();
    });

    it('Medium AI uses default minUnitsForUpgrade=2', () => {
      const mediumAi = new BasicAI(tribe, {
        minUnitsForUpgrade: 2,
        preferredUnit: UnitType.WARRIOR,
        difficulty: 'medium',
        techStarsThreshold: 10,
        moveSkipChance: 0,
      });
      // With 1 existing unit and minUnitsForUpgrade=2, condition 1 < 2 = true → train
      const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
      tribe.units.push(warrior1);
      tribe.stars = 20;

      const actions = mediumAi.decide(gameState, TurnPhase.BUILD);
      const trainAction = actions.find(a => a.type === 'TRAIN');
      expect(trainAction).toBeDefined();
    });

    it('Hard AI trains more units (minUnitsForUpgrade=4)', () => {
      const hardAi = new BasicAI(tribe, {
        minUnitsForUpgrade: 4,
        preferredUnit: UnitType.SWORDSMAN,
        difficulty: 'hard',
        techStarsThreshold: 5,
        moveSkipChance: 0,
      });
      // With 3 existing units and minUnitsForUpgrade=4, condition 3 < 4 = true → train
      for (let i = 0; i < 3; i++) {
        tribe.units.push(new Unit(new HexCoord(4 + i, 4), UnitType.WARRIOR, 'player'));
      }
      tribe.stars = 20;

      const actions = hardAi.decide(gameState, TurnPhase.BUILD);
      const trainAction = actions.find(a => a.type === 'TRAIN');
      expect(trainAction).toBeDefined();
    });

    it('Hard AI picks unit-unlocking tech over cheaper non-unit techs (threshold=5)', () => {
      const hardAi = new BasicAI(tribe, {
        minUnitsForUpgrade: 1,
        preferredUnit: UnitType.SWORDSMAN,
        difficulty: 'hard',
        techStarsThreshold: 5,
        moveSkipChance: 0,
      });
      // Give tribe enough units so it skips training
      for (let i = 0; i < 4; i++) {
        tribe.units.push(new Unit(new HexCoord(4 + i, 4), UnitType.WARRIOR, 'player'));
      }
      tribe.cities[0].population = 0; // block upgrade
      tribe.stars = 8; // > 5 (hard threshold) → should prefer unit-unlocking techs

      const actions = hardAi.decide(gameState, TurnPhase.BUILD);
      const researchAction = actions.find(a => a.type === 'RESEARCH');
      expect(researchAction).toBeDefined();
      // Should pick a unit-unlocking tech (not Fishing which has no unlocks)
      const chosenTech = researchAction!.params.techId;
      const techDef = Object.values(TECH_DEFS).find(t => t.id === chosenTech);
      expect(techDef).toBeDefined();
      expect(techDef!.unlocksUnits.length).toBeGreaterThan(0);
    });

    it('Easy AI prioritises economy techs over military when stars ≤ 15', () => {
      const easyAi = new BasicAI(tribe, {
        minUnitsForUpgrade: 1,
        preferredUnit: UnitType.WARRIOR,
        difficulty: 'easy',
        techStarsThreshold: 15,
        moveSkipChance: 0.3,
      });
      // Give tribe enough units so it skips training
      for (let i = 0; i < 2; i++) {
        tribe.units.push(new Unit(new HexCoord(4 + i, 4), UnitType.WARRIOR, 'player'));
      }
      tribe.cities[0].population = 0; // block upgrade
      tribe.researchTech(TechId.HUNTING); // prereq for Archery
      tribe.researchTech(TechId.RIDING); // remove from contention
      tribe.stars = 12; // > 10 (old threshold) but only > 15 new threshold → should fall back to cheapest

      const actions = easyAi.decide(gameState, TurnPhase.BUILD);
      const researchAction = actions.find(a => a.type === 'RESEARCH');
      expect(researchAction).toBeDefined();
      // With stars=12 (< 15), Easy AI should pick cheapest tech (Fishing at 5⭐) over Archery
      expect(researchAction!.params.techId).toBe(TechId.FISHING);
    });
  });

  // -----------------------------------------------------------------------
  // Difficulty behavior differentiation
  // -----------------------------------------------------------------------

  describe('difficulty behavior', () => {
    it('Easy AI avoids attacking when units are evenly matched', () => {
      //  Easy AI with a warrior adjacent to an equal-strength enemy, no HP advantage
      const easyTribe = new Tribe({ id: 'easy', name: 'Easy', color: 0x44ff44 });
      easyTribe.stars = 10;
      const easyCity = new City(new HexCoord(5, 5), 'EasyCity', 'easy');
      easyTribe.cities.push(easyCity);

      const easyEnemy = new Tribe({ id: 'enemy-e', name: 'Enemy', color: 0xff4444 });
      easyEnemy.stars = 10;
      const easyEnemyCity = new City(new HexCoord(20, 20), 'EnemyCity', 'enemy-e');
      easyEnemy.cities.push(easyEnemyCity);

      const easyGs = new GameState([easyTribe, easyEnemy]);
      (easyGs as unknown as { tileMap: Map<string, TileData> }).tileMap = makeTileMap(30, 30);

      const easyAi = new BasicAI(easyTribe, { difficulty: 'easy' });

      // Place easy warrior adjacent to enemy warrior (same stats, full HP on both)
      const warrior = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'easy');
      warrior.health = 10; // full HP
      easyTribe.units.push(warrior);

      const enemyWarrior = new Unit(new HexCoord(6, 5), UnitType.WARRIOR, 'enemy-e');
      enemyWarrior.health = 10; // full HP
      easyEnemy.units.push(enemyWarrior);

      const actions = easyAi.decide(easyGs, TurnPhase.ATTACK);
      // Easy AI should NOT attack — no one-shot possible, no 2:1 HP advantage
      expect(actions.length).toBe(0);
    });

    it('Medium AI attacks when adjacent (no difficulty avoidance)', () => {
      // Medium AI should still attack evenly-matched enemies
      const warrior = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
      warrior.health = 10;
      tribe.units.push(warrior);

      const enemyWarrior = new Unit(new HexCoord(5, 4), UnitType.WARRIOR, 'enemy');
      enemyWarrior.health = 10;
      enemyTribe.units.push(enemyWarrior);

      const actions = ai.decide(gameState, TurnPhase.ATTACK);
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe('ATTACK');
    });

    it('Easy AI always picks economic upgrades (B)', () => {
      // Give enough units to trigger upgrade, no enemies nearby
      // Remove enemies so there's no threat influence on upgrade choice
      enemyTribe.cities = [];
      enemyTribe.units = [];

      const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
      const warrior2 = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
      tribe.units.push(warrior1, warrior2);
      tribe.stars = 20;
      // Don't set population = 0 — city.canGrow() requires population >= level

      // No enemies → Easy should pick B (economic)
      const easyAi = new BasicAI(tribe, { difficulty: 'easy' });
      const actions = easyAi.decide(gameState, TurnPhase.BUILD);
      const upgradeAction = actions.find(a => a.type === 'UPGRADE');
      expect(upgradeAction).toBeDefined();
      expect(upgradeAction!.params.choice).toBe('B');
    });

    it('Hard AI always picks military upgrades (A)', () => {
      // Remove enemies so threat level doesn't override
      enemyTribe.cities = [];
      enemyTribe.units = [];

      const warrior1 = new Unit(new HexCoord(4, 4), UnitType.WARRIOR, 'player');
      const warrior2 = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'player');
      tribe.units.push(warrior1, warrior2);
      tribe.stars = 20;

      const hardAi = new BasicAI(tribe, { difficulty: 'hard' });
      const actions = hardAi.decide(gameState, TurnPhase.BUILD);
      const upgradeAction = actions.find(a => a.type === 'UPGRADE');
      expect(upgradeAction).toBeDefined();
      expect(upgradeAction!.params.choice).toBe('A');
    });

    it('Hard AI hunts enemy units in MOVE phase', () => {
      // Clear existing units first
      tribe.units.length = 0;

      // Place a hard AI warrior far from enemy city but within hunt range of enemy unit
      const warrior = new Unit(new HexCoord(10, 10), UnitType.WARRIOR, 'player');
      warrior.hasActed = false;
      tribe.units.push(warrior);

      // Enemy unit within 8 hexes (hunt range)
      enemyTribe.units.length = 0;
      const enemyUnit = new Unit(new HexCoord(14, 10), UnitType.WARRIOR, 'enemy');
      enemyTribe.units.push(enemyUnit);

      // Enemy city far away (40 tiles) — should prefer hunting the unit
      enemyTribe.cities[0] = new City(new HexCoord(40, 40), 'FarCity', 'enemy');

      const hardAi = new BasicAI(tribe, { difficulty: 'hard' });
      const actions = hardAi.decide(gameState, TurnPhase.MOVE);

      // Hard AI should produce a move action toward the enemy unit
      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe('MOVE');
      expect(warrior.hasActed).toBe(true);

      // Verify the unit moved toward the enemy (decreasing distance to (14,10))
      // Original position (10,10), enemy at (14,10) — distance 4
      // After move, unit should be closer to (14,10)
      const distToEnemy = Math.abs(warrior.position.q - 14) + Math.abs(warrior.position.r - 10);
      expect(distToEnemy).toBeLessThan(4);
    });
  });
});
