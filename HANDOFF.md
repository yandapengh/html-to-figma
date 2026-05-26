# HTML-to-Figma Plugin — Session Handoff

## Quick Start

```bash
cd /Users/hyd/Documents/html-to-figma
# No server needed. Plugin is self-contained inline extractor.
# Reload plugin in Figma to test.
```

## What Works (Verified in Figma)

| Feature | Status |
|---------|--------|
| Layout (absolute positioning) | ✅ |
| Solid color fills | ✅ |
| Gradient fills (linear/radial/conic) | ✅ |
| Hex colors (e.g. `#0156F0`) | ✅ |
| New CSS color syntax (`rgb(1 86 240)`) | ✅ |
| Border-radius (`px` + `%`) | ✅ |
| Border-radius shorthand fallback | ✅ |
| Box shadow (single) | ✅ |
| IMG dimension from parent container | ✅ |
| stripAnimations (no transform:none) | ✅ |
| Font generic family fallback (sans-serif → Inter) | ✅ |

## Known Issues (Not Fixed)

| Issue | Priority | Notes |
|-------|----------|-------|
| `pro-badge` alignment off | Medium | `translateX(-50%)` preserved but Figma absolute positioning doesn't match flex centering |
| Multi box-shadow | Low | Parser handles 1 shadow only |
| Text shadow | Low | Not extracted |
| `useFrames` tree mode | Low | LCA makeTree may create extra FRAME wrappers |

## Key Files Changed

| File | Summary |
|------|---------|
| `ui.html` | **Gradient parser** (parseGradient, parseColorStops), **hex getRgb**, **parseRadius** (%), IMG parent container size, stripAnimations fix |
| `code.ts` | GENERIC_FONTS fallback |
| `manifest.json` | `allowedDomains: ["none"]` |
| `package.json` | Added `server` script (for server/ directory only, not needed for plugin) |

## Where Gradient Parsing Lives

All in `ui.html` inline `<script>`:

```
line ~139: parseColorStops() — extracts color stops from gradient string
line ~153: parseGradient() — detects linear/radial/conic, calls parseColorStops
line ~170: getRgb() — hex + old comma CSS + new space CSS color syntax
line ~639: background-image section — calls parseGradient, pushes to fills
```

Critical fix: `fills.push(gradient)` does NOT clear existing SOLID fills. Gradient on top of solid → gradient visible, solid as fallback.

## How to Test

1. Open Figma Desktop
2. Plugins → Development → Import plugin from manifest → select `/Users/hyd/Documents/html-to-figma/manifest.json`
3. Drop an HTML file with gradient backgrounds (e.g., `/Users/hyd/Downloads/ai_studio_code (12).html`)
4. Click "Generate in Figma"
5. Check Figma canvas for gradient fills, border-radius, image placeholders

## Server Directory (Not Used by Plugin)

`server/` is a standalone Playwright-based extraction server. It was built during Phase 1-3 but is NOT used by the current plugin. The plugin uses the inline extractor in `ui.html`. Server can be used for debugging via `curl`:

```bash
cd server && npx tsx src/index.ts
curl -X POST http://localhost:3456/convert -H "Content-Type: application/json" -d '{"html": "...", "viewportWidth": 1440, "viewportHeight": 900}'
```

## Git Info

- Remote: https://github.com/yandapengh/html-to-figma
- Branch: main
- Last commit: `3eb3df5` — "feat: gradient fills, hex colors, border-radius %, IMG size fix, font fallback"
