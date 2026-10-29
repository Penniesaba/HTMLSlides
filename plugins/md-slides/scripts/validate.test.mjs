import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { stripNumber, parseFrontmatter, splitPages, parseHeadings, selectPageTitle, classifyPage, parseToc, buildToc, matchToc, validateHtml, validateMarkdown, expectedSlides, expectedTypes } from './validate.mjs'

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

test('H1-only page with a short note is a divider; a long body is content', () => {
  assert.equal(classifyPage('# 1 背景\n', null).type, 'divider')
  assert.equal(classifyPage('# 1 背景\n\n一段说明。\n', null).type, 'divider')
  const long = `# 1 背景\n\n${'这是很长的正文。'.repeat(40)}\n`
  assert.equal(classifyPage(long, null).type, 'content')
})

test('H1-only page with a list is content', () => {
  assert.equal(classifyPage('# 1 背景\n\n- 第一点\n- 第二点\n', null).type, 'content')
})

test('blockquote notes are ignored when classifying a page', () => {
  assert.equal(classifyPage('# 1 背景\n\n> 写给自己看的短注释。\n', null).type, 'divider')
  assert.equal(classifyPage(`# 1 背景\n\n> ${'写给自己看的注释。'.repeat(40)}\n`, null).type, 'divider')
  assert.equal(classifyPage('# 1 背景\n\n> - 注释里的列表\n> - 不算正文\n', null).type, 'divider')
})

test('blockquote content does not count toward density warnings', () => {
  const rows = '> | a | b | c | d | e | f | g |\n> |---|---|---|---|---|---|---|'
  const md = `---\ntitle: D\n---\n# 1 背景\n## 1.1 行业现状\n\n${rows}\n`
  const r = validateMarkdown(md)
  assert.ok(!r.warnings.some(w => w.includes('density')), r.warnings.join('\n'))
})

test('images inside blockquotes are comments and do not warn', () => {
  const md = '# 1 背景\n\n> ![注释里的图](nope.png)\n'
  const r = validateMarkdown(md, { baseDir: 'examples' })
  assert.ok(!r.warnings.some(w => w.includes('image')), r.warnings.join('\n'))
})

test('TOC page is detected by heading', () => {
  assert.equal(classifyPage('## 目录\n\n- 背景\n  - 行业现状\n', null).type, 'toc')
})

test('parseToc reads a nested H1/H2 list', () => {
  const page = '## 目录\n\n- 背景\n  - 行业现状\n- 攻击视角\n  - 威胁模型\n'
  assert.deepEqual(parseToc(page), [
    { level: 1, text: '背景' },
    { level: 2, text: '行业现状' },
    { level: 1, text: '攻击视角' },
    { level: 2, text: '威胁模型' },
  ])
})

test('parseToc treats a tab-indented item as level 2', () => {
  assert.deepEqual(parseToc('## 目录\n\n- 背景\n\t- 行业现状\n'), [
    { level: 1, text: '背景' },
    { level: 2, text: '行业现状' },
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

test('validateHtml allows code text that mentions style and onLoad', () => {
  const withCode = exampleHtml.replace(
    '</body>',
    '<pre><code>const onLoad = 1; &lt;div style="x"&gt;</code></pre></body>',
  )
  const r = validateHtml(withCode, templateHtml, expectedCount)
  assert.deepEqual(r.errors, [])
})

test('validateHtml rejects a real inline event attribute', () => {
  const broken = exampleHtml.replace(
    '<h1 class="slide-title">',
    '<h1 class="slide-title" onclick="x()">',
  )
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('inline event')))
})

test('validateHtml rejects external resource attributes', () => {
  const snippets = [
    '<video src="https://example.com/x.mp4"></video>',
    '<img src="data:image/png;base64,AA" srcset="https://example.com/x.png 2x">',
    '<base href="https://example.com/">',
    '<meta http-equiv="refresh" content="0;url=https://example.com">',
    '<svg><image href="https://example.com/x.png"></image></svg>',
  ]
  for (const snippet of snippets) {
    const broken = exampleHtml.replace('</body>', `${snippet}</body>`)
    const r = validateHtml(broken, templateHtml, expectedCount)
    assert.ok(r.errors.some(e => e.includes('external')), snippet)
  }
})

test('validateHtml rejects an unquoted external image src', () => {
  const broken = exampleHtml.replace(
    /src="data:image\/svg\+xml;base64,[^"]+"/,
    'src=https://example.com/x.png',
  )
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('external') || e.includes('data URI')))
})

test('validateHtml rejects a slide without .slide-content', () => {
  const broken = exampleHtml.replace('<div class="slide-content">', '')
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('slide-content')))
})

test('validateHtml rejects a slide without data-title', () => {
  const broken = exampleHtml.replace('data-title="封面"', '')
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('data-title')))
})

test('validateHtml rejects leftover template placeholders', () => {
  const broken = exampleHtml.replace(
    '<title>Agent Security · 智能体安全</title>',
    '<title>{{TITLE}}</title>',
  )
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('placeholder')))
})

