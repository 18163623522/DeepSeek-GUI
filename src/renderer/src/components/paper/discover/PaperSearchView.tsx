import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { BellPlus, History, Loader2, Search, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PaperSearchSource } from '@shared/paper/paper-search'
import { paperViewOwnsKeyEvent } from './paper-view-keys'
import { usePaperModeStore } from '../../../paper/paper-mode-store'
import {
  encodePaperSearchFeed,
  parseSearchYear,
  pushSearchHistory,
  readSearchHistory,
  readSearchSources,
  toggleSearchSource,
  writeSearchSources,
  type PaperSearchHistoryEntry
} from '../../../paper/paper-search-prefs'
import { PaperSearchScopeRow, PaperSearchTabs } from './PaperSearchScope'
import { PaperResearchView } from '../research/PaperResearchView'
import { usePaperStore } from '../../../write/paper/paper-store'
import { useWriteWorkspaceStore } from '../../../write/write-workspace-store'
import { rendererRuntimeClient } from '../../../agent/runtime-client'
import { PaperSearchResults } from './PaperSearchResults'

const EXAMPLE_QUERIES = [
  'repository-level code agent',
  'long-context retrieval augmented generation',
  'diffusion model video generation'
]

/**
 * Paper search page: one query fanned out to several scholarly indexes and
 * merged, plus a hand-off that asks the paper assistant to run an iterative
 * agent search with the `paper_search` tool.
 */
