import { describe, expect, it } from 'vitest'
import { arxivRssDate, cleanArxivRssAbstract, parseArxivTodayRss } from './arxiv-rss'

const RSS = `<rss><channel><title>cs.CL updates</title>
<item>
  <title>Stable and Faithful Explanations</title>
  <link>https://arxiv.org/abs/2609.28502</link>
  <description>arXiv:2609.28502v1 Announce Type: new
Abstract: Knowledge tracing models predict student performance.</description>
  <category>cs.LG</category>
  <category>cs.CL</category>
  <pubDate>Sat, 26 Sep 2026 00:00:00 -0400</pubDate>
  <arxiv:announce_type>new</arxiv:announce_type>
  <dc:creator>Ada Lovelace, Alan Turing and Grace Hopper</dc:creator>
</item>
<item>
  <title>Old paper, new version</title>
  <link>https://arxiv.org/abs/2401.00001</link>
  <description>arXiv:2401.00001v3 Announce Type: replace Abstract: x</description>
  <arxiv:announce_type>replace</arxiv:announce_type>
</item>
</channel></rss>`

describe('arXiv today RSS', () => {
  it('extracts authors, categories, a clean abstract and an ISO date', () => {
    expect(parseArxivTodayRss(RSS, 'cs.CL')).toEqual([{
      arxivId: '2609.28502',
      title: 'Stable and Faithful Explanations',
      authors: ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'],
      abstract: 'Knowledge tracing models predict student performance.',
      categories: ['cs.LG', 'cs.CL'],
      publishedAt: '2026-09-26',
      relevance: 0
    }])
  })

  it('cleans cached raw values', () => {
    expect(cleanArxivRssAbstract('arXiv:2609.1v1 Announce Type: cross Abstract: Text.')).toBe('Text.')
    expect(cleanArxivRssAbstract('Plain abstract.')).toBe('Plain abstract.')
    expect(arxivRssDate('Sat, 26 Sep 2026 00:00:00 -0400')).toBe('2026-09-26')
    expect(arxivRssDate('2026-09-26')).toBe('2026-09-26')
  })
})