test('validateHtml rejects a slide-count mismatch', () => {
  const r = validateHtml(exampleHtml, templateHtml, 99)
  assert.ok(r.errors.some(e => e.includes('slide count')))
})

test('validateHtml rejects a divider page rendered as content', () => {
  const types = ['cover', ...validateMarkdown(exampleMd).pages.map(p => p.type === 'continuation' ? 'content' : p.type)]
  const broken = exampleHtml.replace(
    '<section class="slide divider" data-title="背景">',
    '<section class="slide content" data-title="背景">',
  )
  const r = validateHtml(broken, templateHtml, expectedCount, types)
  assert.ok(r.errors.some(e => e.includes('slide 3') && e.includes('divider')))
})

test('validateHtml rejects a rendered blockquote', () => {
  const broken = exampleHtml.replace('</body>', '<blockquote>comment</blockquote></body>')
  const r = validateHtml(broken, templateHtml, expectedCount)
  assert.ok(r.errors.some(e => e.includes('blockquote')), r.errors.join('\n'))
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

test('a page starting with H2 inherits the H1 from the document context', () => {
  const md = '# 1 背景\n\n---\n\n## 1.1 行业现状\n\n### 1.1.1 案例\n'
  const r = validateMarkdown(md)
  assert.equal(r.pages[1].type, 'content')
  assert.equal(r.pages[1].main.level, 3)
  assert.deepEqual(r.pages[1].breadcrumb.map(h => h.title), ['背景', '行业现状'])
  assert.ok(!r.warnings.some(w => w.includes('missing H1/H2')))
})

test('multiple H2s on one page stop at H1 through classifyPage', () => {
  const r = classifyPage('# 1 背景\n## 1.1 行业现状\n## 1.2 攻击面\n', null, [])
  assert.equal(r.main.level, 1)
  assert.equal(r.main.title, '背景')
  assert.deepEqual(r.breadcrumb, [])
})

test('multiple H1s on one page warn and use the first', () => {
  const r = classifyPage('# 1 案例 A\n## 1.1 小节\n# 2 案例 B\n', null, [])
  assert.equal(r.main.title, '案例 A')
  assert.ok(r.warnings.some(w => w.includes('multiple H1')))
})

test('consecutive untitled pages keep the previous continuation title', () => {
  const md = '# 1 背景\n\n---\n\n## 1.1 行业现状\n\n---\n\n### 1.1.1 案例\n\n---\n\n正文一。\n\n---\n\n正文二。\n'
  const r = validateMarkdown(md)
  assert.equal(r.pages[3].main.title, '案例（续）')
  assert.equal(r.pages[4].main.title, '案例（续）')
})

test('the reference deck has no TOC hierarchy or density warnings', () => {
  const r = validateMarkdown(exampleMd)
  assert.ok(!r.warnings.some(w => w.startsWith('page 1:') || w.startsWith('density: page 1')))
})

test('validateMarkdown warns when the employee TOC omits H2s', () => {
  const md = '## 目录\n\n- 背景\n\n---\n\n# 1 背景\n\n---\n\n## 1.1 行业现状\n\n---\n\n## 1.2 攻击面\n'
  const r = validateMarkdown(md)
  assert.ok(r.warnings.some(w => w.includes('TOC missing heading')))
})

test('validateMarkdown warns on duplicate document headings', () => {
  const md = '## 目录\n\n- 背景\n\n---\n\n# 1 背景\n\n---\n\n# 2 背景\n'
  const r = validateMarkdown(md)
  assert.ok(r.warnings.some(w => w.includes('TOC duplicate heading')))
})

test('validateMarkdown warns on missing and remote images when baseDir is set', () => {
  const md = '![missing](nope.png)\n\n![remote](https://example.com/x.png)'
  const r = validateMarkdown(md, { baseDir: 'examples' })
  assert.ok(r.warnings.some(w => w.includes('image not found')))
  assert.ok(r.warnings.some(w => w.includes('remote image')))
})

test('validateMarkdown accepts an existing local image', () => {
  const md = '![ok](assets/sample.svg)'
  const r = validateMarkdown(md, { baseDir: 'examples' })
  assert.ok(!r.warnings.some(w => w.includes('image')))
})

test('auto-generated TOC adds one slide and a toc page type', () => {
  const r = validateMarkdown(fs.readFileSync('examples/no-toc.md', 'utf8'))
  assert.equal(r.toc.generated, true)
  assert.equal(expectedSlides(r), r.pages.length + 2)
  assert.equal(expectedTypes(r)[1], 'toc')
  assert.equal(expectedTypes(r).length, expectedSlides(r))
})

test('skill docs point at the plugin-root template and validator', () => {
  const skill = fs.readFileSync('skills/build-slides/SKILL.md', 'utf8')
  assert.match(skill, /<plugin-root>\/assets\/template\.html/)
  assert.match(skill, /<plugin-root>\/scripts\/validate\.mjs/)
  assert.ok(fs.existsSync('assets/template.html'))
  assert.ok(fs.existsSync('scripts/validate.mjs'))
})
