import { HexCoord } from '../hex/HexCoord';
import { Biome, TileData } from '../hex/Tile';
import { BuildingType } from './Building';
import { City } from './City';

/**
 * GDD §5.7 — Trade Routes & City Connections
 *
 * Roads (terrestrial) and Bridges (aquatic) halve movement cost.
 * City Connection: continuous Roads/Bridges/Ports linking outer city to capital.
 * Grants +1 population to both connected cities.
 * Ports act as network nodes; water gap ≤ 5 tiles.
 * Grand Bazaar: completing 5 city connections → +3 population, +400 Perfection score.
 */
export class TradeRouteSystem {
  /**
   * Check if a road can be built at the given tile.
   * Roads can only be built on non-water tiles that don't already have a road.
   */
  canBuildRoad(tile: TileData | undefined): boolean {
    if (!tile) return false;
    if (tile.biome === Biome.WATER) return false;
    if (tile.road) return false;
    if (tile.city) return false;
    return true;
  }

  /**
   * Check if a bridge can be built at the given tile.
   * Bridges can only be built on water tiles that don't already have a bridge.
   */
  canBuildBridge(tile: TileData | undefined): boolean {
    if (!tile) return false;
    if (tile.biome !== Biome.WATER) return false;
    if (tile.bridge) return false;
    return true;
  }

  /**
   * Check if a tile has a road (terrestrial movement bonus).
   */
  hasRoad(tile: TileData | undefined): boolean {
    return tile?.road === true;
  }

  /**
   * Check if a tile has a bridge (aquatic movement bonus).
   */
  hasBridge(tile: TileData | undefined): boolean {
    return tile?.bridge === true;
  }

  /**
   * Check if a tile is a movement-boosting tile (road or bridge).
   */
  isTradeTile(tile: TileData | undefined): boolean {
    return this.hasRoad(tile) || this.hasBridge(tile);
  }

  /**
   * Detect all city connections via continuous road/bridge/port paths.
   * Uses BFS from each city to find reachable other cities.
   * Ports act as network nodes; water gap ≤ 5 tiles.
   *
   * Returns a map of cityId -> connected cityIds.
   */
  detectConnections(
    cities: City[],
    tileMap: Map<string, TileData>,
  ): Map<string, string[]> {
    const connections = new Map<string, string[]>();

    for (const city of cities) {
      const visited = new Set<string>();
      const queue: HexCoord[] = [city.position];
      const found: string[] = [];
      const waterSteps = new Map<string, number>(); // track water gap from last port/road

      visited.add(city.position.toString());

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentKey = current.toString();
        const currentTile = tileMap.get(currentKey);

        // Check if we reached another city
        let foundCityHere = false;
        for (const other of cities) {
          if (other.id === city.id) continue;
          if (other.position.equals(current)) {
            if (!found.includes(other.id)) {
              found.push(other.id);
            }
            foundCityHere = true;
          }
        }
        // Don't propagate through other cities — they are endpoints, not relay nodes
        if (foundCityHere) continue;

        // Explore neighbors
        for (const neighbor of current.neighbors()) {
          const neighborKey = neighbor.toString();
          if (visited.has(neighborKey)) continue;

          const neighborTile = tileMap.get(neighborKey);
          if (!neighborTile) continue;

          // Determine if we can traverse this tile
          const isPort = this.isPortCity(cities, neighbor);
          const isRoadTile = this.hasRoad(neighborTile);
          const isBridgeTile = this.hasBridge(neighborTile);
          const isWater = neighborTile.biome === Biome.WATER;

          // Track water gap
          const currentWaterGap = waterSteps.get(currentKey) ?? 0;

          if (isWater && !isBridgeTile && !isPort) {
            // Water without bridge or port — can traverse if within gap limit from a port/road
            if (currentWaterGap >= 5) continue; // water gap exceeded
            waterSteps.set(neighborKey, currentWaterGap + 1);
            visited.add(neighborKey);
            queue.push(neighbor);
          } else if (isRoadTile || isBridgeTile || isPort) {
            // Trade route tile — reset water gap
            waterSteps.set(neighborKey, 0);
            visited.add(neighborKey);
            queue.push(neighbor);
          } else if (!isWater) {
            // Land tile without road — can traverse but doesn't help connection
            // Only allow if we're on a trade route (road/bridge/port)
            if (this.hasRoad(currentTile!) || this.hasBridge(currentTile!) || this.isPortCity(cities, current)) {
              waterSteps.set(neighborKey, 0);
              visited.add(neighborKey);
              queue.push(neighbor);
            }
          }
        }
      }

      connections.set(city.id, found);
    }

    return connections;
  }

  /**
   * Check if there's a city with a Port at the given coordinate.
   */
  private isPortCity(cities: City[], coord: HexCoord): boolean {
    for (const city of cities) {
      if (city.position.equals(coord) && city.buildings.includes(BuildingType.PORT)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Apply connection bonuses to all cities.
   * Called after road/bridge construction or city changes.
   * Returns the total Grand Bazaar bonus score to add.
   */
  applyConnectionBonuses(
    cities: City[],
    tileMap: Map<string, TileData>,
  ): number {
    const connections = this.detectConnections(cities, tileMap);
    let grandBazaarScore = 0;

    // Clear existing connections
    for (const city of cities) {
      city.connectedCityIds = [];
    }

    // Apply new connections (avoid duplicates)
    const applied = new Set<string>();
    for (const [cityId, connectedIds] of connections) {
      const city = cities.find(c => c.id === cityId);
      if (!city) continue;

      for (const otherId of connectedIds) {
        // Create a canonical pair key to avoid applying twice
        const pairKey = [cityId, otherId].sort().join('--');
        if (applied.has(pairKey)) continue;
        applied.add(pairKey);

        const other = cities.find(c => c.id === otherId);
        if (!other) continue;

        // Add connection to both cities
        if (!city.connectedCityIds.includes(otherId)) {
          city.connectedCityIds.push(otherId);
        }
        if (!other.connectedCityIds.includes(cityId)) {
          other.connectedCityIds.push(cityId);
        }

        // +1 population to both cities (only once per pair)
        city.population++;
        other.population++;
      }
    }

    // Check Grand Bazaar: 5+ connections → +3 pop + 400 score
    for (const city of cities) {
      if (city.connectedCityIds.length >= 5 && !city.hasGrandBazaar) {
        city.hasGrandBazaar = true;
        city.population += 3;
        grandBazaarScore += 400;
      }
    }

    return grandBazaarScore;
  }
}
