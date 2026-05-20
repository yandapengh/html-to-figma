"use strict";
(() => {
  // src/utils.ts
  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    if (!/^[0-9a-fA-F]{3,8}$/.test(clean) || clean.length !== 3 && clean.length !== 6 && clean.length !== 8) {
      return null;
    }
    if (clean.length === 3) {
      const r2 = parseInt(clean[0] + clean[0], 16) / 255;
      const g2 = parseInt(clean[1] + clean[1], 16) / 255;
      const b2 = parseInt(clean[2] + clean[2], 16) / 255;
      return { r: r2, g: g2, b: b2, a: 1 };
    }
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const a = clean.length === 8 ? parseInt(clean.substring(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  function parseColor(color) {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
    if (color.startsWith("#")) return hexToRgb(color);
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]) / 255,
        g: parseInt(rgbaMatch[2]) / 255,
        b: parseInt(rgbaMatch[3]) / 255,
        a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
      };
    }
    return null;
  }
  function parseBoxShadow(shadow) {
    if (!shadow || shadow === "none") return null;
    const parts = [];
    let depth = 0;
    let current = "";
    for (let i = 0; i < shadow.length; i++) {
      const ch = shadow[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current.trim());
    const effects = [];
    for (const part of parts) {
      const inset = part.includes("inset");
      const clean = part.replace("inset", "").trim();
      const values = [];
      const pxRegex = /([-]?\d*\.?\d+)px/g;
      let m;
      while ((m = pxRegex.exec(clean)) !== null) {
        values.push(parseFloat(m[1]));
      }
      if (values.length < 3) continue;
      const offsetX = values[0];
      const offsetY = values[1];
      const blur = values[2];
      const spread = values.length >= 4 ? values[3] : 0;
      const colorMatch = clean.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]+|[a-z]+)(?:\s*$|$)/);
      const color = colorMatch ? parseColor(colorMatch[1]) : null;
      if (!color) continue;
      effects.push({
        type: inset ? "INNER_SHADOW" : "DROP_SHADOW",
        color,
        offset: { x: offsetX, y: offsetY },
        radius: blur,
        spread,
        visible: true,
        blendMode: "NORMAL"
      });
    }
    return effects.length > 0 ? effects : null;
  }

  // src/mapper.ts
  var TEXT_TAGS = /* @__PURE__ */ new Set(["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "a", "li", "label", "strong", "em", "b", "i", "small", "code", "pre", "blockquote"]);
  function mapNodeType(tag) {
    if (tag === "svg") return "VECTOR";
    if (tag === "img") return "RECTANGLE";
    if (tag === "hr") return "LINE";
    if (TEXT_TAGS.has(tag)) return "TEXT";
    if (tag === "input" || tag === "textarea" || tag === "select") return "RECTANGLE";
    if (tag === "button") return "FRAME";
    return "FRAME";
  }
  function mapLayoutMode(style) {
    if (style.display === "flex" || style.display === "inline-flex") {
      if (style.flexDirection === "row" || style.flexDirection === "row-reverse") return "HORIZONTAL";
      if (style.flexDirection === "column" || style.flexDirection === "column-reverse") return "VERTICAL";
      return "HORIZONTAL";
    }
    if (style.display === "grid") return "HORIZONTAL";
    if (style.display === "block" || style.display === "inline-block") return "VERTICAL";
    return void 0;
  }
  function mapJustifyContent(value) {
    switch (value) {
      case "flex-start":
      case "start":
        return "MIN";
      case "flex-end":
      case "end":
        return "MAX";
      case "center":
        return "CENTER";
      case "space-between":
        return "SPACE_BETWEEN";
      case "space-around":
      case "space-evenly":
        return "SPACE_BETWEEN";
      default:
        return "MIN";
    }
  }
  function mapAlignItems(value) {
    switch (value) {
      case "flex-start":
      case "start":
        return "MIN";
      case "flex-end":
      case "end":
        return "MAX";
      case "center":
        return "CENTER";
      case "baseline":
        return "MIN";
      default:
        return "MIN";
    }
  }
  function mapSizingMode(style) {
    const isFlex = style.display === "flex" || style.display === "inline-flex";
    return {
      primaryAxisSizingMode: isFlex ? "AUTO" : "FIXED",
      counterAxisSizingMode: isFlex ? "AUTO" : "FIXED"
    };
  }
  function mapFills(bgColor) {
    const fills = [];
    const parsed = parseColor(bgColor);
    if (parsed) {
      fills.push({ type: "SOLID", color: parsed });
    }
    return fills;
  }
  function mapStrokes(style) {
    const w = Math.max(style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth);
    if (w <= 0) return [];
    const color = parseColor(style.borderTopColor) || parseColor(style.borderRightColor) || parseColor(style.borderBottomColor) || parseColor(style.borderLeftColor);
    if (!color) return [];
    return [{ type: "SOLID", color, weight: w }];
  }
  function mapCornerRadius(style) {
    return style.borderRadius || 0;
  }
  function mapEffects(style) {
    const shadowEffects = parseBoxShadow(style.boxShadow);
    if (shadowEffects) return shadowEffects;
    return [];
  }
  function mapDimensions(style) {
    const dim = {};
    if (style.width > 0) dim.width = style.width;
    if (style.height > 0) dim.height = style.height;
    return dim;
  }
  function fontWeightToStyle(weight, fontStyle) {
    if (fontStyle === "italic") return "Italic";
    if (weight >= 800) return "Extra Bold";
    if (weight >= 700) return "Bold";
    if (weight >= 600) return "Semi Bold";
    if (weight >= 500) return "Medium";
    return "Regular";
  }
  function mapTextStyle(style) {
    const color = parseColor(style.color);
    return {
      fontSize: style.fontSize,
      fontName: {
        family: style.fontFamily,
        style: fontWeightToStyle(style.fontWeight, style.fontStyle)
      },
      // getComputedStyle always returns line-height in pixels; unitless values are already resolved
      lineHeight: { value: style.lineHeight, unit: "PIXELS" },
      letterSpacing: { value: style.letterSpacing, unit: "PIXELS" },
      textAlignHorizontal: style.textAlign === "center" ? "CENTER" : style.textAlign === "right" ? "RIGHT" : "LEFT",
      textDecoration: style.textDecoration.includes("underline") ? "UNDERLINE" : style.textDecoration.includes("line-through") ? "STRIKETHROUGH" : "NONE",
      fills: color ? [{ type: "SOLID", color }] : void 0
    };
  }
  function isContainer(tag, style) {
    const isTextTag = TEXT_TAGS.has(tag);
    if (isTextTag) return false;
    if (tag === "img" || tag === "svg" || tag === "hr" || tag === "br") return false;
    if (tag === "input" || tag === "textarea" || tag === "select") return false;
    return true;
  }
  function mapToFigmaSpec(node) {
    const type = mapNodeType(node.tag);
    const style = node.style;
    const spec = { type, name: node.tag };
    if (isContainer(node.tag, style)) {
      spec.layoutMode = mapLayoutMode(style);
      if (spec.layoutMode) {
        spec.primaryAxisAlignItems = mapJustifyContent(style.justifyContent);
        spec.counterAxisAlignItems = mapAlignItems(style.alignItems);
        const sizing = mapSizingMode(style);
        spec.primaryAxisSizingMode = sizing.primaryAxisSizingMode;
        spec.counterAxisSizingMode = sizing.counterAxisSizingMode;
        if (style.gap > 0) spec.itemSpacing = style.gap;
        if (style.flexWrap === "wrap") spec.layoutWrap = "WRAP";
      }
      if (style.paddingTop > 0) spec.paddingTop = style.paddingTop;
      if (style.paddingRight > 0) spec.paddingRight = style.paddingRight;
      if (style.paddingBottom > 0) spec.paddingBottom = style.paddingBottom;
      if (style.paddingLeft > 0) spec.paddingLeft = style.paddingLeft;
    }
    const dims = mapDimensions(style);
    if (dims.width) spec.width = dims.width;
    if (dims.height) spec.height = dims.height;
    if (type !== "TEXT") {
      spec.fills = mapFills(style.backgroundColor);
    }
    if (type === "FRAME" || type === "RECTANGLE") {
      spec.strokes = mapStrokes(style);
    }
    if (type === "FRAME" || type === "RECTANGLE") {
      const r = mapCornerRadius(style);
      if (r > 0) spec.cornerRadius = r;
    }
    const effects = mapEffects(style);
    if (effects.length > 0) spec.effects = effects;
    if (style.opacity < 1) spec.opacity = style.opacity;
    if (style.overflow === "hidden") spec.clipsContent = true;
    if (type === "TEXT") {
      spec.characters = node.text || "";
      Object.assign(spec, mapTextStyle(style));
    }
    if (node.children.length > 0) {
      spec.children = node.children.map((child) => mapToFigmaSpec(child));
    }
    return spec;
  }

  // src/builder.ts
  function applyFills(node, fills) {
    if (fills.length === 0) return;
    const figmaFills = fills.map((f) => {
      if (f.type === "SOLID" && f.color) {
        return {
          type: "SOLID",
          color: { r: f.color.r, g: f.color.g, b: f.color.b },
          opacity: f.color.a
        };
      }
      if (f.type === "IMAGE" && f.imageHash) {
        return { type: "IMAGE", scaleMode: f.scaleMode || "FILL", imageHash: f.imageHash };
      }
      return { type: "SOLID", color: { r: 0, g: 0, b: 0 } };
    });
    node.fills = figmaFills;
  }
  function applyStrokes(node, strokes) {
    if (strokes.length === 0) return;
    node.strokes = strokes.map((s) => ({ type: "SOLID", color: s.color }));
    node.strokeWeight = strokes[0].weight || 1;
  }
  function applyEffects(node, effects) {
    if (effects.length === 0) return;
    const figmaEffects = effects.map((e) => ({
      type: e.type,
      color: e.color,
      offset: e.offset,
      radius: e.radius,
      spread: e.spread,
      visible: e.visible,
      blendMode: e.blendMode || "NORMAL"
    }));
    node.effects = figmaEffects;
  }
  function createFigmaNode(spec) {
    let node;
    switch (spec.type) {
      case "FRAME": {
        const frame = figma.createFrame();
        frame.name = spec.name;
        if (spec.layoutMode) frame.layoutMode = spec.layoutMode;
        if (spec.primaryAxisSizingMode) frame.primaryAxisSizingMode = spec.primaryAxisSizingMode;
        if (spec.counterAxisSizingMode) frame.counterAxisSizingMode = spec.counterAxisSizingMode;
        if (spec.primaryAxisAlignItems) frame.primaryAxisAlignItems = spec.primaryAxisAlignItems;
        if (spec.counterAxisAlignItems) frame.counterAxisAlignItems = spec.counterAxisAlignItems;
        if (spec.itemSpacing !== void 0) frame.itemSpacing = spec.itemSpacing;
        if (spec.paddingTop !== void 0) frame.paddingTop = spec.paddingTop;
        if (spec.paddingRight !== void 0) frame.paddingRight = spec.paddingRight;
        if (spec.paddingBottom !== void 0) frame.paddingBottom = spec.paddingBottom;
        if (spec.paddingLeft !== void 0) frame.paddingLeft = spec.paddingLeft;
        if (spec.layoutWrap) frame.layoutWrap = spec.layoutWrap;
        if (spec.clipsContent) frame.clipsContent = true;
        if (spec.cornerRadius !== void 0) frame.cornerRadius = spec.cornerRadius;
        if (spec.opacity !== void 0) frame.opacity = spec.opacity;
        if (spec.fills) applyFills(frame, spec.fills);
        if (spec.strokes) applyStrokes(frame, spec.strokes);
        if (spec.effects) applyEffects(frame, spec.effects);
        node = frame;
        break;
      }
      case "TEXT": {
        const text = figma.createText();
        text.name = spec.name;
        if (spec.characters !== void 0) text.characters = spec.characters;
        if (spec.fontSize) text.fontSize = spec.fontSize;
        if (spec.fontName) text.fontName = spec.fontName;
        if (spec.lineHeight) text.lineHeight = spec.lineHeight;
        if (spec.letterSpacing) text.letterSpacing = spec.letterSpacing;
        if (spec.textAlignHorizontal) text.textAlignHorizontal = spec.textAlignHorizontal;
        if (spec.textDecoration) text.textDecoration = spec.textDecoration;
        if (spec.opacity !== void 0) text.opacity = spec.opacity;
        if (spec.fills) applyFills(text, spec.fills);
        node = text;
        break;
      }
      case "RECTANGLE": {
        const rect = figma.createRectangle();
        rect.name = spec.name;
        if (spec.cornerRadius !== void 0) rect.cornerRadius = spec.cornerRadius;
        if (spec.rectangleCornerRadii) rect.rectangleCornerRadii = spec.rectangleCornerRadii;
        if (spec.opacity !== void 0) rect.opacity = spec.opacity;
        if (spec.fills) applyFills(rect, spec.fills);
        if (spec.strokes) applyStrokes(rect, spec.strokes);
        if (spec.effects) applyEffects(rect, spec.effects);
        node = rect;
        break;
      }
      case "VECTOR": {
        const vec = figma.createVector();
        vec.name = spec.name;
        node = vec;
        break;
      }
      case "LINE": {
        const line = figma.createLine();
        line.name = spec.name;
        node = line;
        break;
      }
      case "GROUP": {
        const frame = figma.createFrame();
        frame.name = spec.name;
        node = frame;
        break;
      }
      default:
        node = figma.createFrame();
        node.name = spec.name;
    }
    if (spec.width && spec.height) {
      node.resize(spec.width, spec.height);
    } else if (spec.width) {
      node.resize(spec.width, node.height);
    } else if (spec.height) {
      node.resize(node.width, spec.height);
    }
    return node;
  }
  function buildFromSpec(root) {
    function build(spec, parent) {
      const node = createFigmaNode(spec);
      if (spec.children && "appendChild" in node) {
        for (const childSpec of spec.children) {
          build(childSpec, node);
        }
      }
      parent.appendChild(node);
      return node;
    }
    const rootFrame = figma.createFrame();
    rootFrame.name = root.name || "Imported HTML";
    rootFrame.x = figma.viewport.center.x - (root.width || 1440) / 2;
    rootFrame.y = figma.viewport.center.y - (root.height || 900) / 2;
    if (root.layoutMode) {
      rootFrame.layoutMode = root.layoutMode;
      rootFrame.primaryAxisSizingMode = root.primaryAxisSizingMode || "AUTO";
      rootFrame.counterAxisSizingMode = root.counterAxisSizingMode || "AUTO";
      if (root.itemSpacing !== void 0) rootFrame.itemSpacing = root.itemSpacing;
      if (root.paddingTop !== void 0) rootFrame.paddingTop = root.paddingTop;
      if (root.paddingRight !== void 0) rootFrame.paddingRight = root.paddingRight;
      if (root.paddingBottom !== void 0) rootFrame.paddingBottom = root.paddingBottom;
      if (root.paddingLeft !== void 0) rootFrame.paddingLeft = root.paddingLeft;
    }
    if (root.width && root.height) {
      rootFrame.resize(root.width, root.height);
    }
    if (root.cornerRadius !== void 0) rootFrame.cornerRadius = root.cornerRadius;
    if (root.opacity !== void 0) rootFrame.opacity = root.opacity;
    if (root.clipsContent) rootFrame.clipsContent = true;
    if (root.strokes) applyStrokes(rootFrame, root.strokes);
    if (root.effects) applyEffects(rootFrame, root.effects);
    if (root.fills) applyFills(rootFrame, root.fills);
    if (root.children) {
      for (const childSpec of root.children) {
        build(childSpec, rootFrame);
      }
    }
    return rootFrame;
  }

  // code.ts
  figma.showUI(__html__, { width: 320, height: 520 });
  function collectFonts(spec) {
    const fonts = [];
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
  function dedupeFonts(fonts) {
    const seen = /* @__PURE__ */ new Set();
    return fonts.filter((f) => {
      const key = `${f.family}|${f.style}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "generate-from-node") {
      if (!msg.node) {
        figma.notify("Error: No node data received");
        return;
      }
      try {
        const spec = mapToFigmaSpec(msg.node);
        const fonts = dedupeFonts(collectFonts(spec));
        await Promise.all(fonts.map((f) => figma.loadFontAsync(f)));
        const frame = buildFromSpec(spec);
        figma.currentPage.appendChild(frame);
        figma.viewport.scrollAndZoomIntoView([frame]);
        figma.notify("HTML imported successfully!");
      } catch (err) {
        figma.notify("Error: " + err.message, { error: true });
      }
    }
    if (msg.type === "close") {
      figma.closePlugin();
    }
    if (msg.type === "error") {
      figma.notify(msg.error || "Unknown error", { error: true });
    }
  };
})();
