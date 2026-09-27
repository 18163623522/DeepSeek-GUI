import { useMemo, useState, type ReactElement } from 'react'
import { Check, ClipboardCopy, Import, Loader2, MessageSquarePlus, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generatePaperBibtex } from '@shared/paper/paper-bibtex'
import type { PaperUnitMetaV2 } from '@shared/paper/paper-meta-v2'
import type { PaperLibraryEntry } from '@shared/paper/paper-library-types'
import { titleKey } from '@shared/paper/paper-search'
import { paperCardImportInput, paperCardImportMeta } from '../../../agent/paper-list-adapter'
import type { ResearchPool, ResearchPoolEntry } from '../../../paper/paper-research-pool'
import { usePaperModeStore } from '../../../paper/paper-mode-store'
import { newPaperRequestId, usePaperStore } from '../../../write/paper/paper-store'
import { useWriteWorkspaceStore } from '../../../write/write-workspace-store'
import { currentImportParentDir } from '../../../paper/paper-import-target'
import { PaperImportFolderPicker } from '../import/PaperImportFolderPicker'

type PoolTab = 'all' | 'recommended' | 'library'
type PoolSort = 'relevance' | 'hits' | 'year' | 'citations'

const PRIORITY_RANK: Record<string, number> = { must: 0, should: 1, optional: 2 }
const PRIORITY_TONE: Record<string, string> = {
  must: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  should: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  optional: 'bg-ds-subtle text-ds-muted'
}

function libraryIndex(entries: readonly PaperLibraryEntry[]): Set<string> {
  const keys = new Set<string>()
  for (const entry of entries) {
    const meta = entry.meta
    if (meta.arxivId) keys.add(`arxiv:${meta.arxivId}`)
    if (meta.doi) keys.add(`doi:${meta.doi.toLowerCase()}`)
    if (meta.coolPapers?.id) keys.add(`cool:${meta.coolPapers.id}`)
    if (meta.title) keys.add(`title:${titleKey(meta.title)}`)
  }
  return keys
}

function inLibrary(entry: ResearchPoolEntry, keys: Set<string>): boolean {
  return (
    (entry.arxivId !== undefined && keys.has(`arxiv:${entry.arxivId}`)) ||
    (entry.doi !== undefined && keys.has(`doi:${entry.doi.toLowerCase()}`)) ||
    (entry.coolId !== undefined && keys.has(`cool:${entry.coolId}`)) ||
    keys.has(`title:${titleKey(entry.title)}`)
  )
}

function toBibtexMeta(entry: ResearchPoolEntry): PaperUnitMetaV2 {
  return {
    version: 2,
    slug: entry.id,
    title: entry.title,
    authors: entry.authors,
    abstract: entry.abstract,
    year: entry.year !== undefined ? String(entry.year) : undefined,
    venue: entry.venue,
    doi: entry.doi,
    arxivId: entry.arxivId,
    pdfUrl: entry.pdfUrl,
    sourceUrl: entry.url,
    importedAt: ''
  }
}

function sendableLine(entry: ResearchPoolEntry): string {
  const ids = [entry.arxivId ? `arXiv:${entry.arxivId}` : '', entry.doi ? `doi:${entry.doi}` : ''].filter(Boolean).join(' ')
  return `- ${entry.title}${entry.year ? ` (${entry.year})` : ''}${ids ? ` [${ids}]` : ''}`
}

function sortEntries(entries: ResearchPoolEntry[], sort: PoolSort): ResearchPoolEntry[] {
  if (sort === 'relevance') {
    return [...entries].sort((a, b) =>
      (PRIORITY_RANK[a.recommended?.priority ?? ''] ?? (a.recommended ? 3 : 4)) -
        (PRIORITY_RANK[b.recommended?.priority ?? ''] ?? (b.recommended ? 3 : 4)) || b.hits - a.hits
    )
  }
  const value = (entry: ResearchPoolEntry): number =>
    sort === 'hits' ? entry.hits : sort === 'year' ? entry.year ?? 0 : entry.citations ?? -1
  return [...entries].sort((a, b) => value(b) - value(a))
}

/**
 * Right rail of the research stage: every paper the session surfaced,
 * deduplicated, with recommendations, library state and bulk actions.
 */
