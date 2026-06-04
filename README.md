# HTML to Figma

将本地 HTML 文件转换为 Figma 图层的 Figma 插件。会自动提取文本、颜色、背景、边框、阴影、渐变等样式，并在 Figma 画布中重建为矩形、文本和 Frame 层级树。

## 解决的问题

| 场景 | 无插件时 | 用本插件 |
|------|---------|---------|
| 设计稿还原 | 手动测量 HTML 页面的间距、颜色、字号 | 拖入 HTML → 一键转换 |
| Tailwind 页面 | Tailwind CDN 在 Figma iframe 被 CSP 拦截，样式全丢 | 预处理脚本 → 编译为静态 CSS |
| 内联标签排版 | `<strong>`/`<em>` 拆分文本导致 Figma 中错位 | 自动合并相邻文本节点，字符级换行 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建

```bash
npm run build
```

### 3. 导入 Figma

1. 打开 Figma → Plugins → Development → **Import plugin from manifest...**
2. 选择项目根目录的 `manifest.json`
3. 运行插件 → **拖入 `.html` 文件** → 点击 "Generate in Figma"

## 预处理（Tailwind / CDN 样式）

如果 HTML 使用了 **Tailwind CDN**、**Google Fonts** 或其他外部 CSS，必须先预处理。

### 安装 Playwright（首次）

```bash
npm run server:install
```

### 运行预处理

```bash
npm run preprocess -- <input.html> [output.html]
```

示例：

```bash
npm run preprocess -- samples/page.html
# 输出 → samples/page_inlined.html
```

预处理做了三件事：
1. **Playwright 渲染** HTML，让 Tailwind CDN 编译所有 utility class 为 `<style>` 块
2. **移除外部依赖**：`<script src="...">`、`@import url(...)` 全部剔除
3. **保留 DOM 内容**：JS 生成的动态内容（tab 切换等）已渲染为静态 HTML

**预处理后的 `_inlined.html` 拖入插件即可。**

## 项目结构

```
├── code.ts             # Figma 插件主线程（接收 LayerNode → 创建 Figma 节点）
├── code.js             # esbuild 编译输出
├── ui.html             # 插件 UI + 提取引擎（DOM → LayerNode）
├── src/
│   ├── types.ts        # 类型定义 LayerNode / Paint / ShadowEffect
│   └── utils.ts        # 颜色解析 hex/rgb/hsl/named-colors
├── scripts/
│   └── inline-styles.js  # Playwright 预处理器（Tailwind CDN → 静态 CSS）
├── server/             # 服务端 Playwright 提取管线（HTTP API，可选）
├── tests/              # vitest 单元测试
├── manifest.json       # Figma 插件配置
└── samples/            # 测试用 HTML 样本
```

## 支持与限制

| 支持 | 不支持 |
|------|--------|
| `background-color` / 渐变 / 背景图 | 外部图片需网络可访问 |
| `border` (四边 + 圆角) | `border-image` |
| `box-shadow` / `opacity` | `filter` / `backdrop-filter` |
| `font-size` / `font-family` / `color` | 多 weight 字体需 Figma 支持 |
| `line-height` / `letter-spacing` / `text-align` | 内联加粗/颜色合并后丢失（已知取舍） |
| SVG `<svg>` 元素 | Canvas / Chart.js 图表 |
| 自动构建 Frame 层级树 | `z-index` / `position: sticky` |

## 开发

```bash
npm run typecheck   # TypeScript 类型检查
npm run test        # 运行测试
npm run build       # 编译 code.ts → code.js
npm run server      # 启动服务端 API（可选）
```

## 版本记录

| Tag | 说明 |
|-----|------|
| `v3-stable-text-merge-fix` | mergeAdjacentText 合并方案 — 当前 |
| `v2-stable-before-autolayout-text` | 预处理 viewport + line-height 修复 |
| `v1-stable-before-tailwind-fix` | 初始版本（仅内联样式） |
