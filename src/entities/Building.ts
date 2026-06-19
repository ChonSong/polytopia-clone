import { Resource } from '../hex/Tile';

export enum BuildingType {
  LUMBER_HUT = 'LUMBER_HUT',
  MINE = 'MINE',
  FARM = 'FARM',
  PORT = 'PORT',
  /** GDD §5.7 — Road: built on land tiles, halves movement cost. */
  ROAD = 'ROAD',
  /** GDD §5.7 — Bridge: built on water tiles, halves movement cost on water. */
  BRIDGE = 'BRIDGE',
}

export interface BuildingDef {
  type: BuildingType;
  name: string;
  cost: number;
  /** Resource this building requires on the tile. */
  requiresResource: Resource;
  /** Population added when built. */
  popBonus: number;
  /** Extra stars per turn. */
  starsBonus: number;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  [BuildingType.LUMBER_HUT]: {
    type: BuildingType.LUMBER_HUT,
    name: 'Lumber Hut',
    cost: 3,
    requiresResource: Resource.ANIMALS,
    popBonus: 1,
    starsBonus: 0,
  },
  [BuildingType.MINE]: {
    type: BuildingType.MINE,
    name: 'Mine',
    cost: 5,
    requiresResource: Resource.METAL,
    popBonus: 2,
    starsBonus: 1,
  },
  [BuildingType.FARM]: {
    type: BuildingType.FARM,
    name: 'Farm',
    cost: 5,
    requiresResource: Resource.CROPS,
    popBonus: 2,
    starsBonus: 0,
  },
  [BuildingType.PORT]: {
    type: BuildingType.PORT,
    name: 'Port',
    cost: 7,
    requiresResource: Resource.FISH,
    popBonus: 1,
    starsBonus: 2,
  },
  [BuildingType.ROAD]: {
    type: BuildingType.ROAD,
    name: 'Road',
    cost: 3,
    requiresResource: Resource.ANIMALS,
    popBonus: 0,
    starsBonus: 0,
  },
  [BuildingType.BRIDGE]: {
    type: BuildingType.BRIDGE,
    name: 'Bridge',
    cost: 5,
    requiresResource: Resource.METAL,
    popBonus: 0,
    starsBonus: 0,
  },
};
