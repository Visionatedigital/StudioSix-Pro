/**
 * Door2D Renderer Service
 * Converts TypeScript door2dRenderer template to JavaScript for rendering doors in 2D viewport
 * 
 * Hinge is the local origin (0,0). Closed leaf points along +X.
 * "swing: 'in'" opens toward +Y; "out" opens toward -Y.
 * Apply world placement with an outer <g transform="translate(... ) rotate(... )"> wrapper.
 */

class Door2DRenderer {
  /**
   * Create a 2D SVG representation of a door
   * @param {Object} params - Door parameters
   * @param {number} params.width_mm - Door width in millimeters (e.g., 900)
   * @param {number} params.wall_thickness_mm - Wall thickness in millimeters (e.g., 115) 
   * @param {string} params.hinge - Hinge side: "left" or "right"
   * @param {string} params.swing - Swing direction: "in" or "out"
   * @param {number} params.angle_deg - Door opening angle 0..180 (typical 90)
   * @param {number} params.px_per_mm - Viewport scale, e.g., 0.1 px/mm
   * @param {number} [params.stroke_px] - Optional stroke override in px
   * @returns {string} SVG group string
   */
  static makeDoor2DSVG(params) {
    // Add parameter validation
    if (!params || typeof params !== 'object') {
      console.error('Door2DRenderer: Invalid params object');
      return '<g></g>';
    }

    const {
      width_mm = 900,
      wall_thickness_mm = 115,
      hinge = 'left',
      swing = 'in',
      angle_deg = 90,
      px_per_mm = 0.1,
      stroke_px = 1
    } = params;

    // Validate numeric inputs
    const safePixelsPerMM = Math.max(0.01, px_per_mm || 0.1);
    const safeWidth = Math.max(100, width_mm || 900);
    const safeThickness = Math.max(50, wall_thickness_mm || 115);
    const safeAngle = Math.max(0, Math.min(180, angle_deg || 90));
    
    const s = safePixelsPerMM;
    const w = safeWidth * s;             // leaf length in px
    const t = safeThickness * s;         // wall thickness in px
    const angle = safeAngle * Math.PI / 180;

    const leafThk = Math.max(1, t / 6);   // visual thickness of leaf
    const stroke = stroke_px || Math.max(1, s); // keep lines visible when zoomed out

    const hingeMirror = hinge === "right" ? -1 : 1;  // mirror across Y if right hinge
    const swingDir = swing === "in" ? 1 : -1;        // +Y or -Y

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle) * swingDir;

    const rot = (x, y) => {
      // mirror on X first (hinge side), then rotate around origin
      const xm = x * hingeMirror;
      const xr = xm * cosA - y * sinA;
      const yr = xm * sinA + y * cosA;
      return [xr, yr];
    };

    // Leaf rectangle (closed along +X, then rotated by angle)
    const p1 = rot(0, -leafThk / 2);
    const p2 = rot(w, -leafThk / 2);
    const p3 = rot(w, leafThk / 2);
    const p4 = rot(0, leafThk / 2);
    const leafPath = `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} L ${p4[0]} ${p4[1]} Z`;

    // Swing arc: center at (0,0), radius = w, from 0° to angle (direction by swingDir)
    const arcStartX = hingeMirror * w;
    const arcStartY = 0;
    const [arcEndX, arcEndY] = rot(w, 0);
    const largeArc = angle > Math.PI ? 1 : 0; // usually 0 for <=180
    const sweep = swingDir === 1 ? 1 : 0;     // 'in' sweeps CCW, 'out' CW in this local frame
    const swingArc = `M ${arcStartX} ${arcStartY} A ${w} ${w} 0 ${largeArc} ${sweep} ${arcEndX} ${arcEndY}`;

    // Jamb lines (show wall thickness centered on hinge)
    const jamb1 = `M ${-t / 2} ${-t / 2} L ${t / 2} ${-t / 2}`;
    const jamb2 = `M ${-t / 2} ${t / 2} L ${t / 2} ${t / 2}`;

