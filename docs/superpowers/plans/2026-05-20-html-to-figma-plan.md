# HTML to Figma Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Figma Plugin that converts AI-generated static HTML into Figma Auto Layout frames with high fidelity, stripping all animations and interactions.

**Architecture:** Plugin UI iframe renders HTML in a hidden iframe → `getComputedStyle()` extracts resolved styles → builds an `ExtractedNode` tree → sends via `postMessage` to code side → `mapper.ts` converts CSS to Figma properties → `builder.ts` creates Figma nodes recursively.

**Tech Stack:** Figma Plugin API, TypeScript, Vitest + jsdom (testing), zero runtime dependencies.

---

## File Structure

```
html-to-figma/
  manifest.json              # Figma plugin descriptor
  package.json               # Scripts + devDeps
  tsconfig.json              # TypeScript config for code.ts
  .gitignore                 # node_modules, .superpowers, *.js (compiled)
  code.ts                    # Plugin main thread: receives postMessage, orchestrates builder
  ui.html                    # Plugin UI: file input, hidden iframe, extractor, preview, postMessage
  src/
    types.ts                 # Shared type definitions (ExtractedNode, ExtractedStyle, FigmaNodeSpec)
    utils.ts                 # Color parsing, unit conversion, box-shadow parsing
    mapper.ts                # ExtractedStyle → Figma node properties (pure functions)
    builder.ts               # Figma node creation from FigmaNodeSpec (uses figma API)
    extractor.ts             # iframe-based HTML rendering + computed style extraction (UI side)
  tests/
    utils.test.ts            # Unit tests for color/unit/shadow parsing
    mapper.test.ts           # Unit tests for CSS → Figma mapping
    builder.test.ts          # Unit tests for node building (with mocked figma API)
    fixtures/
      flex-basic.html        # Simple flex layout
      with-animations.html   # Page with CSS animations (verify stripping)
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `html-to-figma/manifest.json`
- Create: `html-to-figma/package.json`
- Create: `html-to-figma/tsconfig.json`

- [ ] **Step 1: Create manifest.json**

```json
{
  "name": "AI HTML to Figma",
  "id": "ai-html-to-figma",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["none"]
  }
}
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "html-to-figma",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.100.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "commonjs",
    "lib": ["ES2017", "DOM"],
    "outDir": ".",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  },
  "include": ["code.ts", "src/**/*.ts"],
  "exclude": ["tests", "node_modules"]
}
```

Note: `ui.html` contains inline `<script>` so it's NOT compiled via tsc. The extractor logic is written directly in the HTML file's script block since it runs in the plugin's UI iframe sandbox (has full browser APIs).

- [ ] **Step 4: Run install and verify build**

```bash
npm install
npx tsc --noEmit
```

Expected: No TypeScript errors. `code.ts` doesn't exist yet, so will fail — expected.

- [ ] **Step 5: Commit**

```bash
git add manifest.json package.json tsconfig.json package-lock.json
git commit -m "chore: scaffold Figma plugin project"
```

---

### Task 2: Type Definitions + Utils

**Files:**
- Create: `html-to-figma/src/types.ts`
- Create: `html-to-figma/src/utils.ts`
- Create: `html-to-figma/tests/utils.test.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// src/types.ts

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
```

- [ ] **Step 2: Write utils.ts**

```typescript
// src/utils.ts
import { RgbColor, FigmaEffect } from './types';

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return { r, g, b, a: 1 };
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const a = clean.length === 8 ? parseInt(clean.substring(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

export function parseColor(color: string): RgbColor | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
  if (color.startsWith('#')) return hexToRgb(color);
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]) / 255,
      g: parseInt(rgbaMatch[2]) / 255,
      b: parseInt(rgbaMatch[3]) / 255,
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }
  return null;
}

export function parsePx(value: string): number {
  if (!value || value === 'auto' || value === 'none') return 0;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : 0;
}

export function parseBoxShadow(shadow: string): FigmaEffect[] | null {
  if (!shadow || shadow === 'none') return null;
  const parts = shadow.split(',').map(s => s.trim());
  const effects: FigmaEffect[] = [];
  for (const part of parts) {
    const inset = part.includes('inset');
    const clean = part.replace('inset', '').trim();
    const values = clean.match(/([-\d.]+)px/g);
    if (!values || values.length < 3) continue;
    const offsetX = parseFloat(values[0]);
    const offsetY = parseFloat(values[1]);
    const blur = parseFloat(values[2]);
    const spread = values[3] ? parseFloat(values[3]) : 0;
    const colorMatch = clean.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]+|[a-z]+)(?=\s*$|$)/);
    const color = colorMatch ? parseColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 0.25 };
    if (!color) continue;
    effects.push({
      type: inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color,
      offset: { x: offsetX, y: offsetY },
      radius: blur,
      spread,
      visible: true,
      blendMode: 'NORMAL',
    });
  }
  return effects.length > 0 ? effects : null;
}
```

- [ ] **Step 3: Write failing tests for utils**

```typescript
// tests/utils.test.ts
import { describe, it, expect } from 'vitest';
import { hexToRgb, parseColor, parsePx, parseBoxShadow } from '../src/utils';

