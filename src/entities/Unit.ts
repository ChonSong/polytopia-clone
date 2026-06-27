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
  // GDD §3.1 — Special units
  CLOAK    = 'CLOAK',
  MIND_BENDER = 'MIND_BENDER',
  // GDD §3.5 — Infiltrate Dagger
  DAGGER   = 'DAGGER',
  // GDD §7.1 — Polaris tribe units
  MOONI      = 'MOONI',
  BATTLE_SLED = 'BATTLE_SLED',
  GAAMI      = 'GAAMI',
  // GDD §7.2 — Cymanti tribe units
  CENTIPEDE  = 'CENTIPEDE',
  HEXAPODS   = 'HEXAPODS',
  DOOMUX     = 'DOOMUX',
  // GDD §7.3 — Elyrion tribe units
  EGG        = 'EGG',
  BABY_DRAGON = 'BABY_DRAGON',
  FIRE_DRAGON = 'FIRE_DRAGON',
  POLYTAUR   = 'POLYTAUR',
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
  // GDD §3.1 — Special units
  [UnitType.CLOAK]:     8,
  [UnitType.MIND_BENDER]: 5,
  // GDD §3.5 — Infiltrate Dagger (not trainable, spawned by Infiltrate)
  [UnitType.DAGGER]:    0,
  // GDD §7.1 — Polaris tribe unit costs
  [UnitType.MOONI]:      3,
  [UnitType.BATTLE_SLED]: 8,
  [UnitType.GAAMI]:      0, // super unit — not purchasable normally
  // GDD §7.2 — Cymanti tribe unit costs
  [UnitType.CENTIPEDE]:  10,
  [UnitType.HEXAPODS]:   6,
  [UnitType.DOOMUX]:     8,
  // GDD §7.3 — Elyrion tribe unit costs
  [UnitType.EGG]:        0, // spawned at city, not purchasable
  [UnitType.BABY_DRAGON]: 0, // matures from Egg, not purchasable
  [UnitType.FIRE_DRAGON]: 0, // matures from Baby Dragon, not purchasable
  [UnitType.POLYTAUR]:   3, // created via Enchantment
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
  // GDD §3.1 — Special units
  [UnitType.CLOAK]:     5,
  [UnitType.MIND_BENDER]: 10,
  // GDD §3.5 — Infiltrate Dagger
  [UnitType.DAGGER]:    3,
  // GDD §7.1 — Polaris tribe unit health
  [UnitType.MOONI]:      8,
  [UnitType.BATTLE_SLED]: 12,
  [UnitType.GAAMI]:      30,
  // GDD §7.2 — Cymanti tribe unit health
  [UnitType.CENTIPEDE]:  15,
  [UnitType.HEXAPODS]:   8,
  [UnitType.DOOMUX]:     6,
  // GDD §7.3 — Elyrion tribe unit health
  [UnitType.EGG]:        3,
  [UnitType.BABY_DRAGON]: 8,
  [UnitType.FIRE_DRAGON]: 15,
  [UnitType.POLYTAUR]:   10,
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
  // GDD §3.1 — Special units
  [UnitType.CLOAK]:    { attack: 0, defense: 0.5, movementRange: 2, canAttackAfterMove: true, ranged: false },
  [UnitType.MIND_BENDER]: { attack: 0, defense: 1, movementRange: 1, canAttackAfterMove: true, ranged: false },
  // GDD §3.5 — Infiltrate Dagger
  [UnitType.DAGGER]:   { attack: 2, defense: 1, movementRange: 1, canAttackAfterMove: true, ranged: false },
  // GDD §7.1 — Polaris tribe unit stats
  [UnitType.MOONI]:      { attack: 0, defense: 1, movementRange: 1, canAttackAfterMove: true, ranged: false },
  [UnitType.BATTLE_SLED]: { attack: 3, defense: 2, movementRange: 3, canAttackAfterMove: true, ranged: false },
  [UnitType.GAAMI]:      { attack: 5, defense: 3, movementRange: 1, canAttackAfterMove: true, ranged: false },
  // GDD §7.2 — Cymanti tribe unit stats
  [UnitType.CENTIPEDE]:  { attack: 3, defense: 2, movementRange: 1, canAttackAfterMove: true, ranged: false },
  [UnitType.HEXAPODS]:   { attack: 2, defense: 1, movementRange: 2, canAttackAfterMove: true, ranged: false },
  [UnitType.DOOMUX]:     { attack: 4, defense: 0, movementRange: 1, canAttackAfterMove: true, ranged: false },
  // GDD §7.3 — Elyrion tribe unit stats
  [UnitType.EGG]:        { attack: 0, defense: 2, movementRange: 0, canAttackAfterMove: false, ranged: false },
  [UnitType.BABY_DRAGON]: { attack: 2, defense: 1, movementRange: 2, canAttackAfterMove: true, ranged: true },
  [UnitType.FIRE_DRAGON]: { attack: 4, defense: 2, movementRange: 2, canAttackAfterMove: true, ranged: true },
  [UnitType.POLYTAUR]:   { attack: 3, defense: 1, movementRange: 1, canAttackAfterMove: true, ranged: false },
};

