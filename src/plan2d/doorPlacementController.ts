import { makeDoor2DSVG, wrapWithTransform, Door2DParams, renderDoorInstance } from './door2dRenderer';
import type { WallSeg } from './wallRegistry';
import { addWallAperture } from './wallRegistry';

type Options = Partial<Pick<Door2DParams, 'width_mm'|'wall_thickness_mm'|'hinge'|'swing'|'angle_deg'|'px_per_mm'|'stroke_px'>> & { px_per_mm: number };

function f(n: number) { return Number.isFinite(n) ? +n.toFixed(2) : 0; }

function clamp(val: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, val)); }

function uuid() { return 'door_' + Math.random().toString(36).slice(2, 9); }

function ensureDoorsLayer(): SVGGElement | null {
  const existing = document.getElementById('plan-layer-doors') as SVGGElement | null;
  if (existing) return existing;
  const svg = document.querySelector('svg');
  if (!svg) return null;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('id', 'plan-layer-doors');
  svg.appendChild(g);
  return g;
}

function ensureOverlayLayer(): SVGGElement | null {
  const existing = document.getElementById('plan-overlay') as SVGGElement | null;
  if (existing) return existing;
  const svg = document.querySelector('svg');
  if (!svg) return null;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('id', 'plan-overlay');
  svg.appendChild(g);
  return g;
}

function dot(a: {x:number,y:number}, b:{x:number,y:number}) { return a.x*b.x + a.y*b.y; }
function len2(v:{x:number,y:number}) { return v.x*v.x + v.y*v.y; }

function projectPointToSegment(p:{x:number,y:number}, a:{x:number,y:number}, b:{x:number,y:number}) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const ab2 = len2(ab) || 1e-6;
  let t = dot(ap, ab) / ab2; t = Math.max(0, Math.min(1, t));
  const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  const dx = p.x - q.x, dy = p.y - q.y;
  const dist2 = dx*dx + dy*dy;
  const angleDeg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  return { point: q, dist2, angleDeg };
}

function getWallsFromGlobal(): WallSeg[] {
  const list = (window as any).__WALL_SEGMENTS__ as WallSeg[] | undefined;
  return Array.isArray(list) ? list : [];
}

function snapToWall(pointPx:{x:number,y:number}) {
  const walls = getWallsFromGlobal();
  let best: { wall: WallSeg, at:{x:number,y:number}, angleDeg:number, dist2:number } | null = null;
  for (const w of walls) {
    const proj = projectPointToSegment(pointPx, w.p1, w.p2);
    if (!best || proj.dist2 < best.dist2) best = { wall: w, at: proj.point, angleDeg: proj.angleDeg, dist2: proj.dist2 };
  }
  if (!best) return null;
  if (best.dist2 > 40*40) return null; // 40px threshold
  return { wallId: best.wall.id, at: best.at, angleDeg: best.angleDeg, dist2: best.dist2 };
}

