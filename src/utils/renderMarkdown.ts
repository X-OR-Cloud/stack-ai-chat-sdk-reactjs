/**
 * Lightweight markdown → safe HTML renderer for chat bubbles.
 * Supports: headings, bold, italic, inline code, fenced code blocks,
 *           unordered/ordered lists, blockquotes, links, horizontal rules.
 * No external deps. XSS-safe via attribute escaping.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text: string): string {
  return (
    text
      // Escape HTML first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Inline code: `code`
      .replace(/`([^`]+)`/g, '<code class="md-code-inline">$1</code>')
      // Bold+italic: ***text***
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Strikethrough: ~~text~~
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m, label, url) => {
        const safeUrl = escapeHtml(url)
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="md-link">${label}</a>`
      })
  )
}

export function renderMarkdown(raw: string): string {
  const lines = raw.split('\n')
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
      output.push(`<h${level} class="md-h${level}">${inlineMarkdown(headingMatch[2])}</h${level}>`)
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
      output.push(`<blockquote class="md-blockquote">${inlineMarkdown(quoteLines.join('\n'))}</blockquote>`)
      continue
    }

    // Unordered list - / * / +
    if (/^[\-\*\+]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\-\*\+]\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[\-\*\+]\s/, ''))}</li>`)
        i++
      }
      output.push(`<ul class="md-ul">${items.join('')}</ul>`)
      continue
    }

    // Ordered list 1. 2.
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s/, ''))}</li>`)
        i++
      }
      output.push(`<ol class="md-ol">${items.join('')}</ol>`)
      continue
    }

    // Empty line → paragraph break
    if (line.trim() === '') {
      output.push('<br />')
      i++
      continue
    }

    // Regular paragraph
    output.push(`<p class="md-p">${inlineMarkdown(line)}</p>`)
    i++
  }

  return output.join('')
}
