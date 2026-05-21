# HTML to Figma Plugin — 实现思路与踩坑记录

## 一、动机：为什么需要这个插件？

### 1.1 AI 生成网页已经很成熟了

无论是 Claude、ChatGPT、Gemini，还是各种 AI 编码工具，生成高质量 HTML/CSS 已经是一件非常可靠的事情。它们可以输出结构良好的页面、正确的样式、甚至是复杂的交互原型。

### 1.2 但设计师无法二次修改

拿着 AI 生成的网页，设计师没有办法对它进行二次设计——改布局、调间距、换颜色、加动效，这些都需要在专业设计工具里完成。而 Figma 是设计师的工作主场。

### 1.3 Figma 原生工具不好用

Figma 有官方的 MCP 和 Plugin API，但实际使用体验很差：
- **限制多**：不允许动态创建组件、不能修改 component properties、复杂的 auto-layout 操作受限
- **AI 无法处理**：让 AI 直接调 Figma API 创建设计稿，AI 很难理解空间关系、图层嵌套、约束系统
- **调试困难**：出了错根本不知道是 AI 的问题还是 API 的问题

### 1.4 HTML 是完美的中间件

HTML/CSS 是 AI 最擅长的「图形化语言」。它：
- 表达能力足够强（布局、样式、字体、图片、SVG）
- AI 生成质量高、稳定
- 可以直接在浏览器里预览

**所以思路很清晰：AI 生成 HTML → HTML 导入 Figma → 设计师在 Figma 里自由修改。**

这就是这个插件存在的意义——用 HTML 作为桥梁，把 AI 的生成能力和设计师的工作流同步起来。

---

## 二、实际使用场景：PRD → HTML → Figma

### 2.1 问题：设计师如何在 PRD 中不迷路？

工作中拿到一份产品的 PRD，几十页的文档，里面混杂了：
- 给开发看的技术约束
- 给测试看的验收标准
- 给运营看的 KPI 指标
- 真正给设计师看的交互逻辑、页面结构、信息层级

设计师要在长篇文字中找到自己需要的内容，很容易信息过载。

### 2.2 AI 可以二次筛选，但纯文本不够

AI 确实可以帮助从 PRD 中提取和筛选重点。但一旦描述复杂化（多状态、多分支、嵌套的逻辑关系），纯文本的交付件无法让设计师快速理解信息架构。

**Karpathy 最近提到过：markdown 不是给人类确认的合适交付件。真正需要人类确认的环节，还是需要图形化。**

### 2.3 AI 最擅长的图形化语言就是 HTML

AI 把 PRD 转换成 HTML 后，信息层级、模块关系、优先级差异一目了然：

- 用颜色区分重点与非重点
- 用卡片组织模块关系
- 用间距表达信息层级
- 用排版建立阅读节奏

例如 Batch Reward 的 PRD，经过 AI 转换成 HTML 之后，设计师一眼就能看到需要做什么，不再需要在一堆文字中苦苦寻找设计线索。

**而 HTML 导入 Figma 就是这整个流程的最后一环。**

```
PRD 文档 → AI 提取/结构化 → HTML 可视化 → 本插件导入 Figma → 设计师自由创作
```

---

## 三、实现方案

### 3.1 参考项目

