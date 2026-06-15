import { describe, it, expect } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { HEX_SIZE } from '../src/hex/constants';

describe('HexCoord', () => {
  it('creates axial coordinates', () => {
    const h = new HexCoord(1, 2);
    expect(h.q).toBe(1);
    expect(h.r).toBe(2);
    expect(h.s).toBe(-3);
  });

  it('equals same coordinate', () => {
    expect(new HexCoord(1, 2).equals(new HexCoord(1, 2))).toBe(true);
    expect(new HexCoord(1, 2).equals(new HexCoord(2, 1))).toBe(false);
  });

  it('computes neighbors', () => {
    const h = new HexCoord(0, 0);
    const neighbors = h.neighbors();
    expect(neighbors).toHaveLength(6);
    expect(neighbors[0].toString()).toBe('1,0');
  });

  it('computes distance', () => {
    const a = new HexCoord(0, 0);
    const b = new HexCoord(3, 0);
    expect(a.distanceTo(b)).toBe(3);
  });

  it('round-trips pixel to hex', () => {
    const original = new HexCoord(5, 3);
    const pixel = original.toPixel(HEX_SIZE);
    const roundtrip = HexCoord.fromPixel(pixel.x, pixel.y, HEX_SIZE);
    expect(roundtrip.equals(original)).toBe(true);
  });

  it('rounds fractional coords correctly', () => {
    const h = HexCoord.round(1.3, 2.7);
    expect(h.q).toBe(1);
    expect(h.r).toBe(3);
  });
});
