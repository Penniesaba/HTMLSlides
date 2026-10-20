# md-slides 双平台插件设计

日期：2026-10-20  
状态：待用户确认  
目标宿主：Claude Code、Codex  
参考实现：`example/演示.html`

## 1. 意图

员工把一份按规范编写的 Markdown 交给 agent；agent 识别出这是“做 slides”的任务，按本插件的工作流直接生成一个单文件 HTML 幻灯片，放在 Markdown 所在目录。员工不需要懂 HTML/CSS，也不需要和 agent 反复讨论设计。

插件包含两部分：

1. **Markdown 编写标准**：员工必须按这个标准写，才能稳定得到好结果。
2. **Agent 工作流（Skill）**：告诉 agent 如何解析 Markdown、如何组织页面、如何套用固定模板、如何自检和修复。

核心不是“让 agent 自由设计”，而是“让 agent 在一条窄轨道上稳定产出”：模板固定、页面模型固定、标题算法固定、风格固定，agent 只负责内容映射和少量判断。

## 2. 目标、非目标、反目标

### 目标

- 员工只写 Markdown，就能产出风格统一的 HTML slides。
- 输出是**一个真正自包含的 HTML 文件**：图片全部转成 data URI 内嵌，双击可看，不依赖构建工具、网络或旁边的图片目录，文件可以单独发送。
- 视觉风格继承 `example/演示.html`：纯白、细线、暗红强调、无阴影/渐变、系统字体，整体更简洁、更 markdown。
- 页码、H1/H2/H3 的用法、目录、封面、分区页都有明确规范。
- Markdown 标准可以被 agent 校验，错误能指出具体页和标题。
- 同一套 Skill 同时适用于 Claude Code 和 Codex。

### 非目标

- 不导出 PPTX/PDF。
- 不做多主题、主题编辑器或品牌定制系统。
- 不自动配图、不生成图片、不调用外部 API。
- 不修改员工的 Markdown 源文件。
- 不做服务端渲染或在线编辑器。
- 不支持 Obsidian 专有语法（`![[...]]`、`|509` 宽度等）。
- 不追求像素级复刻 `演示.html` 的所有内容组件；只继承它的视觉语言和交互。

### 反目标（即使技术可用也算失败）

- 不同员工、不同次运行产出的版式明显漂移。
- agent 自己发明 CSS、布局或页面类型。
- agent 要求员工回答“你想要什么风格/多少页/标题怎么写”这类设计问题。
- 覆盖员工已有的、非本插件生成的文件。
- SKILL.md 长到 agent 只读一半就开始写。
- 为了“好看”引入外部字体、CDN、图标库或构建步骤。

## 3. 已确认的决策

| 主题 | 决策 |
|---|---|
| 平台 | Claude Code + Codex，共用一个 Skill |
| 转换方式 | agent 按 Skill 规范直接写 HTML；不依赖转换脚本 |
| 分页 | 独立的 `---` 行是唯一分页信号；标题不自动分页；agent **不得自行拆页或合页** |
| 标题层级 | H1 = 部分，H2 = 小节/页面主题，H3 = 具体主题 |
| 编号 | 员工手写在标题里；slides 中不显示 |
| 页面标题 | 面包屑方案 B：`H1 / H2` 一行，H3 做主标题 |
| 多 H3 同页 | 标题停在 H2，H3 作为页内小节 |
| 目录 | H1 + H2 两级；员工写则用员工的，没写则 agent 自动生成 |
| 目录显示 | 不显示编号，不显示页码；可点击跳转 |
| 页码 | 自动生成，右下角 `current / total`；封面不显示但计入总数 |
| 封面 | 从 frontmatter 自动生成；不显示页码；不加“按 → 开始”提示 |
| 分区页 | 一页只有 H1（可带一句说明）即为分区页 |
| 输出 | 输入 `foo.md` → 同目录 `foo.html`；冲突时写 `foo.slides.html`；图片全部内嵌为 data URI |
| 交互 | 键盘翻页、点击翻页、顶部进度条、`#sN` 深链、ESC 总览 |
| 风格 | 纯白、黑/深灰、细分隔线、暗红强调、系统 sans + mono |
| 溢出 | 先自动缩放，仍超出才允许该页滚动 |
| 校验 | 附带零依赖校验脚本；agent 生成后运行；没有 Node 时用清单自检 |

