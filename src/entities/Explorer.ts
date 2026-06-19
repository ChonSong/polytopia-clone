import { HexCoord } from '../hex/HexCoord';
import { Biome } from '../hex/Tile';
import { Unit } from './Unit';
import { GameState } from './GameState';

/**
 * GDD §5.6 — Autonomous Explorer pathfinding.
 *
 * When a city chooses Explorer at L2, the spawned explorer unit gets 15
 * autonomous movement steps using BFS scoring:
 *   - Clearing 4-5 fog tiles = 110 (optimal)
 *   - 1 tile revealed = 173 (suboptimal)
 *   - Distance penalty: +10 per step from origin
 *   - Anti-backtracking: heavily penalize recently traversed tiles
 */

/**
 * Run the full autonomous exploration sequence for a unit.
 * Returns the list of positions the explorer will move through.
 */
export function runExplorerPathfinding(
  startPos: HexCoord,
  state: GameState,
  tribeId: string,
  tiles: Map<string, { biome: Biome }>,
  maxSteps: number = 15,
): HexCoord[] {
  const path: HexCoord[] = [];
  const visited = new Set<string>();
  visited.add(startPos.toString());

  let current = startPos;
  const tribeVis = state.tribeVisibility.get(tribeId);
  if (!tribeVis) return path;

  const visionRange = 2;

  for (let step = 0; step < maxSteps; step++) {
    const neighbors = getValidNeighbors(current, tiles);
    let bestPos: HexCoord | null = null;
    let bestScore = -Infinity;

    for (const neighbor of neighbors) {
      const key = neighbor.toString();
      if (visited.has(key)) continue;

      // Score: count newly revealed tiles
      let newlyRevealed = 0;
      for (const [tileKey] of tiles) {
        const [q, r] = tileKey.split(',').map(Number);
        const dist = Math.max(
          Math.abs(q - neighbor.q),
          Math.abs(r - neighbor.r),
          Math.abs((q - neighbor.q) + (r - neighbor.r)),
        );
        if (dist <= visionRange && !tribeVis.has(tileKey)) {
          newlyRevealed++;
        }
      }

      if (newlyRevealed === 0) continue;

      let revealScore: number;
      if (newlyRevealed >= 4) revealScore = 110;
      else if (newlyRevealed >= 2) revealScore = 130;
      else revealScore = 173;

      const distancePenalty = step * 10;
      const score = revealScore - distancePenalty;

      if (score > bestScore) {
        bestScore = score;
        bestPos = neighbor;
      }
    }

    if (!bestPos || bestScore <= 0) break;

    path.push(bestPos);
    visited.add(bestPos.toString());
    current = bestPos;
  }

  return path;
}

function getValidNeighbors(
  pos: HexCoord,
  tiles: Map<string, { biome: Biome }>,
): HexCoord[] {
  const neighbors: HexCoord[] = [];
  for (const dir of HexCoord.DIRECTIONS) {
    const next = new HexCoord(pos.q + dir.q, pos.r + dir.r);
    const key = next.toString();
    const tile = tiles.get(key);
    if (!tile) continue;
    if (tile.biome === Biome.WATER) continue;
    if (tile.biome === Biome.MOUNTAIN) continue;
    neighbors.push(next);
  }
  return neighbors;
}
