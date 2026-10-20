#!/usr/bin/env node
// Checks every source file against the CONVENTIONS.md rules that a machine can verify.
// Usage: node scripts/conformance.mjs [--self-test]
//
// An exception carries its reason on the same line or the line above:  // kobo: allow R-TYPE <reason>

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const CATALOG = join(ROOT, 'catalog')
const MAX_LINES = 250

const PALETTE =
  'slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const UTILITIES = 'bg|text|border|ring|outline|fill|stroke|from|via|to|divide|shadow|decoration|caret|accent'

/** Rules that scan one line. `skip` names files the rule does not apply to. */
const LINE_RULES = [
  { id: 'R-COLOR', why: 'No colour literals (hex, rgb, hsl) in components. Add a token to tokens.css.', test: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/ },
  {
    id: 'R-PALETTE',
    why: 'No Tailwind palette ramps or white/black. Use the role tokens (bg-surface, text-ink-muted).',
    test: new RegExp(`\\b(?:${UTILITIES})-(?:(?:${PALETTE}|neutral)-\\d{2,3}|white|black)\\b`),
  },
  {
    id: 'R-RADIUS',
    why: 'Use the radius tokens (rounded-control, rounded-card, rounded-badge, rounded-inner, rounded-sheet, rounded-full).',
    test: /\brounded(?:-[trblse]{1,2})?-(?:xs|sm|md|lg|[2-3]?xl|\[)/,
  },
  { id: 'R-LAYER', why: 'No raw z-index. Use the layer tokens (z-modal, z-toast).', test: /\bz-(?:\[|\d)/ },
  {
    id: 'R-TYPE',
    why: 'No Tailwind font sizes. Use the type roles (text-body, text-title2).',
    test: /\btext-(?:xs|sm|base|lg|[2-9]?xl|\[\d)/,
  },
  {
    id: 'R-MOTION',
    why: 'No raw durations or curves. Use duration-(--motion-*) and ease-standard / ease-enter / ease-exit.',
    test: /\bduration-\d|\bease-(?:in|out|in-out|linear)\b|\banimate-(?:pulse|bounce|ping)\b/,
  },
  {
    id: 'R-SPINNER',
    why: 'Use <Spinner /> or <Button loading>, never a raw lucide loader.',
    test: /\b(?:Loader2|LoaderCircle)\b/,
    skip: ['Spinner.tsx'],
  },
  { id: 'R-DIALOG', why: 'Use useConfirm() or a toast, never window.confirm / alert / prompt.', test: /\b(?:window\.)?(?:confirm|alert|prompt)\(\s*['"`]/ },
  { id: 'R-CN', why: 'Build class names with cn(), not template literals.', test: /className=\{`/ },
  { id: 'R-HTML', why: 'No dangerouslySetInnerHTML.', test: /dangerouslySetInnerHTML/ },
  {
    id: 'R-CLICK',
    why: 'Clickable things are <button> or <a href>, never a div or span with onClick.',
    test: /<(?:div|span|li|tr|td|p)\b[^>]*\bonClick=/,
  },
  {
    id: 'DOMAIN',
    why: "Kobo is generic: no one app's vocabulary. Samples use neutral content (notes, tasks, trips).",
    test: /\b(?:workouts?|exercises?|barbells?|gyms?|reps)\b/i,
  },
]

const ALLOW = /kobo: allow ([A-Z-]+)/

function filesUnder(dir, extensions) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...filesUnder(path, extensions))
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(path)
  }
  return out
}

function allowed(lines, index, id) {
  for (const line of [lines[index], lines[index - 1]]) {
    const match = line?.match(ALLOW)
    if (match && match[1] === id) return true
  }
  return false
}

/** Returns the findings for one file's text. */
export function checkFile(name, text) {
  const findings = []
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    for (const rule of LINE_RULES) {
      if (rule.skip?.includes(basename(name))) continue
      if (rule.test.test(line) && !allowed(lines, index, rule.id)) {
        findings.push({ id: rule.id, line: index + 1, why: rule.why, text: line.trim() })
      }
    }
  })
  if (/\.tsx$/.test(name) && /\buse(?:State|Effect|Ref|Context|Callback|Memo|Reducer|LayoutEffect|Id)\(|\bcreateContext\(/.test(text) && !/^'use client'/.test(text)) {
    findings.push({ id: 'R-CLIENT', line: 1, why: "A component file that uses React hooks or context starts with 'use client'.", text: basename(name) })
  }
  // The barrel only lists exports, so it may grow past the limit.
  if (lines.length > MAX_LINES && basename(name) !== 'index.ts') {
    findings.push({ id: 'R-SIZE', line: 1, why: `A file has ${MAX_LINES} lines or less. Split it.`, text: `${lines.length} lines` })
  }
  if (name.endsWith('.tsx') && !/^[A-Z][A-Za-z0-9]*\.tsx$/.test(basename(name))) {
    findings.push({ id: 'R-CASING', line: 1, why: 'A .tsx file name is PascalCase (Button.tsx).', text: basename(name) })
  }
  if (name.endsWith('.tsx')) {
    lines.forEach((line, index) => {
      if (/^export function [A-Z]/.test(line) && !/\*\/\s*$/.test(lines[index - 1] ?? '')) {
        findings.push({ id: 'R-DOC', line: index + 1, why: 'Every exported component has a /** */ summary.', text: line.trim() })
      }
    })
  }
  return findings
}

/** Exported component names (PascalCase functions) in a file. */
function componentsIn(text) {
  return [...text.matchAll(/^export function ([A-Z][A-Za-z0-9]*)/gm)].map((match) => match[1])
}

function run() {
  const findings = []
  const sources = filesUnder(SRC, ['.ts', '.tsx'])
  const catalogText = filesUnder(CATALOG, ['.tsx']).map((file) => readFileSync(file, 'utf8')).join('\n')
  for (const file of sources) {
    const text = readFileSync(file, 'utf8')
    const name = relative(ROOT, file)
    for (const finding of checkFile(name, text)) findings.push({ file: name, ...finding })
    if (file.endsWith('.tsx')) {
      for (const component of componentsIn(text)) {
        if (!new RegExp(`<${component}\\b`).test(catalogText)) {
          findings.push({ file: name, id: 'R-CATALOG', line: 1, why: 'Every component appears in the catalog.', text: component })
        }
      }
    }
  }
  for (const finding of findings) {
    console.log(`${finding.file}:${finding.line}  ${finding.id}  ${finding.why}\n    ${finding.text}`)
  }
  console.log(findings.length === 0 ? `conformance: ${sources.length} files, no findings` : `conformance: ${findings.length} findings`)
  process.exit(findings.length === 0 ? 0 : 1)
}

function selfTest() {
  const cases = [
    ['Bad.tsx', "<div className='bg-white' />", 'R-PALETTE'],
    ['Bad.tsx', "<div className='text-gray-500' />", 'R-PALETTE'],
    ['Bad.tsx', "<div className='z-50' />", 'R-LAYER'],
    ['Bad.tsx', "<div className='rounded-lg' />", 'R-RADIUS'],
    ['Bad.tsx', "<div className='rounded-t-xl' />", 'R-RADIUS'],
    ['Bad.tsx', 'const [a] = useState(0)', 'R-CLIENT'],
    ['Bad.tsx', "<div className='text-sm' />", 'R-TYPE'],
    ['Bad.tsx', "<div className='duration-200' />", 'R-MOTION'],
    ['Bad.tsx', "const c = '#ff0000'", 'R-COLOR'],
    ['Bad.tsx', "import { Loader2 } from 'lucide-react'", 'R-SPINNER'],
    ['Bad.tsx', "window.confirm('Sure?')", 'R-DIALOG'],
    ['Bad.tsx', '<div onClick={go} />', 'R-CLICK'],
    ['Bad.tsx', '// a gym workout', 'DOMAIN'],
    ['bad-name.tsx', '', 'R-CASING'],
    ['Bad.tsx', 'export function Thing() {}', 'R-DOC'],
  ]
  const clean = [
    ['Good.tsx', "<div className='bg-surface text-ink-muted text-body z-modal duration-(--motion-state)' />"],
    ['Good.tsx', "<div className='bg-neutral-soft text-neutral-ink rounded-card rounded-full' />"],
    ['Good.tsx', "'use client'\nconst [a] = useState(0)"],
    ['Good.tsx', "// kobo: allow R-TYPE iOS zoom\n<div className='text-base' />"],
    ['Good.tsx', '/** Doc. */\nexport function Thing() {}'],
  ]
  let failed = 0
  for (const [name, text, id] of cases) {
    if (!checkFile(name, text).some((finding) => finding.id === id)) {
      console.log(`self-test: ${id} missed: ${text}`)
      failed += 1
    }
  }
  for (const [name, text] of clean) {
    const found = checkFile(name, text)
    if (found.length > 0) {
      console.log(`self-test: false finding ${found.map((f) => f.id).join(', ')}: ${text}`)
      failed += 1
    }
  }
  console.log(failed === 0 ? `self-test: ${cases.length + clean.length} cases pass` : `self-test: ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

if (process.argv.includes('--self-test')) selfTest()
else run()
