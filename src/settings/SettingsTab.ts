import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type MerlayPlugin from '../main';
import { FlowchartDirection } from '../diagrams/viewModel';
import { MERLAY_ICON_ID } from '../obsidian/icons';

export interface MerlaySettings {
  defaultDirection: FlowchartDirection;
  showCodeDrawerByDefault: boolean;
  enableEditorContextMenu: boolean;
  enableFileContextMenu: boolean;
  enableInsertCommands: boolean;
}

export type VisualMermaidSettings = MerlaySettings;

export const DEFAULT_SETTINGS: MerlaySettings = {
  defaultDirection: 'LR',
  showCodeDrawerByDefault: false,
  enableEditorContextMenu: true,
  enableFileContextMenu: true,
  enableInsertCommands: true,
};

export class MerlaySettingTab extends PluginSettingTab {
  plugin: MerlayPlugin;

  constructor(app: App, plugin: MerlayPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const headerContainer = containerEl.createDiv({ cls: 'merlay-settings-header' });
    const logoEl = headerContainer.createDiv({ cls: 'merlay-settings-logo' });
    setIcon(logoEl, MERLAY_ICON_ID);
    const titleContainer = headerContainer.createDiv({ cls: 'merlay-settings-title-group' });
    // Plain div (not a heading element): settings headings must not contain
    // the plugin name or the word "settings" per community review rules.
    titleContainer.createDiv({ text: 'Merlay Settings', cls: 'merlay-settings-title' });
    titleContainer.createDiv({
      text: 'Visual overlay editor for Mermaid diagrams. Mermaid, your way.',
      cls: 'merlay-settings-subtitle',
    });

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

    new Setting(containerEl).setName('Commands & Context Menus').setHeading();

    new Setting(containerEl)
      .setName('Editor Context Menu')
      .setDesc('Show "Insert Mermaid Diagram" and "Edit Diagram in Visual Mode" in the note editor right-click menu.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableEditorContextMenu)
          .onChange(async (value) => {
            this.plugin.settings.enableEditorContextMenu = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('File Explorer Context Menu')
      .setDesc('Show "New Mermaid Diagram" and "Open in Visual Editor" in the file explorer right-click menu.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFileContextMenu)
          .onChange(async (value) => {
            this.plugin.settings.enableFileContextMenu = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Insert Diagram Commands & Slash Commands')
      .setDesc('Enable "Insert Mermaid Diagram" commands in the Command Palette and Obsidian slash (/) menu.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableInsertCommands)
          .onChange(async (value) => {
            this.plugin.settings.enableInsertCommands = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

