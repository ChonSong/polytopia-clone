import { HexCoord } from '../hex/HexCoord';
import { Tribe } from './Tribe';

export type TileOwnership = Map<string, string>; // "q,r" -> tribeId

export class GameState {
  public turn: number;
  public currentTribeIndex: number;
  public tribes: Tribe[];
  public tileOwnership: TileOwnership;
  public visibility: Map<string, boolean>; // "q,r" -> visible to the owning tribe
  /** GDD §8 — Per-tribe fog-of-war: tribeId -> set of revealed tile keys. */
  public tribeVisibility: Map<string, Set<string>>;

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

  /** GDD §8 — Reveal tiles within vision range of a center point for a given tribe. */
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
}
