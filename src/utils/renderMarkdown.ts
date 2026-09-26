/**
 * Lightweight markdown → safe HTML renderer for chat bubbles.
 * Supports: headings, bold, italic, inline code, fenced code blocks,
 *           unordered/ordered lists, blockquotes, links, horizontal rules, tables.
 * No external deps. XSS-safe via attribute escaping.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface RenderMarkdownOptions {
  /**
   * Label for bare URLs found in the text (not for `[label](url)` links, which keep their
   * own label). Return a short human-readable label, e.g. "Xem thủ tục"; falsy → show the URL.
   */
  formatLinkLabel?: (url: string) => string | null | undefined
}

// Only these schemes may become hrefs — blocks javascript:, data:, vbscript:, etc.
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i

// Bare URL / www. / domain / email detection. The domain form requires a TLD of 2+ letters
// so "x-or.cloud" or "abc.gov.vn" match without a hardcoded TLD list.
const BARE_LINK_RE =
  /\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[^\s<>"'`]+|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>"'`]*)?(?![a-z0-9@])/gi

// Scheme-less "name.ext" that is a file, not a domain
const FILE_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|json|xml|html?|md|js|ts|css|png|jpe?g|gif|svg|webp|zip|rar|7z|exe|mp[34]|wav|mov|avi)$/i

// Strip sentence punctuation glued to the end of a bare URL ("…/page." or "(see …/page)").
// A closing ")" is kept only when the URL itself contains a matching "(" (Wikipedia-style).
function trimTrailingPunctuation(url: string): { url: string; rest: string } {
  let end = url.length
  while (end > 0) {
    const ch = url[end - 1]
    if ('.,;:!?\'"'.includes(ch)) { end--; continue }
    if (ch === ')') {
      const body = url.slice(0, end)
      const open = (body.match(/\(/g) ?? []).length
      const close = (body.match(/\)/g) ?? []).length
      if (close > open) { end--; continue }
    }
    break
  }
  return { url: url.slice(0, end), rest: url.slice(end) }
}

function anchor(href: string, labelHtml: string, extraClass = ''): string {
  if (!SAFE_HREF.test(href)) return labelHtml
  const cls = extraClass ? `md-link ${extraClass}` : 'md-link'
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="${cls}">${labelHtml}</a>`
}

function inlineMarkdown(text: string, opts: RenderMarkdownOptions = {}): string {
  // 1. Pull out segments whose content must not be touched by the emphasis regexes below
  //    (inline code, links, bare URLs) and swap them for placeholders. Otherwise "_" or "*"
  //    inside a URL becomes <em>, and "&" in a query string gets escaped twice.
  const slots: string[] = []
  const stash = (html: string): string => {
    slots.push(html)
    return `\u0000${slots.length - 1}\u0000`
  }

  const src = text
    // Inline code: `code`
    .replace(/`([^`]+)`/g, (_m, code) => stash(`<code class="md-code-inline">${escapeHtml(code)}</code>`))
    // Markdown link: [label](url) or [label](url "title")
    .replace(/\[([^\]]+)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)/g, (m, label, url) =>
      SAFE_HREF.test(url) ? stash(anchor(url, inlineMarkdown(label, opts))) : m
    )
    // Autolink syntax: <https://…>
    .replace(/<(https?:\/\/[^\s<>]+)>/g, (_m, url) => stash(anchor(url, escapeHtml(url))))
    // Bare URL / domain / email
    .replace(BARE_LINK_RE, (match) => {
      const { url, rest } = trimTrailingPunctuation(match)
      if (!url) return match
      const isEmail = /^[a-z0-9._%+-]+@/i.test(url)
      // "report.pdf" / "index.html" look like domains but are file names — leave them alone
      if (!isEmail && !/^(https?:\/\/|www\.)/i.test(url) && !url.includes('/') && FILE_EXT_RE.test(url)) return match
      let href = url
      if (isEmail) href = 'mailto:' + url
      else if (!/^https?:\/\//i.test(url)) href = 'https://' + url
      const custom = isEmail ? null : opts.formatLinkLabel?.(href)
      const labelHtml = escapeHtml(custom || url)
      return stash(anchor(href, labelHtml, custom ? 'md-link--labeled' : '')) + rest
    })

  // 2. Escape what is left, then apply emphasis
  const html = escapeHtml(src)
    // Bold+italic: ***text***
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, '<del>$1</del>')

  // 3. Restore stashed segments
  return html.replace(/\u0000(\d+)\u0000/g, (_m, i) => slots[Number(i)])
}

