# HTML to Figma Plugin — 设计文档

> 2026-05-20 | 状态：已确认

## 概述

将 AI 生成的静态 HTML 单页面高保真转换为 Figma 设计稿的 Figma Plugin。保留 Auto Layout 结构，剔除动效和交互元素。

## 约束条件

- AI HTML 为纯原始输出，无人工修改
- 社区 html-to-figma 插件不开源，仅作思路参考
- 定向优化 AI 输出模式，不求通用
- 单向转换：HTML → Figma，不做反向同步

---

## 1. 架构

三层管线，全部在 Figma Plugin 沙箱内运行：

```
Plugin UI (文件选择/预览) → HTML Sanitizer (清洗) → Figma Node Builder (建节点)
```

- **Plugin UI**：右侧面板 iframe，负责文件选择、预览、触发生成
- **HTML Sanitizer**：DOMParser 解析 → 清洗规则 → 干净 DOM Tree + 合并样式
- **Figma Node Builder**：递归遍历 DOM → 映射规则 → Figma Frame/Text/AutoLayout

---

## 2. HTML 清洗规则

### 移除项

| 类别 | 内容 |
|------|------|
| 脚本 | `<script>` |
| 事件 | `onclick`/`onmouseover`/`onload` 等所有 `on*` 属性 |
| 动效 CSS | `animation`、`transition`、`@keyframes`；`transform` 仅保留纯布局用途（如 rotate 固定值） |
| 交互态 | `:hover`、`:active`、`:focus` 伪类 |
| 非静态元素 | `<canvas>`、`<video>`、`<audio>`、`<iframe>` |
| 隐藏元素 | `display:none`、`visibility:hidden`、`aria-hidden="true"` |
| 无关标签 | `<meta>`、`<link>`、`<noscript>` |

### 保留项

| 类别 | 内容 |
|------|------|
| 布局 | `display`(flex/grid/block)、`flex-direction`、`gap`、`align-*`、`justify-*` |
| 盒模型 | `width`、`height`、`margin`、`padding`、`box-sizing` |
| 视觉 | `color`、`background`、`border`、`border-radius`、`box-shadow`、`opacity` |
| 文字 | `font-*`、`line-height`、`text-align` |
| 图片 | `<img>`，`src` 转 base64 |
| SVG | `<svg>` 内联保留 |

### CSS 样式合并

解析 `<style>` 标签 + 内联 `style` 属性，按优先级合并为每个元素的计算样式对象。同时展开 CSS 简写属性为独立值。

---

## 3. DOM → Figma 节点映射

### 容器 → AutoLayout Frame

| HTML 特征 | Figma 节点 | 映射 |
|-----------|-----------|------|
| `display:flex`/`inline-flex` | AutoLayout Frame | `flex-direction:row`→HORIZONTAL, `column`→VERTICAL |
| `display:grid` | AutoLayout Frame (每行一个) | 按 `grid-template-columns` 比例分配子元素宽度；仅处理显式 grid，不处理命名区域/隐式轨道 |
| `display:block`/默认 | AutoLayout Frame (VERTICAL) | 块级垂直排列 |

### Auto Layout 属性映射

| CSS | Figma 属性 |
|-----|-----------|
| `flex-direction` | `layoutMode` |
| `justify-content` | `primaryAxisAlignItems` |
| `align-items` | `counterAxisAlignItems` |
| `gap` | `itemSpacing` |
| `padding` | `paddingTop/Right/Bottom/Left` |
| `flex-wrap:wrap` | `layoutWrap:"WRAP"` |

### 叶子节点

| HTML | Figma 节点 |
|------|-----------|
| `<p>` `<span>` `<h1>`-`<h6>` `<a>` `<li>` `<label>` | TextNode |
| `<img>` | Rectangle + ImageFill (base64) |
| `<svg>` | VectorNode |
| `<hr>` | LineNode |
| `<br>` | 换行符(TextNode 内) |
| `<input>` `<textarea>` `<select>` | Rectangle + TextNode 组合（静态外观） |
| `<button>` | AutoLayout Frame + TextNode（静态外观） |

### 递归遍历伪代码

```
traverse(domEl, parentFigmaNode):
  1. 创建 Figma 节点
  2. 应用样式（尺寸/颜色/字体/边距/圆角/阴影）
  3. 容器 → 设置 AutoLayout 属性
  4. 叶子 → append 到 parent
  5. 递归子元素
  6. append 当前节点到 parent
```

---

## 4. Plugin UI & 操作流程

### 三步流程

1. **选择 HTML 文件**：`<input type="file">` 多选 .html
2. **预览 & 命名**：画板名称 + iframe 缩略图预览
3. **确认生成**：生成到当前页面或新页面

### 交互细节

- 批量导入：多文件 → 多个 Frame，横向排列，间距 100px
- 画板尺寸：取 `<body>` 实际宽高；可手动指定
- 预览：清洗后 HTML 在 iframe 缩略图 (`scale(0.3)`)
- 生成位置：画布中心；批量时自动排列

### 刻意删减（不需要）

- URL 输入
- zip 上传
- 逐元素编辑
- 反向同步 (Figma → HTML)

---

## 5. 边界情况

| 场景 | 处理 |
|------|------|
| 无 `<body>` | 以 `<html>` 为根 |
| 超大文件 (>10MB) | 拒绝 + 提示拆分 |
| 外部 URL 图片 | fetch → base64；失败用占位图 |
| 嵌套 >50 层 | 截断 + 警告 |
| `position:absolute/fixed` | 放弃 AutoLayout，x/y 坐标 |
| CSS `var()` | 解析 `:root` 定义；无定义用默认值 |
| `rem`/`em` | 固定 `1rem=16px` |
| `@media` | 忽略，以默认样式为准 |
| 空元素 | 保留为 0x0 Frame |
| 特殊字符/Emoji | 直接透传 |
| 字体不可用 | 降级为 Figma 默认字体（Inter），警告提示 |

## 6. 测试策略

| 层级 | 内容 | 方法 |
|------|------|------|
| Sanitizer 单测 | 清洗规则正确性 | HTML 片段 + 断言 DOM |
| Mapper 单测 | CSS → Figma 属性 | 样式对象 + 断言节点属性 |
| 集成测试 | 完整 HTML → 节点树 | 现有 AI HTML 文件 |
| 视觉对比 | 保真度 | 浏览器截图 vs Figma 导出 |

测试用例：从 Downloads 目录选取 5-8 个代表不同布局风格的 AI HTML 文件。

---

## 7. 技术选型

- **运行环境**：Figma Plugin (sandboxed iframe)
- **HTML 解析**：`DOMParser` (Figma 沙箱内置)
- **CSS 解析/合并**：自实现轻量 CSS parser（处理 `<style>` + 内联样式）
- **图片处理**：`fetch` + `FileReader` 转 base64
- **单位转换**：px 直通；rem/em 固定基准；百分比按父元素计算