describe('hexToRgb', () => {
  it('converts 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('converts 3-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('converts hex with alpha', () => {
    const result = hexToRgb('#ff000080');
    expect(result.r).toBe(1);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBeCloseTo(0.502, 1);
  });
});

describe('parseColor', () => {
  it('parses hex', () => {
    expect(parseColor('#00ff00')).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });

  it('parses rgb', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('returns null for transparent', () => {
    expect(parseColor('transparent')).toBeNull();
    expect(parseColor('rgba(0, 0, 0, 0)')).toBeNull();
  });
});

describe('parsePx', () => {
  it('extracts pixel value', () => {
    expect(parsePx('16px')).toBe(16);
  });

  it('returns 0 for auto', () => {
    expect(parsePx('auto')).toBe(0);
  });

  it('handles decimal values', () => {
    expect(parsePx('12.5px')).toBe(12.5);
  });
});

describe('parseBoxShadow', () => {
  it('returns null for none', () => {
    expect(parseBoxShadow('none')).toBeNull();
  });

  it('parses simple shadow', () => {
    const result = parseBoxShadow('2px 2px 4px rgba(0,0,0,0.2)');
    expect(result).toHaveLength(1);
    expect(result![0].offset).toEqual({ x: 2, y: 2 });
    expect(result![0].radius).toBe(4);
  });
});
```

- [ ] **Step 4: Run tests — verify compile failure (files not yet created properly)**

```bash
npx vitest run
```

Expected: TypeScript compilation succeeds (files have correct types), tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/utils.ts tests/utils.test.ts
git commit -m "feat: add type definitions and color/unit/shadow utils"
```

---

### Task 3: CSS-to-Figma Mapper

**Files:**
- Create: `html-to-figma/src/mapper.ts`
- Create: `html-to-figma/tests/mapper.test.ts`

**Purpose:** Pure functions that convert `ExtractedStyle` properties into `FigmaNodeSpec` properties. No side effects, no Figma API calls.

- [ ] **Step 1: Write the test file**

```typescript
// tests/mapper.test.ts
import { describe, it, expect } from 'vitest';
import {
  mapNodeType,
  mapLayoutMode,
  mapFills,
  mapStrokes,
  mapCornerRadius,
  mapAlignItems,
  mapJustifyContent,
  mapTextStyle,
  mapDimensions,
  mapToFigmaSpec,
} from '../src/mapper';
import { ExtractedNode, ExtractedStyle } from '../src/types';

function makeStyle(overrides: Partial<ExtractedStyle> = {}): ExtractedStyle {
  return {
    display: 'block',
    position: 'static',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    gap: 0,
    width: 100,
    height: 50,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: '#000000',
    backgroundColor: '#ffffff',
    backgroundImage: 'none',
    fontSize: 16,
    fontFamily: 'Arial',
    fontWeight: 400,
    fontStyle: 'normal',
    lineHeight: 24,
    letterSpacing: 0,
    textAlign: 'left',
    textDecoration: 'none',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: '#000000',
    borderRightColor: '#000000',
    borderBottomColor: '#000000',
    borderLeftColor: '#000000',
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    boxShadow: 'none',
    opacity: 1,
    overflow: 'visible',
    boxSizing: 'border-box',
    tagName: 'div',
    ...overrides,
  };
}

function makeNode(tag: string, style: Partial<ExtractedStyle> = {}): ExtractedNode {
  return { tag, children: [], text: '', style: makeStyle(style) };
}

describe('mapNodeType', () => {
  it('returns TEXT for text elements', () => {
    expect(mapNodeType('p')).toBe('TEXT');
    expect(mapNodeType('h1')).toBe('TEXT');
    expect(mapNodeType('span')).toBe('TEXT');
  });

  it('returns FRAME for block/inline-block elements', () => {
    expect(mapNodeType('div')).toBe('FRAME');
    expect(mapNodeType('section')).toBe('FRAME');
    expect(mapNodeType('button')).toBe('FRAME');
  });

  it('returns RECTANGLE for img', () => {
    expect(mapNodeType('img')).toBe('RECTANGLE');
  });

  it('returns VECTOR for svg', () => {
    expect(mapNodeType('svg')).toBe('VECTOR');
  });
});

describe('mapLayoutMode', () => {
  it('detects HORIZONTAL flex row', () => {
    expect(mapLayoutMode(makeStyle({ display: 'flex', flexDirection: 'row' }))).toBe('HORIZONTAL');
  });

  it('detects VERTICAL flex column', () => {
    expect(mapLayoutMode(makeStyle({ display: 'flex', flexDirection: 'column' }))).toBe('VERTICAL');
  });

  it('returns undefined for block display', () => {
    expect(mapLayoutMode(makeStyle({ display: 'block' }))).toBeUndefined();
  });
});

describe('mapFills', () => {
  it('maps background color to solid fill', () => {
    const fills = mapFills('#000000', '#ff0000', 'none');
    expect(fills).toHaveLength(1);
    expect(fills[0].type).toBe('SOLID');
    expect(fills[0].color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('returns empty for transparent background', () => {
    expect(mapFills('#000000', 'transparent', 'none')).toEqual([]);
  });
});

describe('mapStrokes', () => {
  it('maps border to stroke', () => {
    const style = makeStyle({
      borderTopWidth: 2, borderRightWidth: 2,
      borderBottomWidth: 2, borderLeftWidth: 2,
      borderTopColor: '#ff0000', borderRightColor: '#ff0000',
      borderBottomColor: '#ff0000', borderLeftColor: '#ff0000',
    });
    const strokes = mapStrokes(style);
    expect(strokes).toHaveLength(1);
    expect(strokes[0].color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('returns empty when no border', () => {
    expect(mapStrokes(makeStyle())).toEqual([]);
  });
});

describe('mapCornerRadius', () => {
  it('maps uniform border radius', () => {
    expect(mapCornerRadius(makeStyle({ borderRadius: 8 }))).toBe(8);
  });

  it('returns 0 when no radius', () => {
    expect(mapCornerRadius(makeStyle())).toBe(0);
  });
});

describe('mapToFigmaSpec', () => {
  it('converts a flex container with text child', () => {
    const container: ExtractedNode = {
      tag: 'div',
      text: '',
      style: makeStyle({ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 }),
      children: [
        { tag: 'h1', text: 'Hello', style: makeStyle({ tagName: 'h1', fontSize: 24, fontWeight: 700 }), children: [] },
        { tag: 'p', text: 'World', style: makeStyle({ tagName: 'p', fontSize: 14 }), children: [] },
      ],
    };
    const spec = mapToFigmaSpec(container);
    expect(spec.type).toBe('FRAME');
    expect(spec.layoutMode).toBe('VERTICAL');
    expect(spec.itemSpacing).toBe(8);
    expect(spec.children).toHaveLength(2);
    expect(spec.children![0].type).toBe('TEXT');
    expect(spec.children![0].characters).toBe('Hello');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail with "module not found"**

```bash
npx vitest run tests/mapper.test.ts
```

Expected: FAIL — `mapper.ts` doesn't exist yet.

- [ ] **Step 3: Write mapper.ts implementation**

```typescript
// src/mapper.ts
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
  if (style.display === 'block' || style.display === 'inline-block') return 'VERTICAL';
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

  // Dimensions
  const dims = mapDimensions(style);
  if (dims.width) spec.width = dims.width;
  if (dims.height) spec.height = dims.height;

  // Fills (containers + rectangles get background; text gets their own)
  if (type !== 'TEXT') {
    spec.fills = mapFills(style.color, style.backgroundColor, style.backgroundImage);
  }

  // Strokes (containers + rectangles)
  if (type === 'FRAME' || type === 'RECTANGLE') {
    spec.strokes = mapStrokes(style);
  }

  // Corner radius
  if (type === 'FRAME' || type === 'RECTANGLE') {
    const r = mapCornerRadius(style);
    if (r > 0) spec.cornerRadius = r;
  }

  // Effects
  const effects = mapEffects(style);
  if (effects.length > 0) spec.effects = effects;

  // Opacity
  if (style.opacity < 1) spec.opacity = style.opacity;

  // Clip content
  if (style.overflow === 'hidden') spec.clipsContent = true;

  // Text-specific
  if (type === 'TEXT') {
    spec.characters = node.text || '';
    Object.assign(spec, mapTextStyle(style));
  }

  // Children
  if (node.children.length > 0) {
    spec.children = node.children.map(child => mapToFigmaSpec(child));
  }

  return spec;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/mapper.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mapper.ts tests/mapper.test.ts
git commit -m "feat: add CSS-to-Figma property mapper"
```

---

### Task 4: HTML Extractor (iframe-based)

**File:**
- Create: `html-to-figma/src/extractor.ts`

**Purpose:** This module runs in the plugin's UI iframe sandbox (has DOM/browser APIs). It renders the HTML into a hidden iframe, disables animations, and walks the DOM using `getComputedStyle()` to build an `ExtractedNode` tree.

Note: This file is included via `<script>` in `ui.html` (the plugin UI side). It does NOT use `import`/`export` — it attaches to `window` since it runs as inline script. We define it as a `.ts` file for editing/IDE support but paste it into `ui.html` inline.

- [ ] **Step 1: Write extractor.ts**

```typescript
// src/extractor.ts
// This file runs in the plugin UI iframe (has DOM/browser APIs).
// It is inlined into ui.html's <script> block via manual copying.
// All functions are attached to window.HtmlExtractor.

interface ExtractedStyle {
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

interface ExtractedNode {
  tag: string;
  children: ExtractedNode[];
  text: string;
  style: ExtractedStyle;
}

(function () {
  const ANIMATION_OVERRIDE = `
    *, *::before, *::after {
      animation: none !important;
      animation-duration: 0s !important;
      transition: none !important;
      transition-duration: 0s !important;
      transform: none !important;
    }
  `;

  function stripAnimations(doc: Document): void {
    const style = doc.createElement('style');
    style.textContent = ANIMATION_OVERRIDE;
    doc.head.appendChild(style);

    // Remove scripts
    doc.querySelectorAll('script').forEach(el => el.remove());
    // Remove non-static elements
    doc.querySelectorAll('canvas, video, audio, iframe').forEach(el => el.remove());
    // Remove hidden elements
    doc.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
  }

  function extractStyle(el: Element): ExtractedStyle {
    const cs = window.getComputedStyle(el);
    const parse = (prop: string): string => cs.getPropertyValue(prop);

    // Parse numeric from px value
    const px = (prop: string): number => {
      const v = cs.getPropertyValue(prop);
      const m = v.match(/^([\d.]+)px$/);
      return m ? parseFloat(m[1]) : 0;
    };

    // Parse pixel box model values
    const paddingTop = px('padding-top');
    const paddingRight = px('padding-right');
    const paddingBottom = px('padding-bottom');
    const paddingLeft = px('padding-left');
    const marginTop = px('margin-top');
    const marginRight = px('margin-right');
    const marginBottom = px('margin-bottom');
    const marginLeft = px('margin-left');
    const borderTopWidth = px('border-top-width');
    const borderRightWidth = px('border-right-width');
    const borderBottomWidth = px('border-bottom-width');
    const borderLeftWidth = px('border-left-width');

    const width = cs.getPropertyValue('width');
    const height = cs.getPropertyValue('height');
    const widthPx = width.endsWith('px') ? parseFloat(width) : el.getBoundingClientRect().width;
    const heightPx = height.endsWith('px') ? parseFloat(height) : el.getBoundingClientRect().height;

    // Extract gap from column-gap (fallback to gap)
    const gapPx = px('column-gap') || px('gap') || px('row-gap');

    return {
      display: parse('display'),
      position: parse('position'),
      flexDirection: parse('flex-direction'),
      justifyContent: parse('justify-content'),
      alignItems: parse('align-items'),
      flexWrap: parse('flex-wrap'),
      gap: gapPx,
      width: Math.round(widthPx),
      height: Math.round(heightPx),
      paddingTop, paddingRight, paddingBottom, paddingLeft,
      marginTop, marginRight, marginBottom, marginLeft,
      color: parse('color'),
      backgroundColor: parse('background-color'),
      backgroundImage: parse('background-image'),
      fontSize: px('font-size'),
      fontFamily: parse('font-family').split(',')[0].replace(/['"]/g, '').trim(),
      fontWeight: parseFloat(parse('font-weight')) || 400,
      fontStyle: parse('font-style'),
      lineHeight: parseFloat(parse('line-height')) || px('font-size') * 1.2,
      letterSpacing: px('letter-spacing'),
      textAlign: parse('text-align'),
      textDecoration: parse('text-decoration'),
      borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth,
      borderTopColor: parse('border-top-color'),
      borderRightColor: parse('border-right-color'),
      borderBottomColor: parse('border-bottom-color'),
      borderLeftColor: parse('border-left-color'),
      borderRadius: px('border-radius'),
      borderTopLeftRadius: px('border-top-left-radius'),
      borderTopRightRadius: px('border-top-right-radius'),
      borderBottomRightRadius: px('border-bottom-right-radius'),
      borderBottomLeftRadius: px('border-bottom-left-radius'),
      boxShadow: parse('box-shadow'),
      opacity: parseFloat(parse('opacity')) || 1,
      overflow: parse('overflow'),
      boxSizing: parse('box-sizing'),
      tagName: el.tagName.toLowerCase(),
    };
  }

  function extractNode(el: Element): ExtractedNode {
    const tag = el.tagName.toLowerCase();
    const children: ExtractedNode[] = [];
    let text = '';

    // Collect direct text nodes and child elements
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const content = child.textContent?.trim();
        if (content) text += content;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as Element;
        const display = window.getComputedStyle(childEl).getPropertyValue('display');
        if (display === 'none') continue; // Skip hidden elements
        children.push(extractNode(childEl));
      }
    }

    return { tag, children, text, style: extractStyle(el) };
  }

  function extractFromHtml(html: string): Promise<ExtractedNode> {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;left:-9999px;width:1440px;height:900px;border:none;';
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow!.document;
          stripAnimations(doc);

          // Wait one frame for styles to apply
          requestAnimationFrame(() => {
            try {
              const body = doc.body || doc.documentElement;
              const root = extractNode(body);
              document.body.removeChild(iframe);
              resolve(root);
            } catch (e) {
              document.body.removeChild(iframe);
              reject(e);
            }
          });
        } catch (e) {
          document.body.removeChild(iframe);
          reject(e);
        }
      };

      iframe.onerror = () => {
        document.body.removeChild(iframe);
        reject(new Error('Failed to load HTML in iframe'));
      };

      iframe.srcdoc = html;
    });
  }

  (window as any).HtmlExtractor = { extractFromHtml, extractNode, extractStyle, stripAnimations };
})();
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. `src/extractor.ts` defines types locally (matches `src/types.ts` structure) since it runs standalone.