export function renderMarkdown(raw: string, opts: RenderMarkdownOptions = {}): string {
  // Convert list numbering format like "1)" or "1) " to "1. " at the start of any line
  const normalized = raw.replace(/^(\s*\d+)\)\s*/gm, '$1. ')
  const lines = normalized.split('\n')
  const output: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block ```
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]))
        i++
      }
      const langAttr = lang ? ` class="md-code-block md-lang-${escapeHtml(lang)}"` : ' class="md-code-block"'
      output.push(`<pre${langAttr}><code>${codeLines.join('\n')}</code></pre>`)
      i++ // skip closing ```
      continue
    }

    // Horizontal rule --- / ***
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      output.push('<hr class="md-hr" />')
      i++
      continue
    }

    // Heading # ## ###
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      output.push(`<h${level} class="md-h${level}">${inlineMarkdown(headingMatch[2], opts)}</h${level}>`)
      i++
      continue
    }

    // Blockquote >
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      output.push(`<blockquote class="md-blockquote">${inlineMarkdown(quoteLines.join('\n'), opts)}</blockquote>`)
      continue
    }

    // Table: | col | col |
    // Find the separator line (may have blank lines between header and separator)
    if (/^\|.*\|/.test(line) && line.split('|').length >= 3) {
      let sepIdx = i + 1
      while (sepIdx < lines.length && lines[sepIdx].trim() === '') sepIdx++
      if (sepIdx < lines.length && /^\|\s*[:\-][\s\-:|]*\|/.test(lines[sepIdx])) {
        // Parse header row
        const headerCells = line.split('|').slice(1, -1).map((c) => c.trim())

        // Parse separator row for alignment
        const sepCells = lines[sepIdx].split('|').slice(1, -1).map((c) => c.trim())
        const aligns = sepCells.map((c) => {
          if (c.startsWith(':') && c.endsWith(':')) return 'center'
          if (c.endsWith(':')) return 'right'
          return 'left'
        })

        i = sepIdx + 1 // skip header + blanks + separator

        // Parse body rows (skip blank lines between rows)
        const bodyRows: string[][] = []
        while (i < lines.length) {
          if (lines[i].trim() === '') { i++; continue }
          if (!/^\|.*\|/.test(lines[i])) break
          bodyRows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()))
          i++
        }

        const thead = '<thead><tr>' + headerCells.map((c, j) =>
          `<th style="text-align:${aligns[j] ?? 'left'}">${inlineMarkdown(c, opts)}</th>`
        ).join('') + '</tr></thead>'

        const tbody = '<tbody>' + bodyRows.map((row) =>
          '<tr>' + row.map((c, j) =>
            `<td style="text-align:${aligns[j] ?? 'left'}">${inlineMarkdown(c, opts)}</td>`
          ).join('') + '</tr>'
        ).join('') + '</tbody>'

        output.push(`<table class="md-table">${thead}${tbody}</table>`)
        continue
      }
    }

    // Unordered list - / * / +
    if (/^[\-\*\+]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\-\*\+]\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[\-\*\+]\s/, ''), opts)}</li>`)
        i++
      }
      output.push(`<ul class="md-ul">${items.join('')}</ul>`)
      continue
    }

    // Ordered list 1. 2.
    if (/^\d+\.\s/.test(line)) {
      // Keep the author's numbering: LLM output often splits "1." "2." "3." into separate
      // lists (blank lines / nested bullets between them) and the browser would restart at 1
      const start = parseInt(line, 10)
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s/, ''), opts)}</li>`)
        i++
      }
      const startAttr = start > 1 ? ` start="${start}"` : ''
      output.push(`<ol class="md-ol"${startAttr}>${items.join('')}</ol>`)
      continue
    }

    // Blank line(s) → one small paragraph gap. LLM output often separates blocks with
    // 2-3 blank lines; one <br /> per line produced a full line-height of white space each.
    if (line.trim() === '') {
      while (i < lines.length && lines[i].trim() === '') i++
      if (output.length > 0 && i < lines.length) output.push('<div class="md-gap"></div>')
      continue
    }

    // Regular paragraph
    output.push(`<p class="md-p">${inlineMarkdown(line, opts)}</p>`)
    i++
  }

  return output.join('')
}