    // Group with sensible stroke styles (solid leaf/jamb, dashed arc)
    return `
      <g stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <g stroke-width="${stroke}">
          <path d="${jamb1}" />
          <path d="${jamb2}" />
          <path d="${leafPath}" />
        </g>
        <path d="${swingArc}" stroke-width="${Math.max(1, stroke * 0.9)}" stroke-dasharray="${4 * stroke},${3 * stroke}"/>
      </g>
    `;
  }

  /**
   * Helper to wrap SVG group with placement transform
   * @param {string} svgGroup - SVG group string
   * @param {number} worldX_px - World X position in pixels
   * @param {number} worldY_px - World Y position in pixels  
   * @param {number} worldRot_deg - World rotation in degrees
   * @returns {string} Wrapped SVG group with transform
   */
  static wrapWithTransform(svgGroup, worldX_px, worldY_px, worldRot_deg) {
    // Validate inputs
    const safeX = isNaN(worldX_px) ? 0 : worldX_px;
    const safeY = isNaN(worldY_px) ? 0 : worldY_px;
    const safeRotation = isNaN(worldRot_deg) ? 0 : worldRot_deg;
    const safeSvg = svgGroup || '<g></g>';
    
    return `<g transform="translate(${safeX} ${safeY}) rotate(${safeRotation})">${safeSvg}</g>`;
  }

  /**
   * Create a complete door SVG element with world positioning
   * @param {Object} doorData - Door object data
   * @param {number} doorData.x - World X position
   * @param {number} doorData.y - World Y position
   * @param {number} doorData.rotation - World rotation in degrees
   * @param {number} doorData.width - Door width in meters
   * @param {number} doorData.thickness - Door thickness in meters
   * @param {number} px_per_mm - Viewport scale factor
   * @param {Object} [options] - Additional options
   * @param {string} [options.hinge] - Hinge side: "left" or "right" (default: "left")
   * @param {string} [options.swing] - Swing direction: "in" or "out" (default: "in") 
   * @param {number} [options.angle_deg] - Opening angle (default: 90)
   * @param {string} [options.color] - Stroke color (default: "#333")
   * @param {string} [options.id] - SVG element ID
   * @returns {string} Complete SVG element
   */
  static createDoorSVG(doorData, px_per_mm, options = {}) {
    const {
      hinge = "left",
      swing = "in", 
      angle_deg = 90,
      color = "#333",
      id = `door-${doorData.id || Math.random().toString(36).substr(2, 9)}`
    } = options;

    // Convert meters to millimeters
    const width_mm = (doorData.width || 0.9) * 1000;
    const wall_thickness_mm = (doorData.thickness || 0.1) * 1000;

    // Create door SVG
    const doorSVG = this.makeDoor2DSVG({
      width_mm,
      wall_thickness_mm,
      hinge,
      swing,
      angle_deg,
      px_per_mm
    });

    // Convert world position to pixels
    const worldX_px = (doorData.x || 0) * 1000 * px_per_mm;
    const worldY_px = (doorData.y || 0) * 1000 * px_per_mm;
    const worldRot_deg = doorData.rotation || 0;

    // Wrap with world transform and styling
    const wrappedSVG = this.wrapWithTransform(doorSVG, worldX_px, worldY_px, worldRot_deg);

    return `<g id="${id}" stroke="${color}" class="door-2d">${wrappedSVG}</g>`;
  }

  /**
   * Calculate door parameters from wall placement
   * @param {Object} wall - Wall object the door is placed on
   * @param {number} positionRatio - Position along wall (0-1)
   * @param {Object} doorParams - Door parameters
   * @returns {Object} Calculated door position and orientation
   */
  static calculateDoorPlacement(wall, positionRatio, doorParams) {
    if (!wall || !wall.startPoint || !wall.endPoint) {
      console.warn('Invalid wall data for door placement');
      return {
        x: 0,
        y: 0,
        rotation: 0,
        width: doorParams.width || 0.9,
        thickness: doorParams.thickness || 0.1
      };
    }

    // Calculate position along wall
    const dx = wall.endPoint.x - wall.startPoint.x;
    const dy = wall.endPoint.y - wall.startPoint.y;
    
    const doorX = wall.startPoint.x + (dx * positionRatio);
    const doorY = wall.startPoint.y + (dy * positionRatio);

    // Calculate wall angle
    const wallAngle = Math.atan2(dy, dx) * 180 / Math.PI;

    return {
      x: doorX,
      y: doorY,
      rotation: wallAngle,
      width: doorParams.width || 0.9,
      thickness: wall.thickness || doorParams.thickness || 0.1,
      wallId: wall.id
    };
  }

  /**
   * Get default door rendering options
   * @returns {Object} Default options
   */
  static getDefaultOptions() {
    return {
      hinge: "left",
      swing: "in",
      angle_deg: 90,
      color: "#2563eb", // Blue color for doors
      strokeWidth: 2
    };
  }
}

export default Door2DRenderer;