## 4. 仓库结构

插件名暂定 `md-slides`，Skill 名 `build-slides`。

仓库根同时是 marketplace 根；插件本身放在 `plugins/md-slides/`，与现有 `example/` 分开。

```text
<repo-root>/                        # marketplace 根
├── .claude-plugin/
│   └── marketplace.json            # Claude 市场，source 指向 ./plugins/md-slides
├── .agents/
│   └── plugins/
│       └── marketplace.json        # Codex 市场，source 指向 ./plugins/md-slides
├── plugins/
│   └── md-slides/                  # 插件根
│       ├── .claude-plugin/
│       │   └── plugin.json         # Claude Code 清单
│       ├── .codex-plugin/
│       │   └── plugin.json         # Codex 兼容清单
│       ├── skills/
│       │   └── build-slides/
│       │       ├── SKILL.md        # agent 工作流（核心）
│       │       └── references/
│       │           ├── markdown-standard.md
│       │           ├── page-model.md
│       │           ├── style-spec.md
│       │           └── recipes.md
│       ├── assets/
│       │   └── template.html       # 固定 HTML/CSS/JS 模板
│       ├── scripts/
│       │   └── validate.mjs        # 零依赖校验器
│       ├── examples/
│       │   ├── example.md
│       │   ├── example.html
│       │   ├── no-toc.md
│       │   ├── multi-h3.md
│       │   ├── invalid-numbering.md
│       │   └── broken-template.html
│       ├── commands/
│       │   └── build-slides.md     # 可选：显式命令包装
│       └── README.md
├── example/                        # 现有用户示例，不属于插件
└── docs/
    └── superpowers/specs/2026-10-20-md-slides-plugin-design.md
```

说明：

- 组件只放在插件根目录，不能放进 `.claude-plugin/` 或 `.codex-plugin/`。
- 不引入 hooks、MCP、LSP；这个插件的核心是 Skill + 模板 + 校验器，保持安装面最小。
- `references/markdown-standard.md` 是规范唯一来源；`docs/` 下只放面向员工的入口或镜像，避免两份规范各写各的。

## 5. Markdown 编写标准

### 5.1 文件与 frontmatter

- UTF-8，扩展名 `.md`。
- 文件最开头可选 YAML frontmatter，用一对 `---` 包住：

```markdown
---
title: Agent Security
subtitle: 智能体安全
kicker: 领域综述汇报 · 2026
author: 张三
date: 2026-10-20
lang: zh-CN
---
```

- `title` 必填；缺省时 agent 用第一个 H1 或文件名，并给出 warning。
- `subtitle`、`kicker`、`author`、`date` 可选；缺省不显示。
- `lang` 默认 `zh-CN`。v1 中文优先：`lang: en` 可正常渲染英文正文，但 UI chrome（目录、总览、续页标记等）仍以中文为主；目录页识别 `## 目录`，并兼容 `## Contents` / `## Table of Contents`。英文 UI 本地化留到 v2。
- 文件最开头那一对 `---` 只当 frontmatter 边界；其后的 `---` 才是分页。

### 5.2 分页

- 一行只有 `---`（前后可有空白）表示新的一页。
- 页内水平分隔线只能用 `***`，不能再用 `---`，否则会被当成分页。
- 封面不算 Markdown 页；封面由 agent 自动生成，放在最前面。
- 目录页是 Markdown 的第一页（如果员工写了）；否则 agent 自动插入。
- 页码由渲染后的总页数决定；员工不写页码。

### 5.3 标题

- `#` = H1，部分/大章节。
- `##` = H2，小节/页面主题。
- `###` = H3，具体主题。
- 不允许跳级：H1 → H2 → H3；不允许只有 H3 没有 H1/H2。
- 员工手动写编号，编号格式：

