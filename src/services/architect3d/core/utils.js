import { Vector2 } from 'three';

// Utility functions for architect3d
export const Utils = {
  // Generate a unique ID
  guide: function() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  },

  // Remove value from array
  removeValue: function(array, value) {
    const index = array.indexOf(value);
    if (index > -1) {
      array.splice(index, 1);
    }
    return array;
  },

  // Calculate distance between two points
  distance: function(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Calculate distance from point to line
  pointDistanceFromLine: function(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Find closest point on line to given point
  closestPointOnLine: function(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    return new Vector2(xx, yy);
  },

  // Get cyclic order of points around a center point
  getCyclicOrder: function(points, center) {
    const angles = [];
    const indices = [];

    // Calculate angles for each point relative to center
    for (let i = 0; i < points.length; i++) {
      const angle = Math.atan2(points[i].y - center.y, points[i].x - center.x);
      const angleDeg = (angle * 180) / Math.PI;
      const normalizedAngle = angleDeg < 0 ? angleDeg + 360 : angleDeg;
      
      angles.push(normalizedAngle);
      indices.push(i);
    }

    // Sort indices based on angles
    const sortedData = indices.map((index, i) => ({ index, angle: angles[i] }))
                            .sort((a, b) => a.angle - b.angle);

    const sortedIndices = sortedData.map(item => item.index);
    const sortedAngles = sortedData.map(item => item.angle);

    return {
      indices: sortedIndices,
      angles: sortedAngles
    };
  },

  // Check if point is inside polygon
  pointInPolygon: function(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  },

  // Calculate polygon area using shoelace formula
  polygonArea: function(polygon) {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i].x * polygon[j].y;
      area -= polygon[j].x * polygon[i].y;
    }
    return Math.abs(area) / 2;
  },

  // Check if two line segments intersect
  lineSegmentsIntersect: function(p1, p2, p3, p4) {
    const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    
    if (denominator === 0) {
      return false; // Lines are parallel
    }

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }
};