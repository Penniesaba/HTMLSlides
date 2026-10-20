# md-slides 双平台插件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个同时适用于 Claude Code 和 Codex 的 `md-slides` 插件：按固定 Markdown 标准，把一份 `.md` 转成一个真正自包含的 HTML 幻灯片，风格继承 `example/演示.html`，但更简洁。

**Architecture:** 一个共享 Skill（`build-slides`）+ 一个固定 HTML/CSS/JS 模板 + 一个零依赖校验器。Agent 读取 Markdown、按页面模型生成 HTML、套用模板、内嵌图片，最后用校验器自检。Claude Code 和 Codex 各有一份薄清单，共用 `skills/`、`assets/`、`scripts/`。

**Tech Stack:** Markdown、原生 HTML/CSS/JS、Node.js 18+（仅校验器，零依赖）、Claude Code 2.1.304、Codex CLI 0.163.0。

**Spec:** `docs/superpowers/specs/2026-10-20-md-slides-plugin-design.md`

## Global Constraints

- 插件根：`plugins/md-slides/`；仓库根是 marketplace 根。
- 输出：`foo.md` → 同目录 `foo.html`；若目标已存在且不是本插件生成，写 `foo.slides.html`。
- 图片：本地相对路径，生成时全部转 `data:image/...;base64,...`；缺失/远程图片用占位块 + warning，输出不得有外部引用。
- 分页：只有独立 `---` 行；agent 不得自行拆页/合页。
- 标题：H1 部分、H2 小节、H3 主题；员工手写编号，slides 中不显示。
- 标题区：方案 B，`H1 / H2` 面包屑 + H3 主标题；多 H3 时主标题停在 H2；多 H2 时停在 H1。
- 页码：右下角 `current / total`；封面不显示但计入；目录/分区/内容页显示。
- 目录：H1 + H2；员工写则用，缺省自动生成；不显示编号和页码；可点击。
- 模板：`assets/template.html` 的 CSS/JS 必须逐字保留；只替换 `{{LANG}}`、`{{TITLE}}`、`{{COVER}}`、`{{SLIDES}}`。
- 不引入 hooks、MCP、CDN、外部字体、构建步骤。
- 生成内容只用模板 class；除模板固定属性外，不允许 `style=` 内联样式。
- `data-goto` 使用 1-based 页码，与显示页码一致；`#sN` 也是 1-based。
- 所有 `git` 命令在仓库根 `/home/xiao/Project/HTMLSlides` 执行；测试步骤里 `cd` 进插件后，commit 前先回到仓库根。
- 每次 commit 以 `Co-Authored-By: Claude Code <noreply@anthropic.com>` 结尾。
- v1 中文优先；`lang: en` 可渲染英文正文，UI chrome 仍以中文为主；目录识别兼容 `目录` / `Contents`。

## Review Focus

- **一页多个 H3**：主标题必须停在 H2，不能取第一个 H3；Task 4 的测试覆盖。
- **整页无标题**：按续页处理，继承上一页标题栈并追加“（续）”，不能崩；Task 4 的测试覆盖。
- **图片缺失/远程**：生成占位块 + warning，HTML 中不得出现相对路径或远程 `src`；Task 6 的测试覆盖。
- **目录缺失/漏项**：缺目录自动生成，漏项保留原文 + warning，不能阻断生成；Task 5 的测试覆盖。
- **输出已存在且非本插件生成**：必须写 `foo.slides.html`，不能覆盖；Task 9 的端到端检查覆盖。

---

### Task 0: 初始化工作区与版本基线

**Files:**
- Create: `.gitignore`

**Interfaces:**
- Consumes: 无
- Produces: 可用的 git 仓库；后续任务每个 commit 的基线。

- [ ] **Step 1: 确认当前目录不是 git 仓库**

Run: `git -C /home/xiao/Project/HTMLSlides rev-parse --is-inside-work-tree`
Expected: 非零退出，输出包含 `not a git repository`。

- [ ] **Step 2: 初始化仓库并写 `.gitignore`**

```bash
cd /home/xiao/Project/HTMLSlides
git init
```

`.gitignore` 内容：

```gitignore
.superpowers/
node_modules/
*.log
.DS_Store
```

- [ ] **Step 3: 提交设计文档作为基线**

