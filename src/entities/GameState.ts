import { HexCoord } from '../hex/HexCoord';
import { Tribe } from './Tribe';

export type TileOwnership = Map<string, string>; // "q,r" -> tribeId

export class GameState {
  public turn: number;
  public currentTribeIndex: number;
  public tribes: Tribe[];
  public tileOwnership: TileOwnership;
  public visibility: Map<string, boolean>; // "q,r" -> visible to the owning tribe

  constructor(tribes: Tribe[]) {
    this.turn = 1;
    this.currentTribeIndex = 0;
    this.tribes = tribes;
    this.tileOwnership = new Map();
    this.visibility = new Map();
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
}
