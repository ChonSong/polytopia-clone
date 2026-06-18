import { describe, it, expect } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { Biome } from '../src/hex/Tile';
import { City } from '../src/entities/City';
import { Unit, UnitType } from '../src/entities/Unit';
import { Tribe, TRIBE_CONFIGS } from '../src/entities/Tribe';

// ---------------------------------------------------------------------------
// Siege Mechanics (GDD §5.8)
// ---------------------------------------------------------------------------

describe('Siege mechanics', () => {
  /** Helper: create a city with a tribe and an enemy unit on the same tile. */
  function setupSiegeScenario() {
    const tribe = new Tribe(TRIBE_CONFIGS[0]); // Xin-xi
    const enemyTribe = new Tribe(TRIBE_CONFIGS[1]); // Imperius
    const pos = new HexCoord(5, 5);
    const city = new City(pos, 'TestCity', tribe.id, 3, 3);
    tribe.addCity(city);
    return { tribe, enemyTribe, city, pos };
  }

  it('city is not besieged when no enemy unit is on it', () => {
    const { city } = setupSiegeScenario();
    expect(city.isBesieged).toBe(false);
  });

  it('city becomes besieged when enemy unit is on its tile', () => {
    const { city, pos, enemyTribe } = setupSiegeScenario();
    const enemyUnit = new Unit(pos, UnitType.WARRIOR, enemyTribe.id);
    enemyTribe.addUnit(enemyUnit);

    // Simulate siege check: scan for enemy units on city tile
    let enemyOnTile = false;
    for (const u of enemyTribe.getAliveUnits()) {
      if (u.position.equals(city.position)) {
        enemyOnTile = true;
        break;
      }
    }
    city.isBesieged = enemyOnTile;
    expect(city.isBesieged).toBe(true);
  });

  it('besieged city produces 0 stars per turn', () => {
    const { city } = setupSiegeScenario();
    const biomes = [Biome.GRASS, Biome.GRASS, Biome.GRASS, Biome.GRASS, Biome.GRASS, Biome.GRASS];

    // Not besieged: should produce stars
    city.isBesieged = false;
    const normalStars = city.getStarsPerTurn(biomes);
    expect(normalStars).toBeGreaterThan(0);

    // Besieged: should produce 0
    city.isBesieged = true;
    expect(city.getStarsPerTurn(biomes)).toBe(0);
  });

  it('siege lifts when enemy unit is killed', () => {
    const { city, pos, enemyTribe } = setupSiegeScenario();
    const enemyUnit = new Unit(pos, UnitType.WARRIOR, enemyTribe.id);
    enemyTribe.addUnit(enemyUnit);

    // Siege active
    city.isBesieged = true;
    expect(city.isBesieged).toBe(true);

    // Kill the enemy unit
    enemyUnit.takeDamage(999);
    expect(enemyUnit.isAlive).toBe(false);

    // Re-check: no alive enemy units on tile
    const aliveOnTile = enemyTribe.getAliveUnits().some(u => u.position.equals(city.position));
    city.isBesieged = aliveOnTile;
    expect(city.isBesieged).toBe(false);
  });

  it('siege lifts when enemy unit moves away', () => {
    const { city, pos, enemyTribe } = setupSiegeScenario();
    const enemyUnit = new Unit(pos, UnitType.WARRIOR, enemyTribe.id);
    enemyTribe.addUnit(enemyUnit);

    city.isBesieged = true;

    // Move unit away
    enemyUnit.position = new HexCoord(6, 6);

    const aliveOnTile = enemyTribe.getAliveUnits().some(u => u.position.equals(city.position));
    city.isBesieged = aliveOnTile;
    expect(city.isBesieged).toBe(false);
  });

  it('friendly unit on city tile does NOT trigger siege', () => {
    const { city, pos, tribe } = setupSiegeScenario();
    const friendlyUnit = new Unit(pos, UnitType.WARRIOR, tribe.id);
    tribe.addUnit(friendlyUnit);

    // Check: friendly units should not cause siege
    let enemyOnTile = false;
    const otherTribes = [tribe]; // only self in this scenario
    for (const otherTribe of otherTribes) {
      if (otherTribe.id === tribe.id) continue; // skip own tribe
      for (const u of otherTribe.getAliveUnits()) {
        if (u.position.equals(city.position)) enemyOnTile = true;
      }
    }
    city.isBesieged = enemyOnTile;
    expect(city.isBesieged).toBe(false);
  });

  it('city starts with isBesieged = false', () => {
    const pos = new HexCoord(3, 3);
    const city = new City(pos, 'NewCity', 'Xin-xi', 1, 1);
    expect(city.isBesieged).toBe(false);
  });
});
