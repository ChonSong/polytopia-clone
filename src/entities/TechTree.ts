import { UnitType } from './Unit';

// ---------------------------------------------------------------------------
// Tech definitions
// ---------------------------------------------------------------------------

export enum TechId {
  HUNTING     = 'HUNTING',
  ARCHERY     = 'ARCHERY',
  MATHEMATICS = 'MATHEMATICS',
  RIDING      = 'RIDING',
  FREE_SPIRIT = 'FREE_SPIRIT',
  CHIVALRY    = 'CHIVALRY',
  FISHING     = 'FISHING',
  SAILING     = 'SAILING',
  NAVIGATION  = 'NAVIGATION',
}

export const TECH_SERIES: Record<string, TechId[]> = {
  hunting: [TechId.HUNTING, TechId.ARCHERY, TechId.MATHEMATICS],
  riding:  [TechId.RIDING, TechId.FREE_SPIRIT, TechId.CHIVALRY],
  fishing: [TechId.FISHING, TechId.SAILING, TechId.NAVIGATION],
};

export const TECH_SERIES_ORDER = ['hunting', 'riding', 'fishing'] as const;
export type TechSeries = typeof TECH_SERIES_ORDER[number];

export interface TechDef {
  id: TechId;
  name: string;
  description: string;
  tier: number; // 1 | 2 | 3
  series: TechSeries;
  /** Unit types this tech unlocks for training. */
  unlocksUnits: UnitType[];
  /** Prerequisites — all must be researched first. */
  prerequisites: TechId[];
}

/** Tech cost formula: (tier × citiesOwned) + 4 */
export function techCost(tier: number, citiesOwned: number): number {
  return tier * citiesOwned + 4;
}

export const TECH_DEFS: Record<TechId, TechDef> = {
  [TechId.HUNTING]: {
    id: TechId.HUNTING,
    name: 'Hunting',
    description: 'Wild animal resources',
    tier: 1,
    series: 'hunting',
    unlocksUnits: [],
    prerequisites: [],
  },
  [TechId.ARCHERY]: {
    id: TechId.ARCHERY,
    name: 'Archery',
    description: 'Unlocks Archer • +150% defense in forest',
    tier: 2,
    series: 'hunting',
    unlocksUnits: [UnitType.ARCHER],
    prerequisites: [TechId.HUNTING],
  },
  [TechId.MATHEMATICS]: {
    id: TechId.MATHEMATICS,
    name: 'Mathematics',
    description: 'Unlocks Catapult • Sawmill',
    tier: 3,
    series: 'hunting',
    unlocksUnits: [UnitType.CATAPULT],
    prerequisites: [TechId.ARCHERY],
  },
  [TechId.RIDING]: {
    id: TechId.RIDING,
    name: 'Riding',
    description: 'Unlocks Rider',
    tier: 1,
    series: 'riding',
    unlocksUnits: [UnitType.RIDER],
    prerequisites: [],
  },
  [TechId.FREE_SPIRIT]: {
    id: TechId.FREE_SPIRIT,
    name: 'Free Spirit',
    description: 'Temple building',
    tier: 2,
    series: 'riding',
    unlocksUnits: [],
    prerequisites: [TechId.RIDING],
  },
  [TechId.CHIVALRY]: {
    id: TechId.CHIVALRY,
    name: 'Chivalry',
    description: 'Unlocks Swordsman • Knight',
    tier: 3,
    series: 'riding',
    unlocksUnits: [UnitType.SWORDSMAN, UnitType.KNIGHT],
    prerequisites: [TechId.FREE_SPIRIT],
  },
  [TechId.FISHING]: {
    id: TechId.FISHING,
    name: 'Fishing',
    description: 'Port building • Fish resources',
    tier: 1,
    series: 'fishing',
    unlocksUnits: [],
    prerequisites: [],
  },
  [TechId.SAILING]: {
    id: TechId.SAILING,
    name: 'Sailing',
    description: 'Scout ship • Embark units',
    tier: 2,
    series: 'fishing',
    unlocksUnits: [UnitType.BOAT],
    prerequisites: [TechId.FISHING],
  },
  [TechId.NAVIGATION]: {
    id: TechId.NAVIGATION,
    name: 'Navigation',
    description: 'Battleship • Starfish',
    tier: 3,
    series: 'fishing',
    unlocksUnits: [],
    prerequisites: [TechId.SAILING],
  },
};

/** Starting techs per tribe. */
export const TRIBE_STARTING_TECHS: Record<string, TechId[]> = {
  'xin-xi':   [TechId.RIDING],
  'imperius': [TechId.FISHING],
  'bardur':   [TechId.HUNTING],
  'oumaji':   [TechId.RIDING],
};

/** Available (non-premium) unit types and which tech gates them. */
export const UNIT_TECH_GATES: Partial<Record<UnitType, TechId>> = {
  [UnitType.ARCHER]:    TechId.ARCHERY,
  [UnitType.CATAPULT]:  TechId.MATHEMATICS,
  [UnitType.RIDER]:     TechId.RIDING,
  [UnitType.SWORDSMAN]: TechId.CHIVALRY,
  [UnitType.KNIGHT]:    TechId.CHIVALRY,
  // Warrior, Defender, Boat are unlocked by default or via other paths
};
