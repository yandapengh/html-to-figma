import { ExtractedStyle, ExtractedNode, FigmaNodeSpec, FigmaFill, FigmaStroke, FigmaEffect } from './types';
import { parseColor, parseBoxShadow } from './utils';

const TEXT_TAGS = new Set(['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'li', 'label', 'strong', 'em', 'b', 'i', 'small', 'code', 'pre', 'blockquote']);

export function mapNodeType(tag: string): FigmaNodeSpec['type'] {
  if (tag === 'svg') return 'VECTOR';
  if (tag === 'img') return 'RECTANGLE';
  if (tag === 'hr') return 'LINE';
  if (TEXT_TAGS.has(tag)) return 'TEXT';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'RECTANGLE';
  if (tag === 'button') return 'FRAME';
  return 'FRAME';
}

export function mapLayoutMode(style: ExtractedStyle): FigmaNodeSpec['layoutMode'] {
  if (style.display === 'flex' || style.display === 'inline-flex') {
    if (style.flexDirection === 'row' || style.flexDirection === 'row-reverse') return 'HORIZONTAL';
    if (style.flexDirection === 'column' || style.flexDirection === 'column-reverse') return 'VERTICAL';
    return 'HORIZONTAL';
  }
  if (style.display === 'grid') return 'HORIZONTAL';
  return undefined;
}

export function mapJustifyContent(value: string): FigmaNodeSpec['primaryAxisAlignItems'] {
  switch (value) {
    case 'flex-start': case 'start': return 'MIN';
    case 'flex-end': case 'end': return 'MAX';
    case 'center': return 'CENTER';
    case 'space-between': return 'SPACE_BETWEEN';
    case 'space-around': case 'space-evenly': return 'SPACE_BETWEEN';
    default: return 'MIN';
  }
}

export function mapAlignItems(value: string): FigmaNodeSpec['counterAxisAlignItems'] {
  switch (value) {
    case 'flex-start': case 'start': return 'MIN';
    case 'flex-end': case 'end': return 'MAX';
    case 'center': return 'CENTER';
    case 'baseline': return 'MIN';
    default: return 'MIN';
  }
}

export function mapSizingMode(style: ExtractedStyle): {
  primaryAxisSizingMode: 'FIXED' | 'AUTO';
  counterAxisSizingMode: 'FIXED' | 'AUTO';
} {
  const isFlex = style.display === 'flex' || style.display === 'inline-flex';
  return {
    primaryAxisSizingMode: isFlex ? 'AUTO' : 'FIXED',
    counterAxisSizingMode: isFlex ? 'AUTO' : 'FIXED',
  };
}

export function mapFills(textColor: string, bgColor: string, bgImage: string): FigmaFill[] {
  const fills: FigmaFill[] = [];
  const parsed = parseColor(bgColor);
  if (parsed) {
    fills.push({ type: 'SOLID', color: parsed });
  }
  return fills;
}

export function mapStrokes(style: ExtractedStyle): FigmaStroke[] {
  const w = Math.max(style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth);
  if (w <= 0) return [];
  const color = parseColor(style.borderTopColor) || parseColor(style.borderRightColor) ||
    parseColor(style.borderBottomColor) || parseColor(style.borderLeftColor);
  if (!color) return [];
  return [{ type: 'SOLID', color }];
}

export function mapCornerRadius(style: ExtractedStyle): number {
  return style.borderRadius || 0;
}

export function mapEffects(style: ExtractedStyle): FigmaEffect[] {
  const shadowEffects = parseBoxShadow(style.boxShadow);
  if (shadowEffects) return shadowEffects;
  return [];
}

export function mapDimensions(style: ExtractedStyle): { width?: number; height?: number } {
  const dim: { width?: number; height?: number } = {};
  if (style.width > 0) dim.width = style.width;
  if (style.height > 0) dim.height = style.height;
  return dim;
}

export function mapTextStyle(style: ExtractedStyle): {
  fontSize?: number;
  fontName?: { family: string; style: string };
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  fills?: FigmaFill[];
} {
  const color = parseColor(style.color);
  return {
    fontSize: style.fontSize,
    fontName: {
      family: style.fontFamily,
      style: style.fontWeight >= 700 ? 'Bold' : style.fontStyle === 'italic' ? 'Italic' : 'Regular',
    },
    lineHeight: { value: style.lineHeight, unit: 'PIXELS' },
    letterSpacing: { value: style.letterSpacing, unit: 'PIXELS' },
    textAlignHorizontal: style.textAlign === 'center' ? 'CENTER' : style.textAlign === 'right' ? 'RIGHT' : 'LEFT',
    textDecoration: style.textDecoration.includes('underline') ? 'UNDERLINE' : style.textDecoration.includes('line-through') ? 'STRIKETHROUGH' : 'NONE',
    fills: color ? [{ type: 'SOLID', color }] : undefined,
  };
}

export function isContainer(tag: string, style: ExtractedStyle): boolean {
  const isTextTag = TEXT_TAGS.has(tag);
  if (isTextTag) return false;
  if (tag === 'img' || tag === 'svg' || tag === 'hr' || tag === 'br') return false;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
  return true;
}

export function mapToFigmaSpec(node: ExtractedNode): FigmaNodeSpec {
  const type = mapNodeType(node.tag);
  const style = node.style;
  const spec: FigmaNodeSpec = { type, name: node.tag };

  if (isContainer(node.tag, style)) {
    spec.layoutMode = mapLayoutMode(style);
    if (spec.layoutMode) {
      spec.primaryAxisAlignItems = mapJustifyContent(style.justifyContent);
      spec.counterAxisAlignItems = mapAlignItems(style.alignItems);
      const sizing = mapSizingMode(style);
      spec.primaryAxisSizingMode = sizing.primaryAxisSizingMode;
      spec.counterAxisSizingMode = sizing.counterAxisSizingMode;
      if (style.gap > 0) spec.itemSpacing = style.gap;
      if (style.flexWrap === 'wrap') spec.layoutWrap = 'WRAP';
    }
    if (style.paddingTop > 0) spec.paddingTop = style.paddingTop;
    if (style.paddingRight > 0) spec.paddingRight = style.paddingRight;
    if (style.paddingBottom > 0) spec.paddingBottom = style.paddingBottom;
    if (style.paddingLeft > 0) spec.paddingLeft = style.paddingLeft;
  }

  const dims = mapDimensions(style);
  if (dims.width) spec.width = dims.width;
  if (dims.height) spec.height = dims.height;

  if (type !== 'TEXT') {
    spec.fills = mapFills(style.color, style.backgroundColor, style.backgroundImage);
  }

  if (type === 'FRAME' || type === 'RECTANGLE') {
    spec.strokes = mapStrokes(style);
  }

  if (type === 'FRAME' || type === 'RECTANGLE') {
    const r = mapCornerRadius(style);
    if (r > 0) spec.cornerRadius = r;
  }

  const effects = mapEffects(style);
  if (effects.length > 0) spec.effects = effects;

  if (style.opacity < 1) spec.opacity = style.opacity;
  if (style.overflow === 'hidden') spec.clipsContent = true;

  if (type === 'TEXT') {
    spec.characters = node.text || '';
    Object.assign(spec, mapTextStyle(style));
  }

  if (node.children.length > 0) {
    spec.children = node.children.map(child => mapToFigmaSpec(child));
  }

  return spec;
}
