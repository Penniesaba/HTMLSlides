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
