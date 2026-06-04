#!/usr/bin/env node
/**
 * inline-styles.js — Preprocess HTML for Figma import
 *
 * Loads an HTML page in Playwright to compile external CSS (Tailwind CDN, etc.)
 * into static <style> blocks, then strips external dependencies.
 *
 * Usage:
 *   node scripts/inline-styles.js <input.html> [output.html]
 *
 *   node scripts/inline-styles.js samples/ai_memory_systems_analysis.html
 *   → outputs: samples/ai_memory_systems_analysis_inlined.html
 */

const path = require('path');
const fs = require('fs');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/inline-styles.js <input.html> [output.html]');
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);
if (!fs.existsSync(resolvedInput)) {
  console.error('File not found:', resolvedInput);
  process.exit(1);
}

const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : resolvedInput.replace(/\.html?$/i, '_inlined.html');

async function main() {
  // Use server's playwright to avoid duplicating Chromium installs
  let playwright;
  try {
    playwright = require('../server/node_modules/playwright');
  } catch (e) {
    try {
      playwright = require(path.join(__dirname, '../server/node_modules/playwright'));
    } catch (e2) {
      console.error('Playwright not found. Run: npm run server:install');
      process.exit(1);
    }
  }

  const html = fs.readFileSync(resolvedInput, 'utf-8');
  console.log(`[inline] Loading: ${resolvedInput}`);
  console.log(`[inline] Size: ${(html.length / 1024).toFixed(1)} KB`);

  const { chromium } = playwright;
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage({
    bypassCSP: true,
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(30000);

  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });

    // Extra wait to ensure Tailwind CDN finishes style injection
    await page.waitForTimeout(1500);

    // Also trigger any post-render JS (tabs, chart setup, etc.)
    await page.evaluate(() => {
      // Open all <details> elements
      document.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
      // Trigger a reflow to ensure all computed styles are settled
      document.body.offsetHeight;
    });

    await page.waitForTimeout(500);

    // Extract full DOM HTML — includes Tailwind-injected <style> blocks
    const fullHtml = await page.content();
    console.log(`[inline] Rendered size: ${(fullHtml.length / 1024).toFixed(1)} KB`);

    // Count injected <style> blocks (Tailwind output)
    const styleCount = await page.evaluate(() => document.querySelectorAll('style').length);
    console.log(`[inline] Style blocks in DOM: ${styleCount}`);

    // Clean up: remove all script tags and external resource urls
    // All JS has already executed in Playwright — DOM contains the final state
    let cleaned = fullHtml
      // Remove all <script> blocks (both external src and inline)
      // Use a single pass: match <script ...> ... </script>
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove @import rules with external URLs
      .replace(/@import\s+url\(['"]?https?:\/\/[^'")\s]*['"]?\)\s*;?/gi, '');

    console.log(`[inline] Cleaned size: ${(cleaned.length / 1024).toFixed(1)} KB`);

    fs.writeFileSync(outputPath, cleaned, 'utf-8');
    console.log(`[inline] Done → ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[inline] Error:', err);
  process.exit(1);
});