```bash
git add .gitignore docs/superpowers/specs/2026-10-20-md-slides-plugin-design.md
git commit -m "docs: add md-slides plugin design" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

- [ ] **Step 4: 验证**

Run: `git -C /home/xiao/Project/HTMLSlides status --short`
Expected: 无输出（干净）。

Run: `git -C /home/xiao/Project/HTMLSlides log --oneline -1`
Expected: 显示 `docs: add md-slides plugin design`。

---

### Task 1: 规范参考文档

**Files:**
- Create: `plugins/md-slides/skills/build-slides/references/markdown-standard.md`
- Create: `plugins/md-slides/skills/build-slides/references/page-model.md`

**Interfaces:**
- Consumes: 设计文档第 5、6 节。
- Produces: 供 Task 7 的 `SKILL.md` 和员工阅读的规范正文；标题算法伪代码。

- [ ] **Step 1: 写 `markdown-standard.md`**

从设计文档第 5 节抽取并整理为员工可读的规范，必须包含：

- frontmatter 字段与示例。
- `---` 分页、`***` 页内分隔线。
- H1/H2/H3 语义、编号格式、编号不显示。
- 目录写法（H1 + H2，嵌套列表，不写编号/链接/页码）。
- 页面类型：封面自动、目录、分区页、内容页、续页。
- 正文元素：段落、列表、链接、引用、表格、代码、图片、`***`、`<details>`。
- 页面指令：`<!-- scrollable -->`、`<!-- grid: 2 -->`、`<!-- grid: 3 -->`。
- 密度建议。
- 一个完整的 5 页示例。

- [ ] **Step 2: 写 `page-model.md`**

从设计文档第 6 节抽取，包含：

- 标题栈定义。
- “唯一且祖先也唯一”的选标题算法。
- 多 H3、多 H2、无标题、多 H1 的判定表。
- 面包屑 B 的 HTML 形状。
- 目录匹配规则与自动生成规则。

- [ ] **Step 3: 验证关键词齐全**

```bash
cd /home/xiao/Project/HTMLSlides/plugins/md-slides
grep -q 'frontmatter' skills/build-slides/references/markdown-standard.md
grep -q 'scrollable' skills/build-slides/references/markdown-standard.md
grep -q 'grid: 2' skills/build-slides/references/markdown-standard.md
grep -q '祖先也唯一' skills/build-slides/references/page-model.md
grep -q '续页' skills/build-slides/references/page-model.md
```

Expected: 五条命令都退出 0。

- [ ] **Step 4: 提交**

```bash
git add plugins/md-slides/skills/build-slides/references/
git commit -m "docs: add markdown and page-model standards" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: HTML 模板与参考示例

**Files:**
- Create: `plugins/md-slides/assets/template.html`
- Create: `plugins/md-slides/examples/example.md`
- Create: `plugins/md-slides/examples/example.html`
- Create: `plugins/md-slides/examples/assets/sample.svg`

**Interfaces:**
- Consumes: 设计文档第 7、9 节。
- Produces:
  - 模板占位符：`{{LANG}}`、`{{TITLE}}`、`{{COVER}}`、`{{SLIDES}}`。
  - 必需结构：`#progress`、`.deck#deck`、`.slide`、`#pageno`、`#overview`、`#ovgrid`、内联 `<script>`。
  - 页面 class：`.slide`、`.slide-content`、`.cover`、`.toc`、`.divider`、`.content`、`.scrollable`、`.grid-2`、`.grid-3`。
  - 标题结构：`.breadcrumb`、`.slide-title`、`.sub`。
  - 跳转：目录项 `data-goto` 为 1-based 页码，与右下角页码一致。

- [ ] **Step 1: 写模板骨架**

`assets/template.html` 第一行必须是：

```html
<!-- md-slides template v1 -->
```

文件结构：

```html
<!DOCTYPE html>
<html lang="{{LANG}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <style>/* 固定 CSS */</style>
</head>
<body>
  <div id="progress"></div>
  <div class="deck" id="deck">
    {{COVER}}
    {{SLIDES}}
  </div>
  <div id="pageno"></div>
  <div id="overview"><h3>幻灯片总览 · 点击跳转（ESC 关闭）</h3><div class="ovgrid" id="ovgrid"></div></div>
  <script>/* 固定 JS */</script>
</body>
</html>
```

CSS 必须实现设计文档 7.1–7.8：色板、字体、B 标题、封面、目录、分区页、内容页、表格、代码、引用、图片、页码、进度条、总览、移动端。

- [ ] **Step 2: 写固定 JS**

参考 `example/演示.html` 的脚本，但按本设计调整：

- 收集 `.slide`，计算 `total`；不要像 example 那样自动包 `.slide-content`——每页 HTML 必须自带 `.slide-content`。
- `show(n)` 切换 active；更新 `#pageno` 为 `n / total`；封面 active 时隐藏 `#pageno`。
- `data-goto` 是 1-based：点击时 `show(parseInt(el.dataset.goto) - 1)`。
- 普通页 `fit()`：从 1.0 缩到 0.5；仍超出时给该页加 `scrollable`；`.scrollable` 页跳过缩放。
- 键盘：←/→、空格、PageUp/PageDown、Home/End、Escape。
- 点击左 28% / 右 72% 翻页；避开 `a,summary,details,table,.toc-item,button`。
- 进度条宽度：`n/(total-1)`。
- ESC 总览：根据 `data-title` 生成卡片，点击跳转。
- `#sN` 深链；初始按 hash 打开。
- `prefers-reduced-motion` 时关闭淡入。

- [ ] **Step 3: 写 `examples/example.md`**

必须覆盖：

- frontmatter：title/subtitle/kicker/author/date/lang。
- 目录页（H1 + H2）。
- 分区页（只有 H1）。
- 单 H3 内容页。
- 多 H3 同页（标题应停在 H2）。
- 多 H2 同页（标题应停在 H1）。
- 续页（无标题）。
- 表格、引用、代码、图片、`<details>`、`<!-- scrollable -->`、`<!-- grid: 2 -->`。

- [ ] **Step 4: 写 `examples/assets/sample.svg`**