- [ ] **Step 3: Commit**

```bash
git add src/extractor.ts
git commit -m "feat: add iframe-based HTML extractor"
```

---

### Task 5: Figma Node Builder

**Files:**
- Create: `html-to-figma/src/builder.ts`
- Create: `html-to-figma/tests/builder.test.ts`

**Purpose:** Runs on the Figma code side (main thread). Receives `FigmaNodeSpec` and creates actual Figma scene nodes using the Figma API. Test with mocked `figma` global.

- [ ] **Step 1: Write builder test**

```typescript
// tests/builder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFromSpec } from '../src/builder';
import { FigmaNodeSpec } from '../src/types';

// Mock the global figma object
const mockAppend = vi.fn();
const mockCreate = {
  frame: vi.fn(),
  text: vi.fn(),
  rectangle: vi.fn(),
  vector: vi.fn(),
  line: vi.fn(),
  group: vi.fn(),
};

(global as any).figma = {
  createFrame: () => {
    const node = { ...mockCreate };
    mockCreate.frame();
    return {
      name: '', layoutMode: 'NONE', primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'AUTO', fills: [], strokes: [], effects: [],
      opacity: 1, cornerRadius: 0, clipsContent: false,
      resize: vi.fn(), appendChild: mockAppend,
      x: 0, y: 0,
      ...mockCreate,
    };
  },
  createText: () => {
    mockCreate.text();
    return {
      name: '', characters: '', fontSize: 0,
      fontName: { family: 'Inter', style: 'Regular' },
      fills: [], opacity: 1, resize: vi.fn(),
      appendChild: mockAppend, x: 0, y: 0,
    };
  },
  createRectangle: () => {
    mockCreate.rectangle();
    return {
      name: '', fills: [], strokes: [], cornerRadius: 0, opacity: 1,
      resize: vi.fn(), appendChild: mockAppend, x: 0, y: 0,
    };
  },
  createVector: () => {
    mockCreate.vector();
    return { name: '', resize: vi.fn(), appendChild: mockAppend, x: 0, y: 0 };
  },
  createLine: () => {
    mockCreate.line();
    return { name: '', resize: vi.fn(), appendChild: mockAppend, x: 0, y: 0 };
  },
  createGroup: () => {
    mockCreate.group();
    return { name: '', resize: vi.fn(), appendChild: mockAppend, x: 0, y: 0 };
  },
  viewport: { center: { x: 0, y: 0 } },
  ui: { postMessage: vi.fn() },
};

describe('buildFromSpec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a frame from spec', () => {
    const spec: FigmaNodeSpec = {
      type: 'FRAME',
      name: 'container',
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      paddingTop: 20,
      paddingLeft: 20,
      width: 400,
      height: 300,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    };
    const node = buildFromSpec(spec);
    expect(mockCreate.frame).toHaveBeenCalled();
    expect(node.name).toBe('container');
  });

  it('builds nested structure', () => {
    const spec: FigmaNodeSpec = {
      type: 'FRAME',
      name: 'root',
      layoutMode: 'VERTICAL',
      children: [
        { type: 'TEXT', name: 'p', characters: 'Hello', fontSize: 16, fontName: { family: 'Arial', style: 'Regular' } },
        { type: 'TEXT', name: 'p', characters: 'World', fontSize: 14, fontName: { family: 'Arial', style: 'Regular' } },
      ],
    };
    const node = buildFromSpec(spec);
    expect(mockAppend).toHaveBeenCalledTimes(2);
    expect(mockCreate.text).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test — verify failure**

```bash
npx vitest run tests/builder.test.ts
```

Expected: FAIL — `builder.ts` module not found.

- [ ] **Step 3: Write builder.ts**

```typescript
// src/builder.ts
import { FigmaNodeSpec, FigmaFill, FigmaStroke, FigmaEffect } from './types';