export function PaperSearchView(): ReactElement {
  const { t } = useTranslation('common')
  const workspaceRoot = useWriteWorkspaceStore((s) => s.workspaceRoot)
  const discover = usePaperModeStore((s) => s.discover)
  const patchDiscover = usePaperModeStore((s) => s.patchDiscover)
  const agentTab = useWriteWorkspaceStore((s) => s.paperResearch.agentTab)
  const setPaperResearch = useWriteWorkspaceStore((s) => s.setPaperResearch)
  const [input, setInput] = useState(discover.searchQuery)
  const [sources, setSources] = useState<PaperSearchSource[]>(readSearchSources)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [history, setHistory] = useState<PaperSearchHistoryEntry[]>(readSearchHistory)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const years = useMemo(
    () => ({ from: parseSearchYear(yearFrom), to: parseSearchYear(yearTo) }),
    [yearFrom, yearTo]
  )

  // `/` focuses the query input (plan P5 keyboard controls).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      if (!paperViewOwnsKeyEvent(rootRef.current, event)) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const applyHistoryEntry = (entry: PaperSearchHistoryEntry): void => {
    setInput(entry.query)
    if (entry.sources?.length) {
      setSources(entry.sources)
      writeSearchSources(entry.sources)
    }
    setYearFrom(entry.yearFrom ? String(entry.yearFrom) : '')
    setYearTo(entry.yearTo ? String(entry.yearTo) : '')
    runSearch(entry.query, entry.sources, entry.yearFrom, entry.yearTo)
  }

  const toggleSource = (source: PaperSearchSource): void => {
    const next = toggleSearchSource(sources, source)
    setSources(next)
    writeSearchSources(next)
  }

  const runSearch = (
    raw = input,
    overrideSources?: PaperSearchSource[],
    overrideYearFrom?: number,
    overrideYearTo?: number
  ): void => {
    const query = raw.trim()
    if (!query || typeof window.kunGui?.paperSearch !== 'function') return
    const querySources = overrideSources ?? sources
    const queryYearFrom = overrideYearFrom !== undefined ? overrideYearFrom : years.from
    const queryYearTo = overrideYearTo !== undefined ? overrideYearTo : years.to
    setInput(query)
    patchDiscover({ searchQuery: query, searchLoading: true, searchError: null })
    void window.kunGui
      .paperSearch({ query, sources: querySources, limit: 10, yearFrom: queryYearFrom, yearTo: queryYearTo })
      .then((result) => {
        if (usePaperModeStore.getState().discover.searchQuery !== query) return
        if (result.ok) {
          const { ok: _ok, ...response } = result
          patchDiscover({ searchResult: response, searchLoading: false })
          setHistory(
            pushSearchHistory({ query, sources: querySources, yearFrom: queryYearFrom, yearTo: queryYearTo })
          )
        } else {
          patchDiscover({ searchLoading: false, searchError: result.message })
        }
      })
      .catch((error: unknown) => {
        patchDiscover({
          searchLoading: false,
          searchError: error instanceof Error ? error.message : String(error)
        })
      })
  }

  // Hand the current query and scope to the Agent research stage, which
  // opens its "new research" state pre-filled with them.
  const handOffToAgent = (): void => {
    patchDiscover({
      researchDraft: {
        query: input.trim(),
        sources,
        yearFrom: years.from,
        yearTo: years.to
      }
    })
    setPaperResearch({ agentTab: true, sessionId: null })
  }

  // Single-source retry (plan P5): re-query just the failed source and merge
  // its hits/report back into the displayed result.
  const retrySource = (source: PaperSearchSource): void => {
    const query = usePaperModeStore.getState().discover.searchQuery.trim()
    const current = usePaperModeStore.getState().discover.searchResult
    if (!query || !current || typeof window.kunGui?.paperSearch !== 'function') return
    patchDiscover({ searchLoading: true })
    void window.kunGui
      .paperSearch({ query, sources: [source], limit: 10, yearFrom: years.from, yearTo: years.to, retry: true })
      .then((result) => {
        const fresh = usePaperModeStore.getState().discover.searchResult
        if (!result.ok || !fresh) {
          patchDiscover({ searchLoading: false })
          return
        }
        const byKey = new Map(fresh.hits.map((hit) => [hit.key, hit]))
        for (const hit of result.hits) {
          const existing = byKey.get(hit.key)
          if (existing) {
            byKey.set(hit.key, {
              ...existing,
              sources: [...new Set([...existing.sources, ...hit.sources])]
            })
          } else {
            byKey.set(hit.key, hit)
          }
        }
        const reports = fresh.sources.filter((report) => report.source !== source)
        const newReport = result.sources.find((report) => report.source === source)
        if (newReport) reports.push(newReport)
        patchDiscover({
          searchLoading: false,
          searchResult: { ...fresh, hits: [...byKey.values()], sources: reports }
        })
      })
      .catch(() => patchDiscover({ searchLoading: false }))
  }

  // "Save search as subscription" (plan P5): stored as a `kun-paper-search://`
  // feed; the Feeds pane re-runs it and flags hits not seen on the last check.
  const subscribeSearch = (): void => {
    const query = usePaperModeStore.getState().discover.searchQuery.trim() || input.trim()
    if (!query) return
    const feeds = useWriteWorkspaceStore.getState().paperMode.discover.feeds
    const url = encodePaperSearchFeed({
      query,
      sources,
      yearFrom: years.from,
      yearTo: years.to
    })
    if (feeds.some((feed) => feed.url === url)) {
      usePaperStore.getState().setNotice({ tone: 'info', message: t('writePaperSearchSubscribedAlready') })
      return
    }
    const next = [...feeds, { id: `feed-${Date.now().toString(36)}`, url, title: query }]
    useWriteWorkspaceStore.setState((s) => ({
      paperMode: { ...s.paperMode, discover: { ...s.paperMode.discover, feeds: next } }
    }))
    void rendererRuntimeClient
      .setSettings({ write: { paperMode: { discover: { feeds: next } } } })
      .catch(() => undefined)
    usePaperStore.getState().setNotice({ tone: 'info', message: t('writePaperSearchSubscribed') })
  }

  const setTab = (next: 'direct' | 'agent'): void => setPaperResearch({ agentTab: next === 'agent' })
  if (agentTab) return <PaperResearchView onShowDirect={() => setTab('direct')} />

  const busy = discover.searchLoading
  return (
    <div ref={rootRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[1040px] px-6 pb-10 pt-8">
        <h1 className="text-[20px] font-semibold tracking-tight text-ds-ink">{t('writePaperSearchTitle')}</h1>
        <p className="mt-1 text-[12.5px] text-ds-muted">{t('writePaperSearchSubtitle')}</p>

        <div className="mt-5 flex items-center gap-2">
          <PaperSearchTabs tab="direct" onChange={setTab} />
          <label className="relative flex h-10 min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ds-faint" strokeWidth={1.9} />
            <input
              ref={inputRef}
              value={input}
              autoFocus
              list="kun-paper-search-history"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) runSearch()
              }}
              placeholder={t('writePaperSearchQueryPlaceholder')}
              aria-label={t('writePaperSearchQueryPlaceholder')}
              className="h-10 w-full rounded-lg border border-ds-border bg-ds-main pl-9 pr-8 text-[14px] text-ds-ink shadow-sm outline-none transition placeholder:text-ds-faint focus:border-[var(--ds-accent)]"
            />
            {input ? (
              <button
                type="button"
                aria-label={t('clearSearch')}
                onClick={() => setInput('')}
                className="absolute right-2 rounded p-1 text-ds-faint hover:text-ds-ink"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
          </label>
          <datalist id="kun-paper-search-history">
            {history.map((entry) => (
              <option key={`${entry.at}:${entry.query}`} value={entry.query} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => runSearch()}
            disabled={!input.trim() || busy}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ds-control)] px-4 text-[13px] font-medium text-[var(--ds-control-foreground)] transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" strokeWidth={2} />}
            {t('writePaperSearchRun')}
          </button>
          <button
            type="button"
            onClick={subscribeSearch}
            disabled={!(discover.searchQuery || input).trim()}
            title={t('writePaperSearchSubscribeHint')}
            aria-label={t('writePaperSearchSubscribe')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ds-border text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink disabled:opacity-50"
          >
            <BellPlus className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={handOffToAgent}
            title={t('writePaperSearchAgentHint')}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-ds-border px-3 text-[13px] font-medium text-ds-ink transition hover:bg-ds-hover"
          >
            <Sparkles className="h-4 w-4 text-[var(--ds-accent)]" strokeWidth={1.9} />
            {t('paperResearchHandOff')}
          </button>
        </div>

        <PaperSearchScopeRow
          sources={sources}
          onToggleSource={toggleSource}
          yearFrom={yearFrom}
          yearTo={yearTo}
          onYearFrom={setYearFrom}
          onYearTo={setYearTo}
        />

        {discover.searchError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {discover.searchError}
          </p>
        ) : null}

        {busy && !discover.searchResult ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[12.5px] text-ds-faint">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('writePaperSearchSearching', { count: sources.length })}
          </div>
        ) : null}

        {discover.searchResult ? (
          <div className={busy ? 'pointer-events-none opacity-60 transition' : 'transition'}>
            <PaperSearchResults
              result={discover.searchResult}
              workspaceRoot={workspaceRoot}
              onRetrySource={retrySource}
              t={t}
            />
          </div>
        ) : !busy ? (
          <div className="mt-10 text-center">
            <p className="text-[12.5px] text-ds-faint">{t('writePaperSearchEmptyHint')}</p>
            {history.length ? (
              <div className="mt-3">
                <p className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-ds-faint">
                  <History className="h-3 w-3" strokeWidth={1.8} />
                  {t('writePaperSearchHistory')}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {history.slice(0, 8).map((entry) => (
                    <button
                      key={`${entry.at}:${entry.query}`}
                      type="button"
                      title={new Date(entry.at).toLocaleString()}
                      onClick={() => applyHistoryEntry(entry)}
                      className="rounded-md border border-ds-border-muted px-2.5 py-1 text-[12px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
                    >
                      {entry.query}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {EXAMPLE_QUERIES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => runSearch(example)}
                  className="rounded-md border border-ds-border-muted px-2.5 py-1 text-[12px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

