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

function isShortDividerBody(page) {
  const body = bodyWithoutHeadings(page)
  if (body === '') return true
  if (body.length > 200) return false
  if (body.split(/\n\s*\n/).length > 1) return false
  if (/^\s*([-*+]|\d+\.)\s+/m.test(body)) return false
  if (/^\s*\|/m.test(body)) return false
  if (/^\s*(```|~~~)/m.test(body)) return false
  if (/^\s*>/m.test(body)) return false
  if (/!\[/.test(body)) return false
  if (/<details/i.test(body)) return false
  return true
}

function withContext(pageHeadings, context = []) {
  const out = []
  for (const h of context) out.push(h)
  for (const h of pageHeadings) {
    if (h.level === 1) {
      out.length = 0
      out.push(h)
    } else if (h.level === 2) {
      const h1 = out.find(x => x.level === 1)
      out.length = 0
      if (h1) out.push(h1)
      out.push(h)
    } else {
      out.push(h)
    }
  }
  return out
}

export function classifyPage(page, previous = null, context = []) {
  const headings = parseHeadings(page)

  if (headings.length === 0) {
    const prev = previous && previous.length ? selectPageTitle(previous) : null
    if (prev && prev.main) {
      return {
        type: 'continuation',
        main: { ...prev.main, title: `${prev.main.title}（续）` },
        breadcrumb: prev.breadcrumb || [],
        warnings: ['续页：没有标题，继承上一页标题'],
      }
    }
    return {
      type: 'continuation',
      main: null,
      breadcrumb: [],
      warnings: ['续页：没有标题，也没有上一页可继承'],
    }
  }

  const first = headings[0]
  if (first.level === 2 && /^(目录|contents|table of contents)$/i.test(first.title)) {
    return { type: 'toc', main: first, breadcrumb: [], warnings: [] }
  }

  if (headings.length === 1 && first.level === 1 && isShortDividerBody(page)) {
    return { type: 'divider', main: first, breadcrumb: [], warnings: [] }
  }

  const selection = selectPageTitle(withContext(headings, context))
  return {
    type: 'content',
    main: selection.main,
    breadcrumb: selection.breadcrumb,
    warnings: selection.warnings,
  }
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

function normalizeBlock(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').trim()
}

function extractBlock(html, tag) {
  const m = String(html).match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? m[1] : null
}

function densityWarnings(page, pageNumber) {
  const warnings = []
  const bullets = (page.match(/^\s*[-*+]\s+/gm) || []).length
  if (bullets > 6) {
    warnings.push(`density: page ${pageNumber} has ${bullets} bullets (recommended <= 6)`)
  }

  let maxColumns = 0
  for (const line of page.split('\n')) {
    if (!line.includes('|')) continue
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
    const columns = trimmed.split('|').length
    if (columns > maxColumns) maxColumns = columns
  }
  if (maxColumns > 6) {
    warnings.push(`density: page ${pageNumber} has a ${maxColumns}-column table (recommended <= 6)`)
  }

  let fence = false
  let codeLines = 0
  for (const line of page.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence
      continue
    }
    if (fence) codeLines += 1
  }
  if (codeLines > 20) {
    warnings.push(`density: page ${pageNumber} has ${codeLines} code lines (recommended <= 20)`)
  }
  return warnings
}

function numberingWarnings(headings) {
  const warnings = []
  let h1Expected = 1
  let h2Expected = 1
  let h3Expected = 1
  let currentH1 = null
  let currentH2 = null

  for (const h of headings) {
    if (h.number == null) continue

    if (h.level === 1) {
      const n = Number.parseInt(h.number, 10)
      if (n !== h1Expected) warnings.push(`numbering: H1 ${h.number} is not ${h1Expected}`)
      h1Expected = n + 1
      currentH1 = h.number
      currentH2 = null
      h2Expected = 1
      h3Expected = 1
    } else if (h.level === 2) {
      if (!currentH1) {
        warnings.push(`numbering: H2 ${h.number} has no H1`)
        continue
      }
      const expected = `${currentH1}.${h2Expected}`
      if (h.number !== expected) warnings.push(`numbering: H2 ${h.number} is not ${expected}`)
      const parts = h.number.split('.')
      h2Expected = Number.parseInt(parts[parts.length - 1], 10) + 1
      currentH2 = h.number
      h3Expected = 1
    } else if (h.level === 3) {
      if (!currentH2) {
        warnings.push(`numbering: H3 ${h.number} has no H2`)
        continue
      }
      const expected = `${currentH2}.${h3Expected}`
      if (h.number !== expected) warnings.push(`numbering: H3 ${h.number} is not ${expected}`)
      const parts = h.number.split('.')
      h3Expected = Number.parseInt(parts[parts.length - 1], 10) + 1
    }
  }
  return warnings
}

export function validateMarkdown(source) {
  const warnings = []
  const errors = []
  const fm = parseFrontmatter(source)
  warnings.push(...fm.warnings)

  const rawPages = splitPages(fm.body)
  const allHeadings = []
  const pages = []
  let context = []
  let previousEffective = null

  rawPages.forEach((page, i) => {
    const headings = parseHeadings(page)
    allHeadings.push(...headings)
    const effective = withContext(headings, context)
    const classification = classifyPage(page, previousEffective, context)
    warnings.push(...classification.warnings.map(w => `page ${i + 1}: ${w}`))
    if (classification.type === 'content' || classification.type === 'continuation') {
      warnings.push(...densityWarnings(page, i + 1))
    }
    pages.push({
      index: i + 1,
      type: classification.type,
      main: classification.main,
      breadcrumb: classification.breadcrumb,
      headings,
      warnings: classification.warnings,
    })
    if (classification.type !== 'toc') {
      for (const h of headings) {
        if (h.level === 1) {
          context = [h]
        } else if (h.level === 2) {
          const h1 = context.find(x => x.level === 1)
          context = h1 ? [h1, h] : [h]
        }
      }
      previousEffective = effective
    }
  })

  const tocPage = pages.find(p => p.type === 'toc')
  let tocItems = []
  let tocMatched = []
  let tocUnmatched = []
  let generatedToc = false

  if (tocPage) {
    tocItems = parseToc(rawPages[tocPage.index - 1])
    const match = matchToc(tocItems, allHeadings)
    tocMatched = match.matched
    tocUnmatched = match.unmatched
    warnings.push(...match.warnings.map(w => `TOC: ${w}`))
    for (const item of match.unmatched) warnings.push(`TOC item not found: ${item.text}`)
  } else {
    generatedToc = true
    tocItems = buildToc(allHeadings)
  }

  let title = fm.data.title || null
  if (!title) {
    const firstH1 = allHeadings.find(h => h.level === 1)
    title = firstH1 ? firstH1.title : (allHeadings[0] ? allHeadings[0].title : null)
    warnings.push('title: missing from frontmatter; using the first heading')
  }

  warnings.push(...numberingWarnings(allHeadings))

  return {
    title,
    data: fm.data,
    pages,
    toc: { items: tocItems, generated: generatedToc, matched: tocMatched, unmatched: tocUnmatched },
    errors,
    warnings,
  }
}

export function expectedSlides(result) {
  return result.pages.length + 1 + (result.toc && result.toc.generated ? 1 : 0)
}

export function expectedTypes(result) {
  const types = ['cover']
  if (result.toc && result.toc.generated) types.push('toc')
  for (const page of result.pages) {
    types.push(page.type === 'continuation' ? 'content' : page.type)
  }
  return types
}

export function validateHtml(html, templateHtml, expectedSlideCount, pageTypes = []) {
  const errors = []
  const warnings = []

  if (!/^\s*<!--\s*md-slides template v1\s*-->/.test(html)) {
    errors.push('missing template sentinel: <!-- md-slides template v1 -->')
  }
  if (!/(class="deck"|id="deck")/.test(html)) errors.push('missing .deck')
  if (!/class="slide[^"]*cover/.test(html)) errors.push('missing cover slide')
  for (const id of ['pageno', 'progress', 'overview', 'ovgrid']) {
    if (!new RegExp(`id="${id}"`).test(html)) errors.push(`missing #${id}`)
  }
  if (!/<script[\s>]/i.test(html)) errors.push('missing inline script')

  const slideCount = (html.match(/<section\s+class="slide\b/g) || []).length
  if (slideCount !== expectedSlideCount) {
    errors.push(`slide count mismatch: expected ${expectedSlideCount}, found ${slideCount}`)
  }

  if (pageTypes.length) {
    const sections = [...html.matchAll(/<section\s+class="slide([^"]*)"[^>]*>/g)].map(m => m[1])
    sections.forEach((classes, i) => {
      const expected = pageTypes[i]
      if (!expected) return
      const wanted = expected === 'continuation' ? 'content' : expected
      if (!new RegExp(`(^|\\s)${wanted}(\\s|$)`).test(classes)) {
        errors.push(`slide ${i + 1} class should be ${wanted}`)
      }
    })
  }

  const templateStyle = extractBlock(templateHtml, 'style')
  const outputStyle = extractBlock(html, 'style')
  if (!outputStyle || normalizeBlock(outputStyle) !== normalizeBlock(templateStyle)) {
    errors.push('template <style> was modified')
  }

  const templateScript = extractBlock(templateHtml, 'script')
  const outputScript = extractBlock(html, 'script')
  if (!outputScript || normalizeBlock(outputScript) !== normalizeBlock(templateScript)) {
    errors.push('template <script> was modified')
  }

  if ((html.match(/<style\b/gi) || []).length > 1) errors.push('extra <style> element')
  if ((html.match(/<script\b/gi) || []).length > 1) errors.push('external or unexpected <script> element')
  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) errors.push('external script is not allowed')
  if (/<link\b[^>]*\bhref\s*=/i.test(html)) errors.push('external stylesheet is not allowed')
  if (/<iframe\b/i.test(html)) errors.push('iframe is not allowed')
  if (/\son[a-z]+\s*=/i.test(html)) errors.push('inline event attribute is not allowed')
  if (/\sstyle\s*=/i.test(html)) errors.push('inline style attribute is not allowed')

  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']*)["']/gi)) {
    if (!/^data:image\//.test(m[1])) {
      errors.push('image src must be a data URI')
      break
    }
  }

  return { errors, warnings }
}

