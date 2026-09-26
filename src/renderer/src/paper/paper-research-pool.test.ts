import { describe, expect, it } from 'vitest'
import type { ChatBlock } from '../agent/types'
import { buildResearchPool } from './paper-research-pool'

function searchBlock(id: string, papers: Array<Record<string, unknown>>, sources: Array<Record<string, unknown>> = []): ChatBlock {
  return {
    kind: 'tool',
    id,
    summary: 'paper_search',
    status: 'success',
    meta: {
      toolName: 'mcp__kun__paper_search',
      paperSearch: { version: 1, query: 'q', total: papers.length, papers, sources }
    }
  }
}

const card = (id: string, title: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, title, authors: [], sources: ['arxiv'], ...extra
})

describe('buildResearchPool', () => {
  it('merges papers across calls and counts first appearances per block', () => {
    const pool = buildResearchPool([
      searchBlock('b1', [
        card('2401.00001', 'Repository Agents at Scale', { arxivId: '2401.00001', year: 2024 }),
        card('10.1234/x', 'Other Paper', { doi: '10.1234/x' })
      ], [{ source: 'semantic_scholar', count: 0, ms: 1, error: 'HTTP 429' }]),
      searchBlock('b2', [
        card('10.1234/agents', 'Repository agents at scale!', { doi: '10.1234/agents', year: 2025, sources: ['openalex'], citations: 9 }),
        card('10.1234/new', 'Brand New Work', { doi: '10.1234/new' })
      ])
    ])
    expect(pool.entries.map((entry) => entry.title)).toEqual(['Repository Agents at Scale', 'Other Paper', 'Brand New Work'])
    expect(pool.entries[0]).toMatchObject({ hits: 2, citations: 9, doi: '10.1234/agents', sources: ['arxiv', 'openalex'], firstBlockId: 'b1' })
    expect(pool.newCountByBlock).toEqual({ b1: 2, b2: 1 })
    expect(pool.stats).toMatchObject({ searches: 2, candidates: 3, recommended: 0, failedSources: ['semantic_scholar'] })
  })

  it('clears a failed source when a later call succeeds', () => {
    const pool = buildResearchPool([
      searchBlock('b1', [], [{ source: 'semantic_scholar', count: 0, ms: 1, error: 'HTTP 429' }]),
      searchBlock('b2', [], [{ source: 'semantic_scholar', count: 3, ms: 1 }])
    ])
    expect(pool.stats.failedSources).toEqual([])
  })

  it('annotates recommendations from the latest report and keeps unverified entries', () => {
    const pool = buildResearchPool([
      searchBlock('b1', [card('2401.00001', 'Repository Agents at Scale', { arxivId: '2401.00001' })]),
      {
        kind: 'paper-list',
        id: 'r1',
        list: {
          version: 1,
          papers: [
            { id: '2401.00001', title: 'Repository Agents at Scale', reason: 'Core.', priority: 'must', verified: true,
              paper: { id: '2401.00001', title: 'Repository Agents at Scale', authors: [], sources: ['arxiv'], arxivId: '2401.00001' } },
            { id: '10.9999/made-up', title: 'Invented Paper', reason: 'Guess.', verified: false }
          ]
        }
      }
    ])
    expect(pool.entries).toHaveLength(2)
    expect(pool.entries[0]?.recommended).toEqual({ reason: 'Core.', priority: 'must' })
    expect(pool.entries[1]).toMatchObject({ title: 'Invented Paper', recommended: { reason: 'Guess.' } })
    expect(pool.stats.recommended).toBe(2)
  })
})
