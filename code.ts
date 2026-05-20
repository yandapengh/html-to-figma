// code.ts - Figma Plugin main thread
import { ExtractedNode, FigmaNodeSpec } from './src/types';
import { mapToFigmaSpec } from './src/mapper';
import { buildFromSpec } from './src/builder';

figma.showUI(__html__, { width: 320, height: 520 });

function collectFonts(spec: FigmaNodeSpec): { family: string; style: string }[] {
  const fonts: { family: string; style: string }[] = [];
  if (spec.fontName) {
    fonts.push(spec.fontName);
  }
  if (spec.children) {
    for (const child of spec.children) {
      fonts.push(...collectFonts(child));
    }
  }
  return fonts;
}

function dedupeFonts(fonts: { family: string; style: string }[]): { family: string; style: string }[] {
  const seen = new Set<string>();
  return fonts.filter(f => {
    const key = `${f.family}|${f.style}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

figma.ui.onmessage = async (msg: { type: string; node?: ExtractedNode; error?: string }) => {
  if (msg.type === 'generate-from-node') {
    if (!msg.node) {
      figma.notify('Error: No node data received');
      return;
    }

    try {
      const spec = mapToFigmaSpec(msg.node);
      const fonts = dedupeFonts(collectFonts(spec));

      // Load all required fonts before building nodes
      await Promise.all(fonts.map(f => figma.loadFontAsync(f)));

      const frame = buildFromSpec(spec);
      figma.currentPage.appendChild(frame);
      figma.viewport.scrollAndZoomIntoView([frame]);
      figma.notify('HTML imported successfully!');
    } catch (err) {
      figma.notify('Error: ' + (err as Error).message, { error: true });
    }
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }

  if (msg.type === 'error') {
    figma.notify(msg.error || 'Unknown error', { error: true });
  }
};
