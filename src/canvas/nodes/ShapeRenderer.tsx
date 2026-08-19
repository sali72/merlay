import React from 'react';
import { MermaidShapeType } from '../../ast/types';

interface ShapeRendererProps {
  shape: MermaidShapeType;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export const ShapeRenderer: React.FC<ShapeRendererProps> = ({
  shape,
  width: w,
  height: h,
  fill,
  stroke,
  strokeWidth: sw,
}) => {
  const safeW = Math.max(w, 70);
  const safeH = Math.max(h, 44);

  switch (shape) {
    case 'rounded':
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <rect x={sw} y={sw} width={safeW - sw * 2} height={safeH - sw * 2} rx="12" fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );

    case 'stadium':
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <rect x={sw} y={sw} width={safeW - sw * 2} height={safeH - sw * 2} rx={safeH / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );

    case 'circle': {
      const diameter = Math.min(safeW, safeH);
      const r = diameter / 2 - sw;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${diameter} ${diameter}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <circle cx={diameter / 2} cy={diameter / 2} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    }

    case 'cylinder': {
      const rx = safeW / 2 - sw - 2;
      const ry = 8;
      const topY = ry + sw;
      const bottomY = safeH - ry - sw;

      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {/* Cylinder Main Body */}
          <path
            d={`M ${sw + 2},${topY} L ${sw + 2},${bottomY} A ${rx},${ry} 0 0,0 ${safeW - sw - 2},${bottomY} L ${safeW - sw - 2},${topY} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          {/* Bottom 3D curved arc outline */}
          <path
            d={`M ${sw + 2},${bottomY} A ${rx},${ry} 0 0,0 ${safeW - sw - 2},${bottomY}`}
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
          />
          {/* Top Elliptical Lid */}
          <ellipse cx={safeW / 2} cy={topY} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    }

    case 'diamond':
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <polygon
            points={`${safeW / 2},${sw + 1} ${safeW - sw - 1},${safeH / 2} ${safeW / 2},${safeH - sw - 1} ${sw + 1},${safeH / 2}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );

    case 'hexagon':
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <polygon
            points={`18,${sw + 1} ${safeW - 18},${sw + 1} ${safeW - sw - 1},${safeH / 2} ${safeW - 18},${safeH - sw - 1} 18,${safeH - sw - 1} ${sw + 1},${safeH / 2}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );

    case 'parallelogram':
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <polygon
            points={`18,${sw + 1} ${safeW - sw - 1},${sw + 1} ${safeW - 18},${safeH - sw - 1} ${sw + 1},${safeH - sw - 1}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );

    case 'subroutine':
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <rect x={sw} y={sw} width={safeW - sw * 2} height={safeH - sw * 2} rx="4" fill={fill} stroke={stroke} strokeWidth={sw} />
          <line x1="12" y1={sw} x2="12" y2={safeH - sw} stroke={stroke} strokeWidth={sw} />
          <line x1={safeW - 12} y1={sw} x2={safeW - 12} y2={safeH - sw} stroke={stroke} strokeWidth={sw} />
        </svg>
      );

    case 'rectangle':
    default:
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <rect x={sw} y={sw} width={safeW - sw * 2} height={safeH - sw * 2} rx="4" fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
  }
};
