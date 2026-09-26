import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Loader2, PanelLeft, PanelRight, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChatBlock } from '../../../agent/types'
import { useChatStore } from '../../../store/chat-store'
import { useWriteWorkspaceStore } from '../../../write/write-workspace-store'
import { usePaperModeStore } from '../../../paper/paper-mode-store'
import { usePaperStore } from '../../../write/paper/paper-store'
import { buildResearchPool } from '../../../paper/paper-research-pool'
import {
  listResearchSessions,
  readLastResearchSession
} from '../../../paper/paper-research-sessions'
import {
  selectPaperResearchSession,
  startPaperResearch,
  type PaperResearchRequest
} from '../../../paper/paper-research-actions'
import { useWriteAssistantStage } from '../../write/WriteAssistantStageContext'
import { PaperSearchTabs } from '../discover/PaperSearchScope'
import { PaperResearchEmpty } from './PaperResearchEmpty'
import { PaperResearchPool } from './PaperResearchPool'
import { PaperResearchSessionList } from './PaperResearchSessionList'
import { PaperResearchStage } from './PaperResearchStage'

const PANELS_KEY = 'kun.paper.research.panels'
const NO_BLOCKS: ChatBlock[] = []

function readPanels(): { sessions: boolean; pool: boolean } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PANELS_KEY) ?? '{}') as { sessions?: unknown; pool?: unknown }
    return { sessions: raw.sessions !== false, pool: raw.pool !== false }
  } catch {
    return { sessions: true, pool: true }
  }
}

function writePanels(panels: { sessions: boolean; pool: boolean }): void {
  try {
    window.localStorage.setItem(PANELS_KEY, JSON.stringify(panels))
  } catch {
    // Panel memory is a convenience only.
  }
}

function useElapsed(since: string | undefined, running: boolean): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  const start = since ? Date.parse(since) : NaN
  if (!running || Number.isNaN(start)) return ''
  const seconds = Math.max(0, Math.floor((now - start) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Agent research stage (paper search → Agent tab): research sessions on the
 * left, the session's Work conversation in the center (Code-style timeline +
 * composer), and the deduplicated paper pool on the right.
 */
export function PaperResearchView({ onShowDirect }: { onShowDirect: () => void }): ReactElement {
  const { t } = useTranslation('common')
  const assistant = useWriteAssistantStage()
  const libraryRoot = useWriteWorkspaceStore((s) => s.workspaceRoot)
  const sessionId = useWriteWorkspaceStore((s) => s.paperResearch.sessionId)
  const threads = useChatStore((s) => s.threads)
  const draft = usePaperModeStore((s) => s.discover.researchDraft)
  const [panels, setPanels] = useState(readPanels)
  const [starting, setStarting] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const restoredFor = useRef<string | null>(null)

  const sessions = useMemo(() => listResearchSessions(libraryRoot, threads), [libraryRoot, threads])
  const activeSession = sessions.find((session) => session.sessionId === sessionId) ?? null
  const bound = Boolean(activeSession && assistant && assistant.activeThreadId === activeSession.threadId)
  const blocks = bound && assistant ? assistant.blocks : NO_BLOCKS
  const pool = useMemo(() => buildResearchPool(blocks), [blocks])
  const running = bound && Boolean(assistant?.busy)
  const lastUserAt = [...blocks].reverse().find((block) => block.kind === 'user')?.createdAt
  const elapsed = useElapsed(lastUserAt, running)

  // Reopen the library's last session once per library, unless the user is
  // already on a session or deliberately started a new one.
  useEffect(() => {
    if (restoredFor.current === libraryRoot || !sessions.length) return
    restoredFor.current = libraryRoot
    if (sessionId || draft) return
    const last = readLastResearchSession(libraryRoot)
    if (last && sessions.some((session) => session.sessionId === last)) selectPaperResearchSession(last)
  }, [libraryRoot, sessions, sessionId, draft])

  const togglePanel = (key: 'sessions' | 'pool'): void => {
    const next = { ...panels, [key]: !panels[key] }
    setPanels(next)
    writePanels(next)
  }

  const start = (request: PaperResearchRequest): void => {
    setStarting(true)
    void startPaperResearch(request).then((result) => {
      setStarting(false)
      if (result.ok) {
        usePaperModeStore.getState().patchDiscover({ researchDraft: null })
        return
      }
      if (result.reason !== 'empty') {
        usePaperStore.getState().setNotice({ tone: 'error', message: t(`paperResearchStartFailed_${result.reason}`) })
      }
    })
  }

  const focusBlock = (blockId: string): void => {
    const target = stageRef.current?.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ds-border-muted px-3">
        <button
          type="button"
          onClick={() => togglePanel('sessions')}
          aria-pressed={panels.sessions}
          aria-label={t('paperResearchSessions')}
          title={t('paperResearchSessions')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
        >
          <PanelLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <PaperSearchTabs tab="agent" compact onChange={(tab) => tab === 'direct' && onShowDirect()} />
        <div className="min-w-0 flex-1 px-2">
          {activeSession ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-[13px] font-semibold text-ds-ink">{activeSession.title}</span>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[11px] ${
                running ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-ds-subtle text-ds-muted'
              }`}>
                {running ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {running ? t('paperResearchStatusRunning') : t('paperResearchStatusIdle')}
              </span>
              {elapsed ? <span className="shrink-0 text-[11.5px] tabular-nums text-ds-faint">{elapsed}</span> : null}
            </div>
          ) : (
            <span className="text-[13px] font-medium text-ds-muted">{t('paperResearchNew')}</span>
          )}
        </div>
        {running ? (
          <button
            type="button"
            onClick={() => assistant?.onInterrupt()}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-ds-border-muted px-2 text-[12px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <Square className="h-3 w-3" strokeWidth={2.2} />
            {t('paperResearchStop')}
          </button>
        ) : null}
        {activeSession ? (
          <button
            type="button"
            onClick={() => togglePanel('pool')}
            aria-pressed={panels.pool}
            aria-label={t('paperResearchPoolTitle')}
            title={t('paperResearchPoolTitle')}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <PanelRight className="h-4 w-4" strokeWidth={1.8} />
            <span className="tabular-nums">{pool.entries.length}</span>
          </button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {panels.sessions ? (
          <div className="hidden w-[220px] shrink-0 border-r border-ds-border-muted bg-ds-sidebar min-[900px]:block">
            <PaperResearchSessionList
              sessions={sessions}
              activeSessionId={activeSession ? activeSession.sessionId : null}
              runningThreadId={running && activeSession ? activeSession.threadId : null}
              onSelect={(id) => selectPaperResearchSession(id)}
              onNew={() => selectPaperResearchSession(null)}
            />
          </div>
        ) : null}

        <div ref={stageRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!assistant ? (
            <p className="m-auto text-[12.5px] text-ds-faint">{t('writePaperSearchAgentUnavailable')}</p>
          ) : !activeSession ? (
            <PaperResearchEmpty
              key={draft?.query ?? ''}
              draft={draft}
              starting={starting}
              runtimeReady={assistant.runtimeConnection === 'ready'}
              onStart={start}
            />
          ) : !bound ? (
            <div className="m-auto flex items-center gap-2 text-[12.5px] text-ds-faint">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('paperResearchLoading')}
            </div>
          ) : (
            <PaperResearchStage assistant={assistant} newCountByBlock={pool.newCountByBlock} />
          )}
        </div>

        {activeSession && bound && panels.pool ? (
          <div className="hidden w-[300px] shrink-0 border-l border-ds-border-muted min-[1100px]:block">
            <PaperResearchPool pool={pool} onFocusBlock={focusBlock} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
