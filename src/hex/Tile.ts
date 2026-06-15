export enum Biome {
  GRASS = 'GRASS',
  FOREST = 'FOREST',
  MOUNTAIN = 'MOUNTAIN',
  WATER = 'WATER',
  SAND = 'SAND',
  SNOW = 'SNOW',
}

export interface TileData {
  biome: Biome;
  elevation: number; // 0-1
  city?: boolean;
  unit?: boolean;
}

export const BiomeColors: Record<Biome, number> = {
  [Biome.GRASS]: 0x5a8f3c,
  [Biome.FOREST]: 0x2d6b1e,
  [Biome.MOUNTAIN]: 0x6b5b4a,
  [Biome.WATER]: 0x3b7dbd,
  [Biome.SAND]: 0xd4b86a,
  [Biome.SNOW]: 0xffffff,
};
