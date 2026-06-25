import { HexCoord } from '../hex/HexCoord';
import { Biome, Resource } from '../hex/Tile';
import { BuildingDef, BuildingType, BUILDING_DEFS } from './Building';

export interface CityResource {
  food: number;
  stars: number;
}

/** Static city name pools per tribe (4 tribes, ~6 names each) */
export const CITY_NAMES: Record<string, string[]> = {
  'Xin-xi':   ['Xin', 'Xi', 'An', 'Tu', 'Li', 'Kai'],
  'Imperius':   ['Imperius', 'Lucian', 'Aurelius', 'Caesar', 'Titus', 'Octavius'],
  'Bardur':     ['Bardur', 'Bjarni', 'Bjorn', 'Ulf', 'Hakon', 'Ragnar'],
  'Oumaji':     ['Oumaji', 'Kazim', 'Jafar', 'Zara', 'Omar', 'Nadia'],
  // GDD §7.1 — Polaris tribe
  'Polaris':    ['Polaris', 'Frostheim', 'Glacier', 'Nordheim', 'Icehold', 'Cryon'],
};

/** Resource yield contributed by each adjacent biome tile. */
export const BIOME_YIELDS: Partial<Record<Biome, CityResource>> = {
  [Biome.GRASS]:    { food: 1, stars: 1 },
  [Biome.FOREST]:   { food: 2, stars: 0 },
  [Biome.MOUNTAIN]: { food: 0, stars: 2 },
  [Biome.WATER]:    { food: 1, stars: 0 },
  [Biome.SAND]:     { food: 0, stars: 1 },
  // GDD §7.1 — Polaris freeze biomes
  [Biome.ICE]:      { food: 0, stars: 1 },
  [Biome.TUNDRA]:   { food: 1, stars: 0 },
};

export class City {
  public readonly id: string;
  public level: number;       // 1-5
  public population: number;
  public canBuildUnits: boolean;
  public captured: boolean;
  public levelStarsBonus: number; // bonus ⭐/turn from level upgrades
  public buildings: BuildingType[];
  public food: number;        // accumulated food toward next population growth
  public foodPerTurn: number; // food generated per turn
  public giantSpawned: boolean; // whether the level-5 super unit has been spawned
  /** GDD §5.8 — Whether this city is under siege (enemy unit on central tile). */
  public isBesieged: boolean;

  /** GDD §5.3 — tracks binary upgrade choices per level (2=A, 3=B, etc.) */
  public upgradeChoices: Record<number, 'A' | 'B'> = {};

  /** GDD §5.7 — IDs of cities this city is connected to via roads/bridges/ports. */
  public connectedCityIds: string[] = [];

  /** GDD §5.7 — Whether Grand Bazaar bonus has been awarded (5+ connections). */
  public hasGrandBazaar: boolean = false;

  /** GDD §1.2 — Number of temples built in this city (scoring category ×20). */
  public templeCount: number = 0;

  constructor(
    public position: HexCoord,
    public name: string,
    public tribeId: string,
    level = 1,
    population = 1,
  ) {
    this.id = `${tribeId}-${name}-${position.toString()}`;
    this.level = level;
    this.population = population;
    this.canBuildUnits = level >= 2;
    this.captured = false;
    this.levelStarsBonus = 0;
    this.buildings = [];
    this.food = 0;
    this.foodPerTurn = 0;
    this.giantSpawned = false;
    this.isBesieged = false;
  }

  // ── GDD §5.3 Computed Properties ─────────────────────────────────────

  get hasWorkshop(): boolean { return this.upgradeChoices[2] === 'A'; }
  get hasExplorer(): boolean { return this.upgradeChoices[2] === 'B'; }
  get hasCityWall(): boolean { return this.upgradeChoices[3] === 'A'; }
  get hasResources(): boolean { return this.upgradeChoices[3] === 'B'; }
  get hasPopulationGrowth(): boolean { return this.upgradeChoices[4] === 'A'; }
  get hasBorderGrowth(): boolean { return this.upgradeChoices[4] === 'B'; }
  get hasPark(): boolean { return this.upgradeChoices[5] === 'A'; }

  /** GDD §5.2 — Territory radius equals city level (L1=1, L2=2, … L5=5). */
  get territoryRadius(): number {
    return this.level;
  }

  // ─────────────────────────────────────────────────────────────────────

  /** A city can grow (level up) when population >= current level and level < 5. */
  canGrow(): boolean {
    return this.population >= this.level && this.level < 5;
  }

  /**
   * Apply a GDD §5.3 binary upgrade choice and advance the city level.
   * Does nothing if canGrow() is false.
   * Immediate effects (spawning scouts, +stars, +pop) must be handled by the caller.
   */
  applyLevelUp(choice: 'A' | 'B'): void {
    if (!this.canGrow()) return;
    const newLevel = this.level + 1;
    this.upgradeChoices[newLevel] = choice;
    this.level = newLevel;
    this.levelStarsBonus = this.level - 1;
    this.canBuildUnits = this.level >= 2;
  }

  /**
   * Legacy level-up method (no choice). Used by AI fallback.
   * Picks a random choice for backward compatibility.
   */
  grow(): void {
    if (!this.canGrow()) return;
    const choice = Math.random() < 0.5 ? 'A' : 'B';
    this.applyLevelUp(choice);
  }

  /** Total stars produced per turn (base yields + level bonus + buildings + workshop). */
  getStarsPerTurn(adjacentBiomes: Biome[]): number {
    if (this.isBesieged) return 0;
    let bonus = 0;
    for (const b of this.buildings) {
      bonus += BUILDING_DEFS[b].starsBonus;
    }
    if (this.hasWorkshop) bonus += 1;
    return this.produceResources(adjacentBiomes).stars + this.levelStarsBonus + bonus;
  }

  /** Calculate food per turn from adjacent biomes. */
  calcFoodPerTurn(adjacentBiomes: Biome[]): number {
    let food = 0;
    for (const biome of adjacentBiomes) {
      const yieldVal = BIOME_YIELDS[biome];
      if (yieldVal) food += yieldVal.food;
    }
    this.foodPerTurn = food;
    return food;
  }

  /** Process food accumulation for one turn. Returns true if population grew. */
  processFood(adjacentBiomes: Biome[]): boolean {
    this.calcFoodPerTurn(adjacentBiomes);
    this.food += this.foodPerTurn;
    const threshold = this.population * 10;
    if (this.food >= threshold && this.population < 10) {
      this.food -= threshold;
      this.population++;
      return true;
    }
    return false;
  }

  /** Check if a building can be built on an adjacent tile with the given resource. */
  canBuild(building: BuildingType, adjacentResources: Resource[]): boolean {
    const def = BUILDING_DEFS[building];
    if (this.buildings.includes(building)) return false;
    return adjacentResources.includes(def.requiresResource);
  }

  /**
   * Calculate resources produced this turn based on the biomes of
   * the six tiles adjacent to the city's position.
   */
  produceResources(adjacentBiomes: Biome[]): CityResource {
    const total: CityResource = { food: 0, stars: 0 };
    for (const biome of adjacentBiomes) {
      const yieldVal = BIOME_YIELDS[biome];
      if (yieldVal) {
        total.food += yieldVal.food;
        total.stars += yieldVal.stars;
      }
    }
    return total;
  }
}
