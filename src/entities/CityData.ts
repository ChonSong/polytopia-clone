export interface CityData {
  owner: string;
  health: number;
  maxHealth: number;
  defenseBonus: number;
  q: number;
  r: number;
}

export function createCity(owner: string, q: number, r: number): CityData {
  return {
    owner,
    health: 10,
    maxHealth: 10,
    defenseBonus: 2,
    q,
    r,
  };
}