```markdown
# 1 背景
## 1.1 行业现状
### 1.1.1 Conditional Access Optimization Agent：自治边界最清晰的样本
```

- 编号规则（用于校验，不显示）：
  - H1：`1`、`2`、`3`……
  - H2：`1.1`、`1.2`、`2.1`……
  - H3：`1.1.1`、`1.1.2`……
  - 编号与标题文字之间至少一个空格。
  - 可接受结尾的 `.` 或 `、`，例如 `## 2.4. 案例分析`。
- 显示时剥掉开头的编号；`2.4.2 Conditional Access...` 显示为 `Conditional Access...`。
- 编号只用于结构校验和目录匹配，不进入 slides。
- 标题文字里可以继续出现数字（例如 `GPT-5`、`2026`），只有行首的层级编号会被剥离。

### 5.4 页面类型

1. **封面**：自动生成，不在 Markdown 里写。
2. **目录**：Markdown 页以 `## 目录` 开头（编号可有可无，如 `## 2 目录` 也可识别）。
3. **分区页**：整页只有一个 H1，正文为空或只有一段 ≤200 字的说明；不允许出现列表/表格/代码/图片或 H2/H3。超出则按内容页处理。
4. **内容页**：其余页面。
5. **续页**：整页没有任何标题；继承上一页的标题栈，主标题追加“（续）”，并给 warning。规范上不推荐，但 agent 不应因此失败。

### 5.5 目录写法

员工可以手写目录；只写标题文字，不写编号、链接、页码：

```markdown
## 目录

- 背景
  - 行业现状
  - 攻击面
- 攻击视角
  - 威胁模型
```

规则：

- 目录只列 H1 和 H2，不列 H3。
- 一级项对应 H1，缩进二级项对应 H2。
- agent 按“去掉编号后的标题文字”精确匹配；匹配成功生成可点击项。
- 匹配不到：保留文字，不加链接，输出 warning。
- 同名标题：匹配第一次出现，输出 warning。
- 没有目录页：agent 按文档顺序自动生成 H1/H2 两级目录，放在封面之后。自动目录页是一个额外 slide：总页数 = 源 Markdown 页数 + 封面 + 自动目录页。
- 目录页不显示编号，不显示页码；底部仍然显示该页的页码。

### 5.6 正文元素

支持并统一渲染：

- 段落、粗体、斜体、行内代码。
- 有序/无序列表，允许一层嵌套；更深嵌套不推荐。
- 链接：外部链接新窗口打开，内部锚点正常跳转。
- 引用块 `>`：左侧暗红细线，用于定义、提示、出处。
- 表格：GFM 管道表格；必须有表头；宽表建议单独一页或加滚动指令。
- 代码块：三反引号围栏，标注语言；不做语法高亮，只用等宽字体和浅灰底。
- 图片：`![alt](path "caption")`；`path` 必须是本地相对路径（相对 Markdown 文件）；`caption` 可选，渲染为图注；生成时 agent 读取图片，按 MIME 转成 `data:image/...;base64,...` 内嵌；最大宽度 100%。
- 不支持远程 URL。远程图片或缺失图片：显示一个占位块（保留 alt、说明和原路径），输出 warning；输出 HTML 里不得留下外部图片引用。
- 默认一页一张主图；多张图片按顺序纵向排列。需要并排时，在页面第一行写 `<!-- grid: 2 -->` 或 `<!-- grid: 3 -->`，该页只放图片和图注，agent 把它们放进对应列数的网格。v1 不支持更复杂的图文混排。
- 水平线：`***`。
- 折叠块：允许一段受限 HTML：

```html
<details>
<summary>展开看细节</summary>

这里放 Markdown 或 HTML。

</details>
```

除 `<details>/<summary>/<br>/<span class="...">` 外，不允许其他原始 HTML。  
不允许 `<script>`、`<style>`、`<iframe>`、事件属性。

### 5.7 页面级指令

支持两个页面级指令，写在页面第一行（可同时出现）：

