import { describe, expect, it } from 'vitest'
import type { ToolBlock } from '../../agent/types'
import { paperToolName, paperToolProcessDetail, summarizePaperToolBlock } from './paper-tool-process'

const t = (key: string, opts?: Record<string, unknown>): string =>
  opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${String(v)}`).join(',')})` : key

function block(toolName: string, args: Record<string, unknown>, meta: Record<string, unknown> = {}): ToolBlock {
  return { kind: 'tool', id: 'b', summary: toolName, status: 'success', detail: JSON.stringify(args), meta: { toolName, ...meta } }
}

const SEARCH_META = {
  version: 1,
  query: 'agents',
  total: 26,
  papers: [{ id: '2401.00001', title: 'A', authors: [], sources: ['arxiv'] }],
  sources: [
    { source: 'arxiv', count: 10, ms: 5 },
    { source: 'semantic_scholar', count: 0, ms: 5, error: 'HTTP 429' }
  ]
}

describe('paper tool rows', () => {
  it('recognizes Kun and SDK-bridged tool names', () => {
    expect(paperToolName('paper_search')).toBe('paper_search')
    expect(paperToolName('mcp__kun__paper_report')).toBe('paper_report')
    expect(paperToolName('web_search')).toBeNull()
  })

  it('summarizes a search with its query, count and failed sources', () => {
    const summary = summarizePaperToolBlock(block('paper_search', { query: 'code agents' }, { paperSearch: SEARCH_META }), 'paper_search', t)
    expect(summary).toBe('paperToolSearch “code agents” · paperToolPaperCount(count=26) · paperToolFailed(sources=writePaperSearchSource_semantic_scholar)')
  })

  it('summarizes citation walks by direction', () => {
    expect(summarizePaperToolBlock(block('paper_citations', { seed_id: '10.1/x', direction: 'citations' }), 'paper_citations', t))
      .toBe('paperToolCitations · paperToolCitedBy(seed=10.1/x)')
  })

  it('exposes the hit list only for validated meta', () => {
    expect(paperToolProcessDetail(block('paper_search', {}, { paperSearch: SEARCH_META }), 'paper_search')?.kind).toBe('paper-search')
    expect(paperToolProcessDetail(block('paper_search', {}, { paperSearch: { version: 2 } }), 'paper_search')).toBeNull()
    expect(paperToolProcessDetail(block('paper_report', {}), 'paper_report')).toBeNull()
  })
})
