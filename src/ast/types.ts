/**
 * Mermaid Flowchart AST Types & Interfaces
 */

export type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';

export type MermaidShapeType =
  | 'rectangle'          // [text]
  | 'rounded'            // (text)
  | 'stadium'            // ([text])
  | 'subroutine'         // [[text]]
  | 'cylinder'           // [(text)]
  | 'circle'             // ((text))
  | 'double_circle'      // (((text)))
  | 'diamond'            // {text}
  | 'hexagon'            // {{text}}
  | 'parallelogram'      // [/text/]
  | 'parallelogram_alt'  // [\text\]
  | 'trapezoid'          // [/text\]
  | 'trapezoid_alt'      // [\text/]
  | 'asymmetric';        // >text]

export type ArrowType =
  | 'arrow'          // -->
  | 'dotted'         // -.->
  | 'thick'          // ==>
  | 'open'           // ---
  | 'dotted_open'    // -.-
  | 'thick_open'     // ===
  | 'bidirectional'  // <-->
  | 'cross'          // --x
  | 'circle';        // --o

export interface MermaidNodeDef {
  type: 'node';
  id: string;
  label: string;
  shape: MermaidShapeType;
  subgraphId?: string;
  style?: Record<string, string>;
  classes?: string[];
}

export interface MermaidEdgeDef {
  type: 'edge';
  id: string;
  from: string;
  to: string;
  arrowType: ArrowType;
  label?: string;
  style?: Record<string, string>;
}

export interface MermaidSubgraphDef {
  type: 'subgraph';
  id: string;
  label: string;
  direction?: FlowchartDirection;
  nodeIds: string[];
  subgraphIds: string[];
  style?: Record<string, string>;
}

export interface MermaidStyleDef {
  type: 'style';
  targetId: string;
  styles: Record<string, string>;
}

export interface MermaidClassDef {
  type: 'classDef';
  name: string;
  styles: Record<string, string>;
}

export interface MermaidRawLine {
  type: 'raw';
  text: string;
}

export type ASTElement =
  | MermaidNodeDef
  | MermaidEdgeDef
  | MermaidSubgraphDef
  | MermaidStyleDef
  | MermaidClassDef
  | MermaidRawLine;

export interface MermaidFlowchartAST {
  diagramType: 'flowchart' | 'graph';
  direction: FlowchartDirection;
  nodes: Map<string, MermaidNodeDef>;
  edges: MermaidEdgeDef[];
  subgraphs: Map<string, MermaidSubgraphDef>;
  styles: MermaidStyleDef[];
  classDefs: Map<string, MermaidClassDef>;
  rawLines: MermaidRawLine[];
}

export interface PositionedNode {
  id: string;
  label: string;
  shape: MermaidShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  subgraphId?: string;
  style?: Record<string, string>;
}

export interface PositionedEdge {
  id: string;
  from: string;
  to: string;
  arrowType: ArrowType;
  label?: string;
  points?: Array<{ x: number; y: number }>;
  svgPath?: string;
  labelPosition?: { x: number; y: number };
}

export interface PositionedSubgraph {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
}

export interface PositionedGraph {
  direction: FlowchartDirection;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  subgraphs: PositionedSubgraph[];
}
