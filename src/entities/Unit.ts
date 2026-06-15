import { HexCoord } from '../hex/HexCoord';

export enum UnitType {
  WARRIOR  = 'WARRIOR',
  RIDER    = 'RIDER',
  DEFENDER = 'DEFENDER',
  ARCHER   = 'ARCHER',
  CATAPULT = 'CATAPULT',
  BOAT     = 'BOAT',
}

export interface UnitStats {
  attack: number;
  defense: number;
  movementRange: number;
  canAttackAfterMove: boolean;
  ranged: boolean;
}

/** Base statistics for every unit type. */
export const UNIT_BASE_STATS: Record<UnitType, UnitStats> = {
  [UnitType.WARRIOR]:  { attack: 2, defense: 2, movementRange: 1, canAttackAfterMove: true,  ranged: false },
  [UnitType.RIDER]:    { attack: 1, defense: 1, movementRange: 2, canAttackAfterMove: true,  ranged: false },
  [UnitType.DEFENDER]: { attack: 1, defense: 4, movementRange: 1, canAttackAfterMove: true,  ranged: false },
  [UnitType.ARCHER]:   { attack: 3, defense: 1, movementRange: 1, canAttackAfterMove: false, ranged: true  },
  [UnitType.CATAPULT]: { attack: 4, defense: 1, movementRange: 1, canAttackAfterMove: false, ranged: true  },
  [UnitType.BOAT]:     { attack: 2, defense: 2, movementRange: 2, canAttackAfterMove: true,  ranged: false },
};

export const MAX_HEALTH = 10;

export class Unit {
  public readonly id: string;
  public health: number;
  /** Whether this unit has already acted (moved/attacked) this turn. */
  public hasActed: boolean;

  constructor(
    public position: HexCoord,
    public type: UnitType,
    public owner: string,       // tribeId
    health: number = MAX_HEALTH,
  ) {
    this.id = `${owner}-${type}-${position.toString()}-${Date.now()}`;
    this.health = health;
    this.hasActed = false;
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

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount: number): void {
    this.health = Math.min(MAX_HEALTH, this.health + amount);
  }

  /** Call at the start of the tribe's turn to reset action state. */
  resetTurn(): void {
    this.hasActed = false;
  }
}
