// code.ts - Figma Plugin main thread
// Receives layers from ui.html and creates Figma nodes using absolute positioning.

declare var process: {
  env: {
    NODE_ENV: 'production' | 'development' | undefined;
  };
};

import {
  LayerNode,
  Paint,
  SolidPaint,
  ImagePaint,
  FrameLayer,
  ShadowEffect,
  ImportDocument,
  ImportWarning,
} from './src/types';

figma.showUI(__html__, { width: 320, height: 520 });

const defaultFont = { family: 'Roboto', style: 'Regular' };
const fontCache: { [key: string]: FontName | undefined } = {};

const normalizeName = (str: string) => str.toLowerCase().replace(/[^a-z]/gi, '');
const fontCacheKey = (family: string, weight?: number, fontStyle?: string) =>
  `${normalizeName(family)}:${weight || 'any'}:${fontStyle || 'normal'}`;

const GENERIC_FONTS: Record<string, string[]> = {
  sansserif: ['Inter', 'Roboto', 'Arial'],
  serif: ['Georgia', 'Times New Roman'],
  monospace: ['Courier New', 'Courier', 'JetBrains Mono'],
  systemui: ['Inter', 'Roboto'],
};

function fontStyleScore(styleName: string, weight?: number, fontStyle?: string): number {
  const normalized = styleName.toLowerCase();
  let score = 0;
  if (fontStyle === 'italic' && normalized.includes('italic')) score += 20;
  if (fontStyle !== 'italic' && !normalized.includes('italic')) score += 10;
  if (weight) {
    const weightByName: Record<string, number> = {
      thin: 100,
      extralight: 200,
      light: 300,
      regular: 400,
      normal: 400,
      medium: 500,
      semibold: 600,
      demi: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    };
    let styleWeight = 400;
    for (const key of Object.keys(weightByName)) {
      if (normalized.replace(/\s+/g, '').includes(key)) {
        styleWeight = weightByName[key];
        break;
      }
    }
    score -= Math.abs(styleWeight - weight) / 100;
  }
  if (normalized === 'regular') score += 1;
  return score;
}

