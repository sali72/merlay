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
  const safeW = Math.max(w, 80);
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
      const r = Math.min(safeW, safeH) / 2 - sw;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <circle cx={safeW / 2} cy={safeH / 2} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    }

    case 'cylinder': {
      const rx = safeW / 2 - sw - 2;
      const ry = 6;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <path
            d={`M ${sw + 2},${ry + 2} L ${sw + 2},${safeH - ry - 2} A ${rx},${ry} 0 0,0 ${safeW - sw - 2},${safeH - ry - 2} L ${safeW - sw - 2},${ry + 2} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <ellipse cx={safeW / 2} cy={ry + 2} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    }

    case 'diamond':
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${safeW} ${safeH}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <polygon
            points={`${safeW / 2},${sw} ${safeW - sw},${safeH / 2} ${safeW / 2},${safeH - sw} ${sw},${safeH / 2}`}
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
            points={`18,${sw} ${safeW - 18},${sw} ${safeW - sw},${safeH / 2} ${safeW - 18},${safeH - sw} 18,${safeH - sw} ${sw},${safeH / 2}`}
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
            points={`16,${sw} ${safeW - sw},${sw} ${safeW - 16},${safeH - sw} ${sw},${safeH - sw}`}
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
          <line x1="10" y1={sw} x2="10" y2={safeH - sw} stroke={stroke} strokeWidth={sw} />
          <line x1={safeW - 10} y1={sw} x2={safeW - 10} y2={safeH - sw} stroke={stroke} strokeWidth={sw} />
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
