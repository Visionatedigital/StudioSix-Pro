/**
 * Plan 2D Door Renderer (framework-agnostic, SVG string generator)
 *
 * Coordinate frame (local):
 * - Hinge at origin (0,0)
 * - Closed leaf points along +X
 * - swing:"in" opens toward +Y; swing:"out" opens toward –Y
 * - hinge:"right" mirrors across Y axis (scaleX = -1)
 * Units: inputs in mm → render in px via px_per_mm
 */

export type Door2DParams = {
  width_mm: number;
  wall_thickness_mm: number;
  hinge: 'left' | 'right';
  swing: 'in' | 'out';
  angle_deg: number;     // 0..180
  px_per_mm: number;     // scale
  stroke_px?: number;    // optional stroke override
};

/** Utility: clamp angle to [0, 180] */
function clampAngle(deg: number): number {
  if (!isFinite(deg)) return 0;
  return Math.max(0, Math.min(180, deg));
}

/** Utility: format number to fixed precision for compact SVG */
function f(n: number): string {
  return Number.isFinite(n) ? (+n.toFixed(2)).toString() : '0';
}

/** Degrees → Radians */
const DEG2RAD = Math.PI / 180;

/**
 * Robust local-space point generator for the swing arc endpoints.
 * Note: the group-level mirror (scale(-1,1)) handles right-hinge mirroring,
 * so this function does not apply an additional mirror. The hinge parameter is
 * accepted for API symmetry but unused here intentionally to avoid double-mirroring.
 */
function rotMirrorPoint(w: number, theta: number, hingeRight: boolean, swingSign: number) {
  // swingSign = +1 for "in", -1 for "out"
  // mirror on X if right hinge (mirror across Y axis in local frame)
  const m = hingeRight ? -1 : 1;
  const c = Math.cos(theta);
  const s = Math.sin(theta) * swingSign;
  const x = (w * m) * c;
  const y = (w * m) * s;
  return [x, y] as const;
}

/**
 * Create a parametric architectural 2D door symbol as an SVG <g> string.
 * Elements: jamb lines, thin leaf rectangle, dashed swing arc, optional hinge dot.
 */
export function makeDoor2DSVG(p: Door2DParams): string {
  const s = p.px_per_mm;
  const width_px = p.width_mm * s;
  const wall_px = p.wall_thickness_mm * s;
  const stroke = Math.max(1, Math.round(p.stroke_px ?? Math.max(1, s * 0.75)));
  const leaf_thickness = Math.max(1, (p.wall_thickness_mm * s) / 6);
  const angle = clampAngle(p.angle_deg ?? 90);

  // Leaf rotation: swing "in" = +angle, "out" = -angle (local frame)
  const leafRot = (p.swing === 'in' ? angle : -angle);

  // Robust swing arc using signed angle with hinge compensation.
  // Rule: local frame hinge at (0,0), closed leaf points +X.
  // signedAngle = angle * DEG2RAD * ((swing==='in')?+1:-1) * ((hinge==='right')?-1:+1)
  const theta = clampAngle(p.angle_deg ?? 90) * DEG2RAD;
  const swingSign = (p.swing === 'in') ? 1 : -1;
  const signedTheta = theta * swingSign * (p.hinge === 'right' ? -1 : 1);
  const start = rotMirrorPoint(width_px, 0, p.hinge === 'right', 1);
  const end = rotMirrorPoint(width_px, signedTheta, p.hinge === 'right', 1);
  const sweep = (signedTheta > 0) ? 1 : 0;
  const largeArc = 0; // angle is clamped to [0,180]

  // Mirroring for hinge:"right" — reflect across Y axis
  const mirror = p.hinge === 'right' ? ' scale(-1,1)' : '';

  // Jamb lines (two segments spanning wall thickness centered on hinge)
  // One above (0 → -wall/2), one below (0 → +wall/2)
  const jambY1 = -wall_px / 2;
  const jambY2 = wall_px / 2;

  // Leaf rectangle (width × leaf_thickness), hinge-aligned at origin
  // Draw unrotated at y = -leaf_thickness/2 so hinge lies on midline, then rotate
  const leafRect = `<rect x="0" y="${f(-leaf_thickness / 2)}" width="${f(width_px)}" height="${f(leaf_thickness)}" `+
                   `fill="none" stroke="currentColor" stroke-width="${stroke}" vector-effect="non-scaling-stroke" `+
                   `transform="rotate(${f(leafRot)})" />`;

  // Swing arc: from (width,0) at 0° to (arcEndX, arcEndY)
  const arcPath = `M ${f(start[0])} ${f(start[1])} A ${f(width_px)} ${f(width_px)} 0 ${largeArc} ${sweep} ${f(end[0])} ${f(end[1])}`;
  const arc = `<path d="${arcPath}" fill="none" stroke="currentColor" stroke-width="${stroke}" `+
              `stroke-dasharray="6,6" vector-effect="non-scaling-stroke" />`;

  // Jambs and optional hinge dot
  const jambTop = `<line x1="0" y1="0" x2="0" y2="${f(jambY1)}" stroke="currentColor" stroke-width="${stroke}" vector-effect="non-scaling-stroke" />`;
  const jambBottom = `<line x1="0" y1="0" x2="0" y2="${f(jambY2)}" stroke="currentColor" stroke-width="${stroke}" vector-effect="non-scaling-stroke" />`;
  const hingeDotR = Math.max(1, stroke / 2);
  const hingeDot = `<circle cx="0" cy="0" r="${f(hingeDotR)}" fill="currentColor" />`;

  // Split groups so the arc uses robust mirrored coordinates while jamb/leaf use group mirror
  const gJambLeaf = `<g transform="${mirror.trim()}">${jambTop}${jambBottom}${leafRect}${hingeDot}</g>`;
  const g = `<g data-door2d="symbol">${gJambLeaf}${arc}</g>`;
  // Wrap in color group to allow color override upstream (currentColor)
  return `<g fill="none" color="#1f2937">${g}</g>`; // default dark gray outline
}

