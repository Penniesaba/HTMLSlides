# 常见页面配方

每个配方给 Markdown 输入和对应的 HTML 片段。HTML 只写 `.slide-content` 里的内容；`<section>` 和标题区按 `page-model.md` 生成。

## 1. 纯文字页

Markdown：

```markdown
## 1.1 行业现状

2026 年被称为 agent 安全的元年。

> agent 安全已经不再只是模型安全的一个子集。
```

HTML：

```html
<section class="slide content" data-title="行业现状">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span></div>
    <h1 class="slide-title">行业现状</h1>
    <p>2026 年被称为 agent 安全的元年。</p>
    <blockquote>agent 安全已经不再只是模型安全的一个子集。</blockquote>
  </div>
</section>
```

## 2. 三条 bullet 页

Markdown：

```markdown
## 1.2 三个变化

- 风险从“输出有害”转向“行为越权”。
- 防护从“提示词过滤”转向“权限与工具边界”。
- 评估从“单轮问答”转向“多步任务”。
```

HTML：

```html
<section class="slide content" data-title="三个变化">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span></div>
    <h1 class="slide-title">三个变化</h1>
    <ul>
      <li>风险从“输出有害”转向“行为越权”。</li>
      <li>防护从“提示词过滤”转向“权限与工具边界”。</li>
      <li>评估从“单轮问答”转向“多步任务”。</li>
    </ul>
  </div>
</section>
```

## 3. 表格页

Markdown：

```markdown
## 1.3 权限对比

| 维度 | 观察 |
|---|---|
| 权限 | 只允许读写当前任务 |
| 边界 | 高风险动作人工确认 |
```

HTML：

```html
<section class="slide content" data-title="权限对比">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span></div>
    <h1 class="slide-title">权限对比</h1>
    <table>
      <thead><tr><th>维度</th><th>观察</th></tr></thead>
      <tbody>
        <tr><td>权限</td><td>只允许读写当前任务</td></tr>
        <tr><td>边界</td><td>高风险动作人工确认</td></tr>
      </tbody>
    </table>
  </div>
</section>
```

## 4. 代码页

Markdown：

````markdown
## 2.1 最小权限

```python
def allow(tool, scope):
    return tool in scope
```
````

HTML：

```html
<section class="slide content" data-title="最小权限">
  <div class="slide-content">
    <div class="breadcrumb"><span>防御</span></div>
    <h1 class="slide-title">最小权限</h1>
    <pre><code class="language-python">def allow(tool, scope):
    return tool in scope</code></pre>
  </div>
</section>
```

## 5. 单图页

Markdown：

```markdown
## 1.4 架构

![条件访问架构](assets/sample.svg "图 1：自治边界")
```

HTML：

```html
<section class="slide content" data-title="架构">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span></div>
    <h1 class="slide-title">架构</h1>
    <figure>
      <img src="data:image/svg+xml;base64,..." alt="条件访问架构">
      <figcaption>图 1：自治边界</figcaption>
    </figure>
  </div>
</section>
```

## 6. 双图页（`grid: 2`）

Markdown：

```markdown
<!-- grid: 2 -->
## 2.2 验证方法

![流程 A](assets/a.svg "图 2：流程 A")
![流程 B](assets/b.svg "图 3：流程 B")
```

HTML：

```html
<section class="slide content" data-title="验证方法">
  <div class="slide-content">
    <div class="breadcrumb"><span>防御</span></div>
    <h1 class="slide-title">验证方法</h1>
    <div class="grid-2">
      <figure>
        <img src="data:image/svg+xml;base64,..." alt="流程 A">
        <figcaption>图 2：流程 A</figcaption>
      </figure>
      <figure>
        <img src="data:image/svg+xml;base64,..." alt="流程 B">
        <figcaption>图 3：流程 B</figcaption>
      </figure>
    </div>
  </div>
</section>
```

## 7. 折叠细节页

Markdown：

```markdown
<details>
<summary>展开：为什么不是“默认允许”</summary>

默认允许会把一次提示注入放大成一次完整的工具链攻击。

</details>
```

HTML：

```html
<details>
  <summary>展开：为什么不是“默认允许”</summary>
  <div class="body">
    <p>默认允许会把一次提示注入放大成一次完整的工具链攻击。</p>
  </div>
</details>
```

## 8. 分区页

Markdown：

```markdown
# 2 防御

从设计原则到验证方法，给出一套可落地的最小防线。
```

HTML：

```html
<section class="slide divider" data-title="防御">
  <div class="slide-content">
    <div class="divider-line"></div>
    <h1 class="divider-title">防御</h1>
    <p class="divider-desc">从设计原则到验证方法，给出一套可落地的最小防线。</p>
  </div>
</section>
```

## 9. 多 H3 页

Markdown：

```markdown
## 1.5 两个案例对比

### 1.5.1 案例 A

案例 A 的边界比较清楚。

### 1.5.2 案例 B

案例 B 的边界更模糊。
```

HTML：

```html
<section class="slide content" data-title="两个案例对比">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span></div>
    <h1 class="slide-title">两个案例对比</h1>
    <h3 class="sub">案例 A</h3>
    <p>案例 A 的边界比较清楚。</p>
    <h3 class="sub">案例 B</h3>
    <p>案例 B 的边界更模糊。</p>
  </div>
</section>
```

## 10. 续页

Markdown（整页没有标题）：

```markdown
过去一年，变化主要体现在三件事上：

- 风险从“输出有害”转向“行为越权”。
- 防护从“提示词过滤”转向“权限与工具边界”。
```

HTML：

```html
<section class="slide content" data-title="上一页标题（续）">
  <div class="slide-content">
    <div class="breadcrumb"><span>背景</span><span class="sep">/</span><span>行业现状</span></div>
    <h1 class="slide-title">上一页标题（续）</h1>
    <p>过去一年，变化主要体现在三件事上：</p>
    <ul>
      <li>风险从“输出有害”转向“行为越权”。</li>
      <li>防护从“提示词过滤”转向“权限与工具边界”。</li>
    </ul>
  </div>
</section>
```
