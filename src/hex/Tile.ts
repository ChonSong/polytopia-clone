export enum Biome {
  GRASS = 'GRASS',
  FOREST = 'FOREST',
  MOUNTAIN = 'MOUNTAIN',
  WATER = 'WATER',
  SAND = 'SAND',
  SNOW = 'SNOW',
  // GDD §7.1 — Polaris freeze biomes
  ICE = 'ICE',
  TUNDRA = 'TUNDRA',
}

export enum Resource {
  ANIMALS = 'ANIMALS',
  FISH = 'FISH',
  FRUIT = 'FRUIT',
  METAL = 'METAL',
  CROPS = 'CROPS',
}

export interface TileData {
  biome: Biome;
  elevation: number; // 0-1
  resource?: Resource;
  city?: boolean;
  /** GDD §5.3 — City Wall upgrade gives ×4 defense on this tile. */
  cityWall?: boolean;
  unit?: boolean;
  /** GDD §2.5 — Neutral village that can be captured to become a city. */
  village?: boolean;
  /** GDD §2.6 — Ancient ruin that reveals a reward when discovered. */
  ruin?: boolean;
  /** GDD §2.6 — Whether this ruin has been discovered already. */
  ruinDiscovered?: boolean;
  /** GDD §5.7 — Road built on this tile (terrestrial). Halves movement cost. */
  road?: boolean;
  /** GDD §5.7 — Bridge built on this tile (aquatic). Halves movement cost on water. */
  bridge?: boolean;
  /** GDD §5.2 — Building placed on this tile (Lumber Hut, Mine, Farm, etc.). */
  building?: BuildingType;
}

import { BuildingType } from '../entities/Building';

export const BiomeColors: Record<Biome, number> = {
  [Biome.GRASS]: 0x5a8f3c,
  [Biome.FOREST]: 0x2d6b1e,
  [Biome.MOUNTAIN]: 0x6b5b4a,
  [Biome.WATER]: 0x3b7dbd,
  [Biome.SAND]: 0xd4b86a,
  [Biome.SNOW]: 0xffffff,
  // GDD §7.1 — Polaris freeze biome colors
  [Biome.ICE]: 0xb0e0e6,
  [Biome.TUNDRA]: 0xc8d8c8,
};

/** Resource dot colors for rendering. */
export const ResourceColors: Record<Resource, number> = {
  [Resource.ANIMALS]: 0xf4a460,
  [Resource.FISH]:   0x00bfff,
  [Resource.FRUIT]:  0xff6347,
  [Resource.METAL]:  0xc0c0c0,
  [Resource.CROPS]:  0xdaa520,
};
