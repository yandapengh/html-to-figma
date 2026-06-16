# HTML to Figma

把本地 HTML 文件转换成可编辑的 Figma 设计稿。

这个插件面向一个很具体的工作流：用 ChatGPT、Claude、Gemini、Cursor、v0 等 AI 工具先生成 HTML/CSS 页面，再把浏览器里的最终视觉结果导入 Figma，方便设计师继续二次编辑、调整版式、规范视觉系统。

当前版本重点是本地导入，不做网页工具栏捕获，也不依赖远程服务。

## 能力重点

- 本地 `.html` 文件拖拽导入 Figma。
- 使用 iframe 渲染 HTML，再读取浏览器最终布局结果。
- 停用动画、transition 和滚动动画，尽量捕获静态最终状态。
- 保留文本、颜色、圆角、边框、阴影、渐变、SVG 和 Frame 层级。
- 支持渐变文字，例如 `background-clip: text`。
- 支持多层背景渐变，包含常见 `linear-gradient`、`radial-gradient`、`conic-gradient`。
- 支持 `backdrop-filter: blur(...)` 到 Figma `BACKGROUND_BLUR` 的近似映射。
- 支持 `::before` / `::after` 中的文本内容，包括 `content: attr(...)`。
- 对高置信的 flex/grid 结构推断 Figma Auto Layout，复杂结构回退绝对定位以保证不明显错位。

## 当前版本说明

分支 `html-to-figma-fixed-v1` 主要修复了 LUMI AI 样例中的非图片高保真问题：

- 顶部 `LUMI AI` 不再变成横向渐变条，而是导入为渐变文本。
- 页面根背景保留浅紫色多层径向渐变。
- 玻璃卡片保留半透明背景、圆角、边框、阴影和背景模糊近似。
- 色板下方的 `#FFFFFF`、`#F3F4F6`、`Partner` 等伪元素文本会导入为独立 TextLayer。
- 字体匹配会参考 `font-weight` 和 `font-style`，不再只匹配 Regular。

图片导入不是本版本重点。对于 base64 图片或无法创建 image fill 的图片，允许保留灰色占位符。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建插件

```bash
npm run build
```

### 3. 在 Figma 中加载

1. 打开 Figma Desktop。
2. 进入 `Plugins -> Development -> Import plugin from manifest...`。
3. 选择项目根目录中的 `manifest.json`。
4. 运行插件。
5. 拖入 `.html` 文件。
6. 点击 `Generate in Figma`。

## 预处理外部依赖

Figma 插件环境不能可靠加载外部 CSS、Tailwind CDN、Google Fonts 或远程脚本。如果 HTML 依赖这些资源，建议先预处理成静态 HTML。

首次安装 Playwright 浏览器：

```bash
npm run preprocess:install
```

运行预处理：

```bash
npm run preprocess -- <input.html> [output.html]
```

示例：

```bash
npm run preprocess -- samples/page.html
```

默认会输出：

```text
samples/page_inlined.html
```

预处理会用 Playwright 渲染页面，保留最终 DOM，移除外部脚本和外部 `@import`，适合 Tailwind CDN 或动态生成 DOM 的 AI HTML 页面。

## 技术路线

插件分为两段：

- `ui.html`：插件 UI 和 DOM 提取器。负责渲染 HTML、冻结动画、读取 computed style、生成中间层数据。
- `code.ts`：Figma 主线程。负责接收中间层数据，创建 Frame、Rectangle、Text、SVG 等 Figma 节点。

中间格式定义在 `src/types.ts`，核心是 `ImportDocument` 和 `LayerNode`。

布局策略是混合策略：

- 先用 `getBoundingClientRect()` 保证视觉位置接近浏览器。
- 对高置信 flex/grid 容器生成 Auto Layout。
- 对 transform、overlap、复杂 wrap 或不稳定结构保留绝对定位。

## 支持情况

| 能力 | 当前状态 |
| --- | --- |
| 文本、字号、行高、字距 | 支持 |
| 字体 fallback、字重、斜体匹配 | 支持 |
| 纯色填充、透明度 | 支持 |
| 线性/径向/角向渐变 | 支持常见场景 |
| 渐变文字 | 支持 |
| 圆角、边框 | 支持 |
| 多层 box-shadow、inset shadow | 支持基础映射 |
| backdrop blur | 支持近似映射 |
| `::before` / `::after` 文本 | 支持基础文本 |
| SVG | 支持 |
| 图片 | 当前允许占位符 |
| canvas / Chart.js | 暂不作为重点 |
| sticky、复杂 z-index、复杂 filter | 暂不完整支持 |

## 开发命令

```bash
npm run typecheck
npm test
npm run build
```

## 项目结构

```text
code.ts                 Figma 插件主线程
code.js                 构建产物
ui.html                 插件 UI 和当前内联提取器
src/types.ts            ImportDocument / LayerNode / Paint 类型
src/extractor.ts        提取器类型边界
src/utils.ts            颜色解析工具
scripts/inline-styles.js Playwright HTML 预处理脚本
tests/                  Vitest 单元测试
samples/                示例 HTML
manifest.json           Figma 插件清单
```

## 验证样例

本版本使用 `LUMI_AI_character_strategy_rebuilt.html` 作为重点回归样例，验证点包括：

- 根 Frame 有浅紫色多层背景。
- `LUMI AI` 是渐变 TextLayer。
- 玻璃卡片有 background blur 和 shadow。
- 色板伪元素文本可以导入。
- 图片区域允许继续作为灰色占位。

## 设计原则

这个项目不是截图工具，也不是官方 Figma Capture 的复刻。它的目标是把 AI 生成的 HTML 页面转成设计师可以继续编辑的 Figma 设计稿。

当高保真和可编辑性冲突时，本项目优先保证视觉不明显错位，再在高置信结构上尽量保留 Auto Layout。
