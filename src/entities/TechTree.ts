import { UnitType } from './Unit';

// ---------------------------------------------------------------------------
// Tech definitions
// ---------------------------------------------------------------------------

export enum TechId {
  // Base game series
  HUNTING     = 'HUNTING',
  ARCHERY     = 'ARCHERY',
  MATHEMATICS = 'MATHEMATICS',
  RIDING      = 'RIDING',
  FREE_SPIRIT = 'FREE_SPIRIT',
  CHIVALRY    = 'CHIVALRY',
  FISHING     = 'FISHING',
  SAILING     = 'SAILING',
  NAVIGATION  = 'NAVIGATION',
  DIPLOMACY   = 'DIPLOMACY',
  PHILOSOPHY  = 'PHILOSOPHY',
  // Extended series (GDD §6.2)
  CLIMBING     = 'CLIMBING',
  ORGANIZATION = 'ORGANIZATION',
  FARMING      = 'FARMING',
  SMITHERY     = 'SMITHERY',
  AQUACULTURE  = 'AQUACULTURE',
  STRATEGY     = 'STRATEGY',
  // GDD §7.1 — Polaris tribe techs
  FROSTWORK    = 'FROSTWORK',
  SLEDDING     = 'SLEDDING',
  POLAR_WARFARE = 'POLAR_WARFARE',
  POLARISM     = 'POLARISM',
  // GDD §7.2 — Cymanti tribe techs
  FUNGICULTURE = 'FUNGICULTURE',
  MYCELIUM     = 'MYCELIUM',
  HYDROLOGY    = 'HYDROLOGY',
  VENOM        = 'VENOM',
}

export const TECH_SERIES: Record<string, TechId[]> = {
  hunting:     [TechId.HUNTING, TechId.ARCHERY, TechId.MATHEMATICS],
  riding:      [TechId.RIDING, TechId.FREE_SPIRIT, TechId.CHIVALRY],
  fishing:     [TechId.FISHING, TechId.SAILING, TechId.NAVIGATION],
  climbing:    [TechId.CLIMBING],
  organization: [TechId.ORGANIZATION, TechId.STRATEGY],
  farming:     [TechId.FARMING, TechId.SMITHERY],
  aquaculture: [TechId.AQUACULTURE],
  // GDD §7.1 — Polaris tribe tech series
  frostwork:    [TechId.FROSTWORK, TechId.SLEDDING, TechId.POLAR_WARFARE, TechId.POLARISM],
  // GDD §7.2 — Cymanti tribe tech series
  fungiculture: [TechId.FUNGICULTURE, TechId.MYCELIUM, TechId.HYDROLOGY, TechId.VENOM],
};

