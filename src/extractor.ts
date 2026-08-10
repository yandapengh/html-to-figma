import type { ImportDocument, ImportWarning, LayerNode } from './types';

// Contract for the DOM extractor that currently runs inline inside ui.html.
// Keep this file as the typed boundary for the extraction pipeline until the
// inline script is moved into the build step.

export interface ExtractorOptions {
  useFrames: boolean;
  warnings: ImportWarning[];
}
export interface HtmlExtractorRuntime {
  extractFromHtml(html: string): Promise<ImportDocument>;
}

declare global {
  interface Window {
    HtmlExtractor?: HtmlExtractorRuntime;
    _useFrames?: boolean;
  }
}

export function createImportDocument(params: {
  title?: string;
  layers: LayerNode[];
  viewportRect: ImportDocument['viewportRect'];
  documentRect: ImportDocument['documentRect'];
  devicePixelRatio: number;
  warnings?: ImportWarning[];
}): ImportDocument {
  return {
    version: 1,
    source: 'local-html',
    title: params.title,
    layers: params.layers,
    viewportRect: params.viewportRect,
    documentRect: params.documentRect,
    devicePixelRatio: params.devicePixelRatio,
    warnings: params.warnings || [],
  };
}
