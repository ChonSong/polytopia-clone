import { HexCoord } from '../hex/HexCoord';
import { TileData, Biome } from '../hex/Tile';
import { Unit, UNIT_MAX_HEALTH, MAX_HEALTH, UnitType } from './Unit';
import { CityData } from './CityData';

export interface CombatResult {
  attackerDamage: number;
  defenderDamage: number;
  attackerKilled: boolean;
  defenderKilled: boolean;
}

export interface CityCombatResult {
  cityDamage: number;
  cityCaptured: boolean;
}

/**
 * Returns hex coordinates along the line from a to b (exclusive of endpoints).
 */
function getHexLine(a: HexCoord, b: HexCoord): HexCoord[] {
  const distance = a.distanceTo(b);
  const coords: HexCoord[] = [];

  for (let i = 0; i <= distance; i++) {
    const t = distance === 0 ? 0 : i / distance;
    const qf = a.q + (b.q - a.q) * t;
    const rf = a.r + (b.r - a.r) * t;
    coords.push(HexCoord.round(qf, rf));
  }

  return coords;
}

function getDistance(attacker: Unit, defender: Unit): number {
  return attacker.position.distanceTo(defender.position);
}

/**
 * CombatSystem — pure functions for combat logic in a Polytopia-like game.
 *
 * Damage formula (real Polytopia):
 *   healthFactor(unit) = unit.health / unit.maxHP
 *   attackForce = attacker.attack × healthFactor(attacker)
 *   defenseForce = defender.defense × healthFactor(defender) × defBonus
 *   totalForce = attackForce + defenseForce
 *   damage = round((attackForce / totalForce) × attacker.attack × 4.5)
 *   Ranged distance ≥ 2: ×0.75
 *   Minimum 1 damage
 */
export class CombatSystem {
  /**
   * Can `attacker` attack `defender`?
   *
   * Checks:
   * - Both alive
   * - Attacker has not acted yet
   * - Different owners
   * - Adjacent (distance 1) for melee; distance ≤ 2 for ranged
   * - Boat: both units must be on WATER tiles
   */
  static canAttack(
    attacker: Unit,
    defender: Unit,
    tiles: Map<string, TileData>,
  ): boolean {
    if (!attacker.isAlive || !defender.isAlive) return false;
    if (attacker.hasActed) return false;
    if (attacker.owner === defender.owner) return false;

    const dist = getDistance(attacker, defender);

    if (attacker.ranged) {
      if (dist > 2) return false;
    } else {
      if (dist !== 1) return false;
    }

    // Boat restriction: both must be on WATER tiles
    if (attacker.type === UnitType.BOAT) {
      const aTile = tiles.get(attacker.position.toString());
      const dTile = tiles.get(defender.position.toString());
      if (!aTile || !dTile) return false;
      if (aTile.biome !== Biome.WATER || dTile.biome !== Biome.WATER) return false;
    }

    return true;
  }

  /**
   * Can `attacker` assault the given city?
   * - Attacker must be alive and not yet acted
   * - Different owners
   * - Adjacent (melee) or within 2 (ranged)
   */
  static canAttackCity(
    attacker: Unit,
    city: CityData,
    _tiles?: Map<string, TileData>,
  ): boolean {
    if (!attacker.isAlive) return false;
    if (attacker.hasActed) return false;
    if (attacker.owner === city.owner) return false;

    const attackerPos = attacker.position;
    const cityPos = new HexCoord(city.q, city.r);
    const dist = attackerPos.distanceTo(cityPos);

    if (attacker.ranged) return dist <= 2;
    return dist === 1;
  }

