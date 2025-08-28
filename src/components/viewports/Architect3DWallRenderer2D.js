import React, { useEffect, useRef, useCallback, useState } from 'react';
import { WallTypes } from '../../services/architect3d/core/constants.js';

/**
 * Enhanced 2D Wall Renderer with Architect3D Logic
 * Renders walls, corners, and rooms with sophisticated joinery visualization
 */
const Architect3DWallRenderer2D = ({
  walls = [],
  corners = [],
  rooms = [],
  selectedWallId = null,
  hoveredWallId = null,
  onWallClick = null,
  onCornerClick = null,
  onRoomClick = null,
  showCorners = true,
  showRooms = true,
  showAngles = false,
  theme = 'dark',
  width = 800,
  height = 600,
  scale = 1,
  offset = { x: 0, y: 0 }
}) => {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);

  // Rendering configuration based on architect3d
  const config = {
    wall: {
      color: theme === 'dark' ? '#dddddd' : '#333333',
      colorHover: '#008cba',
      colorSelected: '#00ba8c',
      width: 5,
      widthHover: 7,
      widthSelected: 9
    },
    corner: {
      color: theme === 'dark' ? '#cccccc' : '#666666',
      colorHover: '#008cba',
      colorSelected: '#00ba8c',
      radius: 3,
      radiusHover: 6,
      radiusSelected: 9
    },
    room: {
      color: theme === 'dark' ? '#fedaff66' : '#f0f8ff66',
      colorHover: '#008cba66',
      colorSelected: '#00ba8c66',
      strokeColor: theme === 'dark' ? '#ffffff20' : '#00000020'
    },
    grid: {
      color: theme === 'dark' ? '#333333' : '#f1f1f1',
      spacing: 25 * scale,
      width: 1
    }
  };

  /**
   * Convert world coordinates to canvas coordinates
   */
  const worldToCanvas = useCallback((worldPoint) => {
    return {
      x: (worldPoint.x * scale) + offset.x + width / 2,
      y: height / 2 - (worldPoint.y * scale) - offset.y
    };
  }, [scale, offset, width, height]);

  /**
   * Convert canvas coordinates to world coordinates
   */
  const canvasToWorld = useCallback((canvasPoint) => {
    return {
      x: (canvasPoint.x - offset.x - width / 2) / scale,
      y: -(canvasPoint.y - height / 2 + offset.y) / scale
    };
  }, [scale, offset, width, height]);

  /**
   * Render grid background
   */
  const renderGrid = useCallback((ctx) => {
    const spacing = config.grid.spacing;
    
    ctx.strokeStyle = config.grid.color;
    ctx.lineWidth = config.grid.width;
    ctx.setLineDash([]);

    // Vertical lines
    for (let x = offset.x % spacing; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = offset.y % spacing; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [config.grid, offset, width, height]);

  /**
   * Render rooms (polygons)
   */
  const renderRooms = useCallback((ctx) => {
    if (!showRooms || !rooms.length) return;

    for (const room of rooms) {
      if (!room.polygon || room.polygon.length < 3) continue;

      const canvasPoints = room.polygon.map(point => worldToCanvas(point));
      
      ctx.fillStyle = config.room.color;
      ctx.strokeStyle = config.room.strokeColor;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
      
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Render room area text
      if (room.center && room.area) {
        const centerCanvas = worldToCanvas(room.center);
        ctx.fillStyle = theme === 'dark' ? '#ffffff80' : '#00000080';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const areaText = `${room.area.toFixed(1)} m²`;
        ctx.fillText(areaText, centerCanvas.x, centerCanvas.y);
      }
    }
  }, [showRooms, rooms, worldToCanvas, config.room, theme]);

  /**
   * Render walls with bezier curve support
   */
  const renderWalls = useCallback((ctx) => {
    for (const wall of walls) {
      const isSelected = wall.id === selectedWallId;
      const isHovered = wall.id === hoveredWallId;
      
      let strokeColor = config.wall.color;
      let lineWidth = config.wall.width;
      
      if (isSelected) {
        strokeColor = config.wall.colorSelected;
        lineWidth = config.wall.widthSelected;
      } else if (isHovered) {
        strokeColor = config.wall.colorHover;
        lineWidth = config.wall.widthHover;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([]);

      // Use adjusted endpoints if available (from 3D joinery system), fall back to original points
      const actualStartPoint = wall.adjustedStartPoint || wall.startPoint;
      const actualEndPoint = wall.adjustedEndPoint || wall.endPoint;
      
      const startCanvas = worldToCanvas(actualStartPoint);
      const endCanvas = worldToCanvas(actualEndPoint);

      ctx.beginPath();

      if (wall.wallType === 'curved' && wall.bezierControlPoints) {
        // Render curved wall using bezier curve
        const aCanvas = worldToCanvas(wall.bezierControlPoints.a);
        const bCanvas = worldToCanvas(wall.bezierControlPoints.b);
        
        ctx.moveTo(startCanvas.x, startCanvas.y);
        ctx.bezierCurveTo(
          aCanvas.x, aCanvas.y,
          bCanvas.x, bCanvas.y,
          endCanvas.x, endCanvas.y
        );
      } else {
        // Render straight wall
        ctx.moveTo(startCanvas.x, startCanvas.y);
        ctx.lineTo(endCanvas.x, endCanvas.y);
      }

      ctx.stroke();

      // Render wall thickness outline
      if (wall.thickness && scale > 0.5) {
        const thicknessPixels = wall.thickness * scale * 0.5;
        
        // Calculate perpendicular vector for thickness
        const dx = endCanvas.x - startCanvas.x;
        const dy = endCanvas.y - startCanvas.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          const perpX = -dy / length * thicknessPixels;
          const perpY = dx / length * thicknessPixels;

          ctx.strokeStyle = theme === 'dark' ? '#ffffff20' : '#00000020';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);

          // Top edge
          ctx.beginPath();
          ctx.moveTo(startCanvas.x + perpX, startCanvas.y + perpY);
          ctx.lineTo(endCanvas.x + perpX, endCanvas.y + perpY);
          ctx.stroke();

          // Bottom edge
          ctx.beginPath();
          ctx.moveTo(startCanvas.x - perpX, startCanvas.y - perpY);
          ctx.lineTo(endCanvas.x - perpX, endCanvas.y - perpY);
          ctx.stroke();
        }
      }

      // Render wall length label
      if (isSelected && wall.length && scale > 0.8) {
        const midPoint = {
          x: (startCanvas.x + endCanvas.x) / 2,
          y: (startCanvas.y + endCanvas.y) / 2
        };

        ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lengthText = `${wall.length.toFixed(2)}m`;
        
        // Draw background for text
        const metrics = ctx.measureText(lengthText);
        const padding = 4;
        ctx.fillStyle = theme === 'dark' ? '#00000080' : '#ffffff80';
        ctx.fillRect(
          midPoint.x - metrics.width / 2 - padding,
          midPoint.y - 6 - padding,
          metrics.width + padding * 2,
          12 + padding * 2
        );

        ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
        ctx.fillText(lengthText, midPoint.x, midPoint.y);
      }
    }
  }, [walls, selectedWallId, hoveredWallId, worldToCanvas, config.wall, scale, theme]);

  /**
   * Render corners with angle indicators
   */
  const renderCorners = useCallback((ctx) => {
    if (!showCorners) return;

    for (const corner of corners) {
      const canvasPos = worldToCanvas(corner.position);
      const isConnected = corner.connectedWalls && corner.connectedWalls.length > 0;
      
      let fillColor = config.corner.color;
      let radius = config.corner.radius;

      if (isConnected && corner.connectedWalls.length > 2) {
        // Multi-wall junction - make it larger
        radius = config.corner.radiusSelected;
        fillColor = config.corner.colorSelected;
      }

      // Draw corner circle
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Draw corner stroke
      ctx.strokeStyle = theme === 'dark' ? '#ffffff40' : '#00000040';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Render angle indicators
      if (showAngles && corner.angles && corner.angles.length > 0 && scale > 1) {
        ctx.fillStyle = theme === 'dark' ? '#ffffff60' : '#00000060';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        corner.angles.forEach((angle, index) => {
          if (corner.angleDirections && corner.angleDirections[index]) {
            const direction = corner.angleDirections[index];
            const labelPos = {
              x: canvasPos.x + direction.x * scale * 0.5,
              y: canvasPos.y - direction.y * scale * 0.5
            };
            
            ctx.fillText(`${angle.toFixed(1)}°`, labelPos.x, labelPos.y);
          }
        });
      }

      // Render elevation if available
      if (corner.elevation && corner.elevation !== 0 && scale > 1.2) {
        ctx.fillStyle = theme === 'dark' ? '#ffff00' : '#ff8800';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        const elevationText = `${corner.elevation.toFixed(1)}m`;
        ctx.fillText(elevationText, canvasPos.x, canvasPos.y + radius + 2);
      }
    }
  }, [showCorners, corners, worldToCanvas, config.corner, showAngles, scale, theme]);

  /**
   * Main render function
   */
  const render = useCallback(() => {
    if (!canvasRef.current || isRendering) return;
    
    setIsRendering(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    try {
      // Render in order: grid -> rooms -> walls -> corners
      renderGrid(ctx);
      renderRooms(ctx);
      renderWalls(ctx);
      renderCorners(ctx);
    } catch (error) {
      console.error('Error rendering 2D walls:', error);
    } finally {
      setIsRendering(false);
    }
  }, [renderGrid, renderRooms, renderWalls, renderCorners, width, height, isRendering]);

  // Handle mouse events
  const handleMouseClick = useCallback((event) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    const worldPoint = canvasToWorld(canvasPoint);

    // Check corner clicks first (smaller targets)
    if (onCornerClick && showCorners) {
      for (const corner of corners) {
        const canvasPos = worldToCanvas(corner.position);
        const distance = Math.sqrt(
          Math.pow(canvasPoint.x - canvasPos.x, 2) + 
          Math.pow(canvasPoint.y - canvasPos.y, 2)
        );
        
        if (distance <= config.corner.radiusSelected) {
          onCornerClick(corner, worldPoint);
          return;
        }
      }
    }

    // Check wall clicks
    if (onWallClick) {
      for (const wall of walls) {
        const startCanvas = worldToCanvas(wall.startPoint);
        const endCanvas = worldToCanvas(wall.endPoint);
        
        // Calculate distance from point to line
        const A = canvasPoint.x - startCanvas.x;
        const B = canvasPoint.y - startCanvas.y;
        const C = endCanvas.x - startCanvas.x;
        const D = endCanvas.y - startCanvas.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) continue;
        
        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
          xx = startCanvas.x;
          yy = startCanvas.y;
        } else if (param > 1) {
          xx = endCanvas.x;
          yy = endCanvas.y;
        } else {
          xx = startCanvas.x + param * C;
          yy = startCanvas.y + param * D;
        }

        const distance = Math.sqrt(
          Math.pow(canvasPoint.x - xx, 2) + 
          Math.pow(canvasPoint.y - yy, 2)
        );

        if (distance <= config.wall.widthSelected) {
          onWallClick(wall, worldPoint);
          return;
        }
      }
    }

    // Check room clicks
    if (onRoomClick && showRooms) {
      for (const room of rooms) {
        if (!room.polygon || room.polygon.length < 3) continue;
        
        // Simple point-in-polygon test using ray casting
        let inside = false;
        const polygon = room.polygon;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          if (((polygon[i].y > worldPoint.y) !== (polygon[j].y > worldPoint.y)) &&
              (worldPoint.x < (polygon[j].x - polygon[i].x) * (worldPoint.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
            inside = !inside;
          }
        }
        
        if (inside) {
          onRoomClick(room, worldPoint);
          return;
        }
      }
    }
  }, [canvasToWorld, worldToCanvas, corners, walls, rooms, onCornerClick, onWallClick, onRoomClick, showCorners, showRooms, config]);

  // Re-render when props change
  useEffect(() => {
    render();
  }, [render]);

  // Set up canvas dimensions
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;
      render();
    }
  }, [width, height, render]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleMouseClick}
        className="border rounded-lg cursor-crosshair"
        style={{
          backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
          borderColor: theme === 'dark' ? '#374151' : '#d1d5db'
        }}
      />
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`absolute top-2 left-2 text-xs p-2 rounded ${
          theme === 'dark' ? 'bg-black/50 text-white' : 'bg-white/50 text-black'
        }`}>
          <div>Walls: {walls.length}</div>
          <div>Corners: {corners.length}</div>
          <div>Rooms: {rooms.length}</div>
          <div>Scale: {scale.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
};

export default Architect3DWallRenderer2D;


