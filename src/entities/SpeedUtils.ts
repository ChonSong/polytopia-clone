/**
 * Game speed multiplier constants.
 * Normal = ×1.0, Fast = ×0.75, Blitz = ×0.5
 */
export const SPEED_MULTIPLIERS: Record<string, number> = {
  normal: 1.0,
  fast: 0.75,
  blitz: 0.5,
};

/**
 * Apply game speed multiplier to a base cost.
 * Always rounds up (Math.ceil) to ensure minimum cost of 1 star.
 * A 1⭐ cost on Blitz stays at 1 (Math.ceil(1 * 0.5) = 1).
 */
export function speedAdjustedCost(baseCost: number, multiplier: number): number {
  return Math.ceil(baseCost * multiplier);
}
