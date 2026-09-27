import type { ToolHostContext } from '../ports/tool-host.js'
import type { SessionStore } from '../ports/session-store.js'
import type {
  CompactIfNeededInput,
  HistoryCompactionOutcome
} from '../loop/history-compaction-service.js'

export const COMPACT_CONTEXT_TOOL_NAME = 'compact_context'

export type CompactContextDispatch = {
  compactIfNeeded(input: CompactIfNeededInput): Promise<HistoryCompactionOutcome>
}

/**
 * Mid-turn adapter for the existing summary compact path. AgentLoop binds the
 * HistoryCompactionService after construction; the tool provider closes over
 * `asTool` so a hot-applied loop can rebind without rebuilding schemas.
 */
export class ContextCompactCoordinator {
  private compaction: CompactContextDispatch | undefined

  constructor(private readonly deps: { sessionStore: SessionStore }) {}

  bind(compaction: CompactContextDispatch): void {
    this.compaction = compaction
  }

  asTool() {
    return async (context: ToolHostContext, args: Record<string, unknown>) => {
      if (Object.keys(args).length > 0) {
        return { output: { error: 'compact_context takes no arguments' }, isError: true }
      }
      if (!this.compaction) {
        return { output: { error: 'summary compaction is not available yet' }, isError: true }
      }
      const model = context.model?.id
      if (!model) {
        return { output: { error: 'compact_context requires an active model' }, isError: true }
      }
      const items = await this.deps.sessionStore.loadItems(context.threadId)
      const outcome = await this.compaction.compactIfNeeded({
        items,
        model,
        ...(context.modelProviderId ? { providerId: context.modelProviderId } : {}),
        signal: context.abortSignal,
        threadId: context.threadId,
        turnId: context.turnId,
        force: { reason: 'model compact_context' }
      })
      if (!outcome.compacted) {
        return {
          output: {
            compacted: false,
            replacedTokens: 0,
            message: 'No history was compactable yet; continue the current step or retry when more conversation is available.'
          }
        }
      }
      return {
        output: {
          compacted: true,
          replacedTokens: outcome.replacedTokens
        }
      }
    }
  }
}