export const MAX_HEALTH = 10;

export const NAVAL_UNIT_TYPES: Set<UnitType> = new Set([
  UnitType.RAFT, UnitType.SCOUT, UnitType.RAMMER, UnitType.BOMBER, UnitType.CLOAK,
]);

export class Unit {
  public id: string;
  public health: number;
  /** Whether this unit has already acted (moved/attacked) this turn. */
  public hasActed: boolean;
  /**
   * GDD §3.3 — Whether this unit has already attacked this turn.
   * Used by Escape (Rider) to prevent double-attack while allowing post-attack movement.
   */
  public hasAttacked: boolean;
  /**
   * GDD §3.2 — When a terrestrial unit embarks as Raft, store its original type
   * so disembark can revert it. null for naturally-trained naval units.
   */
  public originalType: UnitType | null;
  /**
   * GDD §4.2 — Unit is fortified (skipped its turn), gaining defense bonuses
   * from terrain and city walls. Set to true at end of turn when unit hasn't acted;
   * reset to false at the start of its next turn.
   */
  public fortified: boolean;
  /**
   * GDD §4.4 — Kill counter for veteran system. Incremented each time this unit
   * kills an enemy. Reset on veteran promotion.
   */
  public killCount: number;
  /**
   * GDD §4.4 — Whether this unit has been promoted to veteran.
   * Veterans have +5 max HP and a visual badge.
   */
  public isVeteran: boolean;
  /**
   * GDD §4.4 — Bonus max HP from veteran promotion. Added on top of base UNIT_MAX_HEALTH.
   */
  public maxHPBonus: number;
  /**
   * GDD §3.1 — Poison status. Number of remaining turns the unit will take 1 poison damage
   * at the start of its turn. 0 = not poisoned.
   */
  public poisonTurns: number;
  /**
   * GDD §3.1 — Cloak submerge state. When true, unit is hidden from non-adjacent enemies.
   */
  public isSubmerged: boolean;
  /**
   * GDD §3.5 — Whether this Cloak has been submerged adjacent to an enemy city
   * for at least one full turn, making Infiltrate available.
   */
  public primedForInfiltrate: boolean;

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
    this.hasAttacked = false;
    this.originalType = originalType ?? null;
    this.fortified = false;
    this.killCount = 0;
    this.isVeteran = false;
    this.maxHPBonus = 0;
    this.poisonTurns = 0;
    this.isSubmerged = false;
    this.primedForInfiltrate = false;
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

  /** GDD §3.3 — Escape: can move after attacking (Rider). */
  get hasEscape(): boolean {
    return this.type === UnitType.RIDER;
  }

  /** GDD §4.2 — Whether unit is fortified, gaining defense bonuses from terrain/city walls. */
  get isFortified(): boolean {
    return this.fortified;
  }

  /** GDD §3.3 — Persist: if unit kills a target, action refreshes (Knight). */
  get hasPersist(): boolean {
    return this.type === UnitType.KNIGHT;
  }

  /** GDD §3.3 — Stiff: unit cannot move after attacking AND attacker takes no retaliation damage. */
  get hasStiff(): boolean {
    return (
      this.type === UnitType.CATAPULT ||
      this.type === UnitType.GIANT ||
      this.type === UnitType.BOMBER ||
      this.type === UnitType.RAFT
    );
  }

  /** GDD §3.3 — Splash: Bomber deals half damage (rounded down) to all adjacent enemies after primary attack. */
  get hasSplash(): boolean {
    return this.type === UnitType.BOMBER;
  }

  /** GDD §3.1 — Hide: Cloak can submerge to become invisible to non-adjacent enemies. */
  get hasHide(): boolean {
    return this.type === UnitType.CLOAK;
  }

  /** GDD §3.5 — Infiltrate: Cloak that has been submerged adjacent to an enemy city for 1 turn can infiltrate. */
  get hasInfiltrate(): boolean {
    return this.type === UnitType.CLOAK;
  }

