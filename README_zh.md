# md-slides

[English documentation](README.md)

`md-slides` 将符合标准的 Markdown 转换为自包含的 HTML 幻灯片。生成文件包含封面、目录、标题层级、导航、页码和内嵌的本地图片，不依赖外部资源或构建系统。

## 提供的能力

- 为 Claude Code 和 Codex 提供固定的 Markdown 转幻灯片工作流。
- 输出单个 HTML 文件，可独立分享。
- 统一生成封面、目录、标题、分页、键盘控制、点击导航、总览和深链。
- 将本地图片嵌入为 `data:image/...;base64,...` 数据 URI。
- 提供零依赖的 Node.js 校验器，用于检查 Markdown 结构和生成的 HTML。

## 安装

### Claude Code

使用以下命令从 marketplace 安装 `md-slides`：

```text
/plugin marketplace add <owner>/<repo>
/plugin install md-slides@md-slides-marketplace
```

本地开发时可以直接加载插件目录：

```bash
claude --plugin-dir /path/to/plugins/md-slides
```

可以通过自然语言或 `/md-slides:build-slides` 命令调用插件。

### Codex

使用以下命令安装 marketplace 和插件：

```bash
codex plugin marketplace add <owner>/<repo> --ref main
codex plugin add md-slides@md-slides-marketplace
```

本地开发时，将仓库根目录作为 marketplace 加入，再从 `plugins/md-slides/` 安装 `md-slides`。根据已安装的 Codex 版本，可以通过自然语言、`$build-slides` 或 `/build-slides` 调用 skill。

## 输入要求

输入必须是符合项目标准的 Markdown 文档，标准见 [`plugins/md-slides/skills/build-slides/references/markdown-standard.md`](plugins/md-slides/skills/build-slides/references/markdown-standard.md)。

- Frontmatter 提供封面元数据：`title`、`subtitle`、`kicker`、`author`、`date` 和 `lang`。
- 仅包含 `---` 的一行用于分页；围栏代码块中的分隔线会保留。
- H1、H2 和 H3 标题定义章节层级。章节编号用于校验和目录匹配，随后会从可见标题中移除。
- 以 `>` 开头的行是作者注释。这些行不会参与页面分类、密度检查、图片检查或渲染。
- 本地相对图片路径以 Markdown 文件所在目录为基准解析，并嵌入生成的 HTML。
- Markdown 文件不应包含手写封面；封面由 frontmatter 生成。

## 输出行为

- 输出文件写在源 Markdown 文件旁边，使用相同的基础文件名和 `.html` 扩展名。
- 只有包含 `md-slides` 模板标记的现有 HTML 文件才会被覆盖。否则生成器使用 `.slides.html` 后缀并保护现有文件。
- 幻灯片包含生成的封面、源文件的每个页面，以及源文件没有目录时自动生成的目录页。
- 封面计入总页数但隐藏页码；其他页面显示当前页码和总页数。
- 目录使用 H1 和 H2 标题，不显示章节编号，并支持直接跳转。
- 每个生成的 deck 都是自包含的。图片会被嵌入，不需要 CDN、外部字体、iframe 或网络请求。

## 页面模型

- `---` 是唯一的分页信号。Agent 不会根据内容密度自行拆页或合页。
- 只有一个 H1 和一段可选短说明的页面会渲染为分区页。
- 有正文的页面遵循页面模型定义的标题算法：适用的最深层标题作为主标题，H1/H2 祖先作为面包屑。
- 包含多个 H3 的页面使用外层 H2 作为主标题；包含多个 H2 的页面使用外层 H1，且不显示面包屑。
- 没有标题的页面会延续上一页，并追加续页标记。
- 存在源目录时使用源目录；否则根据文档标题自动生成目录。

完整页面模型见 [`plugins/md-slides/skills/build-slides/references/page-model.md`](plugins/md-slides/skills/build-slides/references/page-model.md)。样式规则见 [`plugins/md-slides/skills/build-slides/references/style-spec.md`](plugins/md-slides/skills/build-slides/references/style-spec.md)，可复用的布局模式见 [`plugins/md-slides/skills/build-slides/references/recipes.md`](plugins/md-slides/skills/build-slides/references/recipes.md)。

## 演示行为

- 白色背景、深色正文、细分隔线和暗红强调色。
- 使用系统 sans-serif 和等宽字体，不依赖外部字体。
- 方向键、空格、Page Up 和 Page Down 用于翻页；Home 和 End 跳转到第一页和最后一页。
- 点击视口左侧或右侧可以后退或前进。
- 按 Escape 切换幻灯片总览。
- 使用 `#s3` 这类 hash 链接打开指定页面。
- 固定进度条和页码提供导航上下文。
- 内容过密时先缩放；缩放仍无法容纳时才允许滚动。

## 校验

在仓库根目录运行：

```bash
node plugins/md-slides/scripts/validate.mjs <input.md> <output.html>
```

退出码为 `0` 表示结构通过，但仍可能打印 warning。退出码为 `1` 表示存在结构错误，例如缺少模板标记、幻灯片数量不正确、模板 CSS 或 JavaScript 被修改、存在外部资源，或图片不是 data URI。

校验器和测试套件要求 Node.js 18 或更高版本，且没有包依赖。在插件目录运行测试：

```bash
node --test scripts/validate.test.mjs
```

没有 Node.js 时，按 [`SKILL.md`](plugins/md-slides/skills/build-slides/SKILL.md) 末尾的自检清单执行检查。

## 当前限制

- 默认界面针对中文内容优化。通过 `lang: en` 支持英文正文，但界面标签仍以中文为主。
- 不提供 PPTX 和 PDF 导出。
- 多主题、主题编辑器和品牌定制不在当前范围内。
- Agent 不生成图片，也不访问网络。
- 内容过密会产生 warning，并使用缩放或滚动作为兜底。
- 目录匹配在去除编号、大小写折叠和空白归一化后仍要求精确匹配，不会对简称进行模糊匹配。

## 仓库结构

- `plugins/md-slides/.claude-plugin/` 和 `plugins/md-slides/.codex-plugin/` 存放平台 manifest。
- `plugins/md-slides/skills/build-slides/` 存放构建工作流及参考文档。
- `plugins/md-slides/assets/template.html` 是固定的 HTML/CSS/JavaScript 模板。
- `plugins/md-slides/scripts/` 存放校验器和测试。
- `plugins/md-slides/commands/` 存放 Claude Code 命令定义。
