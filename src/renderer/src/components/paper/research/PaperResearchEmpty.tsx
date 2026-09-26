import { useState, type ReactElement } from 'react'
import { ArrowUp, Loader2, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PaperSearchSource } from '@shared/paper/paper-search'
import type { PaperResearchDraft } from '../../../paper/paper-mode-store'
import type { PaperResearchDepth, PaperResearchRequest } from '../../../paper/paper-research-actions'
import {
  parseSearchYear,
  readSearchSources,
  toggleSearchSource,
  writeSearchSources
} from '../../../paper/paper-search-prefs'
import { PaperSearchScopeRow } from '../discover/PaperSearchScope'

const DEPTHS: PaperResearchDepth[] = ['quick', 'standard', 'deep']
const EXAMPLE_KEYS = ['paperResearchExample1', 'paperResearchExample2', 'paperResearchExample3']

/**
 * "New research" state: the research question, scope (sources, years) and
 * depth. Starting creates a dedicated research conversation.
 */
export function PaperResearchEmpty({
  draft,
  starting,
  runtimeReady,
  onStart
}: {
  draft: PaperResearchDraft | null
  starting: boolean
  runtimeReady: boolean
  onStart: (request: PaperResearchRequest) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState(draft?.query ?? '')
  const [sources, setSources] = useState<PaperSearchSource[]>(() => draft?.sources.length ? [...draft.sources] : readSearchSources())
  const [yearFrom, setYearFrom] = useState(draft?.yearFrom ? String(draft.yearFrom) : '')
  const [yearTo, setYearTo] = useState(draft?.yearTo ? String(draft.yearTo) : '')
  const [depth, setDepth] = useState<PaperResearchDepth>('standard')
  const canStart = Boolean(query.trim()) && !starting && runtimeReady

  const start = (): void => {
    if (!canStart) return
    onStart({ query, sources, yearFrom: parseSearchYear(yearFrom), yearTo: parseSearchYear(yearTo), depth })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-6 pb-10 pt-[12vh]">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ds-border-muted bg-ds-subtle text-[var(--ds-accent)]">
            <Sparkles className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-ds-ink">{t('paperResearchEmptyTitle')}</h2>
          <p className="mt-1.5 max-w-[520px] text-[12.5px] leading-5 text-ds-muted">{t('paperResearchEmptySub')}</p>
        </div>

        <div className="mt-6 rounded-xl border border-ds-border bg-ds-main shadow-sm focus-within:border-[var(--ds-accent)]">
          <textarea
            value={query}
            autoFocus
            rows={3}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                start()
              }
            }}
            placeholder={t('paperResearchQuestionPlaceholder')}
            aria-label={t('paperResearchQuestionPlaceholder')}
            className="block w-full resize-none rounded-t-xl bg-transparent px-4 pt-3 text-[14px] leading-6 text-ds-ink outline-none placeholder:text-ds-faint"
          />
          <div className="flex items-center gap-2 px-3 pb-2.5">
            <span className="text-[11.5px] text-ds-faint">{t('paperResearchDepth')}</span>
            <div className="flex h-7 items-center rounded-md border border-ds-border-muted bg-ds-subtle p-0.5">
              {DEPTHS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={depth === value}
                  title={t(`paperResearchDepthHint_${value}`)}
                  onClick={() => setDepth(value)}
                  className={`inline-flex h-6 items-center rounded px-2 text-[11.5px] transition ${
                    depth === value ? 'bg-ds-main font-medium text-ds-ink shadow-sm' : 'text-ds-muted hover:text-ds-ink'
                  }`}
                >
                  {t(`paperResearchDepth_${value}`)}
                </button>
              ))}
            </div>
            <span className="min-w-0 flex-1 truncate text-[11px] text-ds-faint">{t(`paperResearchDepthHint_${depth}`)}</span>
            <button
              type="button"
              onClick={start}
              disabled={!canStart}
              aria-label={t('paperResearchStart')}
              title={runtimeReady ? t('paperResearchStart') : t('runtimeActionNeedsConnection')}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ds-control)] px-3 text-[12.5px] font-medium text-[var(--ds-control-foreground)] transition hover:opacity-90 disabled:opacity-40"
            >
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.2} />}
              {t('paperResearchStart')}
            </button>
          </div>
        </div>

        <PaperSearchScopeRow
          sources={sources}
          onToggleSource={(source) => {
            const next = toggleSearchSource(sources, source)
            setSources(next)
            writeSearchSources(next)
          }}
          yearFrom={yearFrom}
          yearTo={yearTo}
          onYearFrom={setYearFrom}
          onYearTo={setYearTo}
        />

        <div className="mt-8 flex flex-wrap justify-center gap-1.5">
          <span className="mr-1 self-center text-[11.5px] text-ds-faint">{t('writePaperSearchEmptyHint')}</span>
          {EXAMPLE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setQuery(t(key))}
              className="rounded-md border border-ds-border-muted px-2.5 py-1 text-[12px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
