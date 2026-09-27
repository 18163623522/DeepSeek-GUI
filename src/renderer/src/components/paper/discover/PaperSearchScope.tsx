import type { ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Agent research / quick search switch shown on both search views. */
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
      {(['agent', 'direct'] as const).map((value) => (
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
