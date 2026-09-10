import {
  Plugin,
  WorkspaceLeaf,
  MarkdownView,
  MarkdownPostProcessorContext,
  TFile,
  TFolder,
  Menu,
  MenuItem,
} from 'obsidian';
import {
  DEFAULT_SETTINGS,
  MerlaySettings,
  MerlaySettingTab,
} from './settings/SettingsTab';
import {
  MermaidFileView,
  VIEW_TYPE_MERMAID_FILE,
} from './views/MermaidFileView';
import {
  MermaidObserverChild,
  setupGlobalWorkspaceObserver,
  scanAndAttachToElement,
  scanActiveWorkspace,
  scanActiveView,
} from './obsidian/workspaceObserver';
import {
  createNewDiagram,
  createDiagramFileWithTemplate,
  openVisualModeForActiveFile,
  openDiagramModal,
  insertMermaidBlockAtCursor,
} from './obsidian/diagramOpener';
import { DiagramTemplateModal } from './views/DiagramTemplateModal';
import { DIAGRAM_TEMPLATES } from './diagrams/registry';
import { DiagramTemplate } from './diagrams/types';
import { isCursorInMermaidBlock } from './utils/markdownBlock';
import { MERLAY_ICON_ID, registerMerlayIcons } from './obsidian/icons';

/** Newer Obsidian MenuItem with submenu support (absent from current typings). */
type MenuItemWithSubmenu = MenuItem & { setSubmenu?: () => Menu };

export default class MerlayPlugin extends Plugin {
  public settings: MerlaySettings = DEFAULT_SETTINGS;