```markdown
<!-- scrollable -->
<!-- grid: 2 -->
```

- `scrollable`：强制该页从一屏缩放改为纵向滚动，适用于超长表格/代码。
- `grid: 2` / `grid: 3`：把该页图片排成 2/3 列；该页只放图片和图注。
- agent 生成时给对应的 `<section>` 加 `scrollable` class 或 `grid-2` / `grid-3` class。
- 默认不滚动：模板 JS 对普通页从 1.0 缩放到 0.5；缩到 0.5 仍超出时，JS 自动把该页切成可滚动，并给出一个不打断演示的提示。
- **agent 不得为了放下内容而自行拆页或合页**；只能缩放、滚动，并在最终报告里建议员工拆页。

### 5.8 密度建议（规范的一部分）

- 一页一个中心观点。
- 普通内容页：不超过 6 条 bullet，或 2 段短文 + 1 个视觉元素。
- 表格：不超过 6 列；超过则拆页或滚动。
- 代码：不超过 20 行；超过则拆页或折叠。
- 图片：一页最多 3 张；并排时用 `<!-- grid: 2 -->` 或 `<!-- grid: 3 -->`。
- 这些是 warning 的依据，不是硬失败；agent 不自行拆页，只在报告里建议员工拆页，并用缩放/滚动兜底。

## 6. 页面模型与标题算法

### 6.1 每页的标题栈

对每一页，按出现顺序收集标题，维护一个标题栈。把每个标题表示成路径：

```text
(H1 文本, H2 文本, H3 文本)
```

显示文本先剥掉行首编号。

### 6.2 选择主标题

从最深一级开始，向上找“唯一且祖先也唯一”的层级：

1. 如果页面只有一个 H3，且它只有一个 H2、一个 H1 → 主标题 = H3，面包屑 = `H1 / H2`。
2. 如果页面有多个 H3，但只有一个 H2、一个 H1 → 主标题 = H2，面包屑 = `H1`；多个 H3 作为页内小节。
3. 如果页面有多个 H2（或 H2 的祖先不唯一）→ 主标题 = H1，无面包屑；多个 H2/H3 作为页内小节。
4. 如果页面只有一个 H2、没有 H3 → 主标题 = H2，面包屑 = `H1`。
5. 如果页面只有一个 H1、没有 H2/H3：
   - 正文为空，或只有一段 ≤200 字说明、无列表/表格/代码/图片 → 分区页。
   - 其它情况 → 内容页，主标题 = H1，无面包屑。
6. 如果页面有多个 H1 → 规范错误；主标题取第一个 H1，输出 warning。
7. 如果页面没有标题 → 续页；继承上一页的标题栈，主标题追加“（续）”，输出 warning。

“祖先也唯一”很重要：如果一个 H3 的父 H2 出现两次，不能拿这个 H3 当主标题，否则读者不知道它属于哪个小节。

### 6.3 面包屑方案 B

```html
<div class="breadcrumb">
  <span>背景</span><span class="sep">/</span><span>行业现状</span>
</div>
<h1 class="slide-title">Conditional Access Optimization Agent：自治边界最清晰的样本</h1>
```

- 面包屑：mono、11–12px、`#888`、字距略宽。
- 主标题：30–34px、700、行高 1.28、`#1a1a1a`。
- 没有分隔线；标题区下方留 20–26px 空白。
- 主标题是 H2 时，面包屑只有 H1；主标题是 H1 时，不显示面包屑。
- 页内多个 H3 或 H2 时，用 `h3.sub` 样式作为小节标题。

## 7. 视觉规范

### 7.1 色板

```css
--ink: #1a1a1a;
--ink-soft: #555;
--faint: #888;
--line: #e2e2e2;
--line-strong: #cfcfcf;
--bg: #ffffff;
--accent: #9b1c1c;
--accent-soft: #f6e9e9;
--link: #1f3a8a;
--code-bg: #f6f6f6;
```

### 7.2 字体

- 正文：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
- 等宽：`"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`
- 不加载外部字体。

