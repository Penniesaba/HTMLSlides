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
