import type { ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PAPER_SEARCH_SOURCES, type PaperSearchSource } from '@shared/paper/paper-search'

/** Source chips + year range shared by direct search and new Agent research. */
export function PaperSearchScopeRow({
  sources,
  onToggleSource,
  yearFrom,
  yearTo,
  onYearFrom,
  onYearTo
}: {
  sources: readonly PaperSearchSource[]
  onToggleSource: (source: PaperSearchSource) => void
  yearFrom: string
  yearTo: string
  onYearFrom: (value: string) => void
  onYearTo: (value: string) => void
}): ReactElement {
  const { t } = useTranslation('common')
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[12px] text-ds-faint">{t('writePaperSearchSources')}</span>
      {PAPER_SEARCH_SOURCES.map((source) => {
        const active = sources.includes(source)
        return (
          <button
            key={source}
            type="button"
            aria-pressed={active}
            onClick={() => onToggleSource(source)}
            className={`h-7 rounded-md border px-2.5 text-[12px] transition ${
              active
                ? 'border-transparent bg-[var(--ds-sidebar-row-active)] font-medium text-ds-ink'
                : 'border-ds-border-muted text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
            }`}
          >
            {t(`writePaperSearchSource_${source}`)}
          </button>
        )
      })}
      <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ds-faint">
        {t('writePaperSearchYears')}
        <YearInput value={yearFrom} onChange={onYearFrom} label={t('writePaperSearchYearFrom')} />
        <span>–</span>
        <YearInput value={yearTo} onChange={onYearTo} label={t('writePaperSearchYearTo')} />
      </span>
    </div>
  )
}

function YearInput({
  value,
  onChange,
  label
}: {
  value: string
  onChange: (value: string) => void
  label: string
}): ReactElement {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
      placeholder={label}
      aria-label={label}
      inputMode="numeric"
      className="h-7 w-16 rounded-md border border-ds-border-muted bg-ds-main px-2 text-center text-[12px] tabular-nums text-ds-ink outline-none placeholder:text-ds-faint focus:border-[var(--ds-accent)]"
    />
  )
}

/** Direct search / Agent research switch shown on both views. */
export function PaperSearchTabs({
  tab,
  onChange,
  compact = false
}: {
  tab: 'direct' | 'agent'
  onChange: (tab: 'direct' | 'agent') => void
  compact?: boolean
}): ReactElement {
  const { t } = useTranslation('common')
  return (
    <div className={`flex shrink-0 items-center rounded-lg border border-ds-border-muted bg-ds-subtle p-0.5 ${compact ? 'h-8' : 'h-10'}`}>
      {(['direct', 'agent'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={tab === value}
          onClick={() => onChange(value)}
          className={`inline-flex items-center gap-1 rounded-md px-3 text-[12.5px] transition ${compact ? 'h-6' : 'h-8'} ${
            tab === value ? 'bg-ds-main font-medium text-ds-ink shadow-sm' : 'text-ds-muted hover:text-ds-ink'
          }`}
        >
          {value === 'agent' ? <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} /> : null}
          {t(value === 'direct' ? 'writePaperSearchTabDirect' : 'writePaperSearchTabAgent')}
        </button>
      ))}
    </div>
  )
}
