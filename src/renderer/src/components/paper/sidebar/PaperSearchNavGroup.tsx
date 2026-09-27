import { useMemo, useState, type ReactElement } from 'react'
import { Loader2, Plus, Search, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WritePaperViewId } from '../../../write/write-workspace-store-types'
import { useWriteWorkspaceStore } from '../../../write/write-workspace-store'
import { useChatStore } from '../../../store/chat-store'
import { threadLooksRunning } from '../../../store/chat-store-runtime-helpers'
import { listResearchSessions } from '../../../paper/paper-research-sessions'
import { selectPaperResearchSession } from '../../../paper/paper-research-actions'
import { openPaperViewTab } from '../../../paper/paper-view'

const COLLAPSED_SESSIONS = 6

/**
 * 论文搜索 node with its Agent research sessions listed underneath, the way
 * Code lists a project's conversations: pick a session to reopen it in the
 * center, or start a new one from the row's + button.
 */
export function PaperSearchNavGroup({ activeView }: { activeView: WritePaperViewId | null }): ReactElement {
  const { t } = useTranslation('common')
  const libraryRoot = useWriteWorkspaceStore((s) => s.workspaceRoot)
  const research = useWriteWorkspaceStore((s) => s.paperResearch)
  const threads = useChatStore((s) => s.threads)
  const busy = useChatStore((s) => s.busy)
  const activeThreadId = useChatStore((s) => s.activeThreadId)
  const [showAll, setShowAll] = useState(false)
  const sessions = useMemo(() => listResearchSessions(libraryRoot, threads), [libraryRoot, threads])
  const onSearch = activeView === 'discover:search'
  const shown = showAll ? sessions : sessions.slice(0, COLLAPSED_SESSIONS)

  const openSession = (sessionId: string | null): void => {
    openPaperViewTab('discover:search')
    selectPaperResearchSession(sessionId)
  }

  return (
    <div className="flex flex-col gap-px">
      <div className="group/search relative">
        <button
          type="button"
          onClick={() => openPaperViewTab('discover:search')}
          className={`flex h-7 w-full items-center gap-1.5 rounded-md px-2 pr-8 text-left text-[13px] transition-colors duration-75 ${
            onSearch && !research.agentTab
              ? 'bg-[var(--ds-sidebar-row-active)] font-medium text-ds-ink'
              : 'text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
          }`}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ds-muted">
            <Search className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 truncate">{t('writePaperDiscoverTab_search')}</span>
        </button>
        <button
          type="button"
          onClick={() => openSession(null)}
          aria-label={t('paperResearchNew')}
          title={t('paperResearchNew')}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded text-ds-faint transition hover:bg-ds-main hover:text-ds-ink group-hover/search:flex"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      {shown.map((session) => {
        const active = onSearch && research.agentTab && research.sessionId === session.sessionId
        const running = (busy && activeThreadId === session.threadId) || threadLooksRunning(session)
        return (
          <button
            key={session.sessionId}
            type="button"
            onClick={() => openSession(session.sessionId)}
            title={session.title}
            className={`flex h-7 w-full items-center gap-1.5 rounded-md pl-7 pr-2 text-left text-[12.5px] transition-colors duration-75 ${
              active ? 'bg-[var(--ds-sidebar-row-active)] font-medium text-ds-ink' : 'text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
            }`}
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-ds-faint">
              {running
                ? <Loader2 className="h-3 w-3 animate-spin text-[var(--ds-accent)]" />
                : <Sparkles className="h-3 w-3" strokeWidth={1.8} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{session.title}</span>
          </button>
        )
      })}
      {sessions.length > COLLAPSED_SESSIONS ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="h-6 rounded-md pl-7 text-left text-[11.5px] text-ds-faint hover:text-ds-ink"
        >
          {showAll ? t('paperToolShowLess') : t('paperResearchMoreSessions', { count: sessions.length - COLLAPSED_SESSIONS })}
        </button>
      ) : null}
    </div>
  )
}
