# 1  项目记忆 — Agent 安全汇报 HTML PPT

## 1.1  任务
把本项目（AI Agent 安全领域调研）制作成一个**可交互的静态 HTML 幻灯片**，用于约 20 分钟的汇报。

## 1.2  核心要求（用户明确提出）
- **风格**：简单的 markdown 风格、简约风、**纯白色背景**，不要有多余的装饰元素。
- **形式**：单个静态 HTML 文件，可交互（翻页等）。
- **内容来源**：当前工作目录下的素材，**重点参考 `v4.md`**；演示结构见 `演示脚本.md`。
- **发挥**：可在原有素材基础上适当补充完善，不要太拘泥于原文。
- 维护本 CLAUDE.md 以保持对要求的记忆。
- 工作流程：先维护 CLAUDE.md → 用 superpowers 头脑风暴/规划/理解任务。

## 1.3  汇报结构（来自 v4 copy.md）
四大部分，约 20 分钟：
1. Agent 安全领域的热度与趋势（Page 3: 元年开场 → Page 4-5: OWASP → Page 6-7: ATLAS → Page 8: 其他现象=并购/论文/融资/GitHub）
2. 从攻击视角对 Agent 安全做全局分析（AI Agents 组成；V 分类=攻击向量；R 分类=安全风险）
3. 案例分析（22 个案例总表 + 若干深度拆解：CS0042/0045/0048/0053/0054/0068/0070）
4. 论文研读（S&P/USENIX/CCS/NDSS 统计；5.1 寄生工具链攻击详解 + 5.2–5.7）

## 1.4  素材位置
- 主内容：`v4.md`
- 演示脚本：`演示脚本.md`
- 图片：`asset/*.png`（OWASP、ATLAS 矩阵、platforms 字段、agent 架构、攻击分类、MCP 架构等）
- 论文清单（可补全 5.2–5.7）：`SP2026_*.md` `USENIX2026_*.md` `CCS2026_*.md` `NDSS2026_*.md`
- 既有架构图 HTML（风格参考）：`archify/architecture-mcp-attack-20261008/mcp-attack-architecture.html`

## 1.5  设计决策（已确认）
- **图片**：用相对路径 `asset/...` 引用；因此 HTML 文件必须放在**项目根目录**，与 `asset/` 同级，分发时需连同 `asset/` 文件夹一起。
- **深度**：完整——尽量承载 v4.md 全部内容（22 案例总表 + 7 个深度拆解逐步、7 篇论文），用"要点页 + 可展开细节"的交互折叠承载密度。
- **输出文件**：`演示.html`（根目录）。
- **风格**：纯白背景、黑/深灰正文、极细分隔线、系统无衬线字体 + 等宽字体用于代码/ID；仅用一种克制的强调色（如暗红/靛蓝）标注危险/链接；无阴影、无渐变、无圆角花哨元素。
- **交互**：左右方向键/空格翻页、ESC 显示缩略图总览、顶部进度条、点击展开"零基础逐步拆解"等长内容、键盘可访问。

## 1.6  实现细节（供续作参考）
- 文件：`演示.html`（根目录）。每页是 `<section class="slide" data-sec data-title>`。
- 图片 src 用 `%20` 编码空格（如 `asset/Pasted%20image%20....png`）。
- 导航 JS：方向键/空格/Home/End、点击左右 28%/72% 半屏翻页、ESC 总览、hash 深链 `#s<n>`。
- 目录页用 `data-goto="<slide index>"` 跳转。**注意**：目前 Part 2/3/4 的 toc-item 都临时指向 index 2，建好对应分区后要改成真实起始页索引。
- 样式工具类：`.tag.real`（暗红=真实事件）`.tag.demo`（靛蓝=演示）、`.card`/`.grid2`/`.grid3`、`.stat`、`<details>` 折叠块、`.divider` 分区页。
- {}markdown标识符部分是全局旁白部分，不用在演示材料ppt中体现,但是你不能忽略因为里面有很多需要你理解并完成的要求
- ’> ‘这个markdown标识符部分渲染之后前面的竖杠需要用另一个颜色表示出来
- 如果展示的内容在不滚动的前提下字号太小，那么可以通过增加滚动来实现，尽量不需要使用滚动就可以展示一页的全部内容 

## 1.7  进度
- [x] 脚手架（CSS + 导航 JS + 封面 + 目录）
- [x] Part 1 热度与趋势（6 页）：Page 3 元年 / Page 4-5 OWASP / Page 6-7 ATLAS / Page 8 其他现象
- [x] Part 2 攻击视角（7 页）：Page 9 Agents架构 / Page 10 Attack Landscape / Page 11 V分类 / Page 12 R分类 / Page 13 V/R×ATLAS交叉验证 / Page 14-15 OWASP Top 10 上下
- [x] Part 3 案例分析（9 页）：Page 16 22案例总表(可滚动) / Page 17 CS0045详情 / Page 18 CS0045完整攻击过程(5步折叠) / Page 19 CS0048详情 / Page 20 CS0048完整攻击过程(5步平铺) / Page 21 CS0053详情 / Page 22 CS0053完整攻击过程(4步平铺) / Page 23 CS0054详情(docstring代码折叠) / Page 24 CS0054完整攻击过程(7步平铺)
- [x] Part 4 研究趋势（7 页）：Page 25 四大顶会统计 / Page 26 寄生工具链论文(出处+核心贡献) / Page 27 MCP三要素 / Page 28 MCP-UPD攻击方式 / Page 29 MCP-SEC普查框架 / Page 30 MemPoison论文介绍 / Page 31 MemPoison攻击过程
- [ ] 收尾：检查目录跳转索引、最终验证

## 1.8  新增实现细节
- 可滚动页：给 `<section>` 加 `scrollable` 类，CSS 关闭自动缩放并允许 `overflow-y:auto`；`fit()` 跳过 `.scrollable` 页。用于 22 案例总表这类超长表格。
- 案例性质用 `.tag.real`（真实=暗红）/ `.tag.demo`（演示=靛蓝）标签区分。


Conert MD to 