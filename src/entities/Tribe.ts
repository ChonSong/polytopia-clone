import { City } from './City';
import { Unit, UnitType } from './Unit';
import { TechId, TRIBE_STARTING_TECHS, UNIT_TECH_GATES } from './TechTree';

export interface TribeConfig {
  id: string;
  name: string;
  color: number;      // hex colour, e.g. 0xd4a017
}

/** The four default tribes. */
export const TRIBE_CONFIGS: TribeConfig[] = [
  { id: 'xin-xi',   name: 'Xin-xi',   color: 0xd4a017 },
  { id: 'imperius', name: 'Imperius', color: 0x3b7dbd },
  { id: 'bardur',   name: 'Bardur',   color: 0x5a8f3c },
  { id: 'oumaji',   name: 'Oumaji',   color: 0xc0392b },
];

export class Tribe {
  public readonly id: string;
  public readonly name: string;
  public readonly color: number;
  public cities: City[];
  public units: Unit[];
  public technologyLevel: number;
  public stars: number;
  public starsPerTurn: number;
  public techs: Set<TechId>;

  constructor(config: TribeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.color = config.color;
    this.cities = [];
    this.units = [];
    this.technologyLevel = 1;
    this.stars = 10;
    this.starsPerTurn = 5;
    this.techs = new Set(TRIBE_STARTING_TECHS[config.id] ?? []);
  }

  addCity(city: City): void {
    this.cities.push(city);
  }

  addUnit(unit: Unit): void {
    this.units.push(unit);
  }

  /** Remove a unit by id. Returns the removed unit, or undefined. */
  removeUnit(unitId: string): Unit | undefined {
    const index = this.units.findIndex(u => u.id === unitId);
    if (index === -1) return undefined;
    return this.units.splice(index, 1)[0];
  }

  /** Returns units that are still alive (health > 0). */
  getAliveUnits(): Unit[] {
    return this.units.filter(u => u.isAlive);
  }

  /** A tribe is defeated when it has no cities and no alive units. */
  isDefeated(): boolean {
    return this.cities.length === 0 && this.getAliveUnits().length === 0;
  }

  /** Check if this tribe has researched a tech. */
  hasTech(tech: TechId): boolean {
    return this.techs.has(tech);
  }

  /** Research a tech. Returns false if already known. */
  researchTech(tech: TechId): boolean {
    if (this.techs.has(tech)) return false;
    this.techs.add(tech);
    return true;
  }

  /** Filter trainable unit types by researched techs. */
  getTrainableUnitTypes(): UnitType[] {
    const all: UnitType[] = [UnitType.WARRIOR, UnitType.DEFENDER, UnitType.BOAT];
    for (const ut of [UnitType.RIDER, UnitType.ARCHER, UnitType.SWORDSMAN, UnitType.KNIGHT, UnitType.CATAPULT]) {
      const gate = UNIT_TECH_GATES[ut];
      if (!gate || this.techs.has(gate)) all.push(ut);
    }
    return all;
  }
}
