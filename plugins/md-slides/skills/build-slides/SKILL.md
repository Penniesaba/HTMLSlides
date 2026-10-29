---
name: build-slides
description: Use when the user asks to make slides, a deck, a presentation, 汇报, 幻灯片, or to convert a Markdown file into a single self-contained HTML slide deck.
---

# Build HTML Slides

把一份符合标准的 Markdown 转成一个真正自包含的 HTML 幻灯片：封面、目录、页面标题、页码、导航、图片全部由你按固定规则生成。

这不是“设计一个好看的页面”，而是“在一条窄轨道上稳定产出”。样式、模板、页面模型、标题算法都已经定好；你只负责内容映射和少量判断。

## When to Use

使用：

- 用户给了一个 `.md`，要求做成 slides / deck / presentation / 汇报 / 幻灯片。
- 用户要求把 Markdown 转成 HTML slides。
- 用户要求沿用 `md-slides` 的版式重做一份 deck。

不要使用：

- 用户只是要一个普通网页、报告页、落地页。
- 用户明确要 PPTX/PDF 导出（本插件不提供）。
- 输入不是 Markdown。

## Inputs and Outputs

### 找输入

1. 用户点名了 `.md`，用它。
2. 没点名：当前目录只有一个非文档 `.md`（排除 `README.md`、`CLAUDE.md`、`AGENTS.md`），用它。
3. 有多个候选：只问一个问题，让用户选；不要猜。

读完整文件，不要只读开头。不要修改源 Markdown。

### 定输出

- 输入 `foo.md` → 同目录 `foo.html`。
- 如果 `foo.html` 已存在，且**没有**模板哨兵 `<!-- md-slides template v1 -->`：写 `foo.slides.html`，不要覆盖。
- 如果已存在且**有**哨兵：说明是上次生成的，可以覆盖。
- 如果 `foo.slides.html` 也已存在且没有哨兵：停下来报告，不要覆盖，也不要自动生成第三个名字；让用户决定。
- 不要用 deck 标题、日期或 `slides.html` 之类的名字；输出名只由输入文件名决定。

### 最终产物

- 一个 HTML 文件，无外部依赖、无网络请求。
- 图片全部是 `data:image/...;base64,...`。
- 封面 + 源 Markdown 的每一页；页数 = 源页数 + 1；如果源文件没有目录页、由你自动补了一页目录，则再 +1。
- 右下角自动页码；封面不显示但计入总数。
- 键盘/点击翻页、进度条、`#sN` 深链、ESC 总览。

### 快速判断

| 源 Markdown | 页面类型 | 标题 |
|---|---|---|
| 第一页是 `## 目录` | 目录 | “目录” |
| 整页只有一个 H1，正文为空或只有一段 ≤200 字说明 | 分区页 | H1 |
| 整页只有一个 H1，但有列表/表格/代码/图片或长正文 | 内容页 | H1 |
| 一个 H1 + 一个 H2 + 一个 H3 | 内容页 | H3，面包屑 H1/H2 |
| 一个 H1 + 一个 H2 + 多个 H3 | 内容页 | H2，面包屑 H1 |
| 一个 H1 + 多个 H2 | 内容页 | H1，无面包屑 |
| 整页没有标题 | 续页 | 上一页标题 + “（续）” |

## Workflow

按顺序执行，不要跳步。

1. **定位并读取输入**：按上面的规则找到 `.md`，读全文。
2. **读规范**：读同目录 `references/markdown-standard.md`、`references/page-model.md`、`references/style-spec.md`。需要页面片段时读 `references/recipes.md`。
3. **解析结构**：
   - 解析 frontmatter。
   - 用独立 `---` 行分页；忽略代码块里的 `---`。
   - 以 `>` 开头的行是作者注释：整行忽略，不参与标题、页面类型或密度判断，也不输出到 HTML。
   - 解析每页的 H1/H2/H3，剥掉行首编号。
   - 维护文档级 H1/H2 上下文：后面的页可以只写 H2/H3，继承前面的 H1/H2。
