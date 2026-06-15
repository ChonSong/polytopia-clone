// Axial hex coordinate system (pointy-top)
import { HEX_SIZE } from './constants';

export class HexCoord {
  constructor(public q: number, public r: number) {}

  // Cube coordinate s = -q - r
  get s(): number { return -this.q - this.r; }

  equals(other: HexCoord): boolean {
    return this.q === other.q && this.r === other.r;
  }

  toString(): string { return `${this.q},${this.r}`; }

  // Neighbors (axial direction vectors)
  static readonly DIRECTIONS = [
    new HexCoord(1, 0), new HexCoord(0, 1), new HexCoord(-1, 1),
    new HexCoord(-1, 0), new HexCoord(0, -1), new HexCoord(1, -1),
  ];

  neighbors(): HexCoord[] {
    return HexCoord.DIRECTIONS.map(d => new HexCoord(this.q + d.q, this.r + d.r));
  }

  distanceTo(other: HexCoord): number {
    return Math.max(
      Math.abs(this.q - other.q),
      Math.abs(this.r - other.r),
      Math.abs(this.s - other.s)
    );
  }

  // Pointy-top hex to pixel
  toPixel(size: number = HEX_SIZE): { x: number; y: number } {
    const x = size * (Math.sqrt(3) * this.q + Math.sqrt(3) / 2 * this.r);
    const y = size * (3 / 2 * this.r);
    return { x, y };
  }

  // Pixel to hex (pointy-top)
  static fromPixel(px: number, py: number, size: number = HEX_SIZE): HexCoord {
    const q = (Math.sqrt(3) / 3 * px - 1 / 3 * py) / size;
    const r = (2 / 3 * py) / size;
    return HexCoord.round(q, r);
  }

  static round(qf: number, rf: number): HexCoord {
    const sf = -qf - rf;
    let q = Math.round(qf);
    let r = Math.round(rf);
    const s = Math.round(sf);
    const qd = Math.abs(q - qf);
    const rd = Math.abs(r - rf);
    const sd = Math.abs(s - sf);
    if (qd > rd && qd > sd) { q = -r - s; }
    else if (rd > sd) { r = -q - s; }
    return new HexCoord(q, r);
  }
}