export function applyFills(node: FrameNode | RectangleNode | TextNode, fills: FigmaFill[]): void {
  if (fills.length === 0) return;
  const figmaFills: Paint[] = fills.map(f => {
    if (f.type === 'SOLID' && f.color) {
      return { type: 'SOLID', color: f.color, opacity: f.color.a };
    }
    return { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
  });
  node.fills = figmaFills;
}

export function applyStrokes(node: FrameNode | RectangleNode, strokes: FigmaStroke[]): void {
  if (strokes.length === 0) return;
  node.strokes = strokes.map(s => ({ type: 'SOLID', color: s.color }));
  node.strokeWeight = 1;
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

export function createFigmaNode(spec: FigmaNodeSpec): SceneNode {
  let node: SceneNode;

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
      if (spec.rectangleCornerRadii) rect.rectangleCornerRadii = spec.rectangleCornerRadii;
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
      const group = figma.createGroup();
      group.name = spec.name;
      node = group;
      break;
    }

    default:
      node = figma.createFrame();
      node.name = spec.name;
  }

  // Set dimensions
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

    if (spec.children) {
      for (const childSpec of spec.children) {
        build(childSpec, node as FrameNode);
      }
    }

    parent.appendChild(node);
    return node;
  }

  // Create root as a frame wrapping everything
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

  if (root.fills) applyFills(rootFrame, root.fills);
  if (root.children) {
    for (const childSpec of root.children) {
      build(childSpec, rootFrame);
    }
  }

  return rootFrame;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/builder.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/builder.ts tests/builder.test.ts