一个 400×220 的简单 SVG 示意图（白底、细线、暗红强调），供 `example.md` 引用；不要用外部图片。

- [ ] **Step 5: 手工生成 `examples/example.html`**

用 `assets/template.html` 的 CSS/JS，填入 `example.md` 对应的封面、目录、页面；把 `sample.svg` 读成 base64 后写成 `data:image/svg+xml;base64,...`。这是视觉基准，不是最终 agent 输出。

- [ ] **Step 6: 结构验证**

```bash
cd /home/xiao/Project/HTMLSlides/plugins/md-slides
grep -q 'md-slides template v1' assets/template.html
grep -q 'id="pageno"' assets/template.html
grep -q 'id="overview"' assets/template.html
grep -q 'id="progress"' assets/template.html
grep -q 'data:image/svg+xml;base64' examples/example.html
! grep -q 'src="assets/sample.svg"' examples/example.html
```

Expected: 前五条退出 0，最后一条退出 0（没有相对图片引用）。

- [ ] **Step 7: 浏览器目检**

在浏览器打开 `examples/example.html`，逐项检查：

- 封面无页码；第 2 页开始有 `2 / N`。
- B 面包屑：H1 / H2 一行，H3 主标题。
- 多 H3 页主标题是 H2。
- 多 H2 页主标题是 H1，无面包屑。
- 目录两级、无编号、无页码、可点击。
- ESC 总览、`#s3`、键盘、点击翻页、进度条可用。
- 图片已内嵌，断网仍显示。

- [ ] **Step 8: 提交**

```bash
git add plugins/md-slides/assets/template.html plugins/md-slides/examples/
git commit -m "feat: add HTML template and reference deck" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Validator 解析与编号

**Files:**
- Create: `plugins/md-slides/scripts/validate.mjs`
- Create: `plugins/md-slides/scripts/validate.test.mjs`

**Interfaces:**
- Consumes: 无。
- Produces（后续任务依赖的精确签名）：
  - `stripNumber(raw: string) -> { number: string|null, title: string }`
  - `parseFrontmatter(source: string) -> { data: object, body: string, warnings: string[] }`
  - `splitPages(body: string) -> string[]`
  - `parseHeadings(page: string) -> Heading[]`，`Heading = { level: 1|2|3, raw: string, number: string|null, title: string }`
  - CLI 入口：`node scripts/validate.mjs <input.md> [output.html]`

- [ ] **Step 1: 写失败测试**

`scripts/validate.test.mjs`：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { stripNumber, parseFrontmatter, splitPages, parseHeadings } from './validate.mjs'

test('stripNumber removes a dotted number', () => {
  assert.deepEqual(stripNumber('2.4.2 Conditional Access Optimization Agent'),
    { number: '2.4.2', title: 'Conditional Access Optimization Agent' })
})

test('stripNumber keeps a title that starts with a year', () => {
  assert.deepEqual(stripNumber('2026 年趋势'), { number: null, title: '2026 年趋势' })
})

test('stripNumber keeps GPT-5', () => {
  assert.deepEqual(stripNumber('GPT-5 的能力边界'), { number: null, title: 'GPT-5 的能力边界' })
})

test('stripNumber accepts a trailing dot', () => {
  assert.deepEqual(stripNumber('2.4. 案例分析'), { number: '2.4', title: '案例分析' })
})

test('parseFrontmatter returns data and body', () => {
  const src = '---\ntitle: Demo\nlang: zh-CN\n---\n\n# 1 背景\n'
  const r = parseFrontmatter(src)
  assert.equal(r.data.title, 'Demo')
  assert.equal(r.data.lang, 'zh-CN')
  assert.match(r.body, /# 1 背景/)
})

test('splitPages ignores the frontmatter delimiter', () => {
  const src = '---\ntitle: Demo\n---\n\npage one\n\n---\n\npage two\n'
  const pages = splitPages(parseFrontmatter(src).body)
  assert.equal(pages.length, 2)
  assert.match(pages[0], /page one/)
  assert.match(pages[1], /page two/)
})

test('parseHeadings parses levels and numbers', () => {
  const hs = parseHeadings('# 1 背景\n\n## 1.1 行业现状\n\n### 1.1.1 案例\n')
  assert.deepEqual(hs.map(h => [h.level, h.number, h.title]), [
    [1, '1', '背景'],
    [2, '1.1', '行业现状'],
    [3, '1.1.1', '案例'],
  ])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/xiao/Project/HTMLSlides/plugins/md-slides && node --test scripts/validate.test.mjs`
Expected: FAIL，报 `Cannot find module './validate.mjs'` 或导出缺失。

- [ ] **Step 3: 实现最小解析逻辑**

在 `scripts/validate.mjs` 中实现上述四个导出：

- 编号正则：`/^(\d+(?:\.\d+)*)[.、]?\s+/`。
- 只剥离行首编号；`2026 年趋势`、`GPT-5` 不剥。
- frontmatter 只认文件最开头的一对 `---`；正文中其余 `---` 是分页。
- `splitPages` 去掉每页首尾空行。
- 标题只解析 ATX `#`/`##`/`###`，忽略代码块内的 `#`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /home/xiao/Project/HTMLSlides/plugins/md-slides && node --test scripts/validate.test.mjs`
Expected: PASS，7 个测试全过。

- [ ] **Step 5: 提交**

```bash
git add plugins/md-slides/scripts/validate.mjs plugins/md-slides/scripts/validate.test.mjs
git commit -m "feat: add markdown parser and numbering validator" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 标题选择与页面分类