async function getMatchingFont(
  fontStr: string,
  availableFonts: Font[],
  weight?: number,
  fontStyle?: string
) {
  const familySplit = fontStr.split(/\s*,\s*/);
  for (const family of familySplit) {
    const rawName = family.replace(/['"]/g, '').trim();
    if (!rawName) continue;
    const normalized = normalizeName(rawName);
    const cacheKey = fontCacheKey(rawName, weight, fontStyle);
    const cached = fontCache[cacheKey];
    if (cached) return cached;

    // Try generic fallback first
    if (GENERIC_FONTS[normalized]) {
      for (const fallback of GENERIC_FONTS[normalized]) {
        const fn = normalizeName(fallback);
        const match = bestFamilyMatch(availableFonts, fn, weight, fontStyle);
        if (match) {
          await figma.loadFontAsync(match.fontName);
          fontCache[cacheKey] = match.fontName;
          fontCache[fontCacheKey(fontStr, weight, fontStyle)] = match.fontName;
          console.log('[Font] generic "' + rawName + '" -> "' + match.fontName.family + '"');
          return match.fontName;
        }
      }
    }

    // Exact match
    const match = bestFamilyMatch(availableFonts, normalized, weight, fontStyle);
    if (match) {
      await figma.loadFontAsync(match.fontName);
      fontCache[cacheKey] = match.fontName;
      fontCache[fontCacheKey(fontStr, weight, fontStyle)] = match.fontName;
      return match.fontName;
    }
  }
  return defaultFont;
}

function bestFamilyMatch(
  availableFonts: Font[],
  normalizedFamily: string,
  weight?: number,
  fontStyle?: string
): Font | undefined {
  return availableFonts
    .filter((font) => normalizeName(font.fontName.family) === normalizedFamily)
    .sort(
      (a, b) =>
        fontStyleScore(b.fontName.style, weight, fontStyle) -
        fontStyleScore(a.fontName.style, weight, fontStyle)
    )[0];
}

function isImageFill(fill: Paint): fill is ImagePaint {
  return fill.type === 'IMAGE';
}

function processImages(layer: LayerNode) {
  const fills = (layer as any).fills as Paint[] | undefined;
  if (!fills) return Promise.resolve();

  const imageFills = fills.filter(isImageFill);
  if (!imageFills.length) return Promise.resolve();

  return Promise.all(
    imageFills.map(async (fill) => {
      const imgFill = fill as ImagePaint;
      if (imgFill.imageHash) {
        const image = figma.getImageByHash(imgFill.imageHash);
        if (image) {
          try {
            const bytes = await image.getBytesAsync();
            imgFill.intArr = bytes;
          } catch (err) {
            console.warn('Could not get image for layer', err);
          }
        }
      } else if (imgFill.url) {
        try {
          const response = await fetch(imgFill.url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const image = figma.createImage(uint8Array);
            imgFill.imageHash = image.hash;
          }
        } catch (err) {
          console.warn('Could not fetch image from URL:', imgFill.url, err);
        }
      }
    })
  );
}

// Deep clone preserving Uint8Array
function fastClone(data: any): any {
  if (typeof data === 'symbol') return null;
  return JSON.parse(JSON.stringify(data));
}

async function traverseLayers(
  layer: LayerNode,
  cb: (layer: LayerNode, parent: LayerNode | null) => Promise<void>,
  parent: LayerNode | null = null
): Promise<void> {
  if (layer) {
    await cb(layer, parent);
  }
  const children = (layer as FrameLayer).children;
  if (children) {
    for (const child of children as LayerNode[]) {
      await traverseLayers(child, cb, layer);
    }
  }
}

function assign(a: any, b: any) {
  const ignoredKeys = [
    'width',
    'height',
    'type',
    'ref',
    'children',
    'svg',
    'fontFamily',
    'fontWeight',
    'fontStyle',
    'isPseudoElement',
    'layoutConfidence',
    'layoutReason',
  ];
  for (const key in b) {
    const value = b[key];
    if (key === 'data' && value && typeof value === 'object') {
      const currentData = JSON.parse(a.getSharedPluginData?.('builder', 'data') || '{}') || {};
      const mergedData = Object.assign({}, currentData, value);
      a.setSharedPluginData?.('builder', 'data', JSON.stringify(mergedData));
    } else if (
      typeof value !== 'undefined' &&
      ignoredKeys.indexOf(key) === -1
    ) {
      try {
        a[key] = value;
      } catch (err) {
        console.warn('Assign error for property "' + key + '"', err);
      }
    }
  }
}

function applyFrameLayout(frame: FrameNode, layer: FrameLayer) {
  if (layer.layoutConfidence !== 'high') return;
  if (!layer.layoutMode || layer.layoutMode === 'NONE') return;
  try {
    frame.layoutMode = layer.layoutMode;
    if (typeof layer.itemSpacing === 'number') frame.itemSpacing = layer.itemSpacing;
    if (typeof layer.paddingTop === 'number') frame.paddingTop = layer.paddingTop;
    if (typeof layer.paddingRight === 'number') frame.paddingRight = layer.paddingRight;
    if (typeof layer.paddingBottom === 'number') frame.paddingBottom = layer.paddingBottom;
    if (typeof layer.paddingLeft === 'number') frame.paddingLeft = layer.paddingLeft;
    if (layer.primaryAxisAlignItems) frame.primaryAxisAlignItems = layer.primaryAxisAlignItems;
    if (layer.counterAxisAlignItems) frame.counterAxisAlignItems = layer.counterAxisAlignItems;
    if (layer.primaryAxisSizingMode) frame.primaryAxisSizingMode = layer.primaryAxisSizingMode;
    if (layer.counterAxisSizingMode) frame.counterAxisSizingMode = layer.counterAxisSizingMode;
    if (layer.layoutWrap && 'layoutWrap' in frame) {
      (frame as any).layoutWrap = layer.layoutWrap;
    }
  } catch (err) {
    console.warn('Could not apply inferred auto layout', layer.layoutReason, err);
  }
}

function normalizeImportData(data: any): { document?: ImportDocument; layers: LayerNode[]; warnings: ImportWarning[] } {
  const document = data && data.version === 1 && Array.isArray(data.layers)
    ? (data as ImportDocument)
    : data && data.document && Array.isArray(data.document.layers)
    ? (data.document as ImportDocument)
    : undefined;
  const layers = document?.layers || data?.layers || [];
  const warnings = document?.warnings || data?.warnings || [];
  return { document, layers, warnings };
}

function notifyImportWarnings(warnings: ImportWarning[]) {
  if (!warnings.length) return;
  const important = warnings.filter((warning) => warning.severity !== 'info');
  figma.notify(
    `Imported with ${important.length || warnings.length} warning${(important.length || warnings.length) === 1 ? '' : 's'}. See console for details.`
  );
  console.warn('[HTML to Figma] Import warnings', warnings);
}

function postSelection() {
  figma.ui.postMessage({
    type: 'selectionChange',
    elements: figma.currentPage.selection.map((el) => ({
      id: el.id,
      type: el.type,
      name: el.name,
    })),
  });
}

figma.on('selectionchange', () => {
  postSelection();
});

// --- Message handler ---
figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }

  if (msg.type === 'init') {
    postSelection();
  }

  if (msg.type === 'import') {
    const { data } = msg;
    const { layers, warnings } = normalizeImportData(data);

    if (!layers || !layers.length) {
      figma.notify('No layers to import', { error: true });
      return;
    }

    try {
      const availableFonts = await figma.listAvailableFontsAsync();
      await figma.loadFontAsync(defaultFont);

      const rects: SceneNode[] = [];
      let baseFrame: PageNode | FrameNode = figma.currentPage;
      let frameRoot: PageNode | FrameNode = baseFrame as any;

      for (const rootLayer of layers) {
        await traverseLayers(rootLayer, async (layer, parent) => {
          try {
            if (layer.type === 'FRAME' || layer.type === 'GROUP') {
              const frame = figma.createFrame();
              frame.x = layer.x || 0;
              frame.y = layer.y || 0;
              frame.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
              assign(frame, layer);
              applyFrameLayout(frame, layer);
              rects.push(frame);
              ((parent && (parent as any).ref) || baseFrame).appendChild(frame);
              (layer as any).ref = frame;
              if (!parent) {
                frameRoot = frame;
                baseFrame = frame;
              }
            } else if (layer.type === 'SVG') {
              const node = figma.createNodeFromSvg(layer.svg);
              node.x = layer.x || 0;
              node.y = layer.y || 0;
              node.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
              (layer as any).ref = node;
              rects.push(node);
              assign(node, layer);
              ((parent && (parent as any).ref) || baseFrame).appendChild(node);
            } else if (layer.type === 'RECTANGLE') {
              const rect = figma.createRectangle();
              const fills = (layer as any).fills as Paint[] | undefined;
              if (fills && fills.some(isImageFill)) {
                await processImages(layer);
              }
              assign(rect, layer);
              rect.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
              rects.push(rect);
              (layer as any).ref = rect;
              ((parent && (parent as any).ref) || baseFrame).appendChild(rect);
            } else if (layer.type === 'TEXT') {
              const text = figma.createText();
              const layerFontFamily = (layer as any).fontFamily;
              if (layerFontFamily) {
                const family = await getMatchingFont(
                  layerFontFamily,
                  availableFonts,
                  (layer as any).fontWeight,
                  (layer as any).fontStyle
                );
                text.fontName = family;
              }
              assign(text, layer);
              (layer as any).ref = text;
              text.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
              text.textAutoResize = 'HEIGHT';

              // Font size correction loop (reduce if text overflows)
              const lineHeight =
                (layer.lineHeight && (layer.lineHeight as any).value) || layer.height || 16;
              let adjustments = 0;
              while (
                typeof text.fontSize === 'number' &&
                typeof layer.fontSize === 'number' &&
                (text.height > Math.max(layer.height || 0, lineHeight) * 1.2 ||
                  text.width > (layer.width || 0) * 1.2)
              ) {
                if (adjustments++ > (layer.fontSize || 16) * 0.3) {
                  console.warn('Too many font adjustments', text, layer);
                  break;
                }
                try {
                  text.fontSize = text.fontSize - 1;
                } catch (err) {
                  console.warn('Error on resize text:', layer, text, err);
                }
              }
              rects.push(text);
              ((parent && (parent as any).ref) || baseFrame).appendChild(text);
            }
          } catch (err) {
            console.warn('Error on layer:', layer, err);
          }
        });
      }

      if (frameRoot.type === 'FRAME') {
        figma.currentPage.selection = [frameRoot];
      }

      figma.ui.postMessage({
        type: 'doneLoading',
        rootId: frameRoot.id,
      });

      figma.viewport.scrollAndZoomIntoView([frameRoot]);
      notifyImportWarnings(warnings);

      if (process.env.NODE_ENV !== 'development') {
        figma.closePlugin();
      }
    } catch (err) {
      const msg = typeof err === 'string'
        ? err
        : err instanceof Error
        ? err.message
        : JSON.stringify(err);
      console.error('[DEBUG] Import error:', err);
      figma.notify('Error: ' + msg, { error: true });
    }
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }

  if (msg.type === 'error') {
    figma.notify(msg.error || 'Unknown error', { error: true });
  }

  if (msg.type === 'extract-canvas') {
    try {
      const nodes = figma.currentPage.children;
      const result = scanNodes(nodes, 0, 12);
      figma.ui.postMessage({ type: 'canvas-data', data: result });
    } catch (err) {
      figma.ui.postMessage({ type: 'canvas-data', error: String(err) });
    }
  }
};

