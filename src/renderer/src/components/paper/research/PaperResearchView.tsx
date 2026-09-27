import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Archive, Loader2, PanelRight, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChatBlock } from '../../../agent/types'
import { useChatStore } from '../../../store/chat-store'
import { useWriteWorkspaceStore } from '../../../write/write-workspace-store'
import { usePaperModeStore } from '../../../paper/paper-mode-store'
import { usePaperStore } from '../../../write/paper/paper-store'
import { buildResearchPool } from '../../../paper/paper-research-pool'
import {
  listResearchSessions,
  readLastResearchSession,
  researchResourcePath
} from '../../../paper/paper-research-sessions'
import {
  selectPaperResearchSession,
  startPaperResearch,
  type PaperResearchRequest
} from '../../../paper/paper-research-actions'
import { useWriteAssistantStage } from '../../write/WriteAssistantStageContext'
import { paperResearchStageActive } from '../../../paper/paper-view'
import { PaperSearchTabs } from '../discover/PaperSearchScope'
import { PaperResearchEmpty } from './PaperResearchEmpty'
import { PaperResearchPool } from './PaperResearchPool'
import { PaperResearchStage } from './PaperResearchStage'

const POOL_KEY = 'kun.paper.research.poolOpen'
const NO_BLOCKS: ChatBlock[] = []

function readPoolOpen(): boolean {
  try {
    return window.localStorage.getItem(POOL_KEY) !== '0'
  } catch {
    return true
  }
}

function writePoolOpen(open: boolean): void {
  try {
    window.localStorage.setItem(POOL_KEY, open ? '1' : '0')
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
 * Agent research stage (paper search → Agent tab), laid out like a Code
 * conversation: a slim header, the session's Work conversation in the
 * center and the paper pool on the right. Sessions live in the sidebar
 * under 论文搜索.
 */
export function PaperResearchView({ onShowDirect }: { onShowDirect: () => void }): ReactElement {
  const { t } = useTranslation('common')
  const assistant = useWriteAssistantStage()
  const libraryRoot = useWriteWorkspaceStore((s) => s.workspaceRoot)
  const sessionId = useWriteWorkspaceStore((s) => s.paperResearch.sessionId)
  const threads = useChatStore((s) => s.threads)
  const draft = usePaperModeStore((s) => s.discover.researchDraft)
  const [poolOpen, setPoolOpen] = useState(readPoolOpen)
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
  // already on a session or arrived with a hand-off draft.
  useEffect(() => {
    if (restoredFor.current === libraryRoot || !sessions.length) return
    restoredFor.current = libraryRoot
    if (sessionId || draft) return
    const last = readLastResearchSession(libraryRoot)
    if (last && sessions.some((session) => session.sessionId === last)) selectPaperResearchSession(last)
  }, [libraryRoot, sessions, sessionId, draft])

  // The resource → thread effect normally binds the session within a tick;
  // if something else holds editor focus or selection lags, select directly.
  useEffect(() => {
    if (!activeSession || bound) return
    const timer = setTimeout(() => {
      if (!paperResearchStageActive(useWriteWorkspaceStore.getState())) return
      void useChatStore.getState().selectWriteThread(
        activeSession.threadId,
        libraryRoot,
        researchResourcePath(libraryRoot, activeSession.sessionId)
      )
    }, 1500)
    return () => clearTimeout(timer)
  }, [activeSession, bound, libraryRoot])

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

  const archiveSession = (): void => {
    if (!activeSession) return
    void useChatStore.getState().archiveThread(activeSession.threadId, true)
      .then(() => selectPaperResearchSession(null))
      .catch(() => undefined)
  }

  const focusBlock = (blockId: string): void => {
    const target = stageRef.current?.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const showPool = Boolean(activeSession && bound && poolOpen)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-ds-border-muted px-4">
        <PaperSearchTabs tab="agent" compact onChange={(tab) => tab === 'direct' && onShowDirect()} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {activeSession ? (
            <>
              <span className="min-w-0 truncate text-[13px] font-medium text-ds-ink" title={activeSession.title}>
                {activeSession.title}
              </span>
              {running ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-[var(--ds-accent)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('paperResearchStatusRunning')}
                  {elapsed ? <span className="tabular-nums text-ds-faint">{elapsed}</span> : null}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        {running ? (
          <button
            type="button"
            onClick={() => assistant?.onInterrupt()}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <Square className="h-3 w-3" strokeWidth={2.2} />
            {t('paperResearchStop')}
          </button>
        ) : null}
        {activeSession && !running ? (
          <button
            type="button"
            onClick={archiveSession}
            aria-label={t('paperResearchArchive')}
            title={t('paperResearchArchive')}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <Archive className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        ) : null}
        {activeSession ? (
          <button
            type="button"
            onClick={() => {
              setPoolOpen((open) => {
                writePoolOpen(!open)
                return !open
              })
            }}
            aria-pressed={poolOpen}
            title={t('paperResearchPoolTitle')}
            className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] transition hover:bg-ds-hover hover:text-ds-ink ${
              poolOpen ? 'text-ds-ink' : 'text-ds-muted'
            }`}
          >
            <PanelRight className="h-4 w-4" strokeWidth={1.8} />
            <span className="tabular-nums">{pool.entries.length}</span>
          </button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={stageRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!assistant ? (
            <div className="m-auto flex items-center gap-2 text-[12.5px] text-ds-faint">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('paperResearchLoading')}
            </div>
          ) : !activeSession ? (
            <PaperResearchEmpty assistant={assistant} draft={draft} starting={starting} onStart={start} />
          ) : !bound ? (
            <div className="m-auto flex items-center gap-2 text-[12.5px] text-ds-faint">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('paperResearchLoading')}
            </div>
          ) : (
            <PaperResearchStage assistant={assistant} newCountByBlock={pool.newCountByBlock} />
          )}
        </div>
        {showPool ? (
          <div className="hidden w-[300px] shrink-0 border-l border-ds-border-muted min-[1100px]:block">
            <PaperResearchPool pool={pool} onFocusBlock={focusBlock} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
