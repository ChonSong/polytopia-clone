import { HexCoord } from '../hex/HexCoord';
import { Tribe } from './Tribe';
import { Unit, UnitType } from './Unit';
import { TechId } from './TechTree';

export type TileOwnership = Map<string, string>; // "q,r" -> tribeId

export class GameState {
  public turn: number;
  public currentTribeIndex: number;
  public tribes: Tribe[];
  public tileOwnership: TileOwnership;
  public visibility: Map<string, boolean>; // "q,r" -> visible to the owning tribe
  /** GDD §8 — Per-tribe fog-of-war: tribeId -> set of revealed tile keys. */
  public tribeVisibility: Map<string, Set<string>>;
  /**
   * GDD §3.5 — Pending Dagger spawns: cityId -> tribeId of the Dagger owner.
   * Cleared after processing at the start of the spawner's turn.
   */
  public pendingDaggerSpawns: Map<string, string>;

  constructor(tribes: Tribe[]) {
    this.turn = 1;
    this.currentTribeIndex = 0;
    this.tribes = tribes;
    this.tileOwnership = new Map();
    this.visibility = new Map();
    this.tribeVisibility = new Map();
    for (const tribe of tribes) {
      this.tribeVisibility.set(tribe.id, new Set());
    }
    this.pendingDaggerSpawns = new Map();
  }

  /** Returns the tribe whose turn it currently is. */
  getCurrentTribe(): Tribe {
    return this.tribes[this.currentTribeIndex];
  }

  /** Advance to the next tribe's turn. Skips defeated tribes. */
  nextTurn(): void {
    const aliveCount = this.tribes.filter(t => !t.isDefeated()).length;

    // Advance to the next alive tribe.
    let nextIndex = this.currentTribeIndex;
    do {
      nextIndex = (nextIndex + 1) % this.tribes.length;
    } while (this.tribes[nextIndex].isDefeated() && aliveCount > 1);

    this.currentTribeIndex = nextIndex;

    // If we've wrapped back to the first tribe, increment the turn counter.
    if (this.currentTribeIndex === 0) {
      this.turn++;
    }

    // Reset action state for all units of the newly active tribe.
    const currentTribe = this.getCurrentTribe();
    for (const unit of currentTribe.units) {
      unit.resetTurn();
    }
  }

  /** Filter a list of tiles down to those currently visible to the given tribe. */
  getVisibleTiles(tribeId: string, tiles: HexCoord[]): HexCoord[] {
    return tiles.filter(t => {
      const key = t.toString();
      return this.visibility.get(key) === true;
    });
  }

  /** Check whether a specific coordinate is visible to the given tribe. */
  isTileVisible(coord: HexCoord, tribeId: string): boolean {
    return this.visibility.get(coord.toString()) === true;
  }

  setTileOwner(coord: HexCoord, tribeId: string): void {
    this.tileOwnership.set(coord.toString(), tribeId);
  }

  getTileOwner(coord: HexCoord): string | undefined {
    return this.tileOwnership.get(coord.toString());
  }

  setTileVisibility(coord: HexCoord, visible: boolean): void {
    this.visibility.set(coord.toString(), visible);
  }

  /** GDD §3.4 — Convert an enemy unit to a new tribe. */
  convertUnit(unit: Unit, newTribeId: string): void {
    const oldTribe = this.tribes.find(t => t.id === unit.owner);
    const newTribe = this.tribes.find(t => t.id === newTribeId);
    if (!oldTribe || !newTribe) return;
    // Remove from old tribe
    oldTribe.units = oldTribe.units.filter(u => u.id !== unit.id);
    // Add to new tribe
    unit.owner = newTribeId;
    newTribe.units.push(unit);
    // Reset action state
    unit.hasActed = true;
    unit.hasAttacked = true;
  }
  /** GDD §3.1 — Submerge a Cloak unit (hide from non-adjacent enemies). */
  submergeCloak(unit: Unit): void {
    if (unit.type !== UnitType.CLOAK) return;
    if (unit.hasActed) return;
    unit.isSubmerged = true;
    unit.hasActed = true;
    unit.hasAttacked = true;
  }

  /** GDD §3.1 — Emerge a Cloak unit (become visible again). */
  emergeCloak(unit: Unit): void {
    if (unit.type !== UnitType.CLOAK) return;
    if (unit.hasActed) return;
    unit.isSubmerged = false;
    unit.hasActed = true;
  }

  // ── GDD §3.5 — Cloak Infiltration / Dagger spawning ──────────────────────

