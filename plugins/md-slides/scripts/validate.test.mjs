import test from 'node:test'
import assert from 'node:assert/strict'
import { stripNumber, parseFrontmatter, splitPages, parseHeadings, selectPageTitle, classifyPage } from './validate.mjs'

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

test('H1-only page with body is content; without body is divider', () => {
  assert.equal(classifyPage('# 1 背景\n', null).type, 'divider')
  assert.equal(classifyPage('# 1 背景\n\n一段说明。\n', null).type, 'content')
})

test('TOC page is detected by heading', () => {
  assert.equal(classifyPage('## 目录\n\n- 背景\n  - 行业现状\n', null).type, 'toc')
})
