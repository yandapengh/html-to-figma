import { RgbColor, FigmaEffect } from './types';

export function hexToRgb(hex: string): RgbColor | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{3,8}$/.test(clean) || (clean.length !== 3 && clean.length !== 6 && clean.length !== 8)) {
    return null;
  }
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

  // Split on commas that are NOT inside parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < shadow.length; i++) {
    const ch = shadow[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  const effects: FigmaEffect[] = [];
  for (const part of parts) {
    const inset = part.includes('inset');
    const clean = part.replace('inset', '').trim();
    const values: number[] = [];
    const pxRegex = /([-]?\d*\.?\d+)px/g;
    let m: RegExpExecArray | null;
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