BuilderIO 的开源项目 [html-to-figma](https://github.com/BuilderIO/html-to-figma) 是这个插件的核心参考。它包含：
- `lib/html-to-figma.ts` — 核心转换函数，将 DOM 转换为 Figma 图层数组
- `plugin/code.ts` — Figma 插件主线程，接收图层数据并创建 Figma 节点
- `plugin/ui.tsx` — Figma 插件 UI（React）

BuilderIO 的原版插件的导入流程是：用户输入 URL → 调用后端 API（无头浏览器渲染页面并执行 htmlToFigma）→ 返回图层 JSON → Figma 插件生成节点。

**我们的改动**：将 URL 输入改为本地 HTML 文件输入，去掉了后端依赖，在 Figma 插件的 UI iframe 中本地完成 DOM 提取和转换。

### 3.2 管道架构

```
┌─────────────────────────────────────────────────────────┐
│                    Figma 插件                             │
│                                                          │
│  ui.html (iframe)                code.ts (主线程)         │
│  ┌──────────────────┐           ┌───────────────────┐   │
│  │ 1. 用户加载本地    │           │ 4. 遍历 layers      │   │
│  │    HTML 文件      │           │                     │   │
│  │ 2. iframe 渲染    │  postMsg  │ 5. figma.create*()  │   │
│  │    HTML 内容      │ ──────▶  │                     │   │
│  │ 3. htmlToFigma()  │  layers  │ 6. 字体匹配、坐标    │   │
│  │    提取图层数组    │           │    设置、属性映射     │   │
│  └──────────────────┘           └───────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.3 htmlToFigma() 核心思路

**绝对定位优先，不重建 CSS 布局。**

这是整个方案最关键的设计决策。很多人的第一反应是把 CSS flexbox/grid → Figma auto-layout，但这会产生根本性的阻抗不匹配（CSS 布局模型和 Figma 布局模型差异太大）。

BuilderIO 的做法很简单却很有效：**直接用 `getBoundingClientRect()` 获取每个元素在屏幕上的绝对坐标**，不在 Figma 里重建 CSS 布局。这样可以 100% 还原视觉效果。

核心流程：

1. **收集所有 DOM 元素**：`querySelectorAll('*')` + Shadow DOM 穿透
2. **过滤隐藏元素**：`display:none`、`visibility:hidden`、零高度 overflow:hidden
3. **逐个映射为图层节点**：
   - 位置/大小：`getBoundingClientRect()` → `{ x, y, width, height }`
   - 背景色：`getComputedStyle().backgroundColor` → `fills` (SOLID paint)
   - 边框：`border` / `border-top/left/right/bottom` → `strokes` + `strokeWeight`
   - 非统一边框：每边生成独立的 RECTANGLE 层
   - 圆角：`borderRadius` → `topLeftRadius` 等四个角
   - 阴影：`boxShadow` → `effects` (DROP_SHADOW)
   - 背景图：`background-image` → `fills` (IMAGE paint)
   - 图片：`<img>/<picture>/<video>` → IMAGE fill
   - SVG：`<svg>` → SVG 节点（outerHTML 整段传入）
4. **文本节点单独处理**：`TreeWalker` + `Range.getBoundingClientRect()` 精确获取文本包围盒
5. **可选构建图层树**：`makeTree()` 使用 LCA（最低公共祖先）算法重建 DOM 父子关系为 FRAME 嵌套
6. **可选约束推断**：`addConstraints()` 从 `margin:auto`、flex 对齐、`text-align` 推断 Figma 约束

### 3.4 code.ts 插件主线程

接收来自 UI 的 `{ layers }` 数据，为每个图层调用 Figma API：

| Layer 类型 | Figma API |
|-----------|-----------|
| FRAME/GROUP | `figma.createFrame()` |
| SVG | `figma.createNodeFromSvg()` |
| RECTANGLE | `figma.createRectangle()` |
| TEXT | `figma.createText()` |

字体匹配逻辑：
1. 解析 CSS `font-family` 字符串（如 `"Inter, -apple-system, sans-serif"`）
2. 遍历字体列表，与 `figma.listAvailableFontsAsync()` 结果做模糊匹配
3. 对于 `sans-serif`、`monospace` 等 CSS 通用族名，使用预设回退字体

---

## 四、踩坑记录

### 4.1 跨 frame 的 instanceof 检查全部失效（核心坑）

**现象**：htmlToFigma 能执行，但生成的 layers 几乎为空，提取不到任何图层。

**原因**：HTML 内容加载在 iframe 中（用于隔离渲染），但提取逻辑从父窗口调用。iframe 和父窗口各自有独立的 JavaScript 执行上下文和原型链，导致：

```javascript
// iframe 中的 SVG 元素，从父窗口检查：
iframeSvgElement instanceof SVGSVGElement  // → false ❌
iframeSvgElement instanceof SVGElement      // → false ❌
iframeImgElement instanceof HTMLImageElement // → false ❌
```

这导致 `getAppliedComputedStyles()` 对所有 iframe 元素返回 `{}`（因为 `el instanceof HTMLElement` 检查失败），整个提取逻辑无法识别任何元素。

**解决**：全部替换为跨 frame 兼容的检查方式：

```javascript
// ❌ 跨 frame 失效
el instanceof SVGSVGElement
el instanceof SVGElement
el instanceof HTMLImageElement
el instanceof HTMLPictureElement
el instanceof HTMLVideoElement
el instanceof HTMLElement
el instanceof Element
el instanceof Node

// ✅ 跨 frame 兼容
el.tagName === 'svg'                              // SVG 根元素
el.namespaceURI === 'http://www.w3.org/2000/svg' // 任意 SVG 子元素
el.tagName === 'IMG'                              // 图片
el.tagName === 'PICTURE'                          // Picture 元素
el.tagName === 'VIDEO'                            // 视频
el.nodeType === 1                                 // 任意元素（ELEMENT_NODE）
el.nodeType !== undefined                         // 任意节点
```

### 4.2 CSP 拦截外部资源

**现象**：控制台报错 `Loading the stylesheet 'https://fonts.googleapis.com/...' violates Content Security Policy`。

**原因**：Figma 插件环境有严格的 CSP，不允许加载外部样式表。HTML 中引用的 Google Fonts、外部 CSS 链接会被全部拦截。

**解决**：在将 HTML 加载到 iframe 之前，用正则表达式去掉外部资源引用：

```javascript
html
  .replace(/<link[^>]*href=["']https?:\/\/[^"']*["'][^>]*\/?>/gi, '')
  .replace(/@import\s+url\(['"]?https?:\/\/[^'")\s]*['"]?\)/gi, '');
```

Google Fonts 等外部字体会被去掉，文本回退到本地可用字体（在 code.ts 的字体匹配中处理）。

### 4.3 内联元素含 block 子元素导致包围盒错误

**现象**：某些元素的 `getBoundingClientRect()` 返回的宽高与实际渲染不一致。

**原因**：当 inline 元素包含 block 级子元素时，inline 元素的包围盒可能比子元素更宽，直接用会得到错误的尺寸。

**解决**：实现了智能包围盒逻辑——如果元素是 inline 且有子元素，计算子元素的聚合包围盒（aggregate rect），取子元素宽度和父元素宽度中的较大值：
```javascript
if (display.includes('inline') && el.children.length) {
  var aggregateRect = getAggregateRectOfElements(children);
  if (elRect.width > aggregateRect.width) {
    return { ...aggregateRect, width: elRect.width };
  }
  return aggregateRect;
}
```

### 4.4 非统一边框的处理

**现象**：CSS 允许每个边有不同的边框宽度和颜色，但 Figma 的 RECTANGLE 只支持统一边框。

**解决**：检查四个方向的边框是否相同。如果不同（尺寸或颜色不一致），则不设置主节点的 `strokes`，而是为每个有边框的方向单独创建一个细长的 RECTANGLE 图层来表示那条边。

### 4.5 字体回退链

**现象**：HTML 中通常使用 `font-family: "Inter", -apple-system, "Noto Sans SC", sans-serif` 这样的回退链，但 Figma 只有有限的内置字体。

**解决**：
1. 在 ui.html 的提取阶段保留原始 CSS `font-family` 字符串
2. 在 code.ts 中解析回退链，从列表中找到第一个 Figma 可用的字体
3. 对 CSS 通用族名（serif、sans-serif、monospace 等）预设平台回退字体

### 4.6 文本溢出校正

**现象**：Figma 中创建的文本节点，由于字体渲染差异（CSS 字体 vs Figma 字体），实际尺寸可能比 HTML 中大一些。

**解决**：创建文本后检测溢出，逐步减小字号直到文本适合原始边界框（最多减少约 30%）：
```typescript
while (text.height > originalHeight * 1.2 || text.width > originalWidth * 1.2) {
  if (adjustments++ > originalFontSize * 0.3) break;
  text.fontSize = text.fontSize - 1;
}
```

---

## 五、文件结构

```
html-to-figma/
├── code.ts              # Figma 插件主线程（接收 layers，创建节点）
├── code.js              # esbuild 构建产物
├── manifest.json         # Figma 插件清单
├── ui.html              # 插件 UI + 内联的 htmlToFigma 提取器
├── src/
│   ├── types.ts         # LayerNode 类型定义
│   └── utils.ts         # 颜色解析工具（parseColor, hexToRgb 等）
├── tests/
│   ├── utils.test.ts    # 颜色解析单元测试
│   └── fixtures/        # 测试用 HTML 文件
├── samples/
│   └── reference.html   # 参考测试 HTML
└── docs/
    └── implementation-guide.md  # 本文档
```

### 为什么主要的提取逻辑都在 ui.html 的 `<script>` 标签中？

Figma 插件限制：插件 UI 必须是一个自包含的 HTML 文件，不能引用外部 JavaScript 文件（除非通过 `postMessage` 通信）。因此 htmlToFigma 函数（约 400 行）必须全部内联在 `<script>` 标签中。

TypeScript 源文件（`src/` 目录）用于 code.ts 和单元测试，但不参与 UI 端的运行。

---

## 六、关键设计决策总结

| 决策 | 选择 | 原因 |
|------|------|------|
| 坐标体系 | 绝对定位（getBoundingClientRect） | 不重建 CSS 布局，避免阻抗不匹配 |
| 图层结构 | 扁平数组 + 可选树结构（useFrames） | 快速导出用扁平，需要分组用树 |
| 提取位置 | iframe 内渲染，父窗口提取 | 隔离 HTML 环境，避免污染 Figma UI |
| 跨 frame 检查 | tagName / nodeType / namespaceURI | instanceof 在跨 frame 场景下失效 |
| 字体处理 | 保留原始 CSS 字符串，在主线程匹配 | 解耦提取和渲染，灵活处理回退 |