git commit -m "feat: add Figma node builder"
```

---

### Task 6: Plugin Code Entry (Main Thread)

**File:**
- Modify: `html-to-figma/code.ts` (create)

**Purpose:** The Figma plugin main thread. Listens for `postMessage` from the UI, receives `ExtractedNode` JSON, calls `mapToFigmaSpec` + `buildFromSpec` to create Figma nodes.

- [ ] **Step 1: Write code.ts**

```typescript
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
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: No errors (code.ts, src/types.ts, src/mapper.ts, src/builder.ts all compile).

- [ ] **Step 3: Commit**

```bash
git add code.ts
git commit -m "feat: add plugin main thread entry"
```

---

### Task 7: Plugin UI

**File:**
- Create: `html-to-figma/ui.html`

**Purpose:** The Plugin UI iframe. User selects HTML files, the extractor processes them, shows a preview, and on confirm sends the extracted tree to the code side.

- [ ] **Step 1: Write ui.html**

```html
<!-- ui.html - Plugin user interface -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Inter, -apple-system, sans-serif; font-size: 12px; color: #333; padding: 16px; }
    h2 { font-size: 14px; margin-bottom: 4px; }
    .subtitle { font-size: 11px; color: #999; margin-bottom: 16px; }
    
    .drop-zone {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s;
      margin-bottom: 16px;
    }
    .drop-zone:hover, .drop-zone.dragover {
      border-color: #18A0FB;
      background: #f0f8ff;
    }
    .drop-zone input { display: none; }
    .drop-zone p { color: #999; font-size: 12px; }

    .file-list {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 16px;
    }
    .file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 4px;
      background: #f5f5f5;
      margin-bottom: 4px;
    }
    .file-item .name { flex: 1; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-item .remove { cursor: pointer; color: #999; font-size: 16px; }
    .file-item .status { font-size: 10px; }
    .file-item .status.ready { color: #18A0FB; }
    .file-item .status.error { color: #F24822; }

    .preview-area {
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
      min-height: 100px;
      background: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-area iframe {
      border: none;
      transform: scale(0.35);
      transform-origin: top left;
      pointer-events: none;
    }
    .preview-area p { color: #ccc; font-size: 12px; }

    .btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .btn-primary {
      background: #18A0FB;
      color: #fff;
    }
    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: #f0f0f0;
      color: #333;
    }

    .progress {
      margin-bottom: 8px;
      font-size: 11px;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <h2>AI HTML to Figma</h2>
  <p class="subtitle">Convert AI-generated HTML to Figma Auto Layout frames</p>

  <div class="drop-zone" id="dropZone">
    <p>Click or drag .html files here</p>
    <input type="file" id="fileInput" accept=".html" multiple>
  </div>

  <div class="file-list" id="fileList"></div>

  <div class="preview-area" id="previewArea">
    <p>Select a file to preview</p>
  </div>

  <div class="progress" id="progress"></div>

  <button class="btn btn-primary" id="generateBtn" disabled>Generate in Figma</button>
  <button class="btn btn-secondary" id="closeBtn">Close</button>

  <script>
  // --- HTML Extractor (inlined from src/extractor.ts) ---
  (function () {
    const ANIMATION_OVERRIDE = `
      *, *::before, *::after {
        animation: none !important;
        animation-duration: 0s !important;
        transition: none !important;
        transition-duration: 0s !important;
        transform: none !important;
      }
    `;

    function stripAnimations(doc) {
      const style = doc.createElement('style');
      style.textContent = ANIMATION_OVERRIDE;
      doc.head.appendChild(style);
      doc.querySelectorAll('script').forEach(el => el.remove());
      doc.querySelectorAll('canvas, video, audio, iframe').forEach(el => el.remove());
      doc.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
    }

    function extractStyle(el) {
      const cs = window.getComputedStyle(el);
      const parse = function(prop) { return cs.getPropertyValue(prop); };
      const px = function(prop) {
        var v = cs.getPropertyValue(prop);
        var m = v.match(/^([\d.]+)px$/);
        return m ? parseFloat(m[1]) : 0;
      };

      var paddingTop = px('padding-top');
      var paddingRight = px('padding-right');
      var paddingBottom = px('padding-bottom');
      var paddingLeft = px('padding-left');
      var marginTop = px('margin-top');
      var marginRight = px('margin-right');
      var marginBottom = px('margin-bottom');
      var marginLeft = px('margin-left');
      var borderTopWidth = px('border-top-width');
      var borderRightWidth = px('border-right-width');
      var borderBottomWidth = px('border-bottom-width');
      var borderLeftWidth = px('border-left-width');

      var width = parse('width');
      var height = parse('height');
      var widthPx = width.endsWith('px') ? parseFloat(width) : el.getBoundingClientRect().width;
      var heightPx = height.endsWith('px') ? parseFloat(height) : el.getBoundingClientRect().height;
      var gapPx = px('column-gap') || px('gap') || px('row-gap');

      return {
        display: parse('display'),
        position: parse('position'),
        flexDirection: parse('flex-direction'),
        justifyContent: parse('justify-content'),
        alignItems: parse('align-items'),
        flexWrap: parse('flex-wrap'),
        gap: gapPx,
        width: Math.round(widthPx),
        height: Math.round(heightPx),
        paddingTop: paddingTop, paddingRight: paddingRight, paddingBottom: paddingBottom, paddingLeft: paddingLeft,
        marginTop: marginTop, marginRight: marginRight, marginBottom: marginBottom, marginLeft: marginLeft,
        color: parse('color'),
        backgroundColor: parse('background-color'),
        backgroundImage: parse('background-image'),
        fontSize: px('font-size'),
        fontFamily: parse('font-family').split(',')[0].replace(/['"]/g, '').trim(),
        fontWeight: parseFloat(parse('font-weight')) || 400,
        fontStyle: parse('font-style'),
        lineHeight: parseFloat(parse('line-height')) || px('font-size') * 1.2,
        letterSpacing: px('letter-spacing'),
        textAlign: parse('text-align'),
        textDecoration: parse('text-decoration'),
        borderTopWidth: borderTopWidth, borderRightWidth: borderRightWidth,
        borderBottomWidth: borderBottomWidth, borderLeftWidth: borderLeftWidth,
        borderTopColor: parse('border-top-color'),
        borderRightColor: parse('border-right-color'),
        borderBottomColor: parse('border-bottom-color'),
        borderLeftColor: parse('border-left-color'),
        borderRadius: px('border-radius'),
        borderTopLeftRadius: px('border-top-left-radius'),
        borderTopRightRadius: px('border-top-right-radius'),
        borderBottomRightRadius: px('border-bottom-right-radius'),
        borderBottomLeftRadius: px('border-bottom-left-radius'),
        boxShadow: parse('box-shadow'),
        opacity: parseFloat(parse('opacity')) || 1,
        overflow: parse('overflow'),
        boxSizing: parse('box-sizing'),
        tagName: el.tagName.toLowerCase()
      };
    }

    function extractNode(el) {
      var tag = el.tagName.toLowerCase();
      var children = [];
      var text = '';

      for (var i = 0; i < el.childNodes.length; i++) {
        var child = el.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
          var content = child.textContent ? child.textContent.trim() : '';
          if (content) text += content;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          var childEl = child;
          var display = window.getComputedStyle(childEl).getPropertyValue('display');
          if (display === 'none') continue;
          children.push(extractNode(childEl));
        }
      }

      return { tag: tag, children: children, text: text, style: extractStyle(el) };
    }

    window.HtmlExtractor = {
      extractFromHtml: function(html) {
        return new Promise(function(resolve, reject) {
          var iframe = document.createElement('iframe');
          iframe.style.cssText = 'position:absolute;left:-9999px;width:1440px;height:900px;border:none;';
          document.body.appendChild(iframe);

          iframe.onload = function() {
            try {
              var doc = iframe.contentDocument || iframe.contentWindow.document;
              stripAnimations(doc);
              requestAnimationFrame(function() {
                try {
                  var body = doc.body || doc.documentElement;
                  var root = extractNode(body);
                  document.body.removeChild(iframe);
                  resolve(root);
                } catch (e) {
                  document.body.removeChild(iframe);
                  reject(e);
                }
              });
            } catch (e) {
              document.body.removeChild(iframe);
              reject(e);
            }
          };

          iframe.onerror = function() {
            document.body.removeChild(iframe);
            reject(new Error('Failed to load HTML'));
          };

          iframe.srcdoc = html;
        });
      }
    };
  })();

  // --- UI Logic ---
  var files = [];
  var extractedNodes = {};
  var selectedIndex = -1;

  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var fileList = document.getElementById('fileList');
  var previewArea = document.getElementById('previewArea');
  var progressEl = document.getElementById('progress');
  var generateBtn = document.getElementById('generateBtn');
  var closeBtn = document.getElementById('closeBtn');

  dropZone.addEventListener('click', function() { fileInput.click(); });
  dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', function() { handleFiles(fileInput.files); });

  function handleFiles(fileList) {
    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      if (!file.name.endsWith('.html')) continue;
      files.push(file);
      addFileToList(file);
      extractFile(file);
    }
    fileInput.value = '';
  }

  function addFileToList(file) {
    var idx = files.length - 1;
    var item = document.createElement('div');
    item.className = 'file-item';
    item.id = 'file-' + idx;
    item.innerHTML =
      '<span class="name">' + file.name + '</span>' +
      '<span class="status" id="status-' + idx + '">Extracting...</span>' +
      '<span class="remove" id="remove-' + idx + '">&times;</span>';
    item.addEventListener('click', function() { selectFile(idx); });
    fileList.appendChild(item);
    document.getElementById('remove-' + idx).addEventListener('click', function(e) {
      e.stopPropagation();
      removeFile(idx);
    });
  }

  function extractFile(file) {
    var idx = files.indexOf(file);
    var reader = new FileReader();
    reader.onload = function(e) {
      var html = e.target.result;
      window.HtmlExtractor.extractFromHtml(html).then(function(node) {
        extractedNodes[idx] = node;
        var statusEl = document.getElementById('status-' + idx);
        if (statusEl) { statusEl.textContent = 'Ready'; statusEl.className = 'status ready'; }
      }).catch(function(err) {
        var statusEl = document.getElementById('status-' + idx);
        if (statusEl) { statusEl.textContent = 'Failed'; statusEl.className = 'status error'; }
      });
    };
    reader.readAsText(file);
  }

  function selectFile(idx) {
    selectedIndex = idx;
    // Highlight
    document.querySelectorAll('.file-item').forEach(function(el) { el.style.background = '#f5f5f5'; });
    var el = document.getElementById('file-' + idx);
    if (el) el.style.background = '#e0f0ff';
    generateBtn.disabled = false;

    // Show preview
    if (extractedNodes[idx]) {
      var file = files[idx];
      var reader = new FileReader();
      reader.onload = function(e) {
        previewArea.innerHTML = '<iframe width="1440" height="900" srcdoc="' +
          e.target.result.replace(/"/g, '&quot;').replace(/<script/g, '<!--').replace(/<\/script>/g, '-->') +
          '"></iframe>';
      };
      reader.readAsText(file);
    }
  }

  function removeFile(idx) {
    delete files[idx];
    delete extractedNodes[idx];
    var el = document.getElementById('file-' + idx);
    if (el) el.remove();
    if (selectedIndex === idx) {
      selectedIndex = -1;
      generateBtn.disabled = true;
      previewArea.innerHTML = '<p>Select a file to preview</p>';
    }
  }

  generateBtn.addEventListener('click', function() {
    if (selectedIndex < 0 || !extractedNodes[selectedIndex]) return;
    progressEl.textContent = 'Generating...';
    parent.postMessage({ pluginMessage: { type: 'generate-from-node', node: extractedNodes[selectedIndex] } }, '*');
  });

  closeBtn.addEventListener('click', function() {
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify plugin compiles fully**

```bash
npx tsc --noEmit
```

Expected: No errors. `code.ts` + all `src/*.ts` compile. `ui.html` is not TypeScript compiled.

- [ ] **Step 3: Commit**

```bash
git add ui.html
git commit -m "feat: add plugin UI with file input, preview, and iframe extractor"
```

---

### Task 8: Integration — Test with Real AI HTML

**File:**
- Create: `html-to-figma/tests/fixtures/flex-basic.html`
- Create: `html-to-figma/tests/fixtures/with-animations.html`

**Purpose:** Create test fixtures representing typical AI-generated HTML, load the plugin in Figma, and verify the output.

- [ ] **Step 1: Create test fixture — flex-basic.html**

```html
<!-- tests/fixtures/flex-basic.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    .container { display: flex; flex-direction: column; gap: 16px; padding: 24px; max-width: 400px; }
    .card { display: flex; flex-direction: row; gap: 12px; padding: 16px; background: #f0f0f0; border-radius: 8px; }
    .avatar { width: 48px; height: 48px; background: #18A0FB; border-radius: 24px; flex-shrink: 0; }
    .content { display: flex; flex-direction: column; gap: 4px; }
    .title { font-size: 16px; font-weight: 700; color: #333; }
    .desc { font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="avatar"></div>
      <div class="content">
        <span class="title">Card Title</span>
        <span class="desc">This is a description for the card</span>
      </div>
    </div>
    <div class="card">
      <div class="avatar"></div>
      <div class="content">
        <span class="title">Another Card</span>
        <span class="desc">With different content here</span>
      </div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Create test fixture — with-animations.html**

```html
<!-- tests/fixtures/with-animations.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(20px); } to { transform: translateY(0); } }
    .animated { animation: fadeIn 0.5s ease-in; }
    .card { transition: box-shadow 0.3s ease; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.2); transform: translateY(-2px); }
    body { margin: 40px; font-family: Arial; }
  </style>
</head>
<body>
  <div class="card animated">
    <h2>Animated Card</h2>
    <p>This card has animations that should be stripped</p>
  </div>
  <script>console.log('this should be removed');</script>
</body>
</html>
```

- [ ] **Step 3: Install the plugin in Figma for manual testing**

Instructions:
1. Open Figma desktop app
2. Go to Plugins → Development → Import plugin from manifest
3. Select `html-to-figma/manifest.json`
4. Run the plugin
5. Select `tests/fixtures/flex-basic.html`
6. Verify: Auto Layout frames created, card structure preserved, correct spacing
7. Select `tests/fixtures/with-animations.html`
8. Verify: No animations applied, no hover effects, `box-shadow` rendered as Figma effect

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/
git commit -m "test: add integration test fixtures"
```

---

### Task 9: Build & Final Verification

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: `code.js` generated from `code.ts` and `src/*.ts`.

- [ ] **Step 2: Verify output files exist**

```bash
ls -la code.js
```

Expected: `code.js` exists and is non-empty.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests pass (utils, mapper, builder).

- [ ] **Step 4: Final commit**

```bash
git add code.js
git commit -m "chore: add compiled code.js for plugin deployment"
```

---

## Post-Plan Notes

- **Font handling**: Figma uses its own font system. If a font from the HTML is not available in Figma, the node will use Inter as fallback. This is acceptable for an AI-imported design.
- **Dynamic images**: External image URLs are NOT fetched in this version. Images with external `src` URLs will not render in Figma. Future enhancement.
- **SVG**: SVGs are detected as `VECTOR` type but the actual path data extraction from `<svg>` elements requires additional SVG path parsing, not implemented in v1.
- **Responsive layouts**: Media queries are ignored. The default viewport (1440px width iframe) is used for extraction.