4. **判定页面**：目录页、分区页、内容页、续页；封面不在 Markdown 里，由 frontmatter 生成。
5. **读模板**：读 `<plugin-root>/assets/template.html`。`plugin-root` 是本 `SKILL.md` 所在目录向上两级（`../..`）。保留全部 CSS/JS，只替换 `{{LANG}}`、`{{TITLE}}`、`{{COVER}}`、`{{SLIDES}}`。
6. **生成封面**：只用 frontmatter 的 `title`、`subtitle`、`kicker`、`author`、`date`；缺省就省略。不要加“按 → 开始”提示。
7. **生成目录**：
   - 有 `## 目录` 页：按员工写的 H1/H2 嵌套列表渲染，匹配标题、生成 `data-goto`。
   - 没有：从全文 H1/H2 自动生成一页，放在封面之后。
   - 目录项不显示编号、不显示页码；目录页本身仍有右下角页码。
8. **逐页生成**：
   - 分区页：整页只有一个 H1，正文为空或只有一段 ≤200 字的说明，且没有列表/表格/代码/图片；渲染成 `.divider`。
   - 内容页：按标题算法生成 B 面包屑 + 主标题；正文转 HTML，`>` 开头的注释行直接跳过。
   - 续页：继承上一页标题并追加“（续）”。
   - 页数与分页位置必须和源 Markdown 一致；**不得自行拆页或合页**。
9. **处理图片**：每张本地图片读成 base64，写成 data URI；缺失/远程图片用 `<figure><div class="muted">[图片缺失] path — alt</div><figcaption>caption</figcaption></figure>` 占位并记 warning；不要输出 `<img>`，最终 HTML 里不得出现相对路径或远程 `src`。
10. **写文件**：按输出规则写入；确认没有覆盖非本插件生成的文件。
11. **自检**：如果 Node 可用，运行：
    ```bash
    node <plugin-root>/scripts/validate.mjs <input.md> <output.html>
    ```
    有 error 就修 HTML 后重跑，最多 2 次；warning 保留到最终报告。Node 不可用时，用本文末尾的自检清单。
12. **汇报**：输出路径、总页数、warning 列表。不要贴整份 HTML。

## Frontmatter

只认文件最开头的一对 `---`；正文里的 `---` 是分页。

```yaml
---
title: Agent Security
subtitle: 智能体安全
kicker: 领域综述汇报 · 2026
author: 张三
date: 2026-10-20
lang: zh-CN
---
```

- `title` 必填；缺失时用第一个 H1 或文件名，warning。
- `subtitle` / `kicker` / `author` / `date` 缺省就不渲染。
- `lang` 默认 `zh-CN`，写到 `<html lang="...">`。
- 封面只从这些字段生成；不要在 Markdown 里再写一页封面。

## Body Mapping

| Markdown | HTML |
|---|---|
| 段落 | `<p>` |
| `**粗体**` / `*斜体*` | `<strong>` / `<em>` |
| 行内代码 | `<code>` |
| `[text](url)` | `<a href="...">text</a>`；外链加 `target="_blank" rel="noopener"` |
| `- item` / `1. item` | `<ul><li>` / `<ol><li>` |
| `> comment` | 忽略，不输出任何 HTML（如同注释） |
| 管道表格 | `<table><thead>...<tbody>...` |
| 三反引号代码 | `<pre><code class="language-...">`，转义 `<` `>` `&` |
| `![alt](path "caption")` | `<figure><img src="data:..."><figcaption>` |
| `***` | `<hr>` |
| `<details>` | 原样保留，内部包 `.body` |
| `<!-- scrollable -->` | 页面 section 加 `.scrollable` |
| `<!-- grid: 2 -->` | 图片包进 `.grid-2` |
| `<!-- grid: 3 -->` | 图片包进 `.grid-3` |

所有图片在写入前读成 base64。路径相对输入 Markdown 文件，不是相对当前工作目录。

## TOC Matching

有员工目录时：

1. 解析嵌套列表：一级 = H1，缩进二级 = H2。
2. 用“剥编号 + trim + 压缩空白 + 忽略大小写”的标题文字匹配全文标题。
3. 匹配成功：生成 `data-goto`（1-based）。
4. 匹配失败：保留文字，不加链接，warning。
5. 同名标题：匹配第一次出现，warning。
6. 目录项不显示编号、不显示页码；目录页本身仍有右下角页码。

没有员工目录时：按全文顺序生成 H1/H2 两级目录，放在封面之后。

## Long Decks

