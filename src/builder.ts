import { FigmaNodeSpec, FigmaFill, FigmaStroke, FigmaEffect } from './types';

export function applyFills(node: FrameNode | RectangleNode | TextNode, fills: FigmaFill[]): void {
  if (fills.length === 0) return;
  const figmaFills: Paint[] = fills.map(f => {
    if (f.type === 'SOLID' && f.color) {
      return { type: 'SOLID', color: f.color, opacity: f.color.a };
    }
    if (f.type === 'IMAGE' && f.imageHash) {
      return { type: 'IMAGE', scaleMode: f.scaleMode || 'FILL', imageHash: f.imageHash };
    }
    return { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
  });
  node.fills = figmaFills;
}

export function applyStrokes(node: FrameNode | RectangleNode, strokes: FigmaStroke[]): void {
  if (strokes.length === 0) return;
  node.strokes = strokes.map(s => ({ type: 'SOLID', color: s.color }));
  node.strokeWeight = strokes[0].weight || 1;
}

export function applyEffects(node: FrameNode | RectangleNode | TextNode, effects: FigmaEffect[]): void {
  if (effects.length === 0) return;
  const figmaEffects: Effect[] = effects.map(e => ({
    type: e.type,
    color: e.color,
    offset: e.offset,
    radius: e.radius,
    spread: e.spread,
    visible: e.visible,
    blendMode: e.blendMode || 'NORMAL',
  }));
  node.effects = figmaEffects;
}

type ResizableNode = FrameNode | RectangleNode | TextNode | VectorNode | LineNode | GroupNode;

export function createFigmaNode(spec: FigmaNodeSpec): ResizableNode {
  let node: ResizableNode;

  switch (spec.type) {
    case 'FRAME': {
      const frame = figma.createFrame();
      frame.name = spec.name;
      if (spec.layoutMode) frame.layoutMode = spec.layoutMode;
      if (spec.primaryAxisSizingMode) frame.primaryAxisSizingMode = spec.primaryAxisSizingMode;
      if (spec.counterAxisSizingMode) frame.counterAxisSizingMode = spec.counterAxisSizingMode;
      if (spec.primaryAxisAlignItems) frame.primaryAxisAlignItems = spec.primaryAxisAlignItems;
      if (spec.counterAxisAlignItems) frame.counterAxisAlignItems = spec.counterAxisAlignItems;
      if (spec.itemSpacing !== undefined) frame.itemSpacing = spec.itemSpacing;
      if (spec.paddingTop !== undefined) frame.paddingTop = spec.paddingTop;
      if (spec.paddingRight !== undefined) frame.paddingRight = spec.paddingRight;
      if (spec.paddingBottom !== undefined) frame.paddingBottom = spec.paddingBottom;
      if (spec.paddingLeft !== undefined) frame.paddingLeft = spec.paddingLeft;
      if (spec.layoutWrap) frame.layoutWrap = spec.layoutWrap;
      if (spec.clipsContent) frame.clipsContent = true;
      if (spec.cornerRadius !== undefined) frame.cornerRadius = spec.cornerRadius;
      if (spec.opacity !== undefined) frame.opacity = spec.opacity;
      if (spec.fills) applyFills(frame, spec.fills);
      if (spec.strokes) applyStrokes(frame, spec.strokes);
      if (spec.effects) applyEffects(frame, spec.effects);
      node = frame;
      break;
    }

    case 'TEXT': {
      const text = figma.createText();
      text.name = spec.name;
      if (spec.characters !== undefined) text.characters = spec.characters;
      if (spec.fontSize) text.fontSize = spec.fontSize;
      if (spec.fontName) text.fontName = spec.fontName as FontName;
      if (spec.lineHeight) text.lineHeight = spec.lineHeight as LineHeight;
      if (spec.letterSpacing) text.letterSpacing = spec.letterSpacing as LetterSpacing;
      if (spec.textAlignHorizontal) text.textAlignHorizontal = spec.textAlignHorizontal;
      if (spec.textDecoration) text.textDecoration = spec.textDecoration;
      if (spec.opacity !== undefined) text.opacity = spec.opacity;
      if (spec.fills) applyFills(text, spec.fills);
      node = text;
      break;
    }

    case 'RECTANGLE': {
      const rect = figma.createRectangle();
      rect.name = spec.name;
      if (spec.cornerRadius !== undefined) rect.cornerRadius = spec.cornerRadius;
      if (spec.rectangleCornerRadii) (rect as any).rectangleCornerRadii = spec.rectangleCornerRadii;
      if (spec.opacity !== undefined) rect.opacity = spec.opacity;
      if (spec.fills) applyFills(rect, spec.fills);
      if (spec.strokes) applyStrokes(rect, spec.strokes);
      if (spec.effects) applyEffects(rect, spec.effects);
      node = rect;
      break;
    }

    case 'VECTOR': {
      const vec = figma.createVector();
      vec.name = spec.name;
      node = vec;
      break;
    }

    case 'LINE': {
      const line = figma.createLine();
      line.name = spec.name;
      node = line;
      break;
    }

    case 'GROUP': {
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

export function buildFromSpec(root: FigmaNodeSpec): FrameNode {
  function build(spec: FigmaNodeSpec, parent: BaseNode & ChildrenMixin): SceneNode {
    const node = createFigmaNode(spec);

    if (spec.children && 'appendChild' in node) {
      for (const childSpec of spec.children) {
        build(childSpec, node as FrameNode);
      }
    }

    parent.appendChild(node);
    return node;
  }

  const rootFrame = figma.createFrame();
  rootFrame.name = root.name || 'Imported HTML';
  rootFrame.x = figma.viewport.center.x - ((root.width || 1440) / 2);
  rootFrame.y = figma.viewport.center.y - ((root.height || 900) / 2);

  if (root.layoutMode) {
    rootFrame.layoutMode = root.layoutMode;
    rootFrame.primaryAxisSizingMode = root.primaryAxisSizingMode || 'AUTO';
    rootFrame.counterAxisSizingMode = root.counterAxisSizingMode || 'AUTO';
    if (root.itemSpacing !== undefined) rootFrame.itemSpacing = root.itemSpacing;
    if (root.paddingTop !== undefined) rootFrame.paddingTop = root.paddingTop;
    if (root.paddingRight !== undefined) rootFrame.paddingRight = root.paddingRight;
    if (root.paddingBottom !== undefined) rootFrame.paddingBottom = root.paddingBottom;
    if (root.paddingLeft !== undefined) rootFrame.paddingLeft = root.paddingLeft;
  }

  if (root.width && root.height) {
    rootFrame.resize(root.width, root.height);
  }

  if (root.cornerRadius !== undefined) rootFrame.cornerRadius = root.cornerRadius;
  if (root.opacity !== undefined) rootFrame.opacity = root.opacity;
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
