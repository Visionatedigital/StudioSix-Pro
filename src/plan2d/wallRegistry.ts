export type Aperture = { id: string, sAlong: number, width_mm: number, thickness_mm: number };
export type WallSeg = { id: string, p1: { x: number, y: number }, p2: { x: number, y: number }, apertures?: Aperture[] };

let walls: WallSeg[] = [];
let aperturesByWall: Record<string, Aperture[]> = {};

export function setWalls(list: WallSeg[]) {
  walls = Array.isArray(list) ? list : [];
  // Normalize apertures lists per wall
  aperturesByWall = {};
  for (const w of walls) {
    const aps = Array.isArray(w.apertures) ? w.apertures : [];
    aperturesByWall[w.id] = aps.slice();
  }
  (window as any).__WALL_SEGMENTS__ = walls;
  (window as any).__WALL_APERTURES__ = aperturesByWall;
}

export function getWalls(): WallSeg[] {
  return walls;
}

export function addWallAperture(wallId: string, ap: Aperture) {
  if (!aperturesByWall[wallId]) aperturesByWall[wallId] = [];
  const arr = aperturesByWall[wallId];
  const idx = arr.findIndex(a => a.id === ap.id);
  if (idx >= 0) arr[idx] = ap; else arr.push(ap);
  const wall = walls.find(w => w.id === wallId);
  if (wall) wall.apertures = aperturesByWall[wallId];
  (window as any).__WALL_APERTURES__ = aperturesByWall;
  document.dispatchEvent(new CustomEvent('wall:aperturesChanged', { detail: { wallId, ap } }));
}

export function removeWallAperture(wallId: string, apId: string) {
  const arr = aperturesByWall[wallId];
  if (!arr) return;
  const next = arr.filter(a => a.id !== apId);
  aperturesByWall[wallId] = next;
  const wall = walls.find(w => w.id === wallId);
  if (wall) wall.apertures = next;
  (window as any).__WALL_APERTURES__ = aperturesByWall;
  document.dispatchEvent(new CustomEvent('wall:aperturesChanged', { detail: { wallId, apId } }));
}