**Files:**
- Modify: `plugins/md-slides/scripts/validate.mjs`
- Modify: `plugins/md-slides/scripts/validate.test.mjs`

**Interfaces:**
- Consumes: Task 3 的 `Heading`、`parseHeadings`。
- Produces:
  - `selectPageTitle(headings: Heading[]) -> { main: Heading|null, breadcrumb: Heading[], warnings: string[] }`
  - `classifyPage(page: string, previous: Heading[]|null) -> { type: 'toc'|'divider'|'content'|'continuation', main: Heading|null, breadcrumb: Heading[], warnings: string[] }`

- [ ] **Step 1: 写失败测试**

追加：

```js
test('single H3 wins with H1/H2 breadcrumb', () => {
  const hs = parseHeadings('# 1 背景\n## 1.1 行业现状\n### 1.1.1 案例\n')
  const r = selectPageTitle(hs)
  assert.equal(r.main.level, 3)
  assert.deepEqual(r.breadcrumb.map(h => h.title), ['背景', '行业现状'])
})

test('multiple H3 stops at H2', () => {
  const hs = parseHeadings('# 1 背景\n## 1.1 行业现状\n### 1.1.1 案例 A\n### 1.1.2 案例 B\n')
  const r = selectPageTitle(hs)
  assert.equal(r.main.level, 2)
  assert.equal(r.main.title, '行业现状')
  assert.deepEqual(r.breadcrumb.map(h => h.title), ['背景'])
})

test('multiple H2 stops at H1', () => {
  const hs = parseHeadings('# 1 背景\n## 1.1 行业现状\n## 1.2 攻击面\n### 1.2.1 案例\n')
  const r = selectPageTitle(hs)
  assert.equal(r.main.level, 1)
  assert.equal(r.main.title, '背景')
  assert.deepEqual(r.breadcrumb, [])
})

test('one H2 with no H3 gives H1 breadcrumb', () => {
  const hs = parseHeadings('# 1 背景\n## 1.1 行业现状\n')
  const r = selectPageTitle(hs)
  assert.equal(r.main.level, 2)
  assert.deepEqual(r.breadcrumb.map(h => h.title), ['背景'])
})

test('no heading becomes a continuation', () => {
  const prev = parseHeadings('# 1 背景\n## 1.1 行业现状\n### 1.1.1 案例\n')
  const r = classifyPage('正文只有一段。', prev)
  assert.equal(r.type, 'continuation')
  assert.equal(r.main.title, '案例（续）')
  assert.ok(r.warnings.some(w => w.includes('续页')))
})

test('H1-only page with body is content; without body is divider', () => {
  assert.equal(classifyPage('# 1 背景\n', null).type, 'divider')
  assert.equal(classifyPage('# 1 背景\n\n一段说明。\n', null).type, 'content')
})

test('TOC page is detected by heading', () => {
  assert.equal(classifyPage('## 目录\n\n- 背景\n  - 行业现状\n', null).type, 'toc')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/xiao/Project/HTMLSlides/plugins/md-slides && node --test scripts/validate.test.mjs`
Expected: FAIL，`selectPageTitle is not a function` / `classifyPage is not a function`。

- [ ] **Step 3: 实现选择算法**

`selectPageTitle`：

1. 按 level 分组。
2. 从 H3 开始：若 H3 唯一，且其 H2 唯一、H1 唯一 → 主标题 H3，面包屑 `[H1,H2]`。
3. 否则看 H2：若 H2 唯一、H1 唯一 → 主标题 H2，面包屑 `[H1]`。
4. 否则看 H1：若 H1 唯一 → 主标题 H1，面包屑 `[]`。
5. 多个 H1 → 取第一个，warning。
6. 无标题 → `main: null`，warning。

`classifyPage`：

- 若首个标题是 H2 且剥编号后的 title 为 `目录` / `Contents` / `Table of Contents` → `toc`。
- 若只有 H1 且正文只有空白 → `divider`。
- 若没有标题 → `continuation`，从 `previous` 取最深唯一标题，title 追加 `（续）`。
- 否则 `content`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /home/xiao/Project/HTMLSlides/plugins/md-slides && node --test scripts/validate.test.mjs`
Expected: PASS，14 个测试全过。

- [ ] **Step 5: 提交**

```bash
git add plugins/md-slides/scripts/
git commit -m "feat: add title selection and page classification" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 目录解析与自动生成

**Files:**
- Modify: `plugins/md-slides/scripts/validate.mjs`
- Modify: `plugins/md-slides/scripts/validate.test.mjs`
- Create: `plugins/md-slides/examples/no-toc.md`
- Create: `plugins/md-slides/examples/multi-h3.md`

**Interfaces:**
- Consumes: Task 3/4 的 parser 和 selector。
- Produces:
  - `parseToc(page: string) -> TocItem[]`，`TocItem = { level: 1|2, text: string }`
  - `buildToc(headings: Heading[]) -> TocItem[]`
  - `matchToc(items: TocItem[], headings: Heading[]) -> { matched: Array<{item, heading}>, unmatched: TocItem[] }`

