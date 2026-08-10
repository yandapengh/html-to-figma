import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const uiPath = fileURLToPath(new URL('../ui.html', import.meta.url));
const fixturePath = fileURLToPath(new URL('../tests/fixtures/pseudo-elements.html', import.meta.url));
const html = await readFile(fixturePath, 'utf8');

function flatten(layers) {
  const result = [];
  function visit(layer, parent) {
    result.push({ layer, parent });
    for (const child of layer.children || []) visit(child, layer);
  }
  for (const layer of layers) visit(layer, null);
  return result;
}

async function extract(page, useFrames) {
  return page.evaluate(
    async ({ source, treeMode }) => {
      window._useFrames = treeMode;
      return window.HtmlExtractor.extractFromHtml(source);
    },
    { source: html, treeMode: useFrames },
  );
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  throw new Error(`Playwright Chromium is unavailable. Run "npm run preprocess:install" first.\n${error}`);
}

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(pathToFileURL(uiPath).href);

  const flatPayload = await extract(page, false);
  const flatLayers = flatten(flatPayload.layers);
  const flatPseudo = flatLayers.filter(({ layer }) => layer.isPseudoElement);
  assert.equal(flatPseudo.length, 3, 'expected three decorative pseudo-element rectangles');

  const before = flatPseudo.find(({ layer }) => layer.name === 'main.surface::before')?.layer;
  const after = flatPseudo.find(({ layer }) => layer.name === 'main.surface::after')?.layer;
  const glow = flatPseudo.find(({ layer }) => layer.name === 'div.glow::before')?.layer;
  assert(before, 'missing main.surface::before');
  assert(after, 'missing main.surface::after');
  assert(glow, 'missing div.glow::before');
  assert.deepEqual([before.width, before.height], [240, 180]);
  assert.deepEqual(before.fills.map((fill) => fill.type), ['GRADIENT_RADIAL', 'GRADIENT_LINEAR']);
  assert.deepEqual(after.fills.map((fill) => fill.type), ['GRADIENT_LINEAR']);
  assert.deepEqual([glow.width, glow.height], [60, 30]);
  assert.equal(glow.effects[0].type, 'LAYER_BLUR');
  assert.equal(glow.effects[0].radius, 12);
  assert.deepEqual(
    [glow.topLeftRadius, glow.topRightRadius, glow.bottomRightRadius, glow.bottomLeftRadius],
    [15, 15, 15, 15],
  );

  const treePayload = await extract(page, true);
  const treeLayers = flatten(treePayload.layers);
  const beforeEntry = treeLayers.find(({ layer }) => layer.name === 'main.surface::before');
  const afterEntry = treeLayers.find(({ layer }) => layer.name === 'main.surface::after');
  assert(beforeEntry?.parent, 'tree mode should attach ::before to a host frame');
  assert.equal(beforeEntry.parent, afterEntry?.parent, 'host pseudo-elements should share one frame');
  const hostChildren = beforeEntry.parent.children;
  const beforeIndex = hostChildren.indexOf(beforeEntry.layer);
  const afterIndex = hostChildren.indexOf(afterEntry.layer);
  const firstContentIndex = hostChildren.findIndex(
    (layer) => !layer.isPseudoElement && !Array.isArray(layer.fills),
  );
  assert(beforeIndex > 0, 'host background should remain below negative pseudo-elements');
  assert(afterIndex > beforeIndex, '::after should follow ::before at equal stacking context');
  assert(firstContentIndex === -1 || afterIndex < firstContentIndex, 'negative pseudo-elements should remain below content');

  console.log(`Pseudo-element extraction QA passed: ${projectRoot}`);
} finally {
  await browser.close();
}
