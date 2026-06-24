import { HexCoord } from '../hex/HexCoord';
import { TileData, Biome } from '../hex/Tile';
import { Tribe } from '../entities/Tribe';
import { City } from '../entities/City';
import { Unit, UnitType, UNIT_COSTS, UNIT_BASE_STATS, UNIT_MAX_HEALTH } from '../entities/Unit';
import { GameState } from '../entities/GameState';
import { Action, TurnPhase } from '../entities/TurnManager';
import { TECH_DEFS, TECH_SERIES_ORDER, TechId, techCost } from '../entities/TechTree';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Biomes that ground units can traverse. */
const WALKABLE_BIOMES: Set<Biome> = new Set([
  Biome.GRASS,
  Biome.FOREST,
  Biome.SAND,
  Biome.SNOW,
]);

/** Biomes that naval units can traverse (water + coastal). */
const NAVAL_BIOMES: Set<Biome> = new Set([
  Biome.GRASS,
  Biome.FOREST,
  Biome.SAND,
  Biome.SNOW,
  Biome.WATER,
]);

// ---------------------------------------------------------------------------
// Visibility (fog of war)
// ---------------------------------------------------------------------------

/**
 * Determine which hex coordinates are visible to `tribe`.
 * A tile is visible if it is within sightRange of any of the tribe's cities or units.
 */
export function getVisibleTiles(
  tribe: Tribe,
  tileMap: Map<string, TileData>,
): Set<string> {
  const visible = new Set<string>();

  const addRadius = (center: HexCoord, radius: number) => {
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = -radius; dr <= radius; dr++) {
        const ds = -dq - dr;
        if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds)) <= radius) {
          visible.add(`${center.q + dq},${center.r + dr}`);
        }
      }
    }
  };

  for (const city of tribe.cities) {
    addRadius(city.position, 3);
  }
  for (const unit of tribe.units) {
    addRadius(unit.position, 2);
  }

  return visible;
}

// ---------------------------------------------------------------------------
// Pathfinding (BFS on hex grid)
// ---------------------------------------------------------------------------

/**
 * Simple BFS returning the first step direction from `start` toward `goal`,
 * respecting walkable terrain. Returns the adjacent HexCoord to move to, or
 * null if no path exists.
 *
 * The `maxDist` parameter sets a search limit beyond which BFS stops exploring.
 * If the goal is beyond maxDist, we search up to maxDist to find the best
 * intermediate step toward the goal (greedy heuristic: pick the neighbor that
 * is closest to the goal).
 */
export function bfsPathStep(
  start: HexCoord,
  goal: HexCoord,
  tileMap: Map<string, TileData>,
  maxDist: number,
  isNaval = false,
): HexCoord | null {
  if (start.equals(goal)) return null;

  const visited = new Set<string>();
  const cameFrom = new Map<string, { q: number; r: number } | null>();
  const startKey = `${start.q},${start.r}`;
  const goalKey = `${goal.q},${goal.r}`;

  const queue: { q: number; r: number; dist: number }[] = [{ q: start.q, r: start.r, dist: 0 }];
  visited.add(startKey);
  cameFrom.set(startKey, null);

  // Track the closest reachable node to goal (for when goal is beyond maxDist)
  let closestNode: { q: number; r: number; dist: number } | null = null;
  let closestDist = Infinity;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.q === goal.q && cur.r === goal.r) {
      // Reconstruct the first step
      let node = { q: cur.q, r: cur.r };
      let parent = cameFrom.get(`${node.q},${node.r}`);
      while (parent !== null) {
        const next = node;
        node = parent!;
        parent = cameFrom.get(`${node.q},${node.r}`);
        if (parent === null) {
          return new HexCoord(next.q, next.r);
        }
      }
      return new HexCoord(node.q, node.r);
    }

    if (cur.dist >= maxDist) continue;

    const neighbors = HexCoord.DIRECTIONS.map(d => ({ q: cur.q + d.q, r: cur.r + d.r }));
    for (const nb of neighbors) {
      const key = `${nb.q},${nb.r}`;
      if (visited.has(key)) continue;
      const tile = tileMap.get(key);
      if (!tile) continue;
      const walkable = isNaval ? NAVAL_BIOMES : WALKABLE_BIOMES;
      if (!walkable.has(tile.biome)) continue;

      visited.add(key);
      cameFrom.set(key, { q: cur.q, r: cur.r });
      const distFromGoal = Math.abs(nb.q - goal.q) + Math.abs(nb.r - goal.r);
      if (distFromGoal < closestDist) {
        closestDist = distFromGoal;
        closestNode = { q: nb.q, r: nb.r, dist: cur.dist + 1 };
      }
      queue.push({ q: nb.q, r: nb.r, dist: cur.dist + 1 });
    }
  }

  // Goal not found within maxDist — try returning the first step toward the
  // closest reachable tile (if it's closer than start).
  if (closestNode && closestDist < Math.abs(start.q - goal.q) + Math.abs(start.r - goal.r)) {
    // Walk back from closestNode to find first step
    let node = { q: closestNode.q, r: closestNode.r };
    let parent = cameFrom.get(`${node.q},${node.r}`);
    while (parent !== null) {
      const next = node;
      node = parent!;
      parent = cameFrom.get(`${node.q},${node.r}`);
      if (parent === null) {
        return new HexCoord(next.q, next.r);
      }
    }
  }

  return null; // no path found
}

