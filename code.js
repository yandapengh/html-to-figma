"use strict";
(() => {
  // code.ts
  figma.showUI(__html__, { width: 320, height: 520 });
  var defaultFont = { family: "Roboto", style: "Regular" };
  var fontCache = {};
  var normalizeName = (str) => str.toLowerCase().replace(/[^a-z]/gi, "");
  async function getMatchingFont(fontStr, availableFonts) {
    const familySplit = fontStr.split(/\s*,\s*/);
    for (const family of familySplit) {
      const normalized = normalizeName(family.replace(/['"]/g, "").trim());
      if (!normalized) continue;
      const cached = fontCache[normalized];
      if (cached) return cached;
      for (const availableFont of availableFonts) {
        const normalizedAvailable = normalizeName(availableFont.fontName.family);
        if (normalizedAvailable === normalized) {
          await figma.loadFontAsync(availableFont.fontName);
          fontCache[normalized] = availableFont.fontName;
          fontCache[fontStr] = availableFont.fontName;
          return availableFont.fontName;
        }
      }
    }
    return defaultFont;
  }
  function isImageFill(fill) {
    return fill.type === "IMAGE";
  }
  function processImages(layer) {
    const fills = layer.fills;
    if (!fills) return Promise.resolve();
    const imageFills = fills.filter(isImageFill);
    if (!imageFills.length) return Promise.resolve();
    return Promise.all(
      imageFills.map(async (fill) => {
        const imgFill = fill;
        if (imgFill.imageHash) {
          const image = figma.getImageByHash(imgFill.imageHash);
          if (image) {
            try {
              const bytes = await image.getBytesAsync();
              imgFill.intArr = bytes;
            } catch (err) {
              console.warn("Could not get image for layer", err);
            }
          }
        }
      })
    );
  }
  async function traverseLayers(layer, cb, parent = null) {
    if (layer) {
      await cb(layer, parent);
    }
    const children = layer.children;
    if (children) {
      for (const child of children) {
        await traverseLayers(child, cb, layer);
      }
    }
  }
  function assign(a, b) {
    var _a, _b;
    for (const key in b) {
      const value = b[key];
      if (key === "data" && value && typeof value === "object") {
        const currentData = JSON.parse(((_a = a.getSharedPluginData) == null ? void 0 : _a.call(a, "builder", "data")) || "{}") || {};
        const mergedData = Object.assign({}, currentData, value);
        (_b = a.setSharedPluginData) == null ? void 0 : _b.call(a, "builder", "data", JSON.stringify(mergedData));
      } else if (typeof value !== "undefined" && ["width", "height", "type", "ref", "children", "svg", "fontFamily"].indexOf(key) === -1) {
        try {
          a[key] = value;
        } catch (err) {
          console.warn('Assign error for property "' + key + '"', err);
        }
      }
    }
  }
  function postSelection() {
    figma.ui.postMessage({
      type: "selectionChange",
      elements: figma.currentPage.selection.map((el) => ({
        id: el.id,
        type: el.type,
        name: el.name
      }))
    });
  }
  figma.on("selectionchange", () => {
    postSelection();
  });
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "resize") {
      figma.ui.resize(msg.width, msg.height);
    }
    if (msg.type === "init") {
      postSelection();
    }
    if (msg.type === "import") {
      const { data } = msg;
      const { layers } = data;
      if (!layers || !layers.length) {
        figma.notify("No layers to import", { error: true });
        return;
      }
      try {
        const availableFonts = (await figma.listAvailableFontsAsync()).filter(
          (font) => font.fontName.style === "Regular"
        );
        await figma.loadFontAsync(defaultFont);
        const rects = [];
        let baseFrame = figma.currentPage;
        let frameRoot = baseFrame;
        for (const rootLayer of layers) {
          await traverseLayers(rootLayer, async (layer, parent) => {
            try {
              if (layer.type === "FRAME" || layer.type === "GROUP") {
                const frame = figma.createFrame();
                frame.x = layer.x || 0;
                frame.y = layer.y || 0;
                frame.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
                assign(frame, layer);
                rects.push(frame);
                (parent && parent.ref || baseFrame).appendChild(frame);
                layer.ref = frame;
                if (!parent) {
                  frameRoot = frame;
                  baseFrame = frame;
                }
              } else if (layer.type === "SVG") {
                const node = figma.createNodeFromSvg(layer.svg);
                node.x = layer.x || 0;
                node.y = layer.y || 0;
                node.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
                layer.ref = node;
                rects.push(node);
                assign(node, layer);
                (parent && parent.ref || baseFrame).appendChild(node);
              } else if (layer.type === "RECTANGLE") {
                const rect = figma.createRectangle();
                const fills = layer.fills;
                if (fills && fills.some(isImageFill)) {
                  await processImages(layer);
                }
                assign(rect, layer);
                rect.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
                rects.push(rect);
                layer.ref = rect;
                (parent && parent.ref || baseFrame).appendChild(rect);
              } else if (layer.type === "TEXT") {
                const text = figma.createText();
                const layerFontFamily = layer.fontFamily;
                if (layerFontFamily) {
                  const family = await getMatchingFont(layerFontFamily, availableFonts);
                  text.fontName = family;
                }
                assign(text, layer);
                layer.ref = text;
                text.resize(Math.max(layer.width || 1, 1), Math.max(layer.height || 1, 1));
                text.textAutoResize = "HEIGHT";
                const lineHeight = layer.lineHeight && layer.lineHeight.value || layer.height || 16;
                let adjustments = 0;
                while (typeof text.fontSize === "number" && typeof layer.fontSize === "number" && (text.height > Math.max(layer.height || 0, lineHeight) * 1.2 || text.width > (layer.width || 0) * 1.2)) {
                  if (adjustments++ > (layer.fontSize || 16) * 0.3) {
                    console.warn("Too many font adjustments", text, layer);
                    break;
                  }
                  try {
                    text.fontSize = text.fontSize - 1;
                  } catch (err) {
                    console.warn("Error on resize text:", layer, text, err);
                  }
                }
                rects.push(text);
                (parent && parent.ref || baseFrame).appendChild(text);
              }
            } catch (err) {
              console.warn("Error on layer:", layer, err);
            }
          });
        }
        if (frameRoot.type === "FRAME") {
          figma.currentPage.selection = [frameRoot];
        }
        figma.ui.postMessage({
          type: "doneLoading",
          rootId: frameRoot.id
        });
        figma.viewport.scrollAndZoomIntoView([frameRoot]);
        if (false) {
          figma.closePlugin();
        }
      } catch (err) {
        const msg2 = typeof err === "string" ? err : err instanceof Error ? err.message : JSON.stringify(err);
        console.error("[DEBUG] Import error:", err);
        figma.notify("Error: " + msg2, { error: true });
      }
    }
    if (msg.type === "close") {
      figma.closePlugin();
    }
    if (msg.type === "error") {
      figma.notify(msg.error || "Unknown error", { error: true });
    }
    if (msg.type === "extract-canvas") {
      try {
        const nodes = figma.currentPage.children;
        const result = scanNodes(nodes, 0, 12);
        figma.ui.postMessage({ type: "canvas-data", data: result });
      } catch (err) {
        figma.ui.postMessage({ type: "canvas-data", error: String(err) });
      }
    }
  };
  function isMixed(v) {
    return v === figma.mixed;
  }
  function safeFills(n) {
    const fills = n.fills;
    if (!fills || isMixed(fills) || !Array.isArray(fills) || fills.length === 0) return null;
    return fills.map((f) => {
      var _a;
      if (f.type === "SOLID")
        return {
          type: "SOLID",
          color: {
            r: f.color.r.toFixed(2),
            g: f.color.g.toFixed(2),
            b: f.color.b.toFixed(2),
            a: (_a = f.opacity) != null ? _a : 1
          }
        };
      return { type: f.type };
    });
  }
  function safeStrokes(n) {
    const s = n.strokes;
    if (!s || isMixed(s) || !Array.isArray(s) || s.length === 0) return null;
    return s.length;
  }
  function scanNodes(nodes, depth, maxDepth) {
    if (depth > maxDepth) return [];
    return nodes.map((n) => {
      const info = { type: n.type, name: n.name, id: n.id };
      if ("width" in n) info.w = Math.round(n.width);
      if ("height" in n) info.h = Math.round(n.height);
      if ("x" in n) info.x = Math.round(n.x);
      if ("y" in n) info.y = Math.round(n.y);
      if ("layoutMode" in n && n.layoutMode !== "NONE")
        info.layout = n.layoutMode;
      if ("primaryAxisSizingMode" in n)
        info.primarySizing = n.primaryAxisSizingMode;
      if ("counterAxisSizingMode" in n)
        info.counterSizing = n.counterAxisSizingMode;
      if ("itemSpacing" in n && n.itemSpacing)
        info.gap = n.itemSpacing;
      if ("paddingTop" in n && n.paddingTop)
        info.pt = n.paddingTop;
      if ("paddingBottom" in n && n.paddingBottom)
        info.pb = n.paddingBottom;
      if ("paddingLeft" in n && n.paddingLeft)
        info.pl = n.paddingLeft;
      if ("paddingRight" in n && n.paddingRight)
        info.pr = n.paddingRight;
      const fills = safeFills(n);
      if (fills) info.fills = fills;
      const strokes = safeStrokes(n);
      if (strokes) info.strokes = strokes;
      if ("opacity" in n && n.opacity < 1) info.opacity = n.opacity;
      if ("cornerRadius" in n && n.cornerRadius && !isMixed(n.cornerRadius))
        info.radius = n.cornerRadius;
      if (n.type === "TEXT") {
        const t = n;
        info.txt = t.characters.substring(0, 60).replace(/\n/g, "\\n");
        if (!isMixed(t.fontSize)) info.fs = t.fontSize;
        if (!isMixed(t.fontName)) {
          const fn = t.fontName;
          info.font = { family: fn.family, style: fn.style };
        }
        info.autoResize = t.textAutoResize;
      }
      if ("children" in n) {
        info.kids = n.children.length;
        info.children = scanNodes(
          n.children,
          depth + 1,
          maxDepth
        );
      }
      if ("layoutPositioning" in n && n.layoutPositioning === "ABSOLUTE")
        info.absolute = true;
      return info;
    });
  }
})();
