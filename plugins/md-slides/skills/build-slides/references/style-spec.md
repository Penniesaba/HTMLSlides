# 样式规范（agent 执行版）

目标：纯白、细线、暗红强调、系统字体、markdown 感。所有样式已经写在 `<plugin-root>/assets/template.html` 的固定 CSS 里（plugin root = 本 skill 目录向上两级）。agent 只写结构，不写 CSS，不用 `style=` 内联样式。

## 1. 色板与字体

```css
--ink: #1a1a1a;        /* 正文 */
--ink-soft: #555;      /* 次要文字 */
--faint: #888;         /* 更弱 */
--line: #e2e2e2;       /* 细分隔线 */
--line-strong: #cfcfcf;
--bg: #ffffff;
--accent: #9b1c1c;     /* 暗红强调 */
--link: #1f3a8a;       /* 链接 */
--code-bg: #f6f6f6;
```

- 正文：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
- 等宽：`"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`
- 不加载外部字体。

## 2. 页面骨架

每一页：

```html
<section class="slide content" data-title="页面标题">
  <div class="slide-content">
    ...
  </div>
</section>
```

- `section` 必须有 `.slide` 和 `data-title`（总览用）。
- 每页必须自带 `.slide-content`；模板 JS 不自动包裹。
- 不要手动写页码、进度条、总览；模板 JS 负责。
- 不要写 `<style>`、`style=`、`<script>`、外部资源。

## 3. B 标题区

### 3.1 单 H3 页

```html
<div class="breadcrumb">
  <span>背景</span><span class="sep">/</span><span>行业现状</span>
</div>
<h1 class="slide-title">从模型安全到 agent 安全</h1>
```

### 3.2 单 H2 页

```html
<div class="breadcrumb"><span>背景</span></div>
<h1 class="slide-title">行业现状</h1>
```

### 3.3 H1 页

不写面包屑：

```html
<h1 class="slide-title">背景</h1>
```

### 3.4 多 H3 / 多 H2 页

主标题停在 H2 或 H1；页内小节用：

```html
<h3 class="sub">案例 A：边界清楚</h3>
```

- 面包屑只显示主标题的祖先。
- 主标题是 H3 时，面包屑是 `H1 / H2`。
- 主标题是 H2 时，面包屑是 `H1`。
- 主标题是 H1 时，不写面包屑。
- 编号永远不出现在标题里。

## 4. 封面

封面由 agent 从 frontmatter 生成，放在最前面：

```html
<section class="slide cover" data-title="封面">
  <div class="slide-content">
    <div class="kicker">领域综述汇报 · 2026</div>
    <h1 class="cover-title">Agent Security</h1>
    <p class="cover-sub">智能体安全</p>
  </div>
  <div class="cover-meta">张三 · 2026-10-20</div>
</section>
```

- 没有 kicker/subtitle/author/date 就省略对应元素。
- 不加“按 → 开始”提示。
- 封面无页码；模板 JS 自动隐藏。

## 5. 目录

```html
<section class="slide toc" data-title="目录">
  <div class="slide-content">
    <h1 class="toc-title">目录</h1>
    <div class="toc-list">
      <a class="toc-item lvl1" data-goto="3">背景</a>
      <a class="toc-item lvl2" data-goto="4">行业现状</a>
    </div>
  </div>
</section>
```

- `data-goto` 是 1-based 页码，和右下角页码一致。
- 不显示编号、页码。
- 目录项文字是剥掉编号后的标题文字。
- 员工没写目录时，agent 用 H1/H2 自动生成同样的结构。

## 6. 分区页

```html
<section class="slide divider" data-title="背景">
  <div class="slide-content">
    <div class="divider-line"></div>
    <h1 class="divider-title">背景</h1>
    <p class="divider-desc">一句话说明。</p>
  </div>
</section>
```

- 只在“整页只有 H1”时使用。
- 说明可省略。

## 7. 正文元素

### 7.1 段落、列表、强调

```html
<p>普通段落，<strong>加粗</strong>，<em>斜体</em>，<code>行内代码</code>。</p>
<ul>
  <li>第一点</li>
  <li>第二点</li>
</ul>
```

### 7.2 注释

Markdown 中以 `>` 开头的行是作者注释，不生成任何 HTML。

- 不要输出 `<blockquote>`；validator 会把它当作 error。
- 注释不占版面；观众需要看到的内容不能写在注释里。

### 7.3 表格

```html
<table>
  <thead><tr><th>维度</th><th>观察</th></tr></thead>
  <tbody>
    <tr><td>权限</td><td>只读当前任务</td></tr>
  </tbody>
</table>
```

### 7.4 代码

```html
<pre><code class="language-python">def allow(tool, scope):
    return tool in scope</code></pre>
```

- 代码里的 `<`、`>`、`&` 要转义为 `&lt;`、`&gt;`、`&amp;`。
- 不做语法高亮。

### 7.5 图片

```html
<figure>
  <img src="data:image/png;base64,..." alt="说明">
  <figcaption>图 1：说明</figcaption>
</figure>
```

- `src` 必须是 `data:image/...;base64,...`；不允许相对路径或远程 URL。
- 图注可选。
- 最多 3 张；并排用 `div.grid-2` 或 `div.grid-3`。
- 图片缺失或远程时，不要输出 `<img>`，用固定占位块：

```html
<figure>
  <div class="muted">[图片缺失] assets/missing.png — 原图说明</div>
  <figcaption>图 1：原图说明</figcaption>
</figure>
```

### 7.6 折叠块

```html
<details>
  <summary>展开看细节</summary>
  <div class="body">
    <p>细节内容。</p>
  </div>
</details>
```

## 8. 页面指令映射

| Markdown 指令 | HTML |
|---|---|
| `<!-- scrollable -->` | `<section class="slide content scrollable" ...>` |
| `<!-- grid: 2 -->` | `<div class="grid-2">` 包住图片 |
| `<!-- grid: 3 -->` | `<div class="grid-3">` 包住图片 |

## 9. 禁止清单

- 不写 `<style>` / `style=` / `<script>` / `<iframe>`。
- 不改模板 CSS/JS。
- 不手写页码、进度条、总览。
- 不显示标题编号。
- 不引入外部字体、CDN、图标库。
- 不覆盖非本插件生成的 HTML。