// ---------------------------------------------------------------------------
// Difficulty Levels
// ---------------------------------------------------------------------------

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/** Difficulty presets that scale AI aggression, economy, and tech priorities. */
export const DIFFICULTY_PRESETS: Record<DifficultyLevel, AIOptions> = {
  easy: {
    minUnitsForUpgrade: 1,
    preferredUnit: UnitType.WARRIOR,
    difficulty: 'easy',
    /** Stars above which the AI prefers unit-unlocking techs — higher = more cautious. */
    techStarsThreshold: 15,
    /** Chance (0-1) that a healthy unit skips its move turn. Higher = slower expansion. */
    moveSkipChance: 0.3,
  },
  medium: {
    minUnitsForUpgrade: 2,
    preferredUnit: UnitType.WARRIOR,
    difficulty: 'medium',
    techStarsThreshold: 10,
    moveSkipChance: 0,
  },
  hard: {
    minUnitsForUpgrade: 4,
    preferredUnit: UnitType.SWORDSMAN,
    difficulty: 'hard',
    techStarsThreshold: 5,
    moveSkipChance: 0,
  },
};

// ---------------------------------------------------------------------------
// BasicAI
// ---------------------------------------------------------------------------

export interface AIOptions {
  /** Minimum number of units before the AI considers upgrading cities. */
  minUnitsForUpgrade: number;
  /** Unit type to train by default. */
  preferredUnit: UnitType;
  /** Difficulty level. */
  difficulty: DifficultyLevel;
  /** Stars above which the AI prefers unit-unlocking techs (default: 10). */
  techStarsThreshold: number;
  /** Chance (0-1) that a healthy unit skips its move for slower expansion (easy mode). */
  moveSkipChance: number;
  /** Game speed multiplier for cost calculations (1.0 = normal, 0.75 = fast, 0.5 = blitz, default: 1.0). */
  speedMultiplier?: number;
}

const DEFAULT_OPTIONS: AIOptions = {
  minUnitsForUpgrade: 2,
  preferredUnit: UnitType.WARRIOR,
  difficulty: 'medium',
  techStarsThreshold: 10,
  moveSkipChance: 0,
  speedMultiplier: 1.0,
};

/**
 * Simple AI opponent for a single tribe.
 *
 * Decision priority:
 *   1. Defend own cities (move nearby units toward threats)
 *   2. Attack enemy units / cities
 *   3. Explore / expand
 */
export class BasicAI {
  private tribe: Tribe;
  private options: AIOptions;

