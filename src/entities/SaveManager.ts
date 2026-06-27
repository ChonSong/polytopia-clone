import { GameState } from './GameState';
import { Tribe, TRIBE_CONFIGS } from './Tribe';
import { City } from './City';
import { Unit, UnitType } from './Unit';
import { HexCoord } from '../hex/HexCoord';
import { TechId } from './TechTree';
import { BuildingType } from './Building';
import { TileData } from '../hex/Tile';

/**
 * Serialized plain-object form of GameState (Map/Set → arrays).
 */
interface SerializedGameState {
  version: number;
  savedAt: string;
  turn: number;
  currentTribeIndex: number;
  gameMode: string;
  difficulty: string;
  speedMultiplier: number;
  mapType: string;
  turnLimit: number;
  tiles: Array<[string, TileData]>;
  tribes: SerializedTribe[];
  tileOwnership: Array<[string, string]>;
  visibility: Array<[string, boolean]>;
  tribeVisibility: Array<[string, string[]]>;
  pendingDaggerSpawns: Array<[string, string]>;
}

interface SerializedTribe {
  id: string;
  name: string;
  color: number;
  technologyLevel: number;
  stars: number;
  starsPerTurn: number;
  techs: string[];
  cities: SerializedCity[];
  units: SerializedUnit[];
}

interface SerializedCity {
  id: string;
  level: number;
  population: number;
  canBuildUnits: boolean;
  captured: boolean;
  levelStarsBonus: number;
  buildings: string[];
  food: number;
  foodPerTurn: number;
  giantSpawned: boolean;
  isBesieged: boolean;
  upgradeChoices: Record<number, string>;
  connectedCityIds: string[];
  hasGrandBazaar: boolean;
  templeCount: number;
  monumentCount: number;
  position: { q: number; r: number };
  name: string;
  tribeId: string;
}

interface SerializedUnit {
  id: string;
  health: number;
  hasActed: boolean;
  hasAttacked: boolean;
  originalType: string | null;
  fortified: boolean;
  killCount: number;
  isVeteran: boolean;
  maxHPBonus: number;
  poisonTurns: number;
  isSubmerged: boolean;
  primedForInfiltrate: boolean;
  position: { q: number; r: number };
  type: string;
  owner: string;
}

const SAVE_KEY = 'polytopia_save_slots';
const SAVE_VERSION = 1;
const MAX_SLOTS = 3;

/**
 * SaveManager handles serialization/deserialization of GameState to localStorage.
 *
 * Design decisions:
 * - Map/Set instances are converted to arrays for JSON compatibility.
 * - HexCoord instances are stored as {q, r} plain objects.
 * - Unit/Tribe/City class instances are restored via reconstruction.
 * - Transient Phaser state (graphics, animations) is NOT serialized.
 */
export class SaveManager {

  static save(
    slot: number,
    state: GameState,
    tiles: Map<string, TileData>,
    gameMode: string,
    difficulty: string,
    speedMultiplier: number,
    mapType: string,
    turnLimit: number,
  ): void {
    if (slot < 0 || slot >= MAX_SLOTS) {
      throw new Error(`Invalid save slot: ${slot}`);
    }

    const serialized: SerializedGameState = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      turn: state.turn,
      currentTribeIndex: state.currentTribeIndex,
      gameMode,
      difficulty,
      speedMultiplier,
      mapType,
      turnLimit,
      tiles: Array.from(tiles.entries()),
      tribes: state.tribes.map(serializeTribe),
      tileOwnership: Array.from(state.tileOwnership.entries()),
      visibility: Array.from(state.visibility.entries()),
      tribeVisibility: Array.from(state.tribeVisibility.entries()).map(([k, v]) => [k, Array.from(v)]),
      pendingDaggerSpawns: Array.from(state.pendingDaggerSpawns.entries()),
    };

    const allSlots = SaveManager.loadAllSlots();
    allSlots[slot] = serialized;

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(allSlots));
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        throw new Error('Save failed: storage quota exceeded. Try clearing a slot.');
      }
      throw e;
    }
  }

  static load(slot: number): {
    state: GameState;
    tiles: Map<string, TileData>;
    gameMode: string;
    difficulty: string;
    speedMultiplier: number;
    mapType: string;
    turnLimit: number;
  } | null {
    if (slot < 0 || slot >= MAX_SLOTS) return null;

    const allSlots = SaveManager.loadAllSlots();
    const data = allSlots[slot];
    if (!data) return null;

    const tiles = new Map<string, TileData>(data.tiles);
    const tribes = data.tribes.map(deserializeTribe);
    const state = new GameState(tribes);
    state.turn = data.turn;
    state.currentTribeIndex = data.currentTribeIndex;
    state.tileOwnership = new Map<string, string>(data.tileOwnership);
    state.visibility = new Map<string, boolean>(data.visibility);
    state.tribeVisibility = new Map<string, Set<string>>(
      data.tribeVisibility.map(([k, v]) => [k, new Set(v)])
    );
    state.pendingDaggerSpawns = new Map<string, string>(data.pendingDaggerSpawns);

    return {
      state,
      tiles,
      gameMode: data.gameMode,
      difficulty: data.difficulty,
      speedMultiplier: data.speedMultiplier,
      mapType: data.mapType,
      turnLimit: data.turnLimit,
    };
  }

  static hasSave(slot: number): boolean {
    const allSlots = SaveManager.loadAllSlots();
    return !!allSlots[slot];
  }

  static getSlotInfo(): Array<{ slot: number; savedAt: string | null; turn: number | null }> {
    const allSlots = SaveManager.loadAllSlots();
    return Array.from({ length: MAX_SLOTS }, (_, i) => {
      const data = allSlots[i];
      return {
        slot: i,
        savedAt: data?.savedAt ?? null,
        turn: data?.turn ?? null,
      };
    });
  }

  static deleteSlot(slot: number): void {
    const allSlots = SaveManager.loadAllSlots();
    delete allSlots[slot];
    localStorage.setItem(SAVE_KEY, JSON.stringify(allSlots));
  }

  private static loadAllSlots(): Record<number, SerializedGameState> {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return {};
      return parsed;
    } catch {
      localStorage.removeItem(SAVE_KEY);
      return {};
    }
  }
}

