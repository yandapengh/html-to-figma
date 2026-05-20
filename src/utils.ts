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