- [ ] **Step 1: 写失败测试**

追加：

```js
test('parseToc reads a nested H1/H2 list', () => {
  const page = '## 目录\n\n- 背景\n  - 行业现状\n- 攻击视角\n  - 威胁模型\n'
  assert.deepEqual(parseToc(page), [
    { level: 1, text: '背景' },
    { level: 2, text: '行业现状' },
    { level: 1, text: '攻击视角' },
    { level: 2, text: '威胁模型' },
  ])
})

test('buildToc uses H1 and H2 in document order', () => {
  const hs = parseHeadings('# 1 背景\n## 1.1 行业现状\n## 1.2 攻击面\n# 2 案例\n## 2.1 案例一\n')
  assert.deepEqual(buildToc(hs).map(i => [i.level, i.text]), [
    [1, '背景'], [2, '行业现状'], [2, '攻击面'], [1, '案例'], [2, '案例一'],
  ])
})

test('matchToc reports unmatched items', () => {
  const hs = parseHeadings('# 1 背景\n## 1.1 行业现状\n')
  const r = matchToc([{ level: 1, text: '背景' }, { level: 2, text: '不存在' }], hs)
  assert.equal(r.matched.length, 1)
  assert.equal(r.unmatched[0].text, '不存在')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/xiao/Project/HTMLSlides/plugins/md-slides && node --test scripts/validate.test.mjs`
Expected: FAIL，`parseToc is not a function`。

- [ ] **Step 3: 实现解析、生成、匹配**

- `parseToc`：识别 `- ` / `  - ` 两级；忽略非列表行；剥掉行首编号。
- `buildToc`：按文档顺序收集 H1/H2。
- `matchToc`：用剥编号后的 title 归一化（trim、压缩空白）精确匹配；同名取第一次并 warning。

- [ ] **Step 4: 写 fixtures**

`examples/no-toc.md`：有 frontmatter、无目录、2 个 H1 + 3 个 H2。
`examples/multi-h3.md`：一页含 `### 1.1.1` 和 `### 1.1.2`，用于验证主标题停在 H2。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /home/xiao/Project/HTMLSlides/plugins/md-slides && node --test scripts/validate.test.mjs`
Expected: PASS，17 个测试全过。

- [ ] **Step 6: 提交**

```bash
git add plugins/md-slides/scripts/ plugins/md-slides/examples/no-toc.md plugins/md-slides/examples/multi-h3.md
git commit -m "feat: add TOC parsing and auto-generation" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: HTML 校验与 fixtures

**Files:**
- Modify: `plugins/md-slides/scripts/validate.mjs`
- Modify: `plugins/md-slides/scripts/validate.test.mjs`
- Create: `plugins/md-slides/examples/invalid-numbering.md`
- Create: `plugins/md-slides/examples/broken-template.html`

**Interfaces:**
- Consumes: `assets/template.html`、Task 3–5 的解析结果。
- Produces:
  - `validateHtml(html: string, templateHtml: string, expectedSlideCount: number) -> { errors: string[], warnings: string[] }`
  - CLI：`node scripts/validate.mjs <input.md> [output.html]`；exit 0 = 无 error，exit 1 = 有 error。

- [ ] **Step 1: 写失败测试**

追加：

```js
import fs from 'node:fs'
const exampleHtml = fs.readFileSync('examples/example.html', 'utf8')
const templateHtml = fs.readFileSync('assets/template.html', 'utf8')
const exampleMd = fs.readFileSync('examples/example.md', 'utf8')
const expectedCount = validateMarkdown(exampleMd).pages.length + 1

test('validateHtml accepts the reference deck', () => {
  const r = validateHtml(exampleHtml, templateHtml, expectedCount)
  assert.deepEqual(r.errors, [])
})

test('validateHtml rejects a modified template style', () => {
  const broken = exampleHtml.replace('--accent: #9b1c1c;', '--accent: #ff0000;')
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('template')))
})

test('validateHtml rejects a relative image', () => {
  const broken = exampleHtml.replace(/src="data:image\/svg\+xml;base64,[^"]+"/, 'src="assets/sample.svg"')
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('data URI')))
})

test('validateHtml rejects an external script', () => {
  const broken = exampleHtml.replace('</body>', '<script src="https://example.com/x.js"></script></body>')
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('external')))
})

test('validateHtml rejects an inline style attribute', () => {
  const broken = exampleHtml.replace('<h1 class="slide-title">', '<h1 class="slide-title" style="color:red">')
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('inline style')))
})

test('validateHtml rejects a slide-count mismatch', () => {
  const r = validateHtml(exampleHtml, templateHtml, 99)
  assert.ok(r.errors.some(e => e.includes('slide count')))
})

test('validateMarkdown falls back to the first H1 when title is missing', () => {
  const r = validateMarkdown('# 1 背景\n\n## 1.1 行业现状\n')
  assert.equal(r.title, '背景')
  assert.ok(r.warnings.some(w => w.includes('title')))
})

test('validateMarkdown warns on a dense page', () => {
  const bullets = Array.from({ length: 8 }, (_, i) => `- item ${i}`).join('\n')
  const md = `---\ntitle: D\n---\n# 1 背景\n## 1.1 行业现状\n${bullets}\n`
  const r = validateMarkdown(md)
  assert.ok(r.warnings.some(w => w.includes('density')))
})
```

`validate.test.mjs` 顶部补 `import fs from 'node:fs'` 和 `import { validateHtml, validateMarkdown } from './validate.mjs'`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/xiao/Project/HTMLSlides/plugins/md-slides && node --test scripts/validate.test.mjs`
Expected: FAIL，`validateHtml is not a function`。