function main() {
  const args = process.argv.slice(2)
  const input = args[0]
  if (!input) {
    console.error('usage: node scripts/validate.mjs <input.md> [output.html]')
    process.exit(2)
  }

  const inputPath = path.resolve(input)
  const source = fs.readFileSync(inputPath, 'utf8')
  const result = validateMarkdown(source)
  const errors = [...result.errors]
  const warnings = [...result.warnings]

  if (args[1]) {
    const outputPath = path.resolve(args[1])
    const html = fs.readFileSync(outputPath, 'utf8')
    const templatePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/template.html')
    const templateHtml = fs.readFileSync(templatePath, 'utf8')
    const htmlResult = validateHtml(html, templateHtml, expectedSlides(result), expectedTypes(result))
    errors.push(...htmlResult.errors)
    warnings.push(...htmlResult.warnings)

    const inputBase = path.basename(inputPath).replace(/\.md$/i, '')
    const outputBase = path.basename(outputPath)
    if (outputBase !== `${inputBase}.html` && outputBase !== `${inputBase}.slides.html`) {
      errors.push(`output path must be ${inputBase}.html or ${inputBase}.slides.html`)
    }
  }

  for (const warning of [...new Set(warnings)]) console.log(`WARNING: ${warning}`)
  for (const error of [...new Set(errors)]) console.error(`ERROR: ${error}`)
  const totalSlides = expectedSlides(result)
  const tocNote = result.toc.generated ? ' (including auto-generated TOC)' : ''
  console.log(`${result.pages.length} markdown page(s); ${totalSlides} slide(s) including cover${tocNote}`)
  process.exit(errors.length ? 1 : 0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
