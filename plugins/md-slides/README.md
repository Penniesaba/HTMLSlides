# md-slides

把一份按标准编写的 Markdown 转成一个**真正自包含**的 HTML 幻灯片：封面、目录、标题层级、页码、导航、图片内嵌，全部按固定规则生成。

- 员工只写 Markdown，不写 HTML/CSS。
- Agent 按 `skills/build-slides/SKILL.md` 的固定工作流生成。
- 输出是单个 `.html` 文件，图片已是 data URI，可以单独发送。
- 同时支持 Claude Code 和 Codex。

## 员工从这里开始

Markdown 编写标准：

[`skills/build-slides/references/markdown-standard.md`](skills/build-slides/references/markdown-standard.md)

一句话规则：**用 `---` 分页，用 H1/H2/H3 组织标题，编号手写但不显示，图片用本地相对路径，`>` 开头是注释不渲染。**

最小示例：

```markdown
---
title: Agent Security
subtitle: 智能体安全
kicker: 领域综述汇报 · 2026
author: 张三
date: 2026-10-20
---

## 目录

- 背景
  - 行业现状
- 防御
  - 设计原则

---

# 1 背景

从标准、案例和攻击面三个角度理解 agent 安全。

---

## 1.1 行业现状

### 1.1.1 从模型安全到 agent 安全

- 标准组织开始发布 agent 专项风险清单。
- 攻击面从“模型”扩展到“工具链”。
```

把这份 `.md` 交给 agent，说“做成 slides”，它就会在同目录生成 `<同名>.html`。

## 安装

### Claude Code

在会话里：

```text
/plugin marketplace add <owner>/<repo>
/plugin install md-slides@md-slides-marketplace
```

本地开发：

```bash
claude --plugin-dir /path/to/plugins/md-slides
```

触发方式：

- 自动：说“把这个 md 做成 slides / 汇报 / 幻灯片”。
- 显式：`/md-slides:build-slides`。

### Codex

```bash
codex plugin marketplace add <owner>/<repo> --ref main
codex plugin add md-slides@md-slides-marketplace
```

本地开发：把仓库根作为本地 marketplace 加入，插件在 `plugins/md-slides/`：

```bash
codex plugin marketplace add /path/to/repo
codex plugin add md-slides@md-slides-marketplace
```

触发方式：

- 自然语言：“把这个 md 做成 slides”。
- 显式：`$build-slides`。
- 命令：`/build-slides`（视 Codex 版本而定）。

## 输出规则

| 输入 | 输出 |
|---|---|
| `foo.md` | 同目录 `foo.html` |
| `foo.md`，且 `foo.html` 已存在、不是本插件生成 | `foo.slides.html` |
| `foo.md`，且 `foo.html` 是上次生成的 | 覆盖 `foo.html` |

- 输出一定是单个 HTML 文件。
- 图片全部转成 `data:image/...;base64,...`，不依赖旁边的图片目录。
- 封面不显示页码，但计入总页数；其余页右下角显示 `current / total`。
- 目录不显示编号、不显示页码；可点击跳转。

## 页面规则（摘要）

- `---` 是唯一分页信号；agent 不自行拆页/合页。
- H1 = 部分，H2 = 小节，H3 = 具体主题。
- 标题区是 B 方案：`H1 / H2` 面包屑 + H3 主标题。
- 一页多个 H3：主标题停在 H2，H3 作为页内小节。
- 一页多个 H2：主标题停在 H1，无面包屑。
- 编号只用于校验和目录匹配，不显示。
- 目录：员工写了就用；没写就自动生成 H1/H2 两级（自动目录会多一页）。
- 分区页：一页只有一个 H1（可带一句说明）。
- 续页：整页没有标题，继承上一页标题并追加“（续）”。

完整规则见 `skills/build-slides/references/markdown-standard.md` 和 `page-model.md`。

## 样式与交互

- 纯白背景、黑/深灰正文、细分隔线、暗红强调。
- 系统 sans + mono 字体；无外部字体、无 CDN、无构建步骤。
- ←/→/空格/PageUp/PageDown 翻页；Home/End 首尾。
- 点击左 28% / 右 72% 翻页。
- ESC 打开/关闭总览；`#s3` 深链。
- 顶部进度条；右下角页码。
- 内容过密时先缩放，仍超出才允许滚动。

## 校验

生成后可以运行：

```bash
node scripts/validate.mjs input.md output.html
```

- exit 0：结构通过；warning 会打印。
- exit 1：有结构 error（缺模板哨兵、缺 `#pageno`、slide 数不对、模板 CSS/JS 被改、外部资源、非 data URI 图片）。

Node 18+，零依赖。没有 Node 时，按 `SKILL.md` 的自检清单人工检查。

## 已知限制（v1）

- 中文优先；`lang: en` 可以渲染英文正文，但界面文字仍以中文为主。
- 不导出 PPTX/PDF。
- 不做多主题、主题编辑器、品牌定制。
- 不自动配图、不联网。
- Agent 不自行拆页；页面过密只给 warning，并用缩放/滚动兜底。
- 目录匹配是精确匹配（剥编号、忽略大小写和多余空白）；简称不会自动模糊匹配。

## 目录结构

```text
plugins/md-slides/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── skills/build-slides/
│   ├── SKILL.md
│   └── references/
│       ├── markdown-standard.md
│       ├── page-model.md
│       ├── style-spec.md
│       └── recipes.md
├── assets/template.html
├── scripts/validate.mjs
├── commands/build-slides.md
└── examples/
    ├── example.md
    ├── example.html
    ├── no-toc.md
    ├── multi-h3.md
    ├── invalid-numbering.md
    └── broken-template.html
```
