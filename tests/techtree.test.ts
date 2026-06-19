import { describe, it, expect } from 'vitest';
import { TechId, TECH_DEFS, techCost, TRIBE_STARTING_TECHS, UNIT_TECH_GATES } from '../src/entities/TechTree';
import { UnitType } from '../src/entities/Unit';

describe('TechTree', () => {
  it('has 21 techs defined across 8 series', () => {
    expect(Object.keys(TECH_DEFS).length).toBe(21);
  });

  describe('techCost formula', () => {
    it('tier 1 with 1 city: cost 5', () => { expect(techCost(1, 1)).toBe(5); });
    it('tier 1 with 4 cities: cost 8', () => { expect(techCost(1, 4)).toBe(8); });
    it('tier 2 with 3 cities: cost 10', () => { expect(techCost(2, 3)).toBe(10); });
    it('tier 3 with 5 cities: cost 19', () => { expect(techCost(3, 5)).toBe(19); });
  });

  describe('prerequisites chain', () => {
    it('Hunting has no prerequisites', () => {
      expect(TECH_DEFS[TechId.HUNTING].prerequisites).toEqual([]);
    });
    it('Archery requires Hunting', () => {
      expect(TECH_DEFS[TechId.ARCHERY].prerequisites).toEqual([TechId.HUNTING]);
    });
    it('Mathematics requires Archery', () => {
      expect(TECH_DEFS[TechId.MATHEMATICS].prerequisites).toEqual([TechId.ARCHERY]);
    });
    it('Chivalry requires Free Spirit', () => {
      expect(TECH_DEFS[TechId.CHIVALRY].prerequisites).toEqual([TechId.FREE_SPIRIT]);
    });
  });

  describe('unit tech gates', () => {
    it('Archer is gated behind Archery', () => {
      expect(UNIT_TECH_GATES[UnitType.ARCHER]).toBe(TechId.ARCHERY);
    });
    it('Rider is gated behind Riding', () => {
      expect(UNIT_TECH_GATES[UnitType.RIDER]).toBe(TechId.RIDING);
    });
    it('Swordsman is gated behind Smithery (not Chivalry)', () => {
      expect(UNIT_TECH_GATES[UnitType.SWORDSMAN]).toBe(TechId.SMITHERY);
    });
    it('Knight is gated behind Chivalry', () => {
      expect(UNIT_TECH_GATES[UnitType.KNIGHT]).toBe(TechId.CHIVALRY);
    });
    it('Warrior has no gate', () => {
      expect(UNIT_TECH_GATES[UnitType.WARRIOR]).toBeUndefined();
    });
    it('Defender is gated behind Strategy', () => {
      expect(UNIT_TECH_GATES[UnitType.DEFENDER]).toBe(TechId.STRATEGY);
    });
  });

  describe('TRIBE_STARTING_TECHS', () => {
    it('Xin-xi starts with Riding', () => {
      expect(TRIBE_STARTING_TECHS['xin-xi']).toContain(TechId.RIDING);
    });
    it('Imperius starts with Fishing', () => {
      expect(TRIBE_STARTING_TECHS['imperius']).toContain(TechId.FISHING);
    });
    it('Bardur starts with Hunting', () => {
      expect(TRIBE_STARTING_TECHS['bardur']).toContain(TechId.HUNTING);
    });
    it('Oumaji starts with Riding', () => {
      expect(TRIBE_STARTING_TECHS['oumaji']).toContain(TechId.RIDING);
    });
  });

  describe('extended tech series (GDD §6.2)', () => {
    it('Climbing is a tier-1 tech with no prerequisites', () => {
      expect(TECH_DEFS[TechId.CLIMBING].tier).toBe(1);
      expect(TECH_DEFS[TechId.CLIMBING].prerequisites).toEqual([]);
      expect(TECH_DEFS[TechId.CLIMBING].series).toBe('climbing');
    });
    it('Organization and Strategy form the organization series', () => {
      expect(TECH_DEFS[TechId.ORGANIZATION].tier).toBe(1);
      expect(TECH_DEFS[TechId.STRATEGY].tier).toBe(2);
      expect(TECH_DEFS[TechId.STRATEGY].prerequisites).toContain(TechId.ORGANIZATION);
    });
    it('Farming and Smithery form the farming series', () => {
      expect(TECH_DEFS[TechId.FARMING].tier).toBe(1);
      expect(TECH_DEFS[TechId.SMITHERY].tier).toBe(2);
      expect(TECH_DEFS[TechId.SMITHERY].prerequisites).toContain(TechId.FARMING);
    });
    it('Aquaculture is a tier-2 tech that unlocks Rammer', () => {
      expect(TECH_DEFS[TechId.AQUACULTURE].tier).toBe(2);
      expect(TECH_DEFS[TechId.AQUACULTURE].unlocksUnits).toContain(UnitType.RAMMER);
    });
    it('Smithery unlocks Swordsman', () => {
      expect(TECH_DEFS[TechId.SMITHERY].unlocksUnits).toContain(UnitType.SWORDSMAN);
    });
    it('Strategy unlocks Defender', () => {
      expect(TECH_DEFS[TechId.STRATEGY].unlocksUnits).toContain(UnitType.DEFENDER);
    });
  });
});
