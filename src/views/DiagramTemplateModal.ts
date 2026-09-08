import { App, SuggestModal } from 'obsidian';
import { DiagramTemplate } from '../diagrams/types';
import { DIAGRAM_TEMPLATES } from '../diagrams/registry';

export class DiagramTemplateModal extends SuggestModal<DiagramTemplate> {
  private onChoose: (template: DiagramTemplate) => void;

  constructor(app: App, onChoose: (template: DiagramTemplate) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder('Choose a Mermaid diagram type (Default: Flowchart)...');
  }

  getSuggestions(query: string): DiagramTemplate[] {
    const q = query.toLowerCase();
    return DIAGRAM_TEMPLATES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
    );
  }

  renderSuggestion(item: DiagramTemplate, el: HTMLElement): void {
    const container = el.createDiv({ cls: 'mermaid-template-suggestion' });
    container.createDiv({ text: item.label, cls: 'suggestion-title' });
    container.createDiv({ text: item.description, cls: 'suggestion-note' });
  }

  onChooseSuggestion(item: DiagramTemplate, evt: MouseEvent | KeyboardEvent): void {
    this.onChoose(item);
  }
}
