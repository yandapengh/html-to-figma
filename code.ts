// code.ts - Figma Plugin main thread
import { ExtractedNode } from './src/types';
import { mapToFigmaSpec } from './src/mapper';
import { buildFromSpec } from './src/builder';

figma.showUI(__html__, { width: 320, height: 520 });

figma.ui.onmessage = (msg: { type: string; node?: ExtractedNode; error?: string }) => {
  if (msg.type === 'generate-from-node') {
    if (!msg.node) {
      figma.notify('Error: No node data received');
      return;
    }

    try {
      const spec = mapToFigmaSpec(msg.node);
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
