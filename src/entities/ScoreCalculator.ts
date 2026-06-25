import { Tribe } from './Tribe';
import { HexCoord } from '../hex/HexCoord';

/**
 * One row in the score breakdown.
 */
export interface ScoreCategory {
  name: string;
  count: number;
  perUnit: number;
  subtotal: number;
}

/**
 * Structured score breakdown for end-of-game display.
 */
export interface ScoreBreakdown {
  categories: ScoreCategory[];
  getTotal(): number;
}

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
 * - Temple: 20 pts per temple (GDD §1.2 — temples ×20, unlocked by FREE_SPIRIT tech)
 * - Monument: 30 pts per monument (GDD §1.2 — monuments ×30)
 *
 * @param tribe - The tribe to score
 * @param allCoords - Optional array of all valid tile coordinates (map boundary).
 *   Without this, territorial scoring is skipped (returns 0 for that component).
 * @param exploredCount - Optional count of tiles this tribe has revealed from fog.
 *   Each explored tile contributes +5 to the score. Defaults to 0.
 */
export function computeTribeScore(tribe: Tribe, allCoords?: HexCoord[], exploredCount?: number): ScoreBreakdown {
  const nonCapturedCities = tribe.cities.filter(c => !c.captured);
  const cityCount = nonCapturedCities.length;
  const cityScore = cityCount * 100;

  const aliveUnits = tribe.getAliveUnits();
  const unitScore = aliveUnits.length * 10;

  const techScore = tribe.techs.size * 50;

  const levelScore = nonCapturedCities.reduce((sum, c) => sum + (c.level - 1) * 50, 0);

  const buildingScore = nonCapturedCities.reduce((sum, c) => sum + c.buildings.length * 25, 0);

  const parkScore = nonCapturedCities.reduce((sum, c) => sum + (c.hasPark ? 250 : 0), 0);

  const grandBazaarScore = nonCapturedCities.reduce((sum, c) => sum + (c.hasGrandBazaar ? 400 : 0), 0);

  // GDD §1.2 — Temples: +20 per temple in each non-captured city
  const templeScore = nonCapturedCities.reduce((sum, c) => sum + c.templeCount * 20, 0);

  // GDD §1.2 — Monuments: +30 per monument in each non-captured city
  const monumentScore = nonCapturedCities.reduce((sum, c) => sum + c.monumentCount * 30, 0);

  // GDD §1.2 — Territorial tiles: +20 per unique tile within city.level hex distance
  let territorialScore = 0;
  if (allCoords && allCoords.length > 0) {
    const claimedTiles = new Set<string>();
    for (const city of nonCapturedCities) {
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

  const categories: ScoreCategory[] = [
    { name: 'Cities',         count: cityCount,                              perUnit: 100, subtotal: cityScore },
    { name: 'Units',          count: aliveUnits.length,                      perUnit: 10,  subtotal: unitScore },
    { name: 'Techs',          count: tribe.techs.size,                      perUnit: 50,  subtotal: techScore },
    { name: 'City Levels',    count: nonCapturedCities.reduce((s, c) => s + (c.level - 1), 0), perUnit: 50, subtotal: levelScore },
    { name: 'Buildings',      count: nonCapturedCities.reduce((s, c) => s + c.buildings.length, 0), perUnit: 25, subtotal: buildingScore },
    { name: 'Parks',          count: nonCapturedCities.filter(c => c.hasPark).length, perUnit: 250, subtotal: parkScore },
    { name: 'Grand Bazaar',   count: nonCapturedCities.filter(c => c.hasGrandBazaar).length, perUnit: 400, subtotal: grandBazaarScore },
    { name: 'Territory',      count: allCoords ? Math.round(territorialScore / 20) : 0, perUnit: 20, subtotal: territorialScore },
    { name: 'Exploration',    count: exploredCount ?? 0,                    perUnit: 5,   subtotal: explorationScore },
    { name: 'Temples',        count: nonCapturedCities.reduce((s, c) => s + c.templeCount, 0), perUnit: 20, subtotal: templeScore },
    { name: 'Monuments',      count: nonCapturedCities.reduce((s, c) => s + c.monumentCount, 0), perUnit: 30, subtotal: monumentScore },
  ];

  return {
    categories,
    getTotal: () => categories.reduce((sum, cat) => sum + cat.subtotal, 0),
  };
}