### 7.3 页面

- 16:9，全屏；`.slide` 固定定位，一页一屏。
- 内容最大宽度 1060px；左右 padding `7vw`，上下 `clamp(28px, 5vh, 56px)`。
- 纯白背景；无阴影、无渐变、无大圆角。
- 过渡：淡入 0.25s；`prefers-reduced-motion` 时关闭。
- 移动端：宽度 ≤720px 时缩小标题、单列网格；仍保留翻页。

### 7.4 封面

- 左上 kicker：12–13px mono，`#888`，大写字母间距。
- 主标题：48–56px，700，行高 1.15。
- 副标题：19–21px，`#555`。
- 作者/日期：13–14px，`#888`，放底部。
- 不显示页码；不加“按 → 开始”提示。
- 背景纯白，可有一条很短的暗红细线作为唯一装饰。

### 7.5 目录

- 标题“目录”：与内容页主标题同级或略小。
- H1 项：20–22px，600；H2 项：15–16px，`#555`，缩进一层。
- 项之间用 `1px solid var(--line)` 分隔；H2 项可不加线。
- 不显示编号、页码；悬停时标题变暗红。
- 可点击跳转。

### 7.6 分区页

- H1：40–48px，700。
- 可带一句 17–19px 的说明，`#555`。
- 可选一条 3px 暗红短竖线或短横线；不要大图、不要装饰插画。
- 显示页码。

### 7.7 内容页

- 段落 15–17px，行高 1.75–1.85。
- 列表项 15–17px，项间距 6–8px。
- 引用块：左侧 3px `--accent`，文字 `#555`。
- 表格：14–15px；`1px solid var(--line)`；表头浅灰底。
- 代码：14px mono；浅灰底 `--code-bg`；1px 边框；横向滚动。
- 图片：最大宽度 100%；1px 细边框；图注 13px mono，`#888`。
- 链接：`--link`，下划线细线；外部链接新窗口。
- 页码：右下角，mono 11–12px，`#999`，`current / total`。
- 进度条：顶部 3px，`--accent`。

### 7.8 交互

- ←/→、PageUp/PageDown、空格：翻页。
- 点击左 28% / 右 72%：上一页/下一页；点击链接、按钮、`details` 时不翻页。
- Home/End：第一页/最后一页。
- ESC：打开/关闭缩略图总览；总览里点击跳转。
- `#s3`：打开第 3 页（1-based，含封面）。
- 目录项 `data-goto` 也使用 1-based 页码，和右下角页码一致。
- 触摸左右滑动（可选但建议）。
- 总览卡片显示页码 + 该页 `data-title`。

## 8. SKILL.md 设计

### 8.1 Frontmatter

```markdown
---
name: build-slides
description: Convert a Markdown deck source into a single self-contained HTML slide presentation. Use when the user asks to make slides, a deck, a presentation, 汇报, 幻灯片, or to convert Markdown into HTML slides.
---
```

description 要覆盖中英文触发词，但不要写成能力清单。

### 8.2 正文结构（目标 300–420 行）

1. **一句话职责**：把符合标准的 Markdown 转成一个 HTML 文件。
2. **何时使用 / 何时不用**：不是做 slides 就不要触发。
3. **输入与输出**：找哪个 md、输出到哪、冲突规则。
4. **工作流**（编号步骤）：
   1. 定位输入文件；读 frontmatter 和页面。
   2. 读 `references/markdown-standard.md`、`page-model.md`、`style-spec.md`（按需）。
   3. 解析页面、标题栈、页面类型、目录。
   4. 读 `<plugin-root>/assets/template.html`（plugin root = skill 目录向上两级）；保留全部 CSS/JS，只替换占位符。
   5. 生成封面。
   6. 生成目录（员工写或自动）。
   7. 逐页生成：分区页 / 内容页 / 续页；页数与分页位置必须与源 Markdown 一致，不得增删页。图片逐张读入并转成 data URI；缺失/远程图用占位块并记 warning。
   8. 生成页码、进度条、总览、深链所需的结构（由模板 JS 自动接管）。
   9. 写出 HTML。
   10. 运行 `scripts/validate.mjs`；修到通过或最多重试 2 次。
   11. 汇报：输出路径、页数、warning 列表。
