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

  it('returns VERTICAL for block display', () => {
    expect(mapLayoutMode(makeStyle({ display: 'block' }))).toBe('VERTICAL');
  });
});

describe('mapFills', () => {
  it('maps background color to solid fill', () => {
    const fills = mapFills('#ff0000');
    expect(fills).toHaveLength(1);
    expect(fills[0].type).toBe('SOLID');
    expect(fills[0].color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('returns empty for transparent background', () => {
    expect(mapFills('transparent')).toEqual([]);
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
