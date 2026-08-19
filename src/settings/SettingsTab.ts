import { App, PluginSettingTab, Setting } from 'obsidian';
import type VisualMermaidPlugin from '../main';
import { FlowchartDirection } from '../ast/types';

export interface VisualMermaidSettings {
  defaultDirection: FlowchartDirection;
  autoTidyOnOpen: boolean;
  showCodePanelByDefault: boolean;
}

export const DEFAULT_SETTINGS: VisualMermaidSettings = {
  defaultDirection: 'LR',
  autoTidyOnOpen: true,
  showCodePanelByDefault: true,
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
      .setDesc('Direction for new flowcharts and auto-layouts.')
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
      .setName('Auto-Tidy on Open')
      .setDesc('Automatically calculates a clean layout when opening diagrams.')
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
  }
}
