import { describe, it, expect } from 'vitest';
import { TechId, TECH_DEFS, techCost, TRIBE_STARTING_TECHS, UNIT_TECH_GATES } from '../src/entities/TechTree';
import { UnitType } from '../src/entities/Unit';

describe('TechTree', () => {
  it('has 10 techs defined across 3 series', () => {
    expect(Object.keys(TECH_DEFS).length).toBe(10);
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
    it('Swordsman and Knight are gated behind Chivalry', () => {
      expect(UNIT_TECH_GATES[UnitType.SWORDSMAN]).toBe(TechId.CHIVALRY);
      expect(UNIT_TECH_GATES[UnitType.KNIGHT]).toBe(TechId.CHIVALRY);
    });
    it('Warrior and Defender have no gate', () => {
      expect(UNIT_TECH_GATES[UnitType.WARRIOR]).toBeUndefined();
      expect(UNIT_TECH_GATES[UnitType.DEFENDER]).toBeUndefined();
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
});