  /**
   * Check if a Cloak unit at a given position is adjacent to any enemy city.
   * Returns the first adjacent enemy City, or null.
   */
  findAdjacentEnemyCity(cloakPos: HexCoord, cloakOwner: string): import('./City').City | null {
    for (const dir of HexCoord.DIRECTIONS) {
      const adj = new HexCoord(cloakPos.q + dir.q, cloakPos.r + dir.r);
      for (const tribe of this.tribes) {
        if (tribe.id === cloakOwner) continue;
        for (const city of tribe.cities) {
          if (city.position.q === adj.q && city.position.r === adj.r) {
            return city;
          }
        }
      }
    }
    return null;
  }

  /**
   * GDD §3.5 — At the start of a tribe's turn, prime submerged Cloaks that are
   * adjacent to an enemy city and owned by a tribe with Diplomacy tech.
   */
  primeCloaksForInfiltrate(tribeId: string): void {
    const tribe = this.tribes.find(t => t.id === tribeId);
    if (!tribe) return;
    // Requires Diplomacy tech
    if (!tribe.hasTech(TechId.DIPLOMACY)) return;
    for (const unit of tribe.units) {
      if (unit.type === UnitType.CLOAK && unit.isSubmerged && unit.isAlive) {
        const adjacentCity = this.findAdjacentEnemyCity(unit.position, tribeId);
        if (adjacentCity) {
          unit.primedForInfiltrate = true;
        }
      }
    }
  }

  /**
   * GDD §3.5 — Perform Infiltrate: consumes the Cloak and schedules a Dagger
   * spawn in the adjacent enemy city on the next turn.
   * Returns the city that was infiltrated, or null if invalid.
   */
  performInfiltrate(cloak: Unit): import('./City').City | null {
    if (cloak.type !== UnitType.CLOAK) return null;
    if (!cloak.isSubmerged) return null;
    if (!cloak.primedForInfiltrate) return null;
    const city = this.findAdjacentEnemyCity(cloak.position, cloak.owner);
    if (!city) return null;
    // Schedule Dagger spawn
    this.pendingDaggerSpawns.set(city.id, cloak.owner);
    // Remove the Cloak from its tribe
    const tribe = this.tribes.find(t => t.id === cloak.owner);
    if (tribe) {
      tribe.units = tribe.units.filter(u => u.id !== cloak.id);
    }
    return city;
  }

  /**
   * GDD §3.5 — At the start of a tribe's turn, spawn all pending Daggers
   * inside their targeted cities. Daggers can attack immediately on spawn.
   */
  processDaggerSpawns(tribeId: string): Unit[] {
    const spawned: Unit[] = [];
    const consumed: string[] = [];
    for (const [cityId, ownerId] of this.pendingDaggerSpawns) {
      if (ownerId !== tribeId) continue;
      const tribe = this.tribes.find(t => t.id === tribeId);
      if (!tribe) continue;
      const city = tribe.cities.find(c => c.id === cityId)
        ?? this.tribes.flatMap(t => t.cities).find(c => c.id === cityId);
      if (!city) { consumed.push(cityId); continue; }
      // Spawn Dagger at city position
      const dagger = new Unit(city.position, UnitType.DAGGER, tribeId);
      dagger.hasActed = false; // Dagger can act immediately
      tribe.units.push(dagger);
      spawned.push(dagger);
      consumed.push(cityId);
    }
    for (const id of consumed) {
      this.pendingDaggerSpawns.delete(id);
    }
    return spawned;
  }

  revealVision(tribeId: string, center: HexCoord, range: number, allCoords: HexCoord[]): void {
    const visible = this.tribeVisibility.get(tribeId);
    if (!visible) return;
    for (const coord of allCoords) {
      if (coord.distanceTo(center) <= range) {
        visible.add(coord.toString());
      }
    }
  }

  /** GDD §8 — Check if a tile is currently visible (in vision range) to the given tribe. */
  isTileVisibleToTribe(coord: HexCoord, tribeId: string): boolean {
    return this.tribeVisibility.get(tribeId)?.has(coord.toString()) === true;
  }

  /** GDD §8 — Check if a tile has been previously revealed (explored) by the given tribe. */
  isTileExploredByTribe(coord: HexCoord, tribeId: string): boolean {
    return this.tribeVisibility.get(tribeId)?.has(coord.toString()) === true;
  }

  /** GDD §7.3 — Check if a unit can see ruins through fog (Prophetic Vision). */
  canSeeRuinsThroughFog(tribeId: string): boolean {
    const tribe = this.tribes.find(t => t.id === tribeId);
    if (!tribe) return false;
    return tribe.units.some(u => u.hasPropheticVision && u.isAlive);
  }
}