  async onload() {
    // Register custom Merlay logo icon in Obsidian icon library
    registerMerlayIcons();

    await this.loadSettings();

    // 1. Register custom File View for standalone .mmd and .mermaid files
    this.registerView(
      VIEW_TYPE_MERMAID_FILE,
      (leaf: WorkspaceLeaf) => new MermaidFileView(leaf, this)
    );
    this.registerExtensions(['mmd', 'mermaid'], VIEW_TYPE_MERMAID_FILE);

    // 2. Register Markdown Post-Processor (Reading View & Live Preview)
    this.registerMarkdownPostProcessor((element, context) => {
      const info = context.getSectionInfo(element);
      if (info) {
        element.setAttribute('data-mermaid-line-start', String(info.lineStart));
        element.setAttribute('data-mermaid-line-end', String(info.lineEnd));
      }
      scanAndAttachToElement(element, this, context.sourcePath, context);

      // MutationObserver to catch asynchronous Mermaid SVG rendering
      const observer = new MutationObserver(() => {
        scanAndAttachToElement(element, this, context.sourcePath, context);
      });
      observer.observe(element, { childList: true, subtree: true });

      context.addChild(new MermaidObserverChild(element, observer));
    });

    // 3. Global workspace DOM observer for Live Preview & Reading View
    this.app.workspace.onLayoutReady(() => {
      setupGlobalWorkspaceObserver(this);
    });

    // 4. Ribbon Icon
    this.addRibbonIcon(MERLAY_ICON_ID, 'Merlay', () => {
      void this.createNewDiagram();
    });

    // 5. Context Menus (Right-Click)
    // 5.1 Editor Context Menu (inside markdown notes)
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, info) => {
        if (!this.settings.enableEditorContextMenu) return;

        const view =
          info instanceof MarkdownView
            ? info
            : this.app.workspace.getActiveViewOfType(MarkdownView);

        const cursor = editor.getCursor();
        const content = editor.getValue();
        const blockInCursor = isCursorInMermaidBlock(content, cursor.line);

        // If right-clicked directly inside an existing Mermaid diagram block
        if (blockInCursor && view?.file) {
          menu.addItem((item) => {
            item
              .setTitle('Edit diagram in visual mode')
              .setIcon(MERLAY_ICON_ID)
              .setSection('action')
              .onClick(() => {
                openDiagramModal(
                  this,
                  view.file!.path,
                  blockInCursor,
                  content
                );
              });
          });
          menu.addSeparator();
        }

        // Insert Mermaid Diagram option (with submenu if supported)
        menu.addItem((item) => {
          item
            .setTitle('Insert Mermaid diagram')
            .setIcon(MERLAY_ICON_ID)
            .setSection('action');

          const submenu =
            typeof (item as MenuItemWithSubmenu).setSubmenu === 'function'
              ? (item as MenuItemWithSubmenu).setSubmenu!()
              : null;

          if (submenu && view) {
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('Choose template...')
                .setIcon('list')
                .onClick(() => {
                  new DiagramTemplateModal(this.app, (template) => {
                    void insertMermaidBlockAtCursor(this, view, template, true);
                  }).open();
                });
            });

            submenu.addSeparator();

            for (const template of DIAGRAM_TEMPLATES) {
              submenu.addItem((subItem: MenuItem) => {
                subItem
                  .setTitle(template.label)
                  .setIcon(
                    template.type === 'flowchart' ? 'git-fork' : 'git-commit'
                  )
                  .onClick(() => {
                    void insertMermaidBlockAtCursor(this, view, template, true);
                  });
              });
            }
          } else {
            item.onClick(() => {
              if (view) {
                new DiagramTemplateModal(this.app, (template) => {
                  void insertMermaidBlockAtCursor(this, view, template, true);
                }).open();
              }
            });
          }
        });
      })
    );

    // 5.2 File Explorer Context Menu (folders and files)
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file, source, leaf) => {
        if (!this.settings.enableFileContextMenu) return;

        // If right-clicked on an existing .mmd or .mermaid file, offer to open in visual editor
        if (
          file instanceof TFile &&
          (file.extension === 'mmd' || file.extension === 'mermaid')
        ) {
          menu.addItem((item) => {
            item
              .setTitle('Open in visual editor')
              .setIcon(MERLAY_ICON_ID)
              .setSection('open')
              .onClick(async () => {
                const targetLeaf = leaf || this.app.workspace.getLeaf('tab');
                await targetLeaf.openFile(file);
              });
          });
          return;
        }

        // Determine target folder
        let targetFolder = '';
        if (file instanceof TFolder) {
          targetFolder = file.path;
        } else if (file instanceof TFile) {
          targetFolder = file.parent ? file.parent.path : '';
        }

        menu.addItem((item) => {
          item
            .setTitle('New Mermaid diagram')
            .setIcon(MERLAY_ICON_ID)
            .setSection('action');

          const submenu =
            typeof (item as MenuItemWithSubmenu).setSubmenu === 'function'
              ? (item as MenuItemWithSubmenu).setSubmenu!()
              : null;

          if (submenu) {
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('Choose template...')
                .setIcon('list')
                .onClick(() => {
                  new DiagramTemplateModal(this.app, (template) => {
                    void createDiagramFileWithTemplate(
                      this,
                      template.defaultCode,
                      targetFolder
                    );
                  }).open();
                });
            });

            submenu.addSeparator();

            for (const template of DIAGRAM_TEMPLATES) {
              submenu.addItem((subItem: MenuItem) => {
                subItem
                  .setTitle(template.label)
                  .setIcon(
                    template.type === 'flowchart' ? 'git-fork' : 'git-commit'
                  )
                  .onClick(() => {
                    void createDiagramFileWithTemplate(
                      this,
                      template.defaultCode,
                      targetFolder
                    );
                  });
              });
            }
          } else {
            item.onClick(() => {
              new DiagramTemplateModal(this.app, (template) => {
                void createDiagramFileWithTemplate(
                  this,
                  template.defaultCode,
                  targetFolder
                );
              }).open();
            });
          }
        });
      })
    );

    // 6. Commands (available in Command Palette and Slash Commands "/")
    // 6.1 Insert Mermaid Diagram (in active note at cursor)
    this.addCommand({
      id: 'insert-mermaid-diagram',
      name: 'Insert Mermaid diagram',
      editorCheckCallback: (checking, editor, view) => {
        if (!this.settings.enableInsertCommands) return false;
        if (view instanceof MarkdownView) {
          if (!checking) {
            new DiagramTemplateModal(this.app, (template) => {
              void insertMermaidBlockAtCursor(this, view, template, true);
            }).open();
          }
          return true;
        }
        return false;
      },
    });

    // 6.2 Dynamic insert commands for each template (direct slash command per type)
    for (const template of DIAGRAM_TEMPLATES) {
      this.addCommand({
        id: `insert-mermaid-${template.type.toLowerCase()}`,
        name: `Insert Mermaid diagram: ${template.label}`,
        editorCheckCallback: (checking, editor, view) => {
          if (!this.settings.enableInsertCommands) return false;
          if (view instanceof MarkdownView) {
            if (!checking) {
              void insertMermaidBlockAtCursor(this, view, template, true);
            }
            return true;
          }
          return false;
        },
      });
    }


    // 6.3 Create New Standalone Mermaid Diagram File (.mmd)
    this.addCommand({
      id: 'create-new-mermaid-diagram',
      name: 'Create new Mermaid diagram (file)',
      callback: () => {
        void this.createNewDiagram();
      },
    });

    // 6.4 Open Visual Mode for Current Diagram in Note
    this.addCommand({
      id: 'open-visual-mode-active-note',
      name: 'Open visual mode for current diagram',
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            void this.openVisualModeForActiveFile(view);
          }
          return true;
        }
        return false;
      },
    });

    // 7. Settings Tab
    this.addSettingTab(new MerlaySettingTab(this.app, this));
  }

  // Delegated helpers for backward compatibility
  scanActiveWorkspace(): void {
    scanActiveWorkspace(this);
  }

  scanActiveView(): void {
    scanActiveView(this);
  }

  scanAndAttachToElement(
    container: HTMLElement,
    sourcePath?: string,
    context?: MarkdownPostProcessorContext
  ): void {
    scanAndAttachToElement(container, this, sourcePath, context);
  }

  openVisualModeForActiveFile(view: MarkdownView): Promise<void> {
    return openVisualModeForActiveFile(this, view);
  }

  createNewDiagram(targetFolder?: string): Promise<void> {
    return createNewDiagram(this, targetFolder);
  }

  createDiagramFileWithTemplate(
    initialCode: string,
    targetFolder?: string
  ): Promise<void> {
    return createDiagramFileWithTemplate(this, initialCode, targetFolder);
  }

  insertMermaidDiagram(
    view: MarkdownView,
    template?: DiagramTemplate,
    openVisualMode = true
  ): Promise<void> {
    if (template) {
      return insertMermaidBlockAtCursor(this, view, template, openVisualMode);
    }
    return new Promise((resolve) => {
      new DiagramTemplateModal(this.app, (chosen) => {
        void insertMermaidBlockAtCursor(this, view, chosen, openVisualMode).then(
          () => resolve()
        );
      }).open();
    });
  }

  async loadSettings(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded as Partial<MerlaySettings>);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

export type { MerlayPlugin as VisualMermaidPlugin };