export function PaperResearchPool({
  pool,
  onFocusBlock
}: {
  pool: ResearchPool
  onFocusBlock: (blockId: string) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const libraryEntries = usePaperModeStore((s) => s.entries)
  const refreshEntries = usePaperModeStore((s) => s.refreshEntries)
  const composer = usePaperModeStore((s) => s.composerBridge)
  const [tab, setTab] = useState<PoolTab>('all')
  const [sort, setSort] = useState<PoolSort>('relevance')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const libraryKeys = useMemo(() => libraryIndex(libraryEntries), [libraryEntries])

  const needle = query.trim().toLowerCase()
  const visible = useMemo(() => sortEntries(pool.entries.filter((entry) => {
    if (tab === 'recommended' && !entry.recommended) return false
    if (tab === 'library' && !inLibrary(entry, libraryKeys)) return false
    return !needle || `${entry.title} ${entry.authors.join(' ')}`.toLowerCase().includes(needle)
  }), sort), [pool.entries, tab, libraryKeys, needle, sort])
  const chosen = pool.entries.filter((entry) => selected.has(entry.key))
  const libraryCount = pool.entries.filter((entry) => inLibrary(entry, libraryKeys)).length

  const toggle = (key: string): void => setSelected((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const importChosen = async (): Promise<void> => {
    const items = chosen
      .filter((entry) => !inLibrary(entry, libraryKeys))
      .flatMap((entry) => {
        const input = paperCardImportInput(entry)
        return input ? [{ input, meta: paperCardImportMeta(entry) }] : []
      })
    if (importing || !items.length || typeof window.kunGui?.paperImportBatch !== 'function') return
    setImporting(true)
    try {
      const writeState = useWriteWorkspaceStore.getState()
      const result = await window.kunGui.paperImportBatch({
        workspaceRoot: writeState.workspaceRoot,
        items,
        parentDir: currentImportParentDir(),
        requestId: newPaperRequestId()
      })
      if (result.ok) {
        const imported = result.results.filter((r) => r.ok && !r.reused).length
        const reused = result.results.filter((r) => r.ok && r.reused).length
        const failed = result.results.filter((r) => !r.ok).length
        usePaperStore.getState().setNotice({
          tone: failed ? 'error' : 'info',
          message: t('writePaperReportImportDone', { imported, reused, failed })
        })
        refreshEntries()
        setSelected(new Set())
      } else {
        usePaperStore.getState().setNotice({ tone: 'error', message: result.message })
      }
    } finally {
      setImporting(false)
    }
  }

  const copyBibtex = async (): Promise<void> => {
    const text = generatePaperBibtex(chosen.map(toBibtexMeta))
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const sendToAssistant = (): void => {
    if (!composer?.setInput || !chosen.length) return
    const lines = chosen.map(sendableLine).join('\n')
    composer.setInput(composer.input.trim() ? `${composer.input.trim()}\n\n${lines}` : lines)
  }

  const tabs: Array<[PoolTab, string, number]> = [
    ['all', t('paperResearchPoolAll'), pool.entries.length],
    ['recommended', t('paperResearchPoolRecommended'), pool.stats.recommended],
    ['library', t('paperResearchPoolInLibrary'), libraryCount]
  ]

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-ds-main">
      <div className="shrink-0 border-b border-ds-border-muted px-3 pb-2 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-ds-ink">{t('paperResearchPoolTitle')}</span>
          <span className="text-[11.5px] tabular-nums text-ds-faint">{pool.entries.length}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ds-faint">
          {t('paperResearchPoolStats', { searches: pool.stats.searches, recommended: pool.stats.recommended })}
          {pool.stats.failedSources.length
            ? ` · ${t('paperToolFailed', { sources: pool.stats.failedSources.map((s) => t(`writePaperSearchSource_${s}`)).join(', ') })}`
            : ''}
        </p>
        <div className="mt-2 flex h-7 items-center rounded-md border border-ds-border-muted bg-ds-subtle p-0.5">
          {tabs.map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`inline-flex h-6 flex-1 items-center justify-center gap-1 rounded px-1 text-[11.5px] transition ${
                tab === value ? 'bg-ds-main font-medium text-ds-ink shadow-sm' : 'text-ds-muted hover:text-ds-ink'
              }`}
            >
              {label}<span className="tabular-nums text-ds-faint">{count}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <label className="relative flex h-7 min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-2 h-3 w-3 text-ds-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('paperResearchPoolFilter')}
              aria-label={t('paperResearchPoolFilter')}
              className="h-7 w-full rounded-md border border-ds-border-muted bg-ds-main pl-6 pr-5 text-[12px] text-ds-ink outline-none placeholder:text-ds-faint focus:border-[var(--ds-accent)]"
            />
            {query ? (
              <button type="button" aria-label={t('clearSearch')} onClick={() => setQuery('')} className="absolute right-1 p-0.5 text-ds-faint hover:text-ds-ink">
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as PoolSort)}
            aria-label={t('paperResearchPoolSort')}
            className="h-7 rounded-md border border-ds-border-muted bg-ds-main px-1 text-[11.5px] text-ds-muted outline-none"
          >
            <option value="relevance">{t('writePaperSearchSort_relevance')}</option>
            <option value="hits">{t('paperResearchPoolSortHits')}</option>
            <option value="year">{t('writePaperSearchSort_year')}</option>
            <option value="citations">{t('writePaperSearchSort_citations')}</option>
          </select>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {visible.map((entry) => {
          const checked = selected.has(entry.key)
          const owned = inLibrary(entry, libraryKeys)
          const priority = entry.recommended?.priority
          return (
            <li key={entry.key} className="group flex items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-ds-hover">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(entry.key)}
                aria-label={entry.title}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--ds-accent)]"
              />
              <button
                type="button"
                onClick={() => entry.firstBlockId && onFocusBlock(entry.firstBlockId)}
                title={entry.recommended?.reason ?? entry.title}
                className="min-w-0 flex-1 text-left"
              >
                <span className="line-clamp-2 text-[12.5px] leading-[1.35] text-ds-ink">{entry.title}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1 whitespace-nowrap text-[10.5px] text-ds-faint">
                  {priority ? (
                    <span className={`shrink-0 rounded px-1 font-medium ${PRIORITY_TONE[priority]}`}>{t(`paperResearchPriority_${priority}`)}</span>
                  ) : entry.recommended ? (
                    <span className="shrink-0 rounded bg-ds-subtle px-1 font-medium text-ds-muted">{t('paperResearchPoolRecommendedBadge')}</span>
                  ) : null}
                  <span className="min-w-0 truncate">
                    {[entry.year ? String(entry.year) : '', entry.venue ?? ''].filter(Boolean).join(' · ')}
                  </span>
                  {entry.hits > 1 ? <span className="shrink-0 tabular-nums">×{entry.hits}</span> : null}
                  {owned ? <span className="shrink-0 text-emerald-700 dark:text-emerald-300">{t('writePaperRefInLibrary')}</span> : null}
                </span>
              </button>
            </li>
          )
        })}
        {!visible.length ? (
          <li className="px-3 py-10 text-center text-[12px] text-ds-faint">{t('paperResearchPoolEmpty')}</li>
        ) : null}
      </ul>

      <div className="shrink-0 border-t border-ds-border-muted px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[11px] text-ds-faint">
            {chosen.length ? t('paperResearchPoolSelected', { count: chosen.length }) : t('paperResearchPoolChildNote')}
          </span>
          <PaperImportFolderPicker showPrefix={false} className="-mr-1" />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={!chosen.length || importing}
            onClick={() => void importChosen()}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--ds-control)] px-2 text-[11.5px] font-medium text-[var(--ds-control-foreground)] transition hover:opacity-90 disabled:opacity-40"
          >
            {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Import className="h-3 w-3" />}
            {t('writePaperImport')}
          </button>
          <button
            type="button"
            disabled={!chosen.length}
            onClick={() => void copyBibtex()}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-ds-border-muted px-2 text-[11.5px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink disabled:opacity-40"
          >
            {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
            BibTeX
          </button>
          <button
            type="button"
            disabled={!chosen.length || !composer?.setInput}
            onClick={sendToAssistant}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-ds-border-muted px-2 text-[11.5px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink disabled:opacity-40"
          >
            <MessageSquarePlus className="h-3 w-3" />
            {t('paperResearchPoolSendToChat')}
          </button>
        </div>
      </div>
    </aside>
  )
}
