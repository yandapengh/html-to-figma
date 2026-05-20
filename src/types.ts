export interface ExtractedStyle {
  display: string;
  position: string;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  flexWrap: string;
  gap: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  color: string;
  backgroundColor: string;
  backgroundImage: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: string;
  textDecoration: string;
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderRadius: number;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
  boxShadow: string;
  opacity: number;
  overflow: string;
  boxSizing: string;
  tagName: string;
}

export interface ExtractedNode {
  tag: string;
  children: ExtractedNode[];
  text: string;
  style: ExtractedStyle;
}

export interface FigmaNodeSpec {
  type: 'FRAME' | 'TEXT' | 'RECTANGLE' | 'VECTOR' | 'LINE' | 'GROUP';
  name: string;
  children?: FigmaNodeSpec[];
  layoutMode?: 'HORIZONTAL' | 'VERTICAL';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  layoutWrap?: 'WRAP';
  width?: number;
  height?: number;
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  characters?: string;
  fontSize?: number;
  fontName?: { family: string; style: string };
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  effects?: FigmaEffect[];
  opacity?: number;
  clipsContent?: boolean;
  x?: number;
  y?: number;
}

export interface FigmaFill {
  type: 'SOLID' | 'IMAGE';
  color?: { r: number; g: number; b: number; a: number };
  imageHash?: string;
  scaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
}

export interface FigmaStroke {
  type: 'SOLID';
  color: { r: number; g: number; b: number; a: number };
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW';
  color: { r: number; g: number; b: number; a: number };
  offset: { x: number; y: number };
  radius: number;
  spread?: number;
  visible: boolean;
  blendMode?: 'NORMAL' | 'MULTIPLY';
}

export type RgbColor = { r: number; g: number; b: number; a: number };