// ── Serialization helpers ────────────────────────────────────────────────

function serializeTribe(tribe: Tribe): SerializedTribe {
  return {
    id: tribe.id,
    name: tribe.name,
    color: tribe.color,
    technologyLevel: tribe.technologyLevel,
    stars: tribe.stars,
    starsPerTurn: tribe.starsPerTurn,
    techs: Array.from(tribe.techs),
    cities: tribe.cities.map(serializeCity),
    units: tribe.units.map(serializeUnit),
  };
}

function serializeCity(city: City): SerializedCity {
  return {
    id: city.id,
    level: city.level,
    population: city.population,
    canBuildUnits: city.canBuildUnits,
    captured: city.captured,
    levelStarsBonus: city.levelStarsBonus,
    buildings: [...city.buildings],
    food: city.food,
    foodPerTurn: city.foodPerTurn,
    giantSpawned: city.giantSpawned,
    isBesieged: city.isBesieged,
    upgradeChoices: { ...city.upgradeChoices },
    connectedCityIds: [...city.connectedCityIds],
    hasGrandBazaar: city.hasGrandBazaar,
    templeCount: city.templeCount,
    monumentCount: city.monumentCount,
    position: { q: city.position.q, r: city.position.r },
    name: city.name,
    tribeId: city.tribeId,
  };
}

function serializeUnit(unit: Unit): SerializedUnit {
  return {
    id: unit.id,
    health: unit.health,
    hasActed: unit.hasActed,
    hasAttacked: unit.hasAttacked,
    originalType: unit.originalType,
    fortified: unit.fortified,
    killCount: unit.killCount,
    isVeteran: unit.isVeteran,
    maxHPBonus: unit.maxHPBonus,
    poisonTurns: unit.poisonTurns,
    isSubmerged: unit.isSubmerged,
    primedForInfiltrate: unit.primedForInfiltrate,
    position: { q: unit.position.q, r: unit.position.r },
    type: unit.type,
    owner: unit.owner,
  };
}

// ── Deserialization helpers ──────────────────────────────────────────────

function deserializeTribe(data: SerializedTribe): Tribe {
  const config = TRIBE_CONFIGS.find(c => c.id === data.id);
  if (!config) {
    throw new Error(`Unknown tribe: ${data.id}`);
  }
  const tribe = new Tribe(config);
  tribe.technologyLevel = data.technologyLevel;
  tribe.stars = data.stars;
  tribe.starsPerTurn = data.starsPerTurn;
  tribe.techs = new Set<TechId>(data.techs as TechId[]);
  tribe.cities = data.cities.map(deserializeCity);
  tribe.units = data.units.map(deserializeUnit);
  return tribe;
}

function deserializeCity(data: SerializedCity): City {
  const city = new City(
    new HexCoord(data.position.q, data.position.r),
    data.name,
    data.tribeId,
    data.level,
    data.population,
  );
  city.canBuildUnits = data.canBuildUnits;
  city.captured = data.captured;
  city.levelStarsBonus = data.levelStarsBonus;
  city.buildings = data.buildings as BuildingType[];
  city.food = data.food;
  city.foodPerTurn = data.foodPerTurn;
  city.giantSpawned = data.giantSpawned;
  city.isBesieged = data.isBesieged;
  city.upgradeChoices = data.upgradeChoices as Record<number, 'A' | 'B'>;
  city.connectedCityIds = [...data.connectedCityIds];
  city.hasGrandBazaar = data.hasGrandBazaar;
  city.templeCount = data.templeCount;
  city.monumentCount = data.monumentCount;
  return city;
}

function deserializeUnit(data: SerializedUnit): Unit {
  const pos = new HexCoord(data.position.q, data.position.r);
  const unit = new Unit(pos, data.type as UnitType, data.owner, data.health, data.originalType as UnitType | null);
  unit['id'] = data.id;
  unit.hasActed = data.hasActed;
  unit.hasAttacked = data.hasAttacked;
  unit.fortified = data.fortified;
  unit.killCount = data.killCount;
  unit.isVeteran = data.isVeteran;
  unit.maxHPBonus = data.maxHPBonus;
  unit.poisonTurns = data.poisonTurns;
  unit.isSubmerged = data.isSubmerged;
  unit.primedForInfiltrate = data.primedForInfiltrate;
  return unit;
}
