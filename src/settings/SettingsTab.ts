import { App, PluginSettingTab, Setting } from 'obsidian';
import type VisualMermaidPlugin from '../main';
import { FlowchartDirection } from '../ast/types';

export interface VisualMermaidSettings {
  defaultDirection: FlowchartDirection;
  showCodeDrawerByDefault: boolean;
}

export const DEFAULT_SETTINGS: VisualMermaidSettings = {
  defaultDirection: 'LR',
  showCodeDrawerByDefault: false,
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
      .setName('Default Flow Direction')
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
      .setName('Show Code Drawer by Default')
      .setDesc('Displays the Mermaid syntax code drawer by default inside visual mode.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCodeDrawerByDefault)
          .onChange(async (value) => {
            this.plugin.settings.showCodeDrawerByDefault = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