// --- Canvas scanning (debug feature) ---
function isMixed(v: any): boolean {
  return v === figma.mixed;
}

function safeFills(n: any): any[] | null {
  const fills = n.fills;
  if (!fills || isMixed(fills) || !Array.isArray(fills) || fills.length === 0) return null;
  return fills.map((f: Paint) => {
    if (f.type === 'SOLID')
      return {
        type: 'SOLID',
        color: {
          r: (f as any).color.r.toFixed(2),
          g: (f as any).color.g.toFixed(2),
          b: (f as any).color.b.toFixed(2),
          a: (f as any).opacity ?? 1,
        },
      };
    return { type: f.type };
  });
}

function safeStrokes(n: any): number | null {
  const s = n.strokes;
  if (!s || isMixed(s) || !Array.isArray(s) || s.length === 0) return null;
  return s.length;
}

function scanNodes(
  nodes: readonly SceneNode[],
  depth: number,
  maxDepth: number
): any[] {
  if (depth > maxDepth) return [];
  return nodes.map((n) => {
    const info: any = { type: n.type, name: n.name, id: n.id };
    if ('width' in n) info.w = Math.round(n.width);
    if ('height' in n) info.h = Math.round(n.height);
    if ('x' in n) info.x = Math.round(n.x);
    if ('y' in n) info.y = Math.round(n.y);
    if ('layoutMode' in n && (n as any).layoutMode !== 'NONE')
      info.layout = (n as any).layoutMode;
    if ('primaryAxisSizingMode' in n)
      info.primarySizing = (n as any).primaryAxisSizingMode;
    if ('counterAxisSizingMode' in n)
      info.counterSizing = (n as any).counterAxisSizingMode;
    if ('itemSpacing' in n && (n as any).itemSpacing)
      info.gap = (n as any).itemSpacing;
    if ('paddingTop' in n && (n as any).paddingTop)
      info.pt = (n as any).paddingTop;
    if ('paddingBottom' in n && (n as any).paddingBottom)
      info.pb = (n as any).paddingBottom;
    if ('paddingLeft' in n && (n as any).paddingLeft)
      info.pl = (n as any).paddingLeft;
    if ('paddingRight' in n && (n as any).paddingRight)
      info.pr = (n as any).paddingRight;
    const fills = safeFills(n);
    if (fills) info.fills = fills;
    const strokes = safeStrokes(n);
    if (strokes) info.strokes = strokes;
    if ('opacity' in n && n.opacity < 1) info.opacity = n.opacity;
    if (
      'cornerRadius' in n &&
      (n as any).cornerRadius &&
      !isMixed((n as any).cornerRadius)
    )
      info.radius = (n as any).cornerRadius;
    if (n.type === 'TEXT') {
      const t = n as TextNode;
      info.txt = t.characters.substring(0, 60).replace(/\n/g, '\\n');
      if (!isMixed(t.fontSize)) info.fs = t.fontSize;
      if (!isMixed(t.fontName)) {
        const fn = t.fontName as FontName;
        info.font = { family: fn.family, style: fn.style };
      }
      info.autoResize = t.textAutoResize;
    }
    if ('children' in n) {
      info.kids = (n as any).children.length;
      info.children = scanNodes(
        (n as any).children as readonly SceneNode[],
        depth + 1,
        maxDepth
      );
    }
    if ('layoutPositioning' in n && (n as any).layoutPositioning === 'ABSOLUTE')
      info.absolute = true;
    return info;
  });
}