  /**
   * Calculate damage dealt by `attacker` to `defender` on `defenderTile`.
   * Uses the real Polytopia formula:
   *   attackForce = atk × (hp / maxHP)
   *   defenseForce = def × (hp / maxHP) × defBonus
   *   result = round((attackForce / (attackForce + defenseForce)) × atk × 4.5)
   */
  static calculateDamage(
    attacker: Unit,
    defender: Unit,
    defenderTile: TileData,
    distance: number = 1,
  ): number {
    const attackForce = attacker.attack * (attacker.health / UNIT_MAX_HEALTH[attacker.type]);
    let defBonus = 1.0;
    // Terrain defense bonus
    if (defenderTile.biome === Biome.FOREST || defenderTile.biome === Biome.MOUNTAIN) {
      defBonus = 1.5; // assumes relevant tech is owned — simplified
    }
    if (defenderTile.city) defBonus = 1.5;
    const defenseForce = defender.defense * (defender.health / UNIT_MAX_HEALTH[defender.type]) * defBonus;
    const totalForce = attackForce + defenseForce;
    let damage = (attackForce / totalForce) * attacker.attack * 4.5;
    // Ranged penalty
    if (distance >= 2) damage *= 0.75;
    return Math.max(1, Math.round(damage));
  }

  /**
   * Calculate damage dealt by `attacker` to `city`.
   */
  static calculateCityDamage(
    attacker: Unit,
    city: CityData,
    distance: number = 1,
  ): number {
    const attackForce = attacker.attack * (attacker.health / UNIT_MAX_HEALTH[attacker.type]);
    const cityFactor = city.health / city.maxHealth;
    const defenseForce = city.defenseBonus * cityFactor;
    const totalForce = attackForce + defenseForce;
    let damage = (attackForce / totalForce) * attacker.attack * 4.5;
    if (distance >= 2) damage *= 0.75;
    return Math.max(1, Math.round(damage));
  }

  /**
   * Execute a simultaneous attack between two units.
   * Returns the calculated damages without mutating the units.
   */
  static executeAttack(
    attacker: Unit,
    defender: Unit,
    tiles: Map<string, TileData>,
  ): CombatResult {
    const dist = getDistance(attacker, defender);

    const defenderTile =
      tiles.get(defender.position.toString()) ?? { biome: Biome.GRASS, elevation: 0 };

    const attackerTile =
      tiles.get(attacker.position.toString()) ?? { biome: Biome.GRASS, elevation: 0 };

    const defenderDamage = CombatSystem.calculateDamage(attacker, defender, defenderTile, dist);

    // Counter-attack: defender strikes back if in melee range or if defender is also ranged
    let attackerDamage = 0;
    if (defender.isAlive) {
      if (dist === 1 || defender.ranged) {
        attackerDamage = CombatSystem.calculateDamage(defender, attacker, attackerTile, dist);
      }
    }

    return {
      attackerDamage,
      defenderDamage,
      attackerKilled: attacker.health - attackerDamage <= 0,
      defenderKilled: defender.health - defenderDamage <= 0,
    };
  }

  /**
   * Execute a city assault. Attacker deals damage to the city.
   * Cities do not counter-attack.
   */
  static executeCityAttack(
    attacker: Unit,
    city: CityData,
    tiles: Map<string, TileData>,
  ): CityCombatResult {
    const attackerPos = attacker.position;
    const cityPos = new HexCoord(city.q, city.r);
    const dist = attackerPos.distanceTo(cityPos);

    const cityDamage = CombatSystem.calculateCityDamage(attacker, city, dist);

    return {
      cityDamage,
      cityCaptured: city.health - cityDamage <= 0,
    };
  }

  /**
   * Check if a ranged attack has line of sight.
   * No MOUNTAIN tiles may exist between attacker and defender.
   */
  static canRangedAttack(
    attacker: Unit,
    defender: Unit,
    tiles: Map<string, TileData>,
  ): boolean {
    if (!attacker.ranged) return false;
    if (!attacker.isAlive || !defender.isAlive) return false;
    if (attacker.owner === defender.owner) return false;

    const dist = getDistance(attacker, defender);
    if (dist > 2) return false;

    const lineHexes = getHexLine(attacker.position, defender.position);

    // Check interior hexes (exclude start and end) for mountains
    for (let i = 1; i < lineHexes.length - 1; i++) {
      const hex = lineHexes[i];
      const tile = tiles.get(hex.toString());
      if (tile && tile.biome === Biome.MOUNTAIN) {
        return false;
      }
    }

    return true;
  }
}
