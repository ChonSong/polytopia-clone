import { describe, it, expect } from 'vitest';
import { SPEED_MULTIPLIERS, speedAdjustedCost } from '../src/entities/SpeedUtils';

// ---------------------------------------------------------------------------
// Game Speed Cost Adjustments (GDD §Speed Control)
// ---------------------------------------------------------------------------
// Commit 704df66 added SPEED_MULTIPLIERS × speedAdjustedCost() with:
//   Normal = ×1.0, Fast = ×0.75, Blitz = ×0.5
// All costs use Math.ceil rounding so Blitz always costs ≥1⭐.
// ---------------------------------------------------------------------------

describe('SPEED_MULTIPLIERS', () => {
  it('defines Normal as ×1.0', () => {
    expect(SPEED_MULTIPLIERS.normal).toBe(1.0);
  });

  it('defines Fast as ×0.75', () => {
    expect(SPEED_MULTIPLIERS.fast).toBe(0.75);
  });

  it('defines Blitz as ×0.5', () => {
    expect(SPEED_MULTIPLIERS.blitz).toBe(0.5);
  });
});

describe('speedAdjustedCost — Normal (×1.0)', () => {
  it('returns base cost unchanged', () => {
    expect(speedAdjustedCost(100, 1.0)).toBe(100);
  });

  it('handles small costs unchanged', () => {
    expect(speedAdjustedCost(2, 1.0)).toBe(2);   // Warrior
    expect(speedAdjustedCost(5, 1.0)).toBe(5);   // Swordsman / Scout / Mind Bender
    expect(speedAdjustedCost(8, 1.0)).toBe(8);   // Knight / Catapult / Cloak
    expect(speedAdjustedCost(15, 1.0)).toBe(15); // Bomber
  });

  it('handles zero base cost', () => {
    expect(speedAdjustedCost(0, 1.0)).toBe(0);
  });
});

describe('speedAdjustedCost — Fast (×0.75)', () => {
  it('rounds up to nearest integer', () => {
    expect(speedAdjustedCost(100, 0.75)).toBe(75);   // 100 * 0.75 = 75, exact
    expect(speedAdjustedCost(10, 0.75)).toBe(8);     // 10 * 0.75 = 7.5 → ceil = 8
    expect(speedAdjustedCost(7, 0.75)).toBe(6);      // 7 * 0.75 = 5.25 → ceil = 6
    expect(speedAdjustedCost(3, 0.75)).toBe(3);      // 3 * 0.75 = 2.25 → ceil = 3
  });

  it('returns at least 1 for any non-zero cost', () => {
    expect(speedAdjustedCost(1, 0.75)).toBe(1);      // 1 * 0.75 = 0.75 → ceil = 1
    expect(speedAdjustedCost(2, 0.75)).toBe(2);      // 2 * 0.75 = 1.5 → ceil = 2
  });

  it('affects unit training costs', () => {
    // Warrior costs 2 on Normal → 2 on Fast (2 * 0.75 = 1.5 → ceil = 2)
    expect(speedAdjustedCost(2, 0.75)).toBe(2);
    // Swordsman costs 5 on Normal → 4 on Fast (5 * 0.75 = 3.75 → ceil = 4)
    expect(speedAdjustedCost(5, 0.75)).toBe(4);
    // Knight costs 8 on Normal → 6 on Fast (8 * 0.75 = 6)
    expect(speedAdjustedCost(8, 0.75)).toBe(6);
    // Bomber costs 15 on Normal → 12 on Fast (15 * 0.75 = 11.25 → ceil = 12)
    expect(speedAdjustedCost(15, 0.75)).toBe(12);
  });

  it('affects building costs (Road 3⭐, Bridge 5⭐)', () => {
    // Road: 3 * 0.75 = 2.25 → ceil = 3
    expect(speedAdjustedCost(3, 0.75)).toBe(3);
    // Bridge: 5 * 0.75 = 3.75 → ceil = 4
    expect(speedAdjustedCost(5, 0.75)).toBe(4);
  });

  it('affects city upgrade costs', () => {
    // City L1 → L2 upgrade: 5 * 0.75 = 3.75 → ceil = 4
    expect(speedAdjustedCost(5, 0.75)).toBe(4);
    // City L5 → L6 upgrade: 25 * 0.75 = 18.75 → ceil = 19
    expect(speedAdjustedCost(25, 0.75)).toBe(19);
  });

  it('affects tech research costs', () => {
    // Tier 1 tech with 3 cities: (1 * 3) + 4 = 7 → 7 * 0.75 = 5.25 → ceil = 6
    expect(speedAdjustedCost(7, 0.75)).toBe(6);
    // Tier 2 tech with 5 cities: (2 * 5) + 4 = 14 → 14 * 0.75 = 10.5 → ceil = 11
    expect(speedAdjustedCost(14, 0.75)).toBe(11);
  });
});

