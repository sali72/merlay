import { App, PluginSettingTab, Setting } from 'obsidian';
import type VisualMermaidPlugin from '../main';
import { ArrowType, FlowchartDirection, MermaidShapeType } from '../ast/types';

export interface VisualMermaidSettings {
  defaultDirection: FlowchartDirection;
  defaultShape: MermaidShapeType;
  defaultArrowType: ArrowType;
  autoTidyOnOpen: boolean;
  showCodePanelByDefault: boolean;
  showMinimap: boolean;
  codePanelWidth: number;
}

export const DEFAULT_SETTINGS: VisualMermaidSettings = {
  defaultDirection: 'LR',
  defaultShape: 'rectangle',
  defaultArrowType: 'arrow',
  autoTidyOnOpen: true,
  showCodePanelByDefault: true,
  showMinimap: true,
  codePanelWidth: 340,
};

export class VisualMermaidSettingTab extends PluginSettingTab {
  plugin: VisualMermaidPlugin;

  constructor(app: App, plugin: VisualMermaidPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Visual Mermaid Studio Settings' });

    new Setting(containerEl)
      .setName('Default Layout Direction')
      .setDesc('Default flow direction for newly created diagrams.')
      .addDropdown((drop) =>
        drop
          .addOption('LR', 'Left to Right (LR)')
          .addOption('TD', 'Top to Bottom (TD)')
          .addOption('BT', 'Bottom to Top (BT)')
          .addOption('RL', 'Right to Left (RL)')
          .setValue(this.plugin.settings.defaultDirection)
          .onChange(async (value) => {
            this.plugin.settings.defaultDirection = value as FlowchartDirection;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default Node Shape')
      .setDesc('Shape used when sprouting or creating new nodes.')
      .addDropdown((drop) =>
        drop
          .addOption('rectangle', 'Rectangle [text]')
          .addOption('rounded', 'Rounded (text)')
          .addOption('stadium', 'Stadium ([text])')
          .addOption('cylinder', 'Database [(text)]')
          .addOption('circle', 'Circle ((text))')
          .addOption('diamond', 'Decision {text}')
          .addOption('hexagon', 'Hexagon {{text}}')
          .addOption('subroutine', 'Subroutine [[text]]')
          .addOption('parallelogram', 'Parallelogram [/text/]')
          .setValue(this.plugin.settings.defaultShape)
          .onChange(async (value) => {
            this.plugin.settings.defaultShape = value as MermaidShapeType;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default Connection Style')
      .setDesc('Arrow connector style used when connecting nodes.')
      .addDropdown((drop) =>
        drop
          .addOption('arrow', 'Solid Arrow (-->)')
          .addOption('dotted', 'Dotted Arrow (-.->)')
          .addOption('thick', 'Thick Arrow (==>)')
          .addOption('bidirectional', 'Bidirectional (<-->)')
          .addOption('open', 'Solid Line (---)')
          .setValue(this.plugin.settings.defaultArrowType)
          .onChange(async (value) => {
            this.plugin.settings.defaultArrowType = value as ArrowType;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show Minimap')
      .setDesc('Display a navigation minimap in the corner of the canvas.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showMinimap)
          .onChange(async (value) => {
            this.plugin.settings.showMinimap = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto-Tidy on Open')
      .setDesc('Automatically calculates a clean Elk.js layout when opening diagrams.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoTidyOnOpen)
          .onChange(async (value) => {
            this.plugin.settings.autoTidyOnOpen = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show Code Panel by Default')
      .setDesc('Displays the Mermaid code editor alongside the visual canvas.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCodePanelByDefault)
          .onChange(async (value) => {
            this.plugin.settings.showCodePanelByDefault = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Code Panel Default Width')
      .setDesc('Default width of the sliding Mermaid code editor (in pixels).')
      .addSlider((slider) =>
        slider
          .setLimits(240, 600, 20)
          .setValue(this.plugin.settings.codePanelWidth || 340)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.codePanelWidth = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