- [ ] **Step 3: 实现 `validateHtml` 和 CLI**

`validateHtml` 检查：

- 第一行哨兵 `<!-- md-slides template v1 -->`。
- 有 `.deck`、封面 `.slide.cover`、`#pageno`、`#progress`、`#overview`、`#ovgrid`、内联 `<script>`。
- `.slide` 数量等于 `expectedSlideCount`。
- 抽取输出与模板的 `<style>`、`<script>`，逐字比较（忽略换行符差异）。
- 所有 `<img>` 的 `src` 以 `data:image/` 开头。
- 无 `<script src>`、`<link href>`、`<iframe>`、额外 `<style>`、`on*=` 属性、`style=` 内联属性。
- 输出文件存在时，路径必须是 `foo.html` 或 `foo.slides.html`。

`validateMarkdown` 还要：缺 `title` 时用第一个 H1 或文件名补并给 warning；按页统计 bullet 数、表格列数、代码行数，超过设计文档 5.8 的建议给 density warning。

CLI 组合 `validateMarkdown` + `validateHtml`；warning 打印但不改 exit code。

- [ ] **Step 4: 写 fixtures**

- `examples/invalid-numbering.md`：编号跳号/不连续的合法 Markdown；期望 exit 0 + warning。
- `examples/broken-template.html`：缺少 `#pageno` 或改了 CSS；期望 exit 1。

- [ ] **Step 5: 运行测试与 CLI**

```bash
cd /home/xiao/Project/HTMLSlides/plugins/md-slides
node --test scripts/validate.test.mjs
node scripts/validate.mjs examples/example.md examples/example.html
node scripts/validate.mjs examples/invalid-numbering.md
node scripts/validate.mjs examples/example.md examples/broken-template.html
```

Expected：
- 单元测试全过。
- 第一条 CLI exit 0。
- 第二条 CLI exit 0，输出编号 warning。
- 第三条 CLI exit 1，输出结构 error。

- [ ] **Step 6: 提交**

```bash
git add plugins/md-slides/scripts/ plugins/md-slides/examples/
git commit -m "feat: add HTML and template validator" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: SKILL.md、样式参考与命令

**Files:**
- Create: `plugins/md-slides/skills/build-slides/SKILL.md`
- Create: `plugins/md-slides/skills/build-slides/references/style-spec.md`
- Create: `plugins/md-slides/skills/build-slides/references/recipes.md`
- Create: `plugins/md-slides/commands/build-slides.md`

**Interfaces:**
- Consumes: Task 1–6 的规范、模板、校验器。
- Produces:
  - Skill frontmatter `name: build-slides`。
  - 工作流：定位 md → 解析 → 读模板 → 生成封面/目录/页面 → 内嵌图片 → 写文件 → 校验 → 汇报。
  - 命令包装：`/build-slides`（Claude 为 `/md-slides:build-slides`）。

- [ ] **Step 1: 先调用 `superpowers:writing-skills`**

在写 SKILL.md 前，按该技能的要求检查命名、description、渐进披露和验证方式。

- [ ] **Step 2: 写 `SKILL.md`**

结构必须包含：

- Frontmatter：

```markdown
---
name: build-slides
description: Convert a standards-compliant Markdown deck source into a single self-contained HTML slide presentation. Use when the user asks to make slides, a deck, a presentation, 汇报, 幻灯片, or to convert Markdown into HTML slides.
---
```

- 一句话职责。
- 何时使用 / 何时不用。
- 输入输出与冲突规则。
- 11 步工作流（设计文档 8.2）。
- 标题算法 6 行伪代码。
- 模板纪律。
- 错误处理表。
- 自检清单。
- 平台说明。
- 一个 10 行迷你示例。

目标 300–420 行；细节引用 `references/`。

- [ ] **Step 3: 写 `style-spec.md`**

把设计文档第 7 节转成 agent 可执行的样式规则：

- 色板、字体、页面尺寸。
- B 标题 HTML 形状。
- 封面、目录、分区页、内容页的 class 和 HTML 片段。
- 表格、代码、引用、图片、折叠块。
- 页码、进度条、总览。

- [ ] **Step 4: 写 `recipes.md`**

给出常见页面配方：

- 纯文字页。
- 3 条 bullet 页。
- 表格页。
- 代码页。
- 单图页。
- 双图 `grid: 2` 页。
- 折叠细节页。
- 分区页。
- 多 H3 页。

每个配方给 Markdown 输入 + HTML 输出片段。

- [ ] **Step 5: 写命令包装**

`commands/build-slides.md`：

```markdown
---
description: Build HTML slides from a standards-compliant Markdown file
argument-hint: "[file.md]"
---

