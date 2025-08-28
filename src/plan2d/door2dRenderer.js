// Plain JS version for bundlers without TS

function clampAngle(deg){ if(!isFinite(deg)) return 0; return Math.max(0, Math.min(180, deg)); }
function f(n){ return Number.isFinite(n) ? (+n.toFixed(2)).toString() : '0'; }

export function makeDoor2DSVG(p){
  const s = p.px_per_mm;
  const width_px = p.width_mm * s;
  const wall_px = p.wall_thickness_mm * s;
  const stroke = Math.max(1, Math.round(p.stroke_px ?? Math.max(1, s * 0.75)));
  const leaf_thickness = Math.max(1, (p.wall_thickness_mm * s) / 6);
  const angle = clampAngle(p.angle_deg ?? 90);
  const leafRot = (p.swing === 'in' ? angle : -angle);
  const angleRadAbs = Math.abs(leafRot) * Math.PI/180;
  const signY = leafRot >= 0 ? 1 : -1;
  const arcEndX = width_px * Math.cos(angleRadAbs);
  const arcEndY = signY * width_px * Math.sin(angleRadAbs);
  const largeArc = angle > 180 ? 1 : 0;
  const sweep = leafRot >= 0 ? 0 : 1;
  const mirror = p.hinge === 'right' ? ' scale(-1,1)' : '';
  const jambY1 = -wall_px/2, jambY2 = wall_px/2;
  const leafRect = `<rect x="0" y="${f(-leaf_thickness/2)}" width="${f(width_px)}" height="${f(leaf_thickness)}" fill="none" stroke="currentColor" stroke-width="${stroke}" vector-effect="non-scaling-stroke" transform="rotate(${f(leafRot)})" />`;
  const arcPath = `M ${f(width_px)} 0 A ${f(width_px)} ${f(width_px)} 0 ${largeArc} ${sweep} ${f(arcEndX)} ${f(arcEndY)}`;
  const arc = `<path d="${arcPath}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-dasharray="6,6" vector-effect="non-scaling-stroke" />`;
  const jambTop = `<line x1="0" y1="0" x2="0" y2="${f(jambY1)}" stroke="currentColor" stroke-width="${stroke}" vector-effect="non-scaling-stroke" />`;
  const jambBottom = `<line x1="0" y1="0" x2="0" y2="${f(jambY2)}" stroke="currentColor" stroke-width="${stroke}" vector-effect="non-scaling-stroke" />`;
  const hingeDotR = Math.max(1, stroke/2);
  const hingeDot = `<circle cx="0" cy="0" r="${f(hingeDotR)}" fill="currentColor" />`;
  const g = `<g transform="${mirror.trim()}" data-door2d="symbol">${jambTop}${jambBottom}${leafRect}${arc}${hingeDot}</g>`;
  return `<g fill="none" color="#1f2937">${g}</g>`;
}

export function wrapWithTransform(svgGroup, worldX_px, worldY_px, worldRot_deg){
  return `<g transform="translate(${f(worldX_px)},${f(worldY_px)}) rotate(${f(worldRot_deg)})" data-door2d="placed">${svgGroup}</g>`;
}

export function renderDoorInstance(instance){
  const layer = document.getElementById('plan-layer-doors');
  if(!layer) return;
  const g = makeDoor2DSVG(instance.params);
  const placed = wrapWithTransform(g, instance.worldX_px, instance.worldY_px, instance.worldRot_deg);
  const html = placed.replace('<g ', `<g data-door-id="${instance.id}" `);
  const existing = layer.querySelector(`[data-door-id="${instance.id}"]`);
  if (existing && existing.parentElement) {
    existing.outerHTML = html;
  } else {
    layer.insertAdjacentHTML('beforeend', html);
  }
}


