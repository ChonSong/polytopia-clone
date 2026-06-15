import { HexCoord } from '../hex/HexCoord';
import { Biome } from '../hex/Tile';

export interface CityResource {
  food: number;
  stars: number;
}

/** Static city name pools per tribe (4 tribes, ~6 names each) */
export const CITY_NAMES: Record<string, string[]> = {
  'Xin-xi':   ['Xin', 'Xi', 'An', 'Tu', 'Li', 'Kai'],
  Imperius:   ['Imperius', 'Lucian', 'Aurelius', 'Caesar', 'Titus', 'Octavius'],
  Bardur:     ['Bardur', 'Bjarni', 'Bjorn', 'Ulf', 'Hakon', 'Ragnar'],
  Oumaji:     ['Oumaji', 'Kazim', 'Jafar', 'Zara', 'Omar', 'Nadia'],
};

/** Resource yield contributed by each adjacent biome tile. */
export const BIOME_YIELDS: Partial<Record<Biome, CityResource>> = {
  [Biome.GRASS]:    { food: 1, stars: 1 },
  [Biome.FOREST]:   { food: 2, stars: 0 },
  [Biome.MOUNTAIN]: { food: 0, stars: 2 },
  [Biome.WATER]:    { food: 1, stars: 0 },
  [Biome.SAND]:     { food: 0, stars: 1 },
};

export class City {
  public readonly id: string;
  public level: number;       // 1-5
  public population: number;
  public canBuildUnits: boolean;
  public captured: boolean;
  public levelStarsBonus: number; // bonus ⭐/turn from level upgrades

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
  }

  /** A city can grow (level up) when population >= current level and level < 5. */
  canGrow(): boolean {
    return this.population >= this.level && this.level < 5;
  }

  /** Level up the city. Does nothing if canGrow() is false. */
  grow(): void {
    if (!this.canGrow()) return;
    this.level++;
    this.canBuildUnits = this.level >= 2;
    // Each level adds +1⭐/turn production bonus
    this.levelStarsBonus = this.level - 1;
  }

  /** Total stars produced per turn (base yields + level bonus). */
  getStarsPerTurn(adjacentBiomes: Biome[]): number {
    return this.produceResources(adjacentBiomes).stars + this.levelStarsBonus;
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