Use the build-slides skill to convert `$ARGUMENTS` (or the Markdown file the user names) into a single self-contained HTML slide deck in the same directory.
```

- [ ] **Step 6: 自检**

```bash
cd /home/xiao/Project/HTMLSlides/plugins/md-slides
grep -q 'name: build-slides' skills/build-slides/SKILL.md
grep -q '不得自行拆页' skills/build-slides/SKILL.md
grep -q 'data URI' skills/build-slides/SKILL.md
grep -q 'foo.slides.html' skills/build-slides/SKILL.md
grep -q 'md-slides template v1' skills/build-slides/SKILL.md
grep -q 'data-goto' skills/build-slides/SKILL.md
grep -q 'style=' skills/build-slides/SKILL.md
grep -q 'slide-content' skills/build-slides/SKILL.md
wc -l skills/build-slides/SKILL.md
```

Expected: 关键词全中；行数在 300–420 之间（略多可接受，但不能把细节全堆进来）。

- [ ] **Step 7: 提交**

```bash
git add plugins/md-slides/skills/ plugins/md-slides/commands/
git commit -m "feat: add build-slides skill and style references" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 双平台清单、市场与 README

**Files:**
- Create: `plugins/md-slides/.claude-plugin/plugin.json`
- Create: `plugins/md-slides/.codex-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `.agents/plugins/marketplace.json`
- Create: `plugins/md-slides/README.md`

**Interfaces:**
- Consumes: Task 7 的 Skill、Task 2 的模板、Task 6 的校验器。
- Produces:
  - Claude 插件 id：`md-slides`。
  - Codex 插件 id：`md-slides`。
  - marketplace 名称：`md-slides-marketplace`。
  - 安装入口：Claude `/plugin install md-slides@md-slides-marketplace`；Codex `codex plugin add md-slides@md-slides-marketplace`。

- [ ] **Step 1: 写 Claude 清单**

`plugins/md-slides/.claude-plugin/plugin.json`：

```json
{
  "name": "md-slides",
  "version": "0.1.0",
  "description": "Convert standards-compliant Markdown into a single self-contained HTML slide deck",
  "author": { "name": "Xiao" },
  "skills": "./skills/",
  "commands": "./commands/"
}
```

- [ ] **Step 2: 写 Codex 清单**

`plugins/md-slides/.codex-plugin/plugin.json`：

```json
{
  "name": "md-slides",
  "version": "0.1.0",
  "description": "Convert standards-compliant Markdown into a single self-contained HTML slide deck",
  "skills": "./skills/",
  "interface": {
    "displayName": "MD Slides",
    "shortDescription": "Turn Markdown into clean HTML slides",
    "developerName": "Xiao",
    "category": "Productivity",
    "capabilities": ["Read", "Write"],
    "defaultPrompt": ["Turn this Markdown into HTML slides."]
  }
}
```

- [ ] **Step 3: 写两个 marketplace**

`.claude-plugin/marketplace.json`：

```json
{
  "name": "md-slides-marketplace",
  "owner": { "name": "Xiao" },
  "plugins": [
    { "name": "md-slides", "source": "./plugins/md-slides" }
  ]
}
```

`.agents/plugins/marketplace.json`：

```json
{
  "name": "md-slides-marketplace",
  "interface": { "displayName": "MD Slides Marketplace" },
  "plugins": [
    {
      "name": "md-slides",
      "source": { "source": "local", "path": "./plugins/md-slides" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

- [ ] **Step 4: 写 README**

包含：

- 插件是什么、解决什么问题。
- 员工 Markdown 规范入口。
- Claude Code 安装与使用。
- Codex 安装与使用。
- 本地开发：`claude --plugin-dir`、Codex 本地市场。
- 输出规则（单文件、图片内嵌、冲突命名）。
- 已知限制（v1 中文优先、无 PPTX/PDF、agent 不拆页）。
- 校验器用法。

- [ ] **Step 5: 验证 JSON 与插件**

```bash
cd /home/xiao/Project/HTMLSlides
node -e "JSON.parse(require('fs').readFileSync('plugins/md-slides/.claude-plugin/plugin.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('plugins/md-slides/.codex-plugin/plugin.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('.agents/plugins/marketplace.json','utf8'))"
claude plugin validate plugins/md-slides --strict
claude plugin validate . --strict
```

Expected: 四个 JSON 解析成功；两条 validate 退出 0。

- [ ] **Step 6: Codex 市场验证（不改用户配置）**

优先用临时 `CODEX_HOME`：

```bash
TMP_HOME=$(mktemp -d)
CODEX_HOME="$TMP_HOME" codex plugin marketplace add /home/xiao/Project/HTMLSlides
CODEX_HOME="$TMP_HOME" codex plugin list | grep md-slides
```

Expected: 列表出现 `md-slides@md-slides-marketplace`。

若该版本不支持临时 `CODEX_HOME`，跳过此步，在 Task 9 用真实配置做一次安装/卸载并记录命令。

- [ ] **Step 7: 提交**

```bash
git add plugins/md-slides/.claude-plugin plugins/md-slides/.codex-plugin plugins/md-slides/README.md .claude-plugin/marketplace.json .agents/plugins/marketplace.json
git commit -m "feat: add dual-platform manifests and marketplace" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: 端到端验证与收尾

**Files:**
- Modify: 按测试结果修 `SKILL.md`、`assets/template.html`、`scripts/validate.mjs`、fixtures。
- Create（临时）: `/tmp/md-slides-e2e/`。

**Interfaces:**
- Consumes: Task 1–8 的全部产物。
- Produces: 可安装、可触发、可验证的 v0.1.0 插件。

- [ ] **Step 1: 全量校验器回归**

```bash
cd /home/xiao/Project/HTMLSlides/plugins/md-slides
node --test scripts/validate.test.mjs
node scripts/validate.mjs examples/example.md examples/example.html
node scripts/validate.mjs examples/no-toc.md
node scripts/validate.mjs examples/multi-h3.md
node scripts/validate.mjs examples/invalid-numbering.md
```

Expected: 单元测试全过；example 通过；no-toc/multi-h3 只校验 Markdown，exit 0；invalid-numbering exit 0 + warning。

- [ ] **Step 2: Claude Code 端到端**

```bash
mkdir -p /tmp/md-slides-e2e/claude
cp /home/xiao/Project/HTMLSlides/plugins/md-slides/examples/example.md /tmp/md-slides-e2e/claude/
cd /tmp/md-slides-e2e/claude
claude --plugin-dir /home/xiao/Project/HTMLSlides/plugins/md-slides \
  --permission-mode acceptEdits \
  -p "Use the build-slides skill to convert example.md into HTML slides in this directory."
ls -la
```

Expected: 生成 `example.html`；页面数、封面、目录、页码正确。

- [ ] **Step 3: Claude 输出校验**

```bash
node /home/xiao/Project/HTMLSlides/plugins/md-slides/scripts/validate.mjs \
  /tmp/md-slides-e2e/claude/example.md \
  /tmp/md-slides-e2e/claude/example.html
```

Expected: exit 0。

- [ ] **Step 4: 输出冲突测试**

在 `/tmp/md-slides-e2e/claude/` 里创建一个**非本插件生成**的 `example.html`（内容随便写，无模板哨兵），再跑一次 Step 2 的 Claude 命令。

Expected: 生成 `example.slides.html`，原 `example.html` 内容不变。

- [ ] **Step 5: Codex 端到端**

用真实 Codex 配置做一次可逆安装；结束时卸载并移除市场：

```bash
cd /home/xiao/Project/HTMLSlides
codex plugin marketplace add /home/xiao/Project/HTMLSlides
codex plugin add md-slides@md-slides-marketplace
codex plugin list | grep md-slides
cd /tmp/md-slides-e2e/claude
codex exec "Use the build-slides skill to convert example.md into HTML slides in this directory."
```

Expected: 生成 HTML；若 Codex 的 `exec` 写权限受限，改用交互式 `codex` 手动执行同一提示，并记录结果。

清理：

```bash
codex plugin remove md-slides@md-slides-marketplace
codex plugin marketplace remove md-slides-marketplace
```

- [ ] **Step 6: 浏览器目检生成物**

打开 `/tmp/md-slides-e2e/claude/example.html`，检查 Review Focus 五项：

- 多 H3 页标题停在 H2。
- 无标题页显示“（续）”。
- 缺失/远程图片是占位块，HTML 无外部 `src`。
- 目录存在或自动生成；漏项只 warning。
- 冲突时写 `.slides.html`，原文件未动。

再检查：封面无页码、目录无编号/页码、B 面包屑、ESC 总览、`#s3`、点击翻页、进度条。

- [ ] **Step 7: 修复发现的问题**

按失败项修对应文件；每修一项，重跑 Step 1–3。不要为了通过测试而改设计约束。

- [ ] **Step 8: 最终校验与提交**

```bash
cd /home/xiao/Project/HTMLSlides
claude plugin validate plugins/md-slides --strict
claude plugin validate . --strict
git status --short
```

Expected: 两条 validate 退出 0；`git status` 只显示本次修复涉及的文件。

```bash
git add -A
git commit -m "test: complete dual-platform end-to-end verification" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** 设计文档第 2–12 节分别由 Task 1–9 覆盖；第 13 节实施顺序与本计划一致；第 14 节风险在 Task 6/9 的校验与 E2E 中覆盖；第 15 节留给 builder 的项在 Task 2/7 中定稿。

**Step scan:** 每个步骤都有明确文件、命令或检查结果；没有“TBD”“适当处理”之类空步骤。文档类任务用 grep 关键词和人工目检作为可检查结果。

**Type consistency:** `Heading`、`selectPageTitle`、`classifyPage`、`parseToc`、`buildToc`、`matchToc`、`validateHtml` 的签名在 Task 3–6 中一致；Task 7/9 使用同一组函数和 CLI。

**Review Focus:** 五项均有对应测试或 E2E 检查：多 H3/无标题在 Task 4；图片在 Task 6；目录在 Task 5；输出冲突在 Task 9 Step 4。模板漂移在 Task 6 的模板逐字比较中覆盖。

**Proportion:** 计划以任务、接口、测试和命令为主，没有贴出完整实现代码；模板 CSS/JS 和 SKILL.md 正文留给实现者按设计文档写。
