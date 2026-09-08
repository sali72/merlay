import { DiagramDriver, DiagramTemplate, SupportedDiagramType } from './types';
import { FlowchartDriver } from './flowchart/flowchartDriver';
import { StateDiagramDriver } from './state/stateDriver';

const drivers = new Map<SupportedDiagramType, DiagramDriver>();

export function registerDriver(driver: DiagramDriver): void {
  drivers.set(driver.type, driver);
}

// Register built-in drivers
registerDriver(FlowchartDriver);
registerDriver(StateDiagramDriver);

/**
 * Detect the Mermaid diagram type from code by inspecting directives and comments
 */
export function detectDiagramType(code: string): SupportedDiagramType {
  const lines = code.split('\n');
  let inFrontmatter = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (!inFrontmatter && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
      }
      continue;
    }

    // Check for Flowchart / Graph
    if (/^(flowchart|graph)\b/i.test(trimmed)) {
      return 'flowchart';
    }

    // Check for State Diagram
    if (/^stateDiagram(-v2)?\b/i.test(trimmed)) {
      return 'stateDiagram';
    }

    // Check for Mindmap
    if (/^mindmap\b/i.test(trimmed)) {
      return 'mindmap';
    }

    // Check for Sequence Diagram
    if (/^sequenceDiagram\b/i.test(trimmed)) {
      return 'sequenceDiagram';
    }

    // Check for Class Diagram
    if (/^classDiagram\b/i.test(trimmed)) {
      return 'classDiagram';
    }

    // Check for Entity Relationship Diagram
    if (/^erDiagram\b/i.test(trimmed)) {
      return 'erDiagram';
    }

    // Stop at the first substantive line
    break;
  }

  return 'unknown';
}

export function getDriver(type: SupportedDiagramType): DiagramDriver | undefined {
  return drivers.get(type);
}

export function getDriverForCode(code: string): DiagramDriver | undefined {
  const type = detectDiagramType(code);
  return getDriver(type);
}

export function getAllDrivers(): DiagramDriver[] {
  return Array.from(drivers.values());
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    type: 'flowchart',
    label: 'Flowchart (Default)',
    description: 'Process maps, workflows, decision trees, and system architectures.',
    defaultCode: `flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]\n`,
  },
  {
    type: 'stateDiagram',
    label: 'State Diagram',
    description: 'Finite state machines, lifecycle transitions, choices, and forks.',
    defaultCode: `stateDiagram-v2\n    [*] --> Idle\n    Idle --> Processing : Submit\n    Processing --> Success : Approve\n    Processing --> Failed : Reject\n    Success --> [*]\n    Failed --> Idle : Retry\n`,
  },
];