/**
 * Wrap the generated group with a world transform.
 * Consumers can position/rotate in plan coordinates.
 */
export function wrapWithTransform(svgGroup: string, worldX_px: number, worldY_px: number, worldRot_deg: number): string {
  const tx = f(worldX_px);
  const ty = f(worldY_px);
  const rot = f(worldRot_deg);
  return `<g transform="translate(${tx},${ty}) rotate(${rot})" data-door2d="placed">${svgGroup}</g>`;
}

/**
 * Ensure a plan doors layer <g id="plan-layer-doors"> exists under the first <svg> in the document.
 */
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

export type DoorInstance = {
  id: string;
  params: Door2DParams;
  worldX_px: number;
  worldY_px: number;
  worldRot_deg: number;
};

/**
 * Render (or re-render) a door instance into the doors layer by id.
 * If an element with data-door-id exists, it is replaced; otherwise appended.
 */
export function renderDoorInstance(instance: DoorInstance): void {
  const layer = ensureDoorsLayer();
  if (!layer) return;
  const g = makeDoor2DSVG(instance.params);
  const placed = wrapWithTransform(g, instance.worldX_px, instance.worldY_px, instance.worldRot_deg);
  const html = placed.replace('<g ', `<g data-door-id="${instance.id}" `);
  const existing = layer.querySelector(`[data-door-id="${instance.id}"]`);
  if (existing && existing.parentElement) {
    // Replace by outerHTML for simplicity
    (existing as any).outerHTML = html;
  } else {
    layer.insertAdjacentHTML('beforeend', html);
  }
}

/**
 * Example usage (uncomment to try in a plain HTML/JS runtime):
 *
 * const p: Door2DParams = {
 *   width_mm: 900,
 *   wall_thickness_mm: 115,
 *   hinge: 'right',
 *   swing: 'out',
 *   angle_deg: 90,
 *   px_per_mm: 0.12
 * };
 * const g = makeDoor2DSVG(p);
 * const placed = wrapWithTransform(g, 12540*p.px_per_mm, 8420*p.px_per_mm, 90);
 * document.getElementById('plan-layer-doors')!.insertAdjacentHTML('beforeend', placed);
 */


