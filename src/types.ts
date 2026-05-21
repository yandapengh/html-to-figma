// Types for the HTML-to-Figma conversion pipeline.
// Mirrors the LayerNode structure from BuilderIO/html-to-figma reference impl.

export type LayerNode = RectangleLayer | TextLayer | SvgLayer | FrameLayer;

export interface RectangleLayer {
  type: 'RECTANGLE';
  x: number;
  y: number;
  width: number;
  height: number;
  fills?: Paint[];
  strokes?: SolidPaint[];
  strokeWeight?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
  effects?: ShadowEffect[];
  opacity?: number;
  ref?: Element;
}

export interface TextLayer {
  type: 'TEXT';
  x: number;
  y: number;
  width: number;
  height: number;
  characters: string;
  fills?: SolidPaint[];
  fontSize?: number;
  fontFamily?: string; // raw CSS font-family string, resolved in code.ts
  fontWeight?: number;
  lineHeight?: { unit: 'PIXELS'; value: number };
  letterSpacing?: { unit: 'PIXELS'; value: number };
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textDecoration?: 'UNDERLINE' | 'STRIKETHROUGH';
  textCase?: 'UPPER' | 'LOWER' | 'TITLE';
  opacity?: number;
  ref?: Node;
}

export interface SvgLayer {
  type: 'SVG';
  x: number;
  y: number;
  width: number;
  height: number;
  svg: string;
  ref?: Element;
}

export interface FrameLayer {
  type: 'FRAME' | 'GROUP';
  x: number;
  y: number;
  width: number;
  height: number;
  children?: LayerNode[];
  clipsContent?: boolean;
  constraints?: {
    horizontal: 'MIN' | 'CENTER' | 'MAX' | 'SCALE';
    vertical: 'MIN' | 'CENTER' | 'MAX' | 'SCALE';
  };
  ref?: Element;
  backgrounds?: Paint[];
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
}

export interface SolidPaint {
  type: 'SOLID';
  color: { r: number; g: number; b: number };
  opacity?: number;
}

export interface ImagePaint {
  type: 'IMAGE';
  url?: string;
  imageHash?: string | null;
  scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE';
  intArr?: Uint8Array;
}

export type Paint = SolidPaint | ImagePaint;

export interface ShadowEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW';
  color: { r: number; g: number; b: number; a: number };
  offset: { x: number; y: number };
  radius: number;
  spread?: number;
  visible: boolean;
  blendMode: string;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Message payload from UI to plugin main thread
export interface ImportPayload {
  layers: LayerNode[];
}
