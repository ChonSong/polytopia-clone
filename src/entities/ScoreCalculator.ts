import { Tribe } from './Tribe';
import { HexCoord } from '../hex/HexCoord';

/**
 * Calculate Perfection mode score for a tribe.
 * GDD §1.2 — Scoring formula.
 *
 * Components:
 * - City: 100 pts per non-captured city
 * - Unit: 10 pts per alive unit
 * - Tech: 50 pts per researched tech
 * - Level: 50 pts per level above 1 (L2=50, L3=100, ...L5=200)
 * - Building: 25 pts per building
 * - Park: 250 pts per city with Park
 * - Grand Bazaar: 400 pts per city with Grand Bazaar
 * - Territory: 20 pts per unique territorial tile (within city.level hex distance of each city)
 * - Exploration: 5 pts per explored (previously revealed fog) tile
 *
 * @param tribe - The tribe to score
 * @param allCoords - Optional array of all valid tile coordinates (map boundary).
 *   Without this, territorial scoring is skipped (returns 0 for that component).
 * @param exploredCount - Optional count of tiles this tribe has revealed from fog.
 *   Each explored tile contributes +5 to the score. Defaults to 0.
 */
export function computeTribeScore(tribe: Tribe, allCoords?: HexCoord[], exploredCount?: number): number {
  const cityScore = tribe.cities.filter(c => !c.captured).length * 100;
  const unitScore = tribe.getAliveUnits().length * 10;
  const techScore = tribe.techs.size * 50;
  const levelScore = tribe.cities.reduce((sum, c) => sum + (c.level - 1) * 50, 0);
  const buildingScore = tribe.cities.reduce((sum, c) => sum + c.buildings.length * 25, 0);
  const parkScore = tribe.cities.reduce((sum, c) => sum + (c.hasPark ? 250 : 0), 0);
  const grandBazaarScore = tribe.cities.reduce((sum, c) => sum + (c.hasGrandBazaar ? 400 : 0), 0);

  // GDD §1.2 — Territorial tiles: +20 per unique tile within city.level hex distance
  let territorialScore = 0;
  if (allCoords && allCoords.length > 0) {
    const claimedTiles = new Set<string>();
    for (const city of tribe.cities) {
      if (city.captured) continue;
      const radius = city.level;
      for (const coord of allCoords) {
        if (coord.distanceTo(city.position) <= radius) {
          claimedTiles.add(coord.toString());
        }
      }
    }
    territorialScore = claimedTiles.size * 20;
  }

  // GDD §1.2 — Exploration: +5 per explored (revealed fog) tile
  const explorationScore = (exploredCount ?? 0) * 5;

  return cityScore + unitScore + techScore + levelScore + buildingScore + parkScore + grandBazaarScore + territorialScore + explorationScore;
}