5. **标题算法**：用 6 行伪代码复述第 6 节，防止 agent 只读 references 的一半。
6. **模板纪律**：
   - 必须复制 `<plugin-root>/assets/template.html` 的 CSS/JS，不得改写、不得引入外部资源。
   - 只允许替换 `{{LANG}}`、`{{TITLE}}`、`{{COVER}}`、`{{SLIDES}}`。
   - 页面 section 必须有 `data-title`。
   - 不手写页码；页码由 JS 算。
7. **错误处理**：
   - 缺 frontmatter：用第一个 H1/文件名补，warning。
   - 缺目录：自动生成。
   - 缺页标题：继承上一页 + “（续）”，warning。
   - 编号不连续：仍渲染，warning。
   - 图片缺失/远程：用占位块，warning；不得留下外部图片引用。
   - 输出冲突：写 `foo.slides.html`。
   - 不要为了修规范而改员工的 md。
8. **自检清单**（生成后逐条打勾）：
   - 封面无页码、计入总数。
   - 目录 H1/H2、无编号、无页码。
   - 每个内容页有主标题；多 H3 页标题停在 H2。
   - 编号未显示。
   - 页数 = `.slide` 数量。
   - 无外部请求。
   - 交互脚本存在。
9. **平台说明**：
   - Claude Code / Codex 路径差异；用插件根（skill 目录向上两级）找 `assets/` 和 `scripts/`，用 skill 目录找 `references/`。
   - 不要假设有 Node；校验器可选。
   - 不要调用宿主专有工具。

### 8.3 写得好的关键

- 用“必须/禁止/如果……就……”的可执行句式，不写“尽量美观”。
- 每条规则都能在输出里被检查。
- 细节放 references，SKILL.md 只保留决策树和纪律。
- 给出一个 10 行左右的迷你示例，展示标题栈和 B 布局，不贴整页 HTML。
- 明确“不要问员工设计问题”；只有输入文件不明确时才问。

## 9. HTML 模板

### 9.1 占位符

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
  <div id="overview">...</div>
  <script>/* 固定 JS */</script>
</body>
</html>
```

### 9.2 JS 职责

- 收集所有 `.slide`，计算 `total`。
- 维护 `current`；`show(n)` 切换 active。
- 自动缩放：普通页从 1.0 缩到 0.5；缩到 0.5 仍超出时自动给该页加 `scrollable`。带 `scrollable` class 的页跳过缩放。
- 更新 `#pageno` 为 `current / total`；封面 active 时隐藏。
- 更新进度条宽度。
- 键盘、点击、触摸、hash、ESC 总览。
- 总览根据每页 `data-title` 生成卡片。
- 不依赖任何库。

### 9.3 页面 HTML 形状

生成内容只使用模板 class；禁止 `style=` 内联样式（模板自身也不使用）。每页必须自带 `.slide-content`，模板 JS 不再自动包裹。

内容页：

```html
<section class="slide" data-title="Conditional Access Optimization Agent">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span><span class="sep">/</span><span>行业现状</span></div>
    <h1 class="slide-title">Conditional Access Optimization Agent：自治边界最清晰的样本</h1>
    <p>...</p>
  </div>
</section>
```

分区页：

```html
<section class="slide divider" data-title="背景">
  <div class="slide-content">
    <h1 class="divider-title">背景</h1>
    <p class="divider-desc">...</p>
  </div>
</section>
```

目录页：

```html
<section class="slide toc" data-title="目录">
  <div class="slide-content">
    <h1 class="toc-title">目录</h1>
    <div class="toc-list">
      <a class="toc-item lvl1" data-goto="2">背景</a>
      <a class="toc-item lvl2" data-goto="3">行业现状</a>
    </div>
  </div>
</section>
```

封面：

