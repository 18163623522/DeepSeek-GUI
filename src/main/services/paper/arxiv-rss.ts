import type { PaperArxivTodayItem } from '../../../shared/paper/paper-library-types'
import { decodeEntities, stripTags } from './coolpapers-client'

/**
 * arXiv "new submissions" RSS (rss.arxiv.org/rss/<category>). Each item's
 * description starts with `arXiv:<id>v1 Announce Type: new Abstract: …`,
 * authors live in one comma-separated `dc:creator`, and every category the
 * paper is listed under is its own `<category>`.
 */

const ABS_URL_RE = /arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/[0-9]{7})(v\d+)?/i
const ABSTRACT_PREFIX_RE = /^\s*arXiv:\S+\s+Announce Type:\s*[\w-]+\s*(?:Abstract:\s*)?/i

function tagText(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!m) return undefined
  const cdata = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
  const text = decodeEntities(stripTags(cdata)).replace(/\s+/g, ' ').trim()
  return text || undefined
}

/** Drop the RSS boilerplate before the abstract (also cleans older cache entries). */
export function cleanArxivRssAbstract(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const text = raw.replace(ABSTRACT_PREFIX_RE, '').trim()
  return text || undefined
}

/** RFC-822 pubDate → YYYY-MM-DD; other strings pass through unchanged. */
export function arxivRssDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const time = Date.parse(raw)
  return Number.isNaN(time) ? raw : new Date(time).toISOString().slice(0, 10)
}

export function parseArxivTodayRss(xml: string, fallbackCategory: string): PaperArxivTodayItem[] {
  const items: PaperArxivTodayItem[] = []
  for (const match of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)) {
    const block = match[1]
    const title = tagText(block, 'title')
    const link = tagText(block, 'link') ?? ''
    const arxivId = ABS_URL_RE.exec(link)?.[1]
    if (!title || !arxivId) continue
    const announce = tagText(block, 'arxiv:announce_type')
    // Replacements are old papers re-announced with a new version; skip them.
    if (announce && /replace/i.test(announce)) continue
    const categories = [...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)]
      .map((m) => decodeEntities(stripTags(m[1])).trim())
      .filter(Boolean)
    const authors = (tagText(block, 'dc:creator') ?? '')
      .split(/\s*,\s*|\s+and\s+/)
      .map((name) => name.trim())
      .filter(Boolean)
    items.push({
      arxivId,
      title,
      authors,
      abstract: cleanArxivRssAbstract(tagText(block, 'description')),
      categories: categories.length ? [...new Set(categories)] : [fallbackCategory],
      publishedAt: arxivRssDate(tagText(block, 'pubDate')),
      relevance: 0
    })
  }
  return items
}
