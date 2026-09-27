import { describe, expect, it } from 'vitest'
import type { NormalizedThread } from '../agent/types'
import { emptyWriteThreadRegistry, markWriteThread } from '../write/write-thread-registry'
import { paperConversationResourcePath } from './paper-conversation-scope'
import { buildPaperResearchBrief } from './paper-research-actions'
import {
  isResearchResourcePath,
  listResearchSessions,
  newResearchSessionId,
  researchResourcePath,
  researchSessionIdFromPath
} from './paper-research-sessions'

const ROOT = '/Users/me/papers-lib'

function thread(id: string, title: string, updatedAt: string, archived = false): NormalizedThread {
  return { id, title, updatedAt, model: 'm', mode: 'agent', workspace: ROOT, agentSurface: 'write', archived } as NormalizedThread
}

describe('research session paths', () => {
  it('round-trips session ids through virtual resource paths', () => {
    const id = newResearchSessionId(1_700_000_000_000, () => 0.5)
    expect(id).toMatch(/^rs-[a-z0-9]+-[a-z0-9]{6}$/)
    const path = researchResourcePath(`${ROOT}/`, id)
    expect(path).toBe(`${ROOT}/.kun-research/${id}`)
    expect(researchSessionIdFromPath(path)).toBe(id)
    expect(isResearchResourcePath(path)).toBe(true)
    expect(researchSessionIdFromPath(`${ROOT}/papers/x.pdf`)).toBeNull()
    expect(researchResourcePath(ROOT, null)).toBe(`${ROOT}/.kun-research/draft`)
  })

  it('resolves the research view to the selected session resource', () => {
    const base = { surface: 'papers' as const, workspaceRoot: ROOT, activeFilePath: `${ROOT}/papers/a/a.pdf`, unitDirs: [] }
    expect(paperConversationResourcePath({ ...base, view: 'research', researchSessionId: 'rs-abc-123456' }))
      .toBe(`${ROOT}/.kun-research/rs-abc-123456`)
    expect(paperConversationResourcePath({ ...base, view: 'discover', researchSessionId: 'rs-abc-123456' })).toBeUndefined()
  })

  it('lists research sessions newest first and skips archived or foreign bindings', () => {
    let registry = emptyWriteThreadRegistry()
    registry = markWriteThread(ROOT, 't1', registry, researchResourcePath(ROOT, 'rs-aaa-000001'))
    registry = markWriteThread(ROOT, 't2', registry, researchResourcePath(ROOT, 'rs-bbb-000002'))
    registry = markWriteThread(ROOT, 't3', registry, researchResourcePath(ROOT, 'rs-ccc-000003'))
    registry = markWriteThread(ROOT, 't4', registry, `${ROOT}/papers/a/a.pdf`)
    const sessions = listResearchSessions(ROOT, [
      thread('t1', 'Old question', '2026-09-01T00:00:00Z'),
      thread('t2', 'New question', '2026-09-20T00:00:00Z'),
      thread('t3', 'Archived', '2026-09-25T00:00:00Z', true),
      thread('t4', 'Paper chat', '2026-09-26T00:00:00Z')
    ], registry)
    expect(sessions.map((s) => [s.sessionId, s.title])).toEqual([
      ['rs-bbb-000002', 'New question'],
      ['rs-aaa-000001', 'Old question']
    ])
  })
})

describe('buildPaperResearchBrief', () => {
  it('appends one structured scope line', () => {
    expect(buildPaperResearchBrief({ query: ' code agents ', sources: ['arxiv', 'venues'], yearFrom: 2024, depth: 'deep' }))
      .toBe('code agents\n\n[paper-research] depth=deep; sources=arxiv,venues; years=2024-')
    expect(buildPaperResearchBrief({ query: 'x', sources: [], depth: 'quick' }))
      .toBe('x\n\n[paper-research] depth=quick; sources=default; years=any')
  })
})

describe('library-level conversation', () => {
  it('never resolves to a research session thread', async () => {
    const { activeWriteThreadForWorkspace } = await import('../write/write-thread-registry')
    let registry = emptyWriteThreadRegistry()
    registry = markWriteThread(ROOT, 'library-thread', registry)
    registry = markWriteThread(ROOT, 'research-thread', registry, researchResourcePath(ROOT, 'rs-aaa-000001'))
    const threads = [
      thread('library-thread', 'Library chat', '2026-09-01T00:00:00Z'),
      thread('research-thread', 'Research', '2026-09-02T00:00:00Z')
    ]
    expect(activeWriteThreadForWorkspace(ROOT, threads, registry)?.id).toBe('library-thread')
    expect(activeWriteThreadForWorkspace(ROOT, threads, registry, researchResourcePath(ROOT, 'rs-aaa-000001'))?.id)
      .toBe('research-thread')
  })
})