describe('speedAdjustedCost — Blitz (×0.5)', () => {
  it('rounds up to nearest integer', () => {
    expect(speedAdjustedCost(100, 0.5)).toBe(50);   // exact
    expect(speedAdjustedCost(10, 0.5)).toBe(5);     // exact
    expect(speedAdjustedCost(7, 0.5)).toBe(4);      // 7 * 0.5 = 3.5 → ceil = 4
    expect(speedAdjustedCost(3, 0.5)).toBe(2);      // 3 * 0.5 = 1.5 → ceil = 2
  });

  it('returns minimum 1⭐ for any non-zero cost', () => {
    expect(speedAdjustedCost(1, 0.5)).toBe(1);      // 1 * 0.5 = 0.5 → ceil = 1 (min)
    expect(speedAdjustedCost(2, 0.5)).toBe(1);      // 2 * 0.5 = 1.0 → ceil = 1
    expect(speedAdjustedCost(3, 0.5)).toBe(2);      // 3 * 0.5 = 1.5 → ceil = 2
  });

  it('affects unit training costs', () => {
    // Warrior (2⭐ Normal) → 1⭐ Blitz (2 * 0.5 = 1)
    expect(speedAdjustedCost(2, 0.5)).toBe(1);
    // Rider/Defender/Archer (3⭐ Normal) → 2⭐ Blitz (3 * 0.5 = 1.5 → ceil = 2)
    expect(speedAdjustedCost(3, 0.5)).toBe(2);
    // Swordsman (5⭐ Normal) → 3⭐ Blitz (5 * 0.5 = 2.5 → ceil = 3)
    expect(speedAdjustedCost(5, 0.5)).toBe(3);
    // Knight/Catapult/Cloak (8⭐ Normal) → 4⭐ Blitz (8 * 0.5 = 4)
    expect(speedAdjustedCost(8, 0.5)).toBe(4);
    // Bomber (15⭐ Normal) → 8⭐ Blitz (15 * 0.5 = 7.5 → ceil = 8)
    expect(speedAdjustedCost(15, 0.5)).toBe(8);
  });

  it('affects building costs (Road 3⭐, Bridge 5⭐)', () => {
    // Road: 3 * 0.5 = 1.5 → ceil = 2
    expect(speedAdjustedCost(3, 0.5)).toBe(2);
    // Bridge: 5 * 0.5 = 2.5 → ceil = 3
    expect(speedAdjustedCost(5, 0.5)).toBe(3);
  });

  it('affects city upgrade costs', () => {
    // City L1 → L2: 5 * 0.5 = 2.5 → ceil = 3
    expect(speedAdjustedCost(5, 0.5)).toBe(3);
    // City L5 → L6: 25 * 0.5 = 12.5 → ceil = 13
    expect(speedAdjustedCost(25, 0.5)).toBe(13);
  });

  it('affects tech research costs', () => {
    // Tier 1 tech, 3 cities: 7 * 0.5 = 3.5 → ceil = 4
    expect(speedAdjustedCost(7, 0.5)).toBe(4);
    // Tier 2 tech, 5 cities: 14 * 0.5 = 7
    expect(speedAdjustedCost(14, 0.5)).toBe(7);
  });

  it('affects naval upgrade costs', () => {
    // Scout/Rammer (5⭐ Normal) → 3⭐ Blitz (5 * 0.5 = 2.5 → ceil = 3)
    expect(speedAdjustedCost(5, 0.5)).toBe(3);
    // Bomber (15⭐ Normal) → 8⭐ Blitz (15 * 0.5 = 7.5 → ceil = 8)
    expect(speedAdjustedCost(15, 0.5)).toBe(8);
  });

  it('affects enchantment cost (3⭐)', () => {
    // Enchant: 3 * 0.5 = 1.5 → ceil = 2
    expect(speedAdjustedCost(3, 0.5)).toBe(2);
  });
});

describe('speedAdjustedCost — edge cases', () => {
  it('handles zero base cost at any speed', () => {
    expect(speedAdjustedCost(0, 0.5)).toBe(0);
    expect(speedAdjustedCost(0, 0.75)).toBe(0);
    expect(speedAdjustedCost(0, 1.0)).toBe(0);
  });

  it('handles very large costs', () => {
    expect(speedAdjustedCost(10000, 0.5)).toBe(5000);
    expect(speedAdjustedCost(10000, 0.75)).toBe(7500);
    expect(speedAdjustedCost(9999, 0.5)).toBe(5000); // 9999 * 0.5 = 4999.5 → ceil = 5000
  });

  it('handles unknown multiplier as-is (reality: GameScene falls back to 1.0)', () => {
    // This tests the raw function; GameScene does the fallback
    expect(speedAdjustedCost(10, 2.0)).toBe(20);
    expect(speedAdjustedCost(10, 0.1)).toBe(1);
  });

  it('Normal-speed costs match existing behavior for all cost classes', () => {
    // Unit training (UNIT_COSTS)
    const unitCosts = [2, 3, 5, 8, 15, 10, 6];
    for (const c of unitCosts) {
      expect(speedAdjustedCost(c, 1.0)).toBe(c);
    }
    // Building costs (BUILDING_DEFS)
    const buildingCosts = [3, 5, 7];
    for (const c of buildingCosts) {
      expect(speedAdjustedCost(c, 1.0)).toBe(c);
    }
    // Tech costs
    expect(speedAdjustedCost(7, 1.0)).toBe(7);
    expect(speedAdjustedCost(14, 1.0)).toBe(14);
    // City upgrade
    expect(speedAdjustedCost(5, 1.0)).toBe(5);
    expect(speedAdjustedCost(25, 1.0)).toBe(25);
    // Enchantment
    expect(speedAdjustedCost(3, 1.0)).toBe(3);
  });
});
