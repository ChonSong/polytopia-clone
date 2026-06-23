import { Tribe } from './Tribe';

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
 */
export function computeTribeScore(tribe: Tribe): number {
  const cityScore = tribe.cities.filter(c => !c.captured).length * 100;
  const unitScore = tribe.getAliveUnits().length * 10;
  const techScore = tribe.techs.size * 50;
  const levelScore = tribe.cities.reduce((sum, c) => sum + (c.level - 1) * 50, 0);
  const buildingScore = tribe.cities.reduce((sum, c) => sum + c.buildings.length * 25, 0);
  const parkScore = tribe.cities.reduce((sum, c) => sum + (c.hasPark ? 250 : 0), 0);
  const grandBazaarScore = tribe.cities.reduce((sum, c) => sum + (c.hasGrandBazaar ? 400 : 0), 0);
  return cityScore + unitScore + techScore + levelScore + buildingScore + parkScore + grandBazaarScore;
}
