import { HexCoord } from '../hex/HexCoord';

export enum UnitType {
  WARRIOR  = 'WARRIOR',
  RIDER    = 'RIDER',
  DEFENDER = 'DEFENDER',
  ARCHER   = 'ARCHER',
  SWORDSMAN = 'SWORDSMAN',
  KNIGHT   = 'KNIGHT',
  CATAPULT = 'CATAPULT',
  BOAT     = 'BOAT',
  GIANT    = 'GIANT',
  // GDD §3.2 — Naval units
  RAFT     = 'RAFT',
  SCOUT    = 'SCOUT',
  RAMMER   = 'RAMMER',
  BOMBER   = 'BOMBER',
}

export interface UnitStats {
  attack: number;
  defense: number;
  movementRange: number;
  canAttackAfterMove: boolean;
  ranged: boolean;
}

/** Star cost to train each unit type. */
export const UNIT_COSTS: Record<UnitType, number> = {
  [UnitType.WARRIOR]:   2,
  [UnitType.RIDER]:     3,
  [UnitType.DEFENDER]:  3,
  [UnitType.ARCHER]:    3,
  [UnitType.SWORDSMAN]: 5,
  [UnitType.KNIGHT]:    8,
  [UnitType.CATAPULT]:  8,
  [UnitType.BOAT]:      5,
  [UnitType.GIANT]:     0, // super unit — not purchasable normally
  // GDD §3.2 Naval costs
  [UnitType.RAFT]:      0,
  [UnitType.SCOUT]:     5,
  [UnitType.RAMMER]:    5,
  [UnitType.BOMBER]:    15,
};

/** Max health per unit type (most are 10, Defender and Swordsman are 15). */
export const UNIT_MAX_HEALTH: Record<UnitType, number> = {
  [UnitType.WARRIOR]:   10,
  [UnitType.RIDER]:     10,
  [UnitType.DEFENDER]:  15,
  [UnitType.ARCHER]:    10,
  [UnitType.SWORDSMAN]: 15,
  [UnitType.KNIGHT]:    10,
  [UnitType.CATAPULT]:  10,
  [UnitType.BOAT]:      10,
  [UnitType.GIANT]:     40,
  // GDD §3.2 Naval health
  [UnitType.RAFT]:      10,
  [UnitType.SCOUT]:     10,
  [UnitType.RAMMER]:    10,
  [UnitType.BOMBER]:    10,
};

/** Base statistics for every unit type (matching real Polytopia). */
export const UNIT_BASE_STATS: Record<UnitType, UnitStats> = {
  [UnitType.WARRIOR]:  { attack: 2, defense: 2, movementRange: 1, canAttackAfterMove: true,  ranged: false },
  [UnitType.RIDER]:    { attack: 2, defense: 1, movementRange: 2, canAttackAfterMove: true,  ranged: false },
  [UnitType.DEFENDER]: { attack: 1, defense: 3, movementRange: 1, canAttackAfterMove: true,  ranged: false },
  [UnitType.ARCHER]:   { attack: 2, defense: 1, movementRange: 1, canAttackAfterMove: false, ranged: true  },
  [UnitType.SWORDSMAN]:{ attack: 3, defense: 3, movementRange: 1, canAttackAfterMove: true,  ranged: false },
  [UnitType.KNIGHT]:   { attack: 3.5, defense: 1, movementRange: 3, canAttackAfterMove: true,  ranged: false },
  [UnitType.CATAPULT]: { attack: 4, defense: 0, movementRange: 1, canAttackAfterMove: false, ranged: true  },
  [UnitType.BOAT]:     { attack: 2, defense: 2, movementRange: 2, canAttackAfterMove: true,  ranged: false },
  [UnitType.GIANT]:    { attack: 5, defense: 4, movementRange: 1, canAttackAfterMove: true,  ranged: false },
  // GDD §3.2 Naval stats
  [UnitType.RAFT]:     { attack: 0, defense: 1, movementRange: 2, canAttackAfterMove: false, ranged: false },
  [UnitType.SCOUT]:    { attack: 2, defense: 1, movementRange: 3, canAttackAfterMove: true,  ranged: true  },
  [UnitType.RAMMER]:   { attack: 3, defense: 3, movementRange: 3, canAttackAfterMove: true,  ranged: false },
  [UnitType.BOMBER]:   { attack: 3, defense: 2, movementRange: 2, canAttackAfterMove: false, ranged: true  },
};

export const MAX_HEALTH = 10;

export const NAVAL_UNIT_TYPES: Set<UnitType> = new Set([
  UnitType.RAFT, UnitType.SCOUT, UnitType.RAMMER, UnitType.BOMBER,
]);

export class Unit {
  public readonly id: string;
  public health: number;
  /** Whether this unit has already acted (moved/attacked) this turn. */
  public hasActed: boolean;
  /**
   * GDD §3.2 — When a terrestrial unit embarks as Raft, store its original type
   * so disembark can revert it. null for naturally-trained naval units.
   */
  public originalType: UnitType | null;

  constructor(
    public position: HexCoord,
    public type: UnitType,
    public owner: string,       // tribeId
    health?: number,
    originalType?: UnitType | null,
  ) {
    this.id = `${owner}-${type}-${position.toString()}-${Date.now()}`;
    this.health = health ?? UNIT_MAX_HEALTH[type];
    this.hasActed = false;
    this.originalType = originalType ?? null;
  }

  get stats(): UnitStats {
    return UNIT_BASE_STATS[this.type];
  }

  get attack(): number {
    return this.stats.attack;
  }

  get defense(): number {
    return this.stats.defense;
  }

  get movementRange(): number {
    return this.stats.movementRange;
  }

  get canAttackAfterMove(): boolean {
    return this.stats.canAttackAfterMove;
  }

  get ranged(): boolean {
    return this.stats.ranged;
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /** True for naval unit types (RAFT, SCOUT, RAMMER, BOMBER). */
  get isNaval(): boolean {
    return NAVAL_UNIT_TYPES.has(this.type);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount: number): void {
    this.health = Math.min(UNIT_MAX_HEALTH[this.type], this.health + amount);
  }

  /** Call at the start of the tribe's turn to reset action state. */
  resetTurn(): void {
    this.hasActed = false;
  }
}
