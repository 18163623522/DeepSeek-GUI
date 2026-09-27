import { useEffect, useState } from 'react'
import type { ChatBlock } from '../../agent/types'
import { getProvider } from '../../agent/registry'
import { threadSnapshotLooksRunning } from '../../store/chat-store-runtime-helpers'

const POLL_MS = 1500

export type ChildThreadViewer = {
  childThreadId: string | null
  childBlocks: ChatBlock[]
  childStatus: string | undefined
  childLoading: boolean
  childError: string | null
  viewingChildThread: boolean
  openChildThread: (threadId: string) => void
  closeChildThread: () => void
}

/**
 * Local, read-only viewer for a delegated child (subagent) thread: loads the
 * thread detail and polls while it still looks running. Opening another
 * child or closing resets the snapshot. `resetKey` closes the viewer when the
 * host's conversation context changes (file, thread, workspace).
 */
export function useChildThreadViewer(resetKey: string): ChildThreadViewer {
  const [childThreadId, setChildThreadId] = useState<string | null>(null)
  const [childBlocks, setChildBlocks] = useState<ChatBlock[]>([])
  const [childStatus, setChildStatus] = useState<string | undefined>(undefined)
  const [childLoading, setChildLoading] = useState(false)
  const [childError, setChildError] = useState<string | null>(null)

  const reset = (): void => {
    setChildBlocks([])
    setChildStatus(undefined)
    setChildError(null)
  }

  useEffect(() => {
    setChildThreadId(null)
    reset()
  }, [resetKey])

  useEffect(() => {
    if (!childThreadId) {
      reset()
      setChildLoading(false)
      return
    }
    let cancelled = false
    let pollTimer: ReturnType<typeof globalThis.setTimeout> | null = null
    const load = async (): Promise<void> => {
      if (!cancelled) setChildLoading(true)
      try {
        const detail = await getProvider().getThreadDetail(childThreadId)
        if (cancelled) return
        setChildBlocks(detail.blocks)
        setChildStatus(detail.threadStatus)
        setChildError(null)
        if (threadSnapshotLooksRunning(detail.blocks, detail.threadStatus, detail.latestTurnStatus)) {
          pollTimer = globalThis.setTimeout(load, POLL_MS)
        }
      } catch (error) {
        if (cancelled) return
        setChildError(error instanceof Error ? error.message : String(error))
        // A queued child can be announced before its side thread is durable.
        // Keep retrying while this local viewer remains open.
        pollTimer = globalThis.setTimeout(load, POLL_MS)
      } finally {
        if (!cancelled) setChildLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
      if (pollTimer !== null) globalThis.clearTimeout(pollTimer)
    }
  }, [childThreadId])

  return {
    childThreadId,
    childBlocks,
    childStatus,
    childLoading,
    childError,
    viewingChildThread: Boolean(childThreadId),
    openChildThread: (threadId) => {
      const targetId = threadId.trim()
      if (!targetId || targetId === childThreadId) return
      reset()
      setChildThreadId(targetId)
    },
    closeChildThread: () => {
      setChildThreadId(null)
      reset()
    }
  }
}
