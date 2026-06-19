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
  /** GDD §7.1 — Ice Bank: Polaris tribe building, income scales with frozen tiles. */
  ICE_BANK = 'ICE_BANK',
  /** GDD §7.2 — Fungi Farm: Cymanti building, replaces Farm for organic economy. */
  FUNGI_FARM = 'FUNGI_FARM',
  /** GDD §7.2 — Mycelium Network: Cymanti road that heals units. */
  MYCELIUM_NETWORK = 'MYCELIUM_NETWORK',
  /** GDD §7.2 — Algae Bridge: Cymanti water crossing without Port. */
  ALGAE_BRIDGE = 'ALGAE_BRIDGE',
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
  [BuildingType.ICE_BANK]: {
    type: BuildingType.ICE_BANK,
    name: 'Ice Bank',
    cost: 7,
    requiresResource: Resource.FISH,
    popBonus: 1,
    starsBonus: 0, // Income scales with frozen tiles — computed dynamically
  },
  [BuildingType.FUNGI_FARM]: {
    type: BuildingType.FUNGI_FARM,
    name: 'Fungi Farm',
    cost: 5,
    requiresResource: Resource.CROPS,
    popBonus: 2,
    starsBonus: 0, // Organic economy — food bonus instead of stars
  },
  [BuildingType.MYCELIUM_NETWORK]: {
    type: BuildingType.MYCELIUM_NETWORK,
    name: 'Mycelium Network',
    cost: 3,
    requiresResource: Resource.ANIMALS,
    popBonus: 0,
    starsBonus: 0, // Heals units that move through — effect computed dynamically
  },
  [BuildingType.ALGAE_BRIDGE]: {
    type: BuildingType.ALGAE_BRIDGE,
    name: 'Algae Bridge',
    cost: 5,
    requiresResource: Resource.FISH,
    popBonus: 0,
    starsBonus: 0, // Allows water crossing without Port
  },
};
