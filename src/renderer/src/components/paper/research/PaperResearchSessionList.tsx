import { useState, type ReactElement } from 'react'
import { Archive, Check, Loader2, Pencil, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ResearchSessionSummary } from '../../../paper/paper-research-sessions'
import { useChatStore } from '../../../store/chat-store'

function relativeTime(iso: string | null, locale: string): string {
  if (!iso) return ''
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  const minutes = Math.round((Date.now() - time) / 60_000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(-hours, 'hour')
  return format.format(-Math.round(hours / 24), 'day')
}

/** Left rail: this library's Agent research sessions, newest first. */
export function PaperResearchSessionList({
  sessions,
  activeSessionId,
  runningThreadId,
  onSelect,
  onNew
}: {
  sessions: ResearchSessionSummary[]
  activeSessionId: string | null
  runningThreadId: string | null
  onSelect: (sessionId: string) => void
  onNew: () => void
}): ReactElement {
  const { t, i18n } = useTranslation('common')
  const [editing, setEditing] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  const commitRename = async (session: ResearchSessionSummary): Promise<void> => {
    const title = draftTitle.trim()
    setEditing(null)
    if (!title || title === session.title) return
    await useChatStore.getState().renameThread(session.threadId, title).catch(() => undefined)
  }

  const archive = async (session: ResearchSessionSummary): Promise<void> => {
    await useChatStore.getState().archiveThread(session.threadId, true).catch(() => undefined)
    if (session.sessionId === activeSessionId) onNew()
  }

  return (
    <nav className="flex h-full min-h-0 flex-col" aria-label={t('paperResearchSessions')}>
      <div className="shrink-0 px-2 pb-1.5 pt-2.5">
        <button
          type="button"
          onClick={onNew}
          className={`flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium transition ${
            activeSessionId === null ? 'bg-[var(--ds-sidebar-row-active)] text-ds-ink' : 'text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
          }`}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          {t('paperResearchNew')}
        </button>
      </div>
      <p className="px-3 pb-1 text-[11px] text-ds-faint">{t('paperResearchSessions')}</p>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {sessions.map((session) => {
          const active = session.sessionId === activeSessionId
          const running = session.threadId === runningThreadId
          return (
            <li key={session.sessionId} className="group relative">
              {editing === session.sessionId ? (
                <div className="flex items-center gap-1 px-1 py-1">
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) void commitRename(session)
                      if (event.key === 'Escape') setEditing(null)
                    }}
                    aria-label={t('paperResearchRename')}
                    className="h-7 min-w-0 flex-1 rounded-md border border-ds-border bg-ds-main px-1.5 text-[12px] text-ds-ink outline-none focus:border-[var(--ds-accent)]"
                  />
                  <button type="button" aria-label={t('paperResearchRename')} onClick={() => void commitRename(session)} className="rounded p-1 text-ds-muted hover:text-ds-ink">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label={t('cancel')} onClick={() => setEditing(null)} className="rounded p-1 text-ds-muted hover:text-ds-ink">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(session.sessionId)}
                  className={`flex w-full flex-col rounded-md px-2 py-1.5 pr-12 text-left transition ${
                    active ? 'bg-[var(--ds-sidebar-row-active)]' : 'hover:bg-ds-hover'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {running ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[var(--ds-accent)]" />
                    ) : (
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-[var(--ds-accent)]' : 'bg-ds-faint'}`} />
                    )}
                    <span className={`min-w-0 truncate text-[12.5px] ${active ? 'font-medium text-ds-ink' : 'text-ds-muted'}`}>
                      {session.title}
                    </span>
                  </span>
                  <span className="pl-3 text-[10.5px] text-ds-faint">{relativeTime(session.updatedAt, i18n.language)}</span>
                </button>
              )}
              {editing !== session.sessionId ? (
                <span className="absolute right-1 top-1.5 hidden items-center gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    aria-label={t('paperResearchRename')}
                    title={t('paperResearchRename')}
                    onClick={() => {
                      setDraftTitle(session.title)
                      setEditing(session.sessionId)
                    }}
                    className="rounded p-1 text-ds-faint hover:bg-ds-main hover:text-ds-ink"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('paperResearchArchive')}
                    title={t('paperResearchArchive')}
                    onClick={() => void archive(session)}
                    className="rounded p-1 text-ds-faint hover:bg-ds-main hover:text-ds-ink"
                  >
                    <Archive className="h-3 w-3" />
                  </button>
                </span>
              ) : null}
            </li>
          )
        })}
        {!sessions.length ? (
          <li className="px-2 py-6 text-center text-[11.5px] leading-5 text-ds-faint">{t('paperResearchNoSessions')}</li>
        ) : null}
      </ul>
    </nav>
  )
}