export const TECH_SERIES_ORDER = ['hunting', 'riding', 'fishing', 'climbing', 'organization', 'farming', 'aquaculture', 'frostwork', 'fungiculture'] as const;
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
    description: 'Unlocks Knight',
    tier: 3,
    series: 'riding',
    unlocksUnits: [UnitType.KNIGHT],
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
  [TechId.DIPLOMACY]: {
    id: TechId.DIPLOMACY,
    name: 'Diplomacy',
    description: 'Cloak unit • Infiltration',
    tier: 3,
    series: 'fishing',
    unlocksUnits: [UnitType.CLOAK],
    prerequisites: [TechId.SAILING],
  },
  [TechId.PHILOSOPHY]: {
    id: TechId.PHILOSOPHY,
    name: 'Philosophy',
    description: 'Mind Bender unit • Convert & Heal',
    tier: 3,
    series: 'riding',
    unlocksUnits: [UnitType.MIND_BENDER],
    prerequisites: [TechId.FREE_SPIRIT],
  },
  // Extended series (GDD §6.2)
  [TechId.CLIMBING]: {
    id: TechId.CLIMBING,
    name: 'Climbing',
    description: 'Mountain movement',
    tier: 1,
    series: 'climbing',
    unlocksUnits: [],
    prerequisites: [],
  },
  [TechId.ORGANIZATION]: {
    id: TechId.ORGANIZATION,
    name: 'Organization',
    description: '+1 population per city',
    tier: 1,
    series: 'organization',
    unlocksUnits: [],
    prerequisites: [],
  },
  [TechId.FARMING]: {
    id: TechId.FARMING,
    name: 'Farming',
    description: '+1 food per turn',
    tier: 1,
    series: 'farming',
    unlocksUnits: [],
    prerequisites: [],
  },
  [TechId.SMITHERY]: {
    id: TechId.SMITHERY,
    name: 'Smithery',
    description: 'Unlocks Swordsman',
    tier: 2,
    series: 'farming',
    unlocksUnits: [UnitType.SWORDSMAN],
    prerequisites: [TechId.FARMING],
  },
  [TechId.AQUACULTURE]: {
    id: TechId.AQUACULTURE,
    name: 'Aquaculture',
    description: 'Unlocks Rammer',
    tier: 2,
    series: 'aquaculture',
    unlocksUnits: [UnitType.RAMMER],
    prerequisites: [],
  },
  [TechId.STRATEGY]: {
    id: TechId.STRATEGY,
    name: 'Strategy',
    description: 'Unlocks Defender',
    tier: 2,
    series: 'organization',
    unlocksUnits: [UnitType.DEFENDER],
    prerequisites: [TechId.ORGANIZATION],
  },
  // GDD §7.1 — Polaris tribe techs
  [TechId.FROSTWORK]: {
    id: TechId.FROSTWORK,
    name: 'Frostwork',
    description: 'Unlocks Mooni • Outposts',
    tier: 1,
    series: 'frostwork',
    unlocksUnits: [UnitType.MOONI],
    prerequisites: [],
  },
  [TechId.SLEDDING]: {
    id: TechId.SLEDDING,
    name: 'Sledding',
    description: 'Unlocks Battle Sled',
    tier: 2,
    series: 'frostwork',
    unlocksUnits: [UnitType.BATTLE_SLED],
    prerequisites: [TechId.FROSTWORK],
  },
  [TechId.POLAR_WARFARE]: {
    id: TechId.POLAR_WARFARE,
    name: 'Polar Warfare',
    description: 'Ice Fortresses',
    tier: 3,
    series: 'frostwork',
    unlocksUnits: [],
    prerequisites: [TechId.SLEDDING],
  },
  [TechId.POLARISM]: {
    id: TechId.POLARISM,
    name: 'Polarism',
    description: 'Ice Temples',
    tier: 3,
    series: 'frostwork',
    unlocksUnits: [],
    prerequisites: [TechId.SLEDDING],
  },
  // GDD §7.2 — Cymanti tribe techs
  [TechId.FUNGICULTURE]: {
    id: TechId.FUNGICULTURE,
    name: 'Fungiculture',
    description: 'Unlocks Fungi Farm • Organic economy',
    tier: 1,
    series: 'fungiculture',
    unlocksUnits: [],
    prerequisites: [],
  },
  [TechId.MYCELIUM]: {
    id: TechId.MYCELIUM,
    name: 'Mycelium',
    description: 'Mycelium roads that heal units',
    tier: 2,
    series: 'fungiculture',
    unlocksUnits: [UnitType.HEXAPODS],
    prerequisites: [TechId.FUNGICULTURE],
  },
  [TechId.HYDROLOGY]: {
    id: TechId.HYDROLOGY,
    name: 'Hydrology',
    description: 'Algae cultivation • Water crossing without Port',
    tier: 2,
    series: 'fungiculture',
    unlocksUnits: [UnitType.CENTIPEDE],
    prerequisites: [TechId.FUNGICULTURE],
  },
  [TechId.VENOM]: {
    id: TechId.VENOM,
    name: 'Venom',
    description: 'Venom attacks strip ×0.7 defense • Unlocks Doomux',
    tier: 3,
    series: 'fungiculture',
    unlocksUnits: [UnitType.DOOMUX],
    prerequisites: [TechId.MYCELIUM],
  },
};

/** Starting techs per tribe. */
export const TRIBE_STARTING_TECHS: Record<string, TechId[]> = {
  'xin-xi':   [TechId.RIDING],
  'imperius': [TechId.FISHING],
  'bardur':   [TechId.HUNTING],
  'oumaji':   [TechId.RIDING],
  // GDD §7.1 — Polaris tribe
  'polaris':  [TechId.FROSTWORK],
  // GDD §7.2 — Cymanti tribe
  'cymanti':  [TechId.FUNGICULTURE],
};

/** Available (non-premium) unit types and which tech gates them. */
export const UNIT_TECH_GATES: Partial<Record<UnitType, TechId>> = {
  [UnitType.ARCHER]:    TechId.ARCHERY,
  [UnitType.CATAPULT]:  TechId.MATHEMATICS,
  [UnitType.RIDER]:     TechId.RIDING,
  // GDD §3.1 Swordsman gated by Smithery (not Chivalry)
  [UnitType.SWORDSMAN]: TechId.SMITHERY,
  [UnitType.KNIGHT]:    TechId.CHIVALRY,
  // GDD §3.2 Naval gates
  [UnitType.SCOUT]:     TechId.SAILING,
  // GDD §3.2 Rammer gated by Aquaculture (not Sailing/Navigation)
  [UnitType.RAMMER]:    TechId.AQUACULTURE,
  [UnitType.BOMBER]:    TechId.NAVIGATION,
  // GDD §3.1 Special unit gates
  [UnitType.CLOAK]:     TechId.DIPLOMACY,
  [UnitType.MIND_BENDER]: TechId.PHILOSOPHY,
  // GDD §3.1 Defender gated by Strategy
  [UnitType.DEFENDER]:  TechId.STRATEGY,
  // GDD §7.1 — Polaris tribe unit gates
  [UnitType.MOONI]:      TechId.FROSTWORK,
  [UnitType.BATTLE_SLED]: TechId.SLEDDING,
  [UnitType.GAAMI]:      TechId.POLAR_WARFARE,
  // GDD §7.2 — Cymanti tribe unit gates
  [UnitType.CENTIPEDE]:  TechId.HYDROLOGY,
  [UnitType.HEXAPODS]:   TechId.MYCELIUM,
  [UnitType.DOOMUX]:     TechId.VENOM,
};
