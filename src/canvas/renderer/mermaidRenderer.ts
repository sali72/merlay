import { App, MarkdownRenderer, Component, loadMermaid } from 'obsidian';

let cachedMermaidApi: any = null;

export async function getMermaidApi(): Promise<any> {
  if (cachedMermaidApi) return cachedMermaidApi;
  if (typeof window !== 'undefined' && (window as any).mermaid) {
    cachedMermaidApi = (window as any).mermaid;
    return cachedMermaidApi;
  }
  try {
    cachedMermaidApi = await loadMermaid();
    return cachedMermaidApi;
  } catch (err) {
    console.warn(
      'Merlay: Direct loadMermaid not available, fallback to MarkdownRenderer',
      err
    );
    return null;
  }
}

let renderSeq = 0;

export async function renderMermaidSvg(app: App, code: string): Promise<string> {
  const mermaidApi = await getMermaidApi();
  if (mermaidApi && typeof mermaidApi.render === 'function') {
    const id = `vmm_${Date.now()}_${++renderSeq}`;
    const scratch = document.body.createDiv('mermaid');
    scratch.setCssStyles({
      position: 'absolute',
      visibility: 'hidden',
      top: '-9999px',
      left: '-9999px',
      width: '1200px',
    });

    try {
      const res = await mermaidApi.render(id, code, scratch);
      scratch.remove();
      return typeof res === 'string' ? res : res.svg;
    } catch (err) {
      scratch.remove();
      throw err;
    }
  }

  // Fallback to MarkdownRenderer if direct API is unavailable
  const tempContainer = document.createElement('div');
  const comp = new Component();
  comp.load();
  await MarkdownRenderer.render(
    app,
    `\`\`\`mermaid\n${code}\n\`\`\``,
    tempContainer,
    '',
    comp
  );
  comp.unload();
  return tempContainer.innerHTML;
}