- 先写完整 HTML 骨架（模板 + 封面 + 空 `.deck`），再逐页追加 `<section>`。
- 不要因为文件大就拆成多个 HTML；最终仍是一个文件。
- 超过约 30 页时，在报告里提醒用户检查目录和页码；不要改变分页。
- 不要用脚本生成整份 HTML；这个 Skill 的职责是让 agent 按规范写。

## Validation Output

`node <plugin-root>/scripts/validate.mjs input.md output.html`：

- exit 0：结构没问题；warning 照常报告。
- exit 1：有结构 error（缺模板哨兵、缺 `#pageno`、slide 数不对、模板 CSS/JS 被改、外部资源、非 data URI 图片）。修 HTML 后重跑，最多 2 次。
- 不要为了让 validator 通过而改模板或删页面；改自己生成的 HTML。

## Title Algorithm

每页独立选标题，但要带上文档级 H1/H2 上下文。

```text
effective = context + page headings (new H1 resets; new H2 replaces context H2)
main = deepest level with exactly one heading and unique ancestors
breadcrumb = ancestors of main: H3 -> H1/H2, H2 -> H1, H1 -> none
multiple H3 -> main = H2
multiple H2 -> main = H1
no heading -> previous main + "（续）"
```

例子：

- 一页只有 `### 1.1.1 案例`，上下文是 H1 背景、H2 行业现状 → 主标题“案例”，面包屑“背景 / 行业现状”。
- 一页有 `### 1.1.1` 和 `### 1.1.2` → 主标题“行业现状”（H2），面包屑“背景”。
- 一页有 `## 1.4` 和 `## 1.5` → 主标题“背景”（H1），无面包屑。
- 一页没有标题 → 上一页主标题 + “（续）”。

编号只用于校验，**永远不要显示**。

## Template Discipline

模板是硬约束，不是参考。

- 模板第一行是 `<!-- md-slides template v1 -->`。
- 只替换四个占位符：`{{LANG}}`、`{{TITLE}}`、`{{COVER}}`、`{{SLIDES}}`。
- 不改 CSS，不改 JS，不加 `<style>`，不加 `<script>`，不加 `style=` 内联样式。
- 不加外部字体、CDN、图标库、图片 URL。
- 每页必须有 `.slide`、`.slide-content`、`data-title`。
- 页码、进度条、总览、深链由模板 JS 自动处理；不要手写。
- 目录项 `data-goto` 用 1-based 页码，和右下角页码一致。
- 页面类型 class：`.cover`、`.toc`、`.divider`、`.content`、`.scrollable`；图片网格用 `.grid-2` / `.grid-3`。
- 标题结构：`.breadcrumb`、`.slide-title`、`.sub`。

如果 `<plugin-root>/assets/template.html` 缺失或读不到：停下来报告，不要自己发明 CSS。

## Error Handling

| 情况 | 处理 |
|---|---|
| 缺 frontmatter / `title` | 用第一个 H1 或文件名补；warning |
| 没有目录页 | 自动生成 H1/H2 目录；不 warning |
| 员工目录漏项 | 保留员工目录；warning |
| 目录项匹配不到标题 | 保留文字、不加链接；warning |
| 一页没有标题 | 续页：继承上一页标题 + “（续）”；warning |
| 编号跳号/不连续 | 仍渲染；warning |
| 一页多个 H3 | 主标题停在 H2；H3 变页内小节 |
| 一页多个 H2 | 主标题停在 H1；H2 变页内小节 |
| 图片缺失/远程 | 占位块 + warning；不保留外部引用 |
| Markdown 里有 `>` 注释 | 直接忽略；不输出 `<blockquote>` |
| 页面过密 | 缩放 → 自动滚动；warning 建议员工拆页；**不自行拆页** |
| 输出已存在且非本插件生成 | 写 `foo.slides.html` |
| 模板 CSS/JS 被改 | 修回模板；validator 会报 error |
| Node 不可用 | 用自检清单人工检查 |

## Red Flags — 不要这样做

这些是常见跑偏，出现任意一条就停下改回：

