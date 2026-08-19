import { toPng, toSvg, toBlob } from 'html-to-image';

function filterCanvasElements(node: HTMLElement): boolean {
  if (!node.classList) return true;
  if (
    node.classList.contains('react-flow__controls') ||
    node.classList.contains('react-flow__minimap') ||
    node.classList.contains('react-flow__panel') ||
    node.classList.contains('mermaid-top-toolbar') ||
    node.classList.contains('mermaid-floating-toolbar') ||
    node.classList.contains('mermaid-floating-toolbar-container') ||
    node.classList.contains('mermaid-sprout-container') ||
    node.classList.contains('mermaid-handle') ||
    node.classList.contains('mermaid-studio-edit-btn')
  ) {
    return false;
  }
  return true;
}

export async function exportDiagramAsPng(
  element: HTMLElement,
  fileName: string = 'mermaid-diagram.png'
): Promise<void> {
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: 'transparent',
      quality: 1,
      pixelRatio: 2,
      filter: filterCanvasElements,
    });

    const link = document.createElement('a');
    link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error exporting diagram to PNG:', error);
    throw error;
  }
}

export async function exportDiagramAsSvg(
  element: HTMLElement,
  fileName: string = 'mermaid-diagram.svg'
): Promise<void> {
  try {
    const dataUrl = await toSvg(element, {
      backgroundColor: 'transparent',
      filter: filterCanvasElements,
    });

    const link = document.createElement('a');
    link.download = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error exporting diagram to SVG:', error);
    throw error;
  }
}

export async function copyDiagramToClipboard(element: HTMLElement): Promise<void> {
  try {
    const blob = await toBlob(element, {
      backgroundColor: 'transparent',
      quality: 1,
      pixelRatio: 2,
      filter: filterCanvasElements,
    });

    if (!blob) throw new Error('Failed to generate image blob');

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);
  } catch (error) {
    console.error('Error copying diagram to clipboard:', error);
    throw error;
  }
}

