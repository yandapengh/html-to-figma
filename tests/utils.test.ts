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
    expect(result!.r).toBe(1);
    expect(result!.g).toBe(0);
    expect(result!.b).toBe(0);
    expect(result!.a).toBeCloseTo(0.502, 1);
  });

  it('returns null for invalid hex', () => {
    expect(hexToRgb('#xyz')).toBeNull();
    expect(hexToRgb('#ggg')).toBeNull();
    expect(hexToRgb('invalid')).toBeNull();
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

  it('parses rgba with alpha', () => {
    const result = parseColor('rgba(255, 128, 64, 0.5)');
    expect(result).toEqual({ r: 1, g: 128 / 255, b: 64 / 255, a: 0.5 });
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

  it('handles multiple shadows separated by commas', () => {
    const result = parseBoxShadow('2px 2px 4px rgba(0, 0, 0, 0.2), 4px 4px 8px rgba(255, 0, 0, 0.5)');
    expect(result).toHaveLength(2);
    expect(result![0].offset).toEqual({ x: 2, y: 2 });
    expect(result![1].offset).toEqual({ x: 4, y: 4 });
  });

  it('handles inset shadow', () => {
    const result = parseBoxShadow('inset 2px 2px 4px rgba(0, 0, 0, 0.3)');
    expect(result).toHaveLength(1);
    expect(result![0].type).toBe('INNER_SHADOW');
    expect(result![0].offset).toEqual({ x: 2, y: 2 });
  });

  it('handles spread value', () => {
    const result = parseBoxShadow('2px 2px 4px 1px rgba(0, 0, 0, 0.2)');
    expect(result).toHaveLength(1);
    expect(result![0].spread).toBe(1);
  });
});