```html
<section class="slide cover" data-title="封面">
  <div class="slide-content">
    <div class="kicker">领域综述汇报 · 2026</div>
    <h1 class="cover-title">Agent Security</h1>
    <p class="cover-sub">智能体安全</p>
    <div class="cover-meta">张三 · 2026-10-20</div>
  </div>
</section>
```

## 10. 校验器

`scripts/validate.mjs`，Node 18+，零依赖。

```bash
node scripts/validate.mjs input.md [output.html]
```

### 10.1 错误（exit 1；agent 修 HTML 后重试，最多 2 次）

- 输出不是合法 HTML，或缺少模板哨兵 `<!-- md-slides template v1 -->`。
- 缺少封面、`.deck`、任一 `.slide`。
- `.slide` 数量与源 Markdown 页数不一致（含封面/目录）。
- 缺少 `#pageno`、`#progress`、`#overview`、导航脚本。
- 模板 `<style>` 或 `<script>` 与 `assets/template.html` 不一致（只允许换行符差异）。
- 出现外部 `<script src>`、`<link href>`、额外 `<style>`、`<iframe>`、事件属性。
- 输出 HTML 里任何一个 `<img src>` 不是 `data:image/...;base64,...`（包括远程 URL、相对路径、空 src）。
- 输出文件路径冲突规则未遵守。

### 10.2 警告（exit 0；写进最终报告，不阻断）

- 缺 frontmatter 或 `title`；agent 已用第一个 H1/文件名补。
- 标题跳级、编号不连续、H2/H3 编号不以父级开头。
- 缺目录（agent 已自动生成）、目录漏项、目录项匹配不到标题。
- 页内无标题（agent 已按续页处理）。
- 页面密度超过 5.8 的建议。
- 图片缺失或远程（agent 用占位块，不保留外部引用）。
- 员工目录页不在封面之后。

### 10.3 模板一致性

- 模板第一行是 `<!-- md-slides template v1 -->`。
- 校验器从输出和模板各抽取 `<style>`、`<script>` 块，逐字比较；只允许换行符差异。
- agent 不得修改 CSS/JS；只能替换 `{{LANG}}`、`{{TITLE}}`、`{{COVER}}`、`{{SLIDES}}`。

Skill 运行校验器；如果 Node 不存在，降级为 SKILL.md 内的自检清单。

## 11. 双平台打包

### 11.1 Claude Code

`.claude-plugin/plugin.json`：

```json
{
  "name": "md-slides",
  "version": "0.1.0",
  "description": "Convert standards-compliant Markdown into a single HTML slide deck",
  "author": { "name": "Xiao" },
  "commands": "./commands/"
}
```

Claude Code 会自动发现 `skills/`；manifest 里不再重复写 `skills`，避免组件清单出现重复项。

调用：

- 自动触发：用户说“把这个 md 做成 slides/汇报/PPT/幻灯片”。
- 显式：`/md-slides:build-slides`。

### 11.2 Codex

`.codex-plugin/plugin.json`：

