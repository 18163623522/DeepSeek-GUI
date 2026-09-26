import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPaperSearchToolProvider } from './paper-search-tool-provider.js'
import {
  PaperSeenScopes,
  resolveRootThreadId
} from '../../services/paper-search/paper-search-seen-store.js'
import type { ToolHostContext } from '../../ports/tool-host.js'

const WORK = {
  display_name: 'Scoped Paper About Agents',
  publication_year: 2024,
  doi: 'https://doi.org/10.1234/scoped'
}

function context(threadId: string): ToolHostContext {
  return { threadId, turnId: 'turn', workspace: '/tmp/ws', agentSurface: 'write' } as ToolHostContext
}

function stubOpenAlex(): ReturnType<typeof vi.fn> {
  const impl = vi.fn(async (input: unknown): Promise<Response> => {
    const url = String(input)
    if (url.includes('api.openalex.org')) return Response.json({ results: [WORK] })
    return Response.json({ data: [], results: [], feed: '' })
  })
  vi.stubGlobal('fetch', impl as unknown as typeof fetch)
  return impl
}

function tools(parents: Record<string, string> = {}, enabledSources?: string[]) {
  const [provider] = buildPaperSearchToolProvider({
    proxyUrl: () => undefined,
    parentThreadId: async (id) => parents[id],
    ...(enabledSources ? { enabledSources: () => enabledSources } : {})
  })
  return new Map(provider!.tools.map((tool) => [tool.name, tool]))
}

const REPORT = {
  papers: [{ id: '10.1234/scoped', title: 'Scoped Paper About Agents', reason: 'Relevant.' }]
}

describe('paper tools per-conversation verification', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not verify papers found in a different conversation', async () => {
    stubOpenAlex()
    const map = tools()
    await map.get('paper_search')!.execute({ query: 'scoped agents a', sources: ['openalex'] }, context('scope-a'))
    const other = await map.get('paper_report')!.execute(REPORT, context('scope-b'))
    const otherList = other.meta?.paperList as { papers: Array<{ verified: boolean }> }
    expect(otherList.papers[0]?.verified).toBe(false)
    const same = await map.get('paper_report')!.execute(REPORT, context('scope-a'))
    const sameList = same.meta?.paperList as { papers: Array<{ verified: boolean }> }
    expect(sameList.papers[0]?.verified).toBe(true)
  })

  it('credits delegated children to the root conversation', async () => {
    stubOpenAlex()
    const map = tools({ 'child-1': 'root-1' })
    await map.get('paper_search')!.execute({ query: 'scoped agents child', sources: ['openalex'] }, context('child-1'))
    const report = await map.get('paper_report')!.execute(REPORT, context('root-1'))
    const list = report.meta?.paperList as { papers: Array<{ verified: boolean }> }
    expect(list.papers[0]?.verified).toBe(true)
  })

  it('uses the defaults within the enabled allow-list when sources are omitted', async () => {
    const impl = stubOpenAlex()
    const map = tools({}, ['openalex', 'crossref', 'europepmc'])
    await map.get('paper_search')!.execute({ query: 'scoped agents defaults' }, context('scope-defaults'))
    const hosts = new Set(impl.mock.calls.map(([url]) => new URL(String(url)).hostname))
    expect([...hosts]).toEqual(['api.openalex.org'])
  })
})

describe('paper seen scopes', () => {
  it('walks parent links to the root and stops on cycles', async () => {
    const parents: Record<string, string> = { c: 'b', b: 'a', loop: 'loop' }
    const parentOf = async (id: string): Promise<string | undefined> => parents[id]
    expect(await resolveRootThreadId('c', parentOf)).toBe('a')
    expect(await resolveRootThreadId('loop', parentOf)).toBe('loop')
    expect(await resolveRootThreadId('x', async () => { throw new Error('gone') })).toBe('x')
  })

  it('evicts the least recently used conversation', () => {
    const scopes = new PaperSeenScopes(2)
    scopes.scope('a').record([{ id: '1', title: 'Alpha paper title', authors: [], sources: ['arxiv'] }])
    scopes.scope('b')
    scopes.scope('a')
    scopes.scope('c')
    expect(scopes.scope('a').hasAny()).toBe(true)
    expect(scopes.scope('b').hasAny()).toBe(false)
  })
})