  constructor(tribe: Tribe, options: Partial<AIOptions> = {}) {
    this.tribe = tribe;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Apply speed multiplier to a base cost, rounding up (minimum 1). */
  private speedAdjustedCost(baseCost: number): number {
    return Math.ceil(baseCost * (this.options.speedMultiplier ?? 1.0));
  }

  /** Get the tribe this AI controls. */
  getTribe(): Tribe {
    return this.tribe;
  }

  // -----------------------------------------------------------------------
  // Main decision entry point
  // -----------------------------------------------------------------------

  /**
   * Produce a list of actions for the current turn phase.
   */
  decide(gameState: GameState, phase: TurnPhase): Action[] {
    switch (phase) {
      case TurnPhase.BUILD:
        return this.decideBuild(gameState);
      case TurnPhase.MOVE:
        return this.decideMove(gameState);
      case TurnPhase.ATTACK:
        return this.decideAttack(gameState);
      default:
        return [];
    }
  }

  // -----------------------------------------------------------------------
  // BUILD phase
  // -----------------------------------------------------------------------

  private decideBuild(gameState: GameState): Action[] {
    const actions: Action[] = [];

    if (this.tribe.cities.length === 0) return actions;

    // Priority 1: Train units if we have fewer than minUnitsForUpgrade (scaled by difficulty: Easy=1, Medium=2, Hard=4)
    if (this.tribe.units.length < this.options.minUnitsForUpgrade) {
      for (const city of this.tribe.cities) {
        const unitTypes = this.tribe.getTrainableUnitTypes();
        // Pick the best affordable unit (favor high attack)
        const best = unitTypes
          .map(ut => ({ type: ut, cost: this.speedAdjustedCost(UNIT_COSTS[ut]) }))
          .filter(u => this.tribe.stars >= u.cost)
          .sort((a, b) => UNIT_BASE_STATS[b.type].attack - UNIT_BASE_STATS[a.type].attack);
        if (best.length > 0 && city) {
          const chosen = best[0];
          actions.push({
            type: 'TRAIN',
            params: { cityId: city.id, unitType: chosen.type, cost: chosen.cost },
          });
          break;
        }
      }
    } else {
      // Priority 2: Upgrade the cheapest (lowest-level) city
      const sortedCities = [...this.tribe.cities].sort((a, b) => a.level - b.level);
      for (const city of sortedCities) {
        const cost = this.speedAdjustedCost(city.level * 5);
        if (this.tribe.stars >= cost && city.canGrow()) {
          // Pick a random upgrade choice
          const choice = Math.random() < 0.5 ? 'A' : 'B';
          actions.push({
            type: 'UPGRADE',
            params: { cityId: city.id, cost, choice },
          });
          break;
        }
      }
    }

    // If we had no build actions, try researching a tech
    if (actions.length === 0) {
      const techAction = this.decideTechResearch(gameState);
      if (techAction) actions.push(techAction);
    }

    return actions;
  }

  /**
   * Pick a tech to research.
   *
   * GDD §6, §7.1 — Smart tech priority:
   * - If the AI has spare stars (>10), prioritize techs that unlock new unit types
   *   (sorted by the highest attack stat among unlocked units).
   * - Otherwise (stars <= 10 or no unit-unlocking tech available), pick the cheapest
   *   affordable unresearched tech with met prereqs (old behaviour).
   */
  private decideTechResearch(gameState: GameState): Action | null {
    const numCities = this.tribe.cities.filter(c => !c.captured).length;
    const allTechs = Object.values(TECH_DEFS);
    const affordable = allTechs
      .filter(t => !this.tribe.hasTech(t.id))
      .filter(t => t.prerequisites.every(p => this.tribe.hasTech(p)))
      .map(t => ({ techId: t.id, cost: this.speedAdjustedCost(techCost(t.tier, numCities)) }))
      .filter(t => this.tribe.stars >= t.cost);
    if (affordable.length === 0) return null;

    // GDD §7.1 — When AI has spare stars, prioritise unit-unlocking techs
    // Threshold is scaled by difficulty: Easy=15, Medium=10, Hard=5
    if (this.tribe.stars > this.options.techStarsThreshold) {
      const unitTechs = affordable
        .filter(t => TECH_DEFS[t.techId].unlocksUnits.length > 0)
        .sort((a, b) => {
          const aMaxAtk = Math.max(
            ...TECH_DEFS[a.techId].unlocksUnits.map(ut => UNIT_BASE_STATS[ut].attack),
          );
          const bMaxAtk = Math.max(
            ...TECH_DEFS[b.techId].unlocksUnits.map(ut => UNIT_BASE_STATS[ut].attack),
          );
          return bMaxAtk - aMaxAtk; // highest-attack unit first
        });
      if (unitTechs.length > 0) {
        return {
          type: 'RESEARCH',
          params: { techId: unitTechs[0].techId, cost: unitTechs[0].cost },
        };
      }
    }

    // Fallback: cheapest affordable tech (original behaviour)
    affordable.sort((a, b) => a.cost - b.cost);
    return {
      type: 'RESEARCH',
      params: { techId: affordable[0].techId, cost: affordable[0].cost },
    };
  }

  // -----------------------------------------------------------------------
  // MOVE phase
  // -----------------------------------------------------------------------

  /** Gather enemy cities from other tribes. */
  private getEnemyCities(gameState: GameState): { position: HexCoord; tribeId: string }[] {
    const result: { position: HexCoord; tribeId: string }[] = [];
    for (const tribe of gameState.tribes) {
      if (tribe === this.tribe || tribe.isDefeated()) continue;
      for (const city of tribe.cities) {
        result.push({ position: city.position, tribeId: tribe.id });
      }
    }
    return result;
  }

  /** Gather enemy units from other tribes. */
  private getEnemyUnits(gameState: GameState): Unit[] {
    const result: Unit[] = [];
    for (const tribe of gameState.tribes) {
      if (tribe === this.tribe || tribe.isDefeated()) continue;
      for (const unit of tribe.units) {
        if (unit.isAlive) result.push(unit);
      }
    }
    return result;
  }

  private decideMove(gameState: GameState): Action[] {
    const actions: Action[] = [];
    const tileMap = this.getTileMap(gameState);
    const enemyCities = this.getEnemyCities(gameState);
    const enemyUnits = this.getEnemyUnits(gameState);
    const ownCities = this.tribe.cities;

    if (this.tribe.units.length === 0) return actions;

    for (const unit of this.tribe.units) {
      if (unit.hasActed || !unit.isAlive) continue;

      // Difficulty-based: Easy AI sometimes skips moves for slower expansion
      if (this.options.moveSkipChance > 0 && Math.random() < this.options.moveSkipChance) {
        continue;
      }

      // Priority 0: GDD §7 — Heal damaged units in friendly territory
      const belowHalfHp = unit.health < UNIT_MAX_HEALTH[unit.type] / 2;
      const nearFriendlyCity = this.tribe.cities.some(city =>
        unit.position.distanceTo(city.position) <= 2,
      );
      if (belowHalfHp && nearFriendlyCity) {
        // Skip this unit — it stays idle and gets healed by healInactiveUnits
        continue;
      }

      let target: HexCoord | null = null;

      // Priority 1: Defend threatened cities
      const threatenedCity = ownCities.find(city =>
        enemyUnits.some(eu => city.position.distanceTo(eu.position) <= 3),
      );
      if (threatenedCity && enemyUnits.length > 0) {
        const nearestThreat = enemyUnits
          .filter(eu => threatenedCity!.position.distanceTo(eu.position) <= 3)
          .sort((a, b) =>
            unit.position.distanceTo(a.position) - unit.position.distanceTo(b.position),
          )[0];
        if (nearestThreat) {
          target = nearestThreat.position;
        }
      }

      // Priority 2: Move toward nearest enemy city
      if (!target && enemyCities.length > 0) {
        const nearest = enemyCities
          .sort(
            (a, b) =>
              unit.position.distanceTo(a.position) - unit.position.distanceTo(b.position),
          )[0];
        target = nearest.position;
      }

      // Priority 2.5: Move toward nearest visible village (GDD §2.5)
      if (!target) {
        const villageTarget = this.findNearestVillage(unit, tileMap);
        if (villageTarget) {
          target = villageTarget;
        }
      }

      // Priority 3: Explore — move toward nearest unseen walkable tile
      if (!target) {
        const visible = getVisibleTiles(this.tribe, tileMap);
        const unseenTarget = this.findExploreTarget(unit, tileMap, visible);
        if (unseenTarget) {
          target = unseenTarget;
        }
      }

      if (!target) continue;

      const step = bfsPathStep(unit.position, target, tileMap, unit.movementRange, unit.isNaval);
      if (step && !step.equals(unit.position)) {
        actions.push({
          type: 'MOVE',
          params: {
            unitId: unit.id,
            fromQ: unit.position.q,
            fromR: unit.position.r,
            toQ: step.q,
            toR: step.r,
          },
        });
        // Update unit position for subsequent decisions in the same phase
        unit.position = step;
        unit.hasActed = true;
      }
    }

    return actions;
  }

  /**
   * Find a tile to explore: the closest unseen walkable tile.
   */
  private findExploreTarget(
    unit: Unit,
    tileMap: Map<string, TileData>,
    visible: Set<string>,
  ): HexCoord | null {
    const walkable = unit.isNaval ? NAVAL_BIOMES : WALKABLE_BIOMES;
    let best: HexCoord | null = null;
    let bestDist = Infinity;

    for (const [key, tile] of tileMap) {
      if (!walkable.has(tile.biome)) continue;
      if (visible.has(key)) continue;
      const [q, r] = key.split(',').map(Number);
      const coord = new HexCoord(q, r);
      const dist = unit.position.distanceTo(coord);
      if (dist < bestDist && dist > 0) {
        bestDist = dist;
        best = coord;
      }
    }

    return best;
  }

  /** GDD §2.5 — Find the nearest village for a unit to capture. */
  private findNearestVillage(unit: Unit, tileMap: Map<string, TileData>): HexCoord | null {
    const walkable = unit.isNaval ? NAVAL_BIOMES : WALKABLE_BIOMES;
    let best: HexCoord | null = null;
    let bestDist = Infinity;

    for (const [key, tile] of tileMap) {
      if (!tile.village) continue;
      if (!walkable.has(tile.biome)) continue;
      const [q, r] = key.split(',').map(Number);
      const coord = new HexCoord(q, r);
      const dist = unit.position.distanceTo(coord);
      if (dist < bestDist && dist > 0) {
        bestDist = dist;
        best = coord;
      }
    }

    return best;
  }

  // -----------------------------------------------------------------------
  // ATTACK phase
  // -----------------------------------------------------------------------

  private decideAttack(gameState: GameState): Action[] {
    const actions: Action[] = [];
    const enemyCities = this.getEnemyCities(gameState);
    const enemyUnits = this.getEnemyUnits(gameState);

    for (const unit of this.tribe.units) {
      if (!unit.isAlive) continue;

      // GDD §8.4 — Collect all adjacent enemies, then sort by priority:
      //   1. Ascending current HP (finish off weak targets first)
      //   2. Descending attack value for ties (eliminate biggest threats)
      const adjacentEnemies: Unit[] = [];
      const adjacentPositions: { q: number; r: number }[] = [];

      for (const neighbor of unit.position.neighbors()) {
        const enemyUnit = enemyUnits.find(
          eu => eu.position.q === neighbor.q && eu.position.r === neighbor.r,
        );
        if (enemyUnit) {
          adjacentEnemies.push(enemyUnit);
          adjacentPositions.push({ q: neighbor.q, r: neighbor.r });
        }
      }

      // Sort: lowest HP first, then highest attack for ties
      const indexed = adjacentEnemies.map((eu, i) => ({ enemy: eu, pos: adjacentPositions[i] }));
      indexed.sort((a, b) => {
        if (a.enemy.health !== b.enemy.health) return a.enemy.health - b.enemy.health;
        return b.enemy.attack - a.enemy.attack;
      });

      // Attack sorted enemies
      for (const { enemy, pos } of indexed) {
        actions.push({
          type: 'ATTACK',
          params: {
            unitId: unit.id,
            targetId: enemy.id,
            targetType: 'unit',
            targetQ: pos.q,
            targetR: pos.r,
          },
        });
        // GDD §3.3 — Persist (Knight) can attack all adjacent enemies; others get one attack
        if (!unit.hasPersist) break;
      }

      // If no enemy units adjacent, check adjacent cities
      if (indexed.length === 0) {
        for (const neighbor of unit.position.neighbors()) {
          const enemyCity = enemyCities.find(
            ec => ec.position.q === neighbor.q && ec.position.r === neighbor.r,
          );
          if (enemyCity) {
            actions.push({
              type: 'ATTACK',
              params: {
                unitId: unit.id,
                targetId: `city-${neighbor.q}-${neighbor.r}`,
                targetType: 'city',
                targetQ: neighbor.q,
                targetR: neighbor.r,
              },
            });
            break; // only attack one city
          }
        }
      }
    }

    return actions;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Get the tile map from the game state.
   * The project's GameState doesn't have a tileMap property directly,
   * but in practice the AI needs access to it. We derive it from
   * visibility / ownership or pass it via a custom property.
   *
   * For now we check for a custom `tileMap` property set externally,
   * or fall back to an empty map.
   */
  private getTileMap(gameState: GameState): Map<string, TileData> {
    // The GameState class doesn't include tileMap directly.
    // We expect the caller to attach it, or we provide an empty map.
    const cast = gameState as unknown as { tileMap?: Map<string, TileData> };
    return cast.tileMap ?? new Map();
  }
}