```json
{
  "name": "md-slides",
  "version": "0.1.0",
  "description": "Convert standards-compliant Markdown into a single HTML slide deck",
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

调用：`$build-slides` 或自然语言触发；命令 `/build-slides` 视 Codex 版本而定，不作为唯一入口。

### 11.3 Marketplace

- 仓库根是 marketplace 根；插件根固定为 `plugins/md-slides/`。
- Claude：`.claude-plugin/marketplace.json`，`source: "./plugins/md-slides"`。
- Codex：`.agents/plugins/marketplace.json`，`source: { "source": "local", "path": "./plugins/md-slides" }`。
- Codex 也读旧 `.claude-plugin/marketplace.json`，但保留独立市场文件，避免两边字段耦合。

### 11.4 安装

Claude：

```text
/plugin marketplace add owner/md-slides
/plugin install md-slides@owner-marketplace
```

Codex：

```bash
codex plugin marketplace add owner/md-slides --ref main
codex plugin add md-slides@owner-marketplace
```

## 12. 示例与测试

### 12.1 示例

`examples/example.md` 应覆盖：

- frontmatter 全部字段。
- 目录页（H1 + H2）。
- 分区页。
- 单 H3 内容页。
- 多 H3 同页（标题停在 H2）。
- 表格、引用、代码、图片、折叠块。
- 一页 `<!-- scrollable -->`。
- 续页（无标题）。

`examples/example.html` 是视觉基准；实现后与它对比。

### 12.2 测试矩阵

| 场景 | 期望 |
|---|---|
| 无 frontmatter | 用第一个 H1/文件名补，warning |
| 无目录 | 自动生成 H1/H2 目录 |
| 有目录但漏项 | 保留员工目录，warning |
| 多 H3 同页 | 标题 = H2，H3 变页内小节 |
| 多 H2 同页 | 标题 = H1，无面包屑 |
| 只有 H1 + 正文 | 内容页，标题 = H1 |
| 只有 H1 无正文 | 分区页 |
| 无标题页 | 续页，标题追加“（续）” |
| 编号跳号 | 仍渲染，warning |
| 图片不存在/远程 | 占位块，warning，HTML 无外部引用 |
| 输出已存在且非本插件生成 | 写 `foo.slides.html` |
| 超长表格 | 自动缩放；仍超出则滚动 |
| 外部链接 | 新窗口打开 |

### 12.3 验收标准

- 在 Claude Code 和 Codex 中都能安装、触发、生成。
- 输出是单文件，无外部请求。
- 页码、封面、目录、分区页、B 标题布局、多 H3 规则全部符合。
- 编号不出现在 slides 中。
- 键盘/点击/进度条/hash/ESC 总览可用。
- `claude plugin validate` 通过；Codex `codex plugin list` 能看到并安装。
- 校验器对示例通过；对 `invalid-numbering.md` 通过但输出编号 warning；对 `broken-template.html` 以 exit 1 报错。

## 13. 实施顺序

1. 写 `references/markdown-standard.md` 和 `references/page-model.md`。
2. 写 `references/style-spec.md`，确定 CSS 细节。
3. 写 `assets/template.html` + `examples/example.html`，先在浏览器里手动验证视觉与交互。
4. 写 `examples/example.md`，人工对照生成规则。
5. 写 `skills/build-slides/SKILL.md`（核心，最后定稿前反复压缩）。
6. 写 `scripts/validate.mjs` 和测试 fixture。
7. 写两份 manifest、marketplace、README。
8. 在 Claude Code 和 Codex 各安装一次，跑完整测试矩阵。
9. 根据实际输出修 SKILL.md 和模板。

## 14. 风险与对策

| 风险 | 对策 |
|---|---|
| agent 自由发挥 CSS | SKILL.md 强制“复制模板，不改 CSS”；校验器检查无额外 style/外部资源 |
| SKILL.md 太长被忽略 | 核心决策树留在 SKILL.md，细节放 references；目标 300–420 行 |
| 长 deck 超出单次输出 | SKILL.md 指示：先写模板骨架，再分段追加 slide；超过 ~30 页时提醒 |
| 图片内嵌导致 HTML 过大 | 图片原样 base64；输出超过 20MB 给 warning，建议员工先压缩图片；不自动压缩/重采样 |
| 标题算法理解错 | SKILL.md 内嵌 6 行伪代码 + 多 H3/多 H2 两个例子；校验器检查 |
| Codex/Claude 路径差异 | 插件根（skill 目录向上两级）找 assets/scripts；skill 目录找 references；两只宿主各测一次 |
| 员工目录写错 | 保留原文 + warning，不阻断生成 |
| 图片路径失效 | 占位块 + warning；输出不保留外部引用，不联网 |
| 输出覆盖 | 检查生成标记；冲突写 `.slides.html` |

## 15. 留给 builder 的决定

- 具体 CSS 数值、断点、总览卡片尺寸。
- 是否把 `<details>` 样式做成独立组件（设计上允许）。
- 插件名、作者、marketplace 名称的最终拼写。