| 想法 | 现实 |
|---|---|
| “按标题生成文件名更像样” | 输出名只由输入文件名决定：`foo.md` → `foo.html` |
| “我设计一套更漂亮的 CSS” | 必须用模板 CSS；改了就 error |
| “员工目录不如我自动生成的好” | 有员工目录就用员工的；只在缺省时自动生成 |
| “H2 才是页面标题” | 标题取“唯一且祖先唯一”的最深一级；单 H3 页主标题是 H3 |
| “把节号显示出来更清楚” | 编号只用于校验，slides 中不显示 |
| “把 `>` 渲染成引用块更完整” | `>` 开头是作者注释，直接忽略，不输出 `<blockquote>` |
| “页码补零更整齐” | 用 `current / total`，不要 `02 / 11` |
| “只有小图需要内嵌” | 所有本地图片都内嵌；不允许任何外部 `src` |
| “加一点打印样式/动画” | 模板之外不加任何样式或脚本 |
| “页面太满，我拆成两页” | 不允许；缩放/滚动 + warning |
| “先问用户想要什么风格” | 风格已固定；只有输入文件不明确时才问 |

## Self-Check

生成后逐条确认：

- [ ] 输出文件名符合 `foo.html` / `foo.slides.html` 规则，没有覆盖非本插件文件。
- [ ] 封面由 frontmatter 生成；没有页码；没有“按 → 开始”。
- [ ] 总 slide 数 = 源 Markdown 页数 + 1；自动补了目录页时再 +1。
- [ ] 目录有 H1/H2 两级；目录项无编号/页码（目录页本身有页码）；可点击。
- [ ] 每个内容页有主标题；单 H3 页显示 H1/H2 面包屑；多 H3 页标题停在 H2；多 H2 页停在 H1。
- [ ] 分区页 section class 是 `.divider`；H1 + 长正文/列表的页是 `.content`。
- [ ] 所有标题都不带行首编号。
- [ ] 所有 `<img src>` 都是 `data:image/...;base64,...`。
- [ ] 没有 `<blockquote>`：`>` 开头的行都按注释忽略了。
- [ ] 没有 `<style>`、`style=`、额外 `<script>`、外部 `<link>`、`<iframe>`。
- [ ] `.slide-content`、`data-title`、`#pageno`、`#progress`、`#overview` 都在。
- [ ] validator exit 0；warning 已在报告中列出。

## Platform Notes

- Claude Code 和 Codex 共用这个 Skill；不要调用宿主专有工具。
- `references/` 在本 `SKILL.md` 所在目录下；`assets/`、`scripts/` 在插件根（`../..`）。用这些路径解析，不要用当前工作目录。
- 校验器需要 Node 18+；没有 Node 就人工自检，不要因此拒绝生成。
- 不要写 `.claude/`、`.codex/` 或宿主配置文件。
- 不要联网。

## Path Resolution

- Skill 目录 = `skills/build-slides/`。
- 插件根 = Skill 目录向上两级（`../..`）。
- 模板 = `<plugin-root>/assets/template.html`；校验器 = `<plugin-root>/scripts/validate.mjs`；引用 = `<skill-dir>/references/*.md`。
- 输入 `.md`、图片路径、输出 `.html` 相对用户的工作目录 / 输入文件所在目录。
- 不要把 Skill 目录或插件根当成当前工作目录。

## Do Not Ask

- 不要问风格、配色、页数、字号、是否加动画、是否加打印样式；这些都已固定。
- 不要要求用户先改 Markdown；先生成，再在报告里指出 warning。
- 只有两种情况值得问：输入文件有多个候选且用户没点名；输出文件已存在且无法判断是不是本插件生成的。

## Mini Example

Markdown：

```markdown
## 1.1 行业现状

### 1.1.1 从模型安全到 agent 安全

- 标准组织开始发布 agent 专项风险清单。
```

HTML：

```html
<section class="slide content" data-title="从模型安全到 agent 安全">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span><span class="sep">/</span><span>行业现状</span></div>
    <h1 class="slide-title">从模型安全到 agent 安全</h1>
    <ul><li>标准组织开始发布 agent 专项风险清单。</li></ul>
  </div>
</section>
```

## References

- `references/markdown-standard.md` — 员工 Markdown 规范。
- `references/page-model.md` — 页面类型、标题算法、目录匹配。
- `references/style-spec.md` — 固定样式与 HTML 结构。
- `references/recipes.md` — 常见页面配方。
- `<plugin-root>/assets/template.html` — 唯一允许使用的模板。
- `<plugin-root>/scripts/validate.mjs` — 生成后自检。