export function startDoorPlacement(options: Options) {
  enum State { Idle, Hovering, Anchored }
  let state: State = State.Hovering;
  toolActive = true;
  const params: Door2DParams = {
    width_mm: options.width_mm ?? 900,
    wall_thickness_mm: options.wall_thickness_mm ?? 115,
    hinge: options.hinge ?? 'left',
    swing: options.swing ?? 'in',
    angle_deg: clamp(options.angle_deg ?? 90, 0, 180),
    px_per_mm: options.px_per_mm,
    stroke_px: options.stroke_px
  };

  const overlay = ensureOverlayLayer();
  ensureDoorsLayer();
  if (!overlay) return () => { toolActive = false; };

  // Create ghost element
  const ghostId = 'door-ghost';
  let ghost = document.getElementById(ghostId) as SVGGElement | null;
  const ghostHTML = wrapWithTransform(makeDoor2DSVG(params), 0, 0, 0)
    .replace('<g ', `<g id="${ghostId}" opacity="0.85" `)
    .replace('color="#1f2937"', 'color="#2563eb"'); // blue preview
  if (ghost) ghost.remove();
  overlay.insertAdjacentHTML('beforeend', ghostHTML);
  ghost = document.getElementById(ghostId) as SVGGElement | null;

  let snapped: ReturnType<typeof snapToWall> | null = null;
  let anchor: { wallId: string, x: number, y: number, wallAngleDeg: number, sAlong_px: number } | null = null;
  let capturedPointerId: number | null = null;

  function updateGhostTransform(x:number, y:number, wallAngleDeg:number) {
    if (!ghost) return;
    // Open perpendicular to wall (leaf rotates around hinge)
    const worldRot = wallAngleDeg; // use wall tangent as door baseline, consumers orient leaf via params.angle_deg
    ghost.setAttribute('transform', `translate(${f(x)},${f(y)}) rotate(${f(worldRot)})`);
  }

  function onPointerMove(ev: PointerEvent) {
    const svg = (ev.target as Element).closest('svg') as SVGSVGElement | null;
    if (!svg || !ghost) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const snap = snapToWall({ x: local.x, y: local.y });
    snapped = snap;
    if (state === State.Hovering) {
      if (!snap) {
        ghost.setAttribute('visibility', 'hidden');
        return;
      }
      ghost.setAttribute('visibility', 'visible');
      updateGhostTransform(snap.at.x, snap.at.y, snap.angleDeg);
    } else if (state === State.Anchored && anchor) {
      // Determine side of wall by signed distance from cursor to wall centerline
      const wall = getWallsFromGlobal().find(w => w.id === anchor!.wallId);
      if (!wall) return;
      const ax = wall.p1.x, ay = wall.p1.y;
      const bx = wall.p2.x, by = wall.p2.y;
      const vx = bx - ax, vy = by - ay;
      const px = local.x - ax, py = local.y - ay;
      const cross = vx * py - vy * px; // z-component of cross in 2D
      // Convention: distance > 0 => swing "in", < 0 => swing "out"
      params.swing = cross > 0 ? 'in' : 'out';
      if (ghost) {
        const inner = makeDoor2DSVG(params);
        ghost.innerHTML = inner.replace(/^<g[^>]*>/, '').replace(/<\/g>$/, '');
      }
      // Position stays fixed
      updateGhostTransform(anchor.x, anchor.y, anchor.wallAngleDeg);
    }
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') return cleanup();
    if (ev.key === 'h' || ev.key === 'H') { params.hinge = params.hinge === 'left' ? 'right' : 'left'; }
    if (ev.key === 'o' || ev.key === 'O') { params.swing = params.swing === 'in' ? 'out' : 'in'; }
    if (ev.key === '[') { params.angle_deg = clamp((params.angle_deg ?? 90) - 5, 0, 180); }
    if (ev.key === ']') { params.angle_deg = clamp((params.angle_deg ?? 90) + 5, 0, 180); }
    if (ghost) {
      const inner = makeDoor2DSVG(params);
      ghost.innerHTML = inner.replace(/^<g[^>]*>/, '').replace(/<\/g>$/, ''); // quick swap of children
    }
  }

  function onPointerDown(ev: PointerEvent) {
    const svg = (ev.target as Element).closest('svg') as SVGSVGElement | null;
    if (!svg) return;
    ev.preventDefault(); ev.stopPropagation();
    svg.style.cursor = 'crosshair';
    if (capturedPointerId == null) {
      try { svg.setPointerCapture(ev.pointerId); capturedPointerId = ev.pointerId; } catch {}
    }
    if (state === State.Hovering) {
      if (!snapped) return;
      // Anchor to snapped wall
      const wall = getWallsFromGlobal().find(w => w.id === snapped!.wallId);
      if (!wall) return;
      // Compute sAlong from p1 to snapped point (in px)
      const abx = wall.p2.x - wall.p1.x, aby = wall.p2.y - wall.p1.y;
      const len2 = abx*abx + aby*aby || 1e-6;
      const apx = snapped.at.x - wall.p1.x, apy = snapped.at.y - wall.p1.y;
      let t = (apx*abx + apy*aby) / len2; t = Math.max(0, Math.min(1, t));
      const sAlong_px = Math.sqrt((abx*t)*(abx*t) + (aby*t)*(aby*t));
      anchor = { wallId: snapped.wallId, x: snapped.at.x, y: snapped.at.y, wallAngleDeg: snapped.angleDeg, sAlong_px };
      state = State.Anchored;
      // Keep ghost fixed at anchor
      updateGhostTransform(anchor.x, anchor.y, anchor.wallAngleDeg);
    } else if (state === State.Anchored && anchor) {
      // Second click: place door
      const id = uuid();
      renderDoorInstance({
        id,
        params,
        worldX_px: anchor.x,
        worldY_px: anchor.y,
        worldRot_deg: anchor.wallAngleDeg
      });
      // Compute aperture data and store (sAlong in meters)
      const pxPerMeter = options.px_per_mm * 1000; // px / m
      const sAlong_m = anchor.sAlong_px / (pxPerMeter || 1);
      addWallAperture(anchor.wallId, {
        id,
        sAlong: sAlong_m,
        width_mm: params.width_mm,
        thickness_mm: params.wall_thickness_mm
      });
      // Dispatch placed event
      document.dispatchEvent(new CustomEvent('door:placed', {
        detail: { id, wallId: anchor.wallId, sAlong: sAlong_m, width_mm: params.width_mm, thickness_mm: params.wall_thickness_mm }
      }));
      cleanup();
    }
  }

  function cleanup() {
    const svg = document.querySelector('svg') as SVGSVGElement | null;
    if (svg) {
      if (capturedPointerId != null) { try { svg.releasePointerCapture(capturedPointerId); } catch {} }
      svg.style.cursor = '';
      svg.removeEventListener('pointermove', onPointerMove as any);
      svg.removeEventListener('pointerdown', onPointerDown as any);
    }
    window.removeEventListener('keydown', onKeyDown);
    state = State.Idle;
    toolActive = false;
    if (ghost) ghost.remove();
  }

  const svg = document.querySelector('svg') as SVGSVGElement | null;
  if (svg) {
    svg.style.cursor = 'crosshair';
    svg.addEventListener('pointermove', onPointerMove as any, { passive: true } as any);
    svg.addEventListener('pointerdown', onPointerDown as any, { capture: true } as any);
    const eatClick = (e: any) => { if (toolActive) { e.preventDefault(); e.stopPropagation(); } };
    svg.addEventListener('click', eatClick as any, true);
    svg.addEventListener('mousedown', eatClick as any, true);
    svg.addEventListener('pointerup', eatClick as any, true);
  }
  window.addEventListener('keydown', onKeyDown);

  // Return cancel function to caller
  return cleanup;
}

// Local helpers exported for tests (optional)
export const __internals = { ensureDoorsLayer, ensureOverlayLayer, snapToWall, projectPointToSegment };

// Prevent other tools: expose active flag
let toolActive = false;
export function isDoorPlacing() { return toolActive; }




