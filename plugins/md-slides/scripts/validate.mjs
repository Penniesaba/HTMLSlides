import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NUMBER_RE = /^(\d+(?:\.\d+)*)[.、]?\s+/

export function stripNumber(raw) {
  const text = String(raw).trim()
  const m = text.match(NUMBER_RE)
  if (!m) return { number: null, title: text }
  const number = m[1]
  // A bare four-digit number is a year, not a section number.
  if (!number.includes('.') && number.length === 4) {
    return { number: null, title: text }
  }
  return { number, title: text.slice(m[0].length).trim() }
}

function parseYamlScalar(value) {
  const v = value.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

export function parseFrontmatter(source) {
  const text = String(source).replace(/^﻿/, '')
  const warnings = []
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return { data: {}, body: text, warnings }
  }
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
  if (end === -1) {
    warnings.push('frontmatter is not closed')
    return { data: {}, body: text, warnings }
  }
  const data = {}
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx === -1) {
      warnings.push(`frontmatter line is not key: value: ${line.trim()}`)
      continue
    }
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1)
    if (!key) continue
    data[key] = parseYamlScalar(value)
  }
  const body = lines.slice(end + 1).join('\n').replace(/^\n+/, '')
  return { data, body, warnings }
}

function isFence(line) {
  return /^\s*(```|~~~)/.test(line)
}

export function splitPages(body) {
  const lines = String(body).replace(/\r\n/g, '\n').split('\n')
  const pages = []
  let current = []
  let fence = false
  for (const line of lines) {
    if (isFence(line)) fence = !fence
    if (!fence && /^\s*---\s*$/.test(line)) {
      pages.push(current.join('\n').trim())
      current = []
      continue
    }
    current.push(line)
  }
  pages.push(current.join('\n').trim())
  return pages.filter((page, i) => page.length > 0 || i === 0)
}

export function parseHeadings(page) {
  const lines = String(page).replace(/\r\n/g, '\n').split('\n')
  const headings = []
  let fence = false
  for (const line of lines) {
    if (isFence(line)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const raw = m[2].trim()
    const { number, title } = stripNumber(raw)
    headings.push({ level: m[1].length, raw, number, title })
  }
  return headings
}

export function selectPageTitle(headings) {
  const warnings = []
  if (!headings.length) {
    return { main: null, breadcrumb: [], warnings: ['page has no heading'] }
  }
  const byLevel = { 1: [], 2: [], 3: [] }
  for (const h of headings) {
    if (byLevel[h.level]) byLevel[h.level].push(h)
  }
  const unique = (arr) => (arr.length === 1 ? arr[0] : null)
  const h1 = unique(byLevel[1])
  const h2 = unique(byLevel[2])
  const h3 = unique(byLevel[3])

  if (h3 && h2 && h1) {
    return { main: h3, breadcrumb: [h1, h2], warnings }
  }
  if (h2 && h1) {
    return { main: h2, breadcrumb: [h1], warnings }
  }
  if (h1) {
    return { main: h1, breadcrumb: [], warnings }
  }
  if (byLevel[1].length) {
    warnings.push('multiple H1 headings on one page')
    return { main: byLevel[1][0], breadcrumb: [], warnings }
  }
  warnings.push('page is missing H1/H2 hierarchy')
  return { main: headings[0], breadcrumb: [], warnings }
}

function bodyWithoutHeadings(page) {
  return String(page).replace(/^#{1,3}\s+.*$/gm, '').trim()
}

export function classifyPage(page, previous = null) {
  const headings = parseHeadings(page)
  const selection = selectPageTitle(headings)
  const warnings = [...selection.warnings]

  if (headings.length === 0) {
    const prev = previous && previous.length ? selectPageTitle(previous) : null
    if (prev && prev.main) {
      warnings.push('续页：没有标题，继承上一页标题')
      return {
        type: 'continuation',
        main: { ...prev.main, title: `${prev.main.title}（续）` },
        breadcrumb: prev.breadcrumb || [],
        warnings,
      }
    }
    warnings.push('续页：没有标题，也没有上一页可继承')
    return { type: 'continuation', main: null, breadcrumb: [], warnings }
  }

  const first = headings[0]
  if (first.level === 2 && /^(目录|contents|table of contents)$/i.test(first.title)) {
    return { type: 'toc', main: first, breadcrumb: [], warnings }
  }

  if (headings.length === 1 && first.level === 1 && bodyWithoutHeadings(page) === '') {
    return { type: 'divider', main: first, breadcrumb: [], warnings }
  }

  return { type: 'content', main: selection.main, breadcrumb: selection.breadcrumb, warnings }
}

export function parseToc(page) {
  const lines = String(page).replace(/\r\n/g, '\n').split('\n')
  const items = []
  let fence = false
  for (const line of lines) {
    if (isFence(line)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const m = line.match(/^(\s*)-\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1].length >= 2 ? 2 : 1
    const { title } = stripNumber(m[2])
    items.push({ level, text: title })
  }
  return items
}

export function buildToc(headings) {
  return headings
    .filter(h => h.level === 1 || h.level === 2)
    .map(h => ({ level: h.level, text: h.title }))
}

function normalizeTitle(text) {
  return String(text).replace(/\s+/g, ' ').trim().toLowerCase()
}

export function matchToc(items, headings) {
  const matched = []
  const unmatched = []
  const warnings = []
  const seen = new Map()
  for (const item of items) {
    const key = `${item.level}:${normalizeTitle(item.text)}`
    if (seen.has(key)) {
      warnings.push(`duplicate TOC entry: ${item.text}`)
    }
    const found = headings.find(h =>
      h.level === item.level && normalizeTitle(h.title) === normalizeTitle(item.text))
    if (found) {
      if (!seen.has(key)) seen.set(key, found)
      matched.push({ item, heading: found })
    } else {
      unmatched.push(item)
    }
  }
  return { matched, unmatched, warnings }
}

function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('usage: node scripts/validate.mjs <input.md> [output.html]')
    process.exit(2)
  }
  const source = fs.readFileSync(path.resolve(input), 'utf8')
  const { data, body, warnings } = parseFrontmatter(source)
  const pages = splitPages(body)
  const headings = pages.map(parseHeadings)
  console.log(JSON.stringify({ title: data.title || null, pages: pages.length, headings, warnings }, null, 2))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