  /** GDD §3.4 — Convert: Mind Bender can convert adjacent enemy units to your tribe. */
  get hasConvert(): boolean {
    return this.type === UnitType.MIND_BENDER;
  }

  /** GDD §3.4 — Heal: Mind Bender restores 4 HP to all adjacent friendly units. */
  get hasHeal(): boolean {
    return this.type === UnitType.MIND_BENDER;
  }

  /** GDD §7.1 — Freeze: Mooni auto-freezes adjacent tiles. */
  get hasFreeze(): boolean {
    return this.type === UnitType.MOONI;
  }

  /** GDD §7.1 — Mass Freeze: Gaami freezes all adjacent tiles. */
  get hasMassFreeze(): boolean {
    return this.type === UnitType.GAAMI;
  }

  /** GDD §7.1 — Ice Mobility: Battle Sled moves on ice but is crippled on land. */
  get hasIceMobility(): boolean {
    return this.type === UnitType.BATTLE_SLED;
  }

  /** GDD §7.2 — Eat/Grow: Centipede gains +2 max HP when it kills a unit. */
  get hasEatGrow(): boolean {
    return this.type === UnitType.CENTIPEDE;
  }

  /** GDD §7.2 — Creep/Sneak: Hexapods ignore ZOC (zone of control). */
  get hasCreepSneak(): boolean {
    return this.type === UnitType.HEXAPODS;
  }

  /** GDD §7.2 — Explode: Doomux deals AoE damage to all adjacent enemies on death. */
  get hasExplode(): boolean {
    return this.type === UnitType.DOOMUX;
  }

  /** GDD §7.2 — Venom: Cymanti attacker applies venom that strips ×0.7 defense. */
  get hasVenom(): boolean {
    return this.type === UnitType.CENTIPEDE || this.type === UnitType.HEXAPODS;
  }

  /** GDD §7.3 — Flight: Dragon units can move over water/mountain tiles. */
  get hasFlight(): boolean {
    return this.type === UnitType.BABY_DRAGON || this.type === UnitType.FIRE_DRAGON;
  }

  /** GDD §7.3 — Splash AoE: Fire Dragon deals half damage to adjacent enemies. */
  get hasSplashAoE(): boolean {
    return this.type === UnitType.FIRE_DRAGON;
  }

  /** GDD §7.3 — Prophetic Vision: Elyrion tribe can see ruins through fog. */
  get hasPropheticVision(): boolean {
    return this.type === UnitType.POLYTAUR;
  }

  /** GDD §7.3 — Egg: immobile, matures into Baby Dragon at city. */
  get isEgg(): boolean {
    return this.type === UnitType.EGG;
  }

  /** GDD §8 — Vision range for fog-of-war. Scout and Giant get 3, all others 2. */
  get visionRange(): number {
    if (this.type === UnitType.SCOUT || this.type === UnitType.GIANT) return 3;
    return 2;
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  /** Effective max HP including veteran bonus. */
  get maxHealth(): number {
    return UNIT_MAX_HEALTH[this.type] + this.maxHPBonus;
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /** GDD §4.4 — Whether this unit is eligible for veteran promotion. */
  get isEligibleForVeteran(): boolean {
    if (this.isVeteran) return false;
    if (this.isNaval) return false;
    if (this.type === UnitType.GIANT) return false;
    return this.killCount >= 3;
  }

  /** GDD §4.4 — Promote to veteran: +5 max HP, full heal, reset kill counter. */
  promoteVeteran(): void {
    if (!this.isEligibleForVeteran) return;
    this.isVeteran = true;
    this.maxHPBonus = 5;
    this.health = this.maxHealth; // full heal to new max
    this.killCount = 0;
  }

  /** GDD §4.2 — Whether this unit is currently poisoned. */
  get isPoisoned(): boolean {
    return this.poisonTurns > 0;
  }

  /** GDD §4.2 — Apply poison to this unit. Resets duration to 3 turns (does not stack). */
  applyPoison(): void {
    this.poisonTurns = 3;
  }

  /**
   * GDD §4.2 — Process poison damage at start of turn.
   * Deals 1 damage per tick. Returns true if unit died from poison.
   */
  processPoison(): boolean {
    if (this.poisonTurns <= 0) return false;
    this.poisonTurns--;
    this.health = Math.max(0, this.health - 1);
    if (this.health <= 0) {
      this.poisonTurns = 0; // clear poison on death
      return true;
    }
    return false;
  }

  /** Call at the start of the tribe's turn to reset action state. */
  resetTurn(): void {
    this.hasActed = false;
    this.hasAttacked = false;
    this.fortified = false;
  }
}
