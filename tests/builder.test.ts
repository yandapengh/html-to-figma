import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFromSpec } from '../src/builder';
import { FigmaNodeSpec } from '../src/types';

const mockAppend = vi.fn();
const mockCreate = {
  frame: vi.fn(),
  text: vi.fn(),
  rectangle: vi.fn(),
  vector: vi.fn(),
  line: vi.fn(),
};

(global as any).figma = {
  createFrame: () => {
    mockCreate.frame();
    return {
      name: '', layoutMode: 'NONE', primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'AUTO', fills: [], strokes: [], effects: [],
      opacity: 1, cornerRadius: 0, clipsContent: false,
      resize: vi.fn(), appendChild: mockAppend,
      x: 0, y: 0,
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
