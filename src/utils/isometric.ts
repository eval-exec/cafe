import { SeatConfig, SeatId } from '../types';

export const ISO_ORIGIN_X = 800;
export const ISO_ORIGIN_Y = 235;
export const TILE_W = 58;
export const TILE_H = 31;
export const Z_SCALE = 48;

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Converts 3D isometric coordinates (isoX, isoY, isoZ) to 2D SVG canvas coordinates.
 * isoX: 0..10 (along Back-Right wall, South-East)
 * isoY: 0..10 (along Back-Left wall, South-West)
 * isoZ: 0..4  (vertical height upwards)
 */
export function isoToScreen(isoX: number, isoY: number, isoZ: number = 0): Point2D {
  return {
    x: ISO_ORIGIN_X + (isoX - isoY) * TILE_W,
    y: ISO_ORIGIN_Y + (isoX + isoY) * TILE_H - isoZ * Z_SCALE,
  };
}

/**
 * Formats an array of 3D isometric points into an SVG polygon `points` string.
 */
export function isoPolygon(points: Array<[number, number, number?]>): string {
  return points
    .map(([x, y, z = 0]) => {
      const p = isoToScreen(x, y, z);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Returns the 3 visible faces (top, left/SW, right/SE) of an isometric 3D box
 * spanning [x, x+dx], [y, y+dy], [z, z+dz].
 */
export function isoBoxFaces(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number
) {
  const top = isoPolygon([
    [x, y, z + dz],
    [x + dx, y, z + dz],
    [x + dx, y + dy, z + dz],
    [x, y + dy, z + dz],
  ]);

  // South-West facing front-left face (at x + dx, spanning y..y+dy)
  const leftFace = isoPolygon([
    [x + dx, y + dy, z + dz],
    [x, y + dy, z + dz],
    [x, y + dy, z],
    [x + dx, y + dy, z],
  ]);

  // South-East facing front-right face (at y + dy, spanning x..x+dx)
  const rightFace = isoPolygon([
    [x + dx, y, z + dz],
    [x + dx, y + dy, z + dz],
    [x + dx, y + dy, z],
    [x + dx, y, z],
  ]);

  return { top, leftFace, rightFace };
}

export const SEATS: Record<SeatId, SeatConfig> = {
  'window-1': {
    id: 'window-1',
    name: 'Sunlit Bay Table',
    subtitle: 'Window Seat I',
    description: 'Bathed in natural afternoon sunbeams beside the tall arched window overlooking the ginkgo tree.',
    vibeTag: 'Peaceful & Airy',
    lightingTag: 'Natural Sunlight',
    isoX: 2.5,
    isoY: 8.2,
    isoZ: 0,
    cameraViewBox: [195, 315, 560, 350],
    tableScreenX: 469,
    tableScreenY: 525,
    chairPullDx: -10,
    chairPullDy: -6,
    laptopFacing: 'se',
  },
  'window-2': {
    id: 'window-2',
    name: 'Streetview Nook',
    subtitle: 'Window Seat II',
    description: 'Watch falling leaves and passersby through the front picture window while sipping a warm pour-over.',
    vibeTag: 'Scenic & Inspiring',
    lightingTag: 'Warm Window Glow',
    isoX: 6.2,
    isoY: 8.2,
    isoZ: 0,
    cameraViewBox: [410, 430, 560, 350],
    tableScreenX: 684,
    tableScreenY: 640,
    chairPullDx: -10,
    chairPullDy: -6,
    laptopFacing: 'se',
  },
  'quiet-corner': {
    id: 'quiet-corner',
    name: 'Sanctuary Corner',
    subtitle: 'Quiet Corner Booth',
    description: 'Secluded velvet corner table illuminated by a vintage green-glass banker’s lamp for deep, uninterrupted work.',
    vibeTag: 'Deep Focus Sanctuary',
    lightingTag: 'Warm Amber Lamp',
    isoX: 2.1,
    isoY: 2.3,
    isoZ: 0,
    cameraViewBox: [510, 155, 560, 350],
    tableScreenX: 788,
    tableScreenY: 330,
    chairPullDx: 10,
    chairPullDy: 6,
    laptopFacing: 'se',
  },
  'central-table': {
    id: 'central-table',
    name: 'Heart of the Café',
    subtitle: 'Central Oak Table',
    description: "Set atop the woven kilim rug at the lively center of Eval Exec's Cafe, surrounded by gentle café hum.",
    vibeTag: 'Lively & Grounded',
    lightingTag: 'Pendant Halo',
    isoX: 5.2,
    isoY: 5.2,
    isoZ: 0,
    cameraViewBox: [520, 340, 560, 350],
    tableScreenX: 800,
    tableScreenY: 516,
    chairPullDx: -12,
    chairPullDy: 7,
    laptopFacing: 'sw',
  },
  'bookshelf-seat': {
    id: 'bookshelf-seat',
    name: 'Library Reading Nook',
    subtitle: 'Bookshelf Seat',
    description: 'Nestled right beside floor-to-ceiling timber bookshelves, old hardcovers, and the café’s sleeping ginger cat.',
    vibeTag: 'Cozy & Scholarly',
    lightingTag: 'Reading Sconce',
    isoX: 1.9,
    isoY: 5.3,
    isoZ: 0,
    cameraViewBox: [325, 240, 560, 350],
    tableScreenX: 603,
    tableScreenY: 417,
    chairPullDx: 11,
    chairPullDy: 6,
    laptopFacing: 'se',
  },
  'counter-seat': {
    id: 'counter-seat',
    name: 'Roastery Bar Stool',
    subtitle: 'Counter Seat',
    description: 'Perched at the walnut espresso bar right beside the brass espresso machine, aroma of fresh crema, and warm pastries.',
    vibeTag: 'Casual & Aromatic',
    lightingTag: 'Edison Pendant',
    isoX: 6.5,
    isoY: 3.2,
    isoZ: 0,
    cameraViewBox: [715, 305, 560, 350],
    tableScreenX: 991,
    tableScreenY: 486,
    chairPullDx: 12,
    chairPullDy: 7,
    laptopFacing: 'sw',
  },
};

export const SEAT_LIST: SeatConfig[] = Object.values(SEATS);
export const DEFAULT_INTERIOR_VIEWBOX: [number, number, number, number] = [110, 20, 1380, 862];
