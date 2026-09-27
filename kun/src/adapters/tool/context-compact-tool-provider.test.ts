import { describe, expect, it, vi } from 'vitest'
import type { ToolHostContext } from '../../ports/tool-host.js'
import { buildContextCompactToolProviders } from './context-compact-tool-provider.js'
import type { LocalTool } from './local-tool-host-types.js'
import { COMPACT_CONTEXT_TOOL_NAME, ContextCompactCoordinator } from '../../services/context-compact-coordinator.js'
import { InMemorySessionStore } from '../in-memory-session-store.js'

function context(threadId: string): ToolHostContext {
  return {
    threadId,
    turnId: 'turn-1',
    workspace: '/tmp/ws',
    approvalPolicy: 'auto',
    sandboxMode: 'workspace-write',
    abortSignal: new AbortController().signal,
    awaitApproval: async () => 'allow' as const,
    model: {
      id: 'test-model',
      inputModalities: ['text'],
      outputModalities: ['text'],
      supportsToolCalling: true,
      messageParts: ['text']
    }
  }
}

describe('buildContextCompactToolProviders', () => {
  it('advertises compact_context only in model_compact mode', async () => {
    let mode: 'summary' | 'model_compact' | 'windows' = 'summary'
    const tools = buildContextCompactToolProviders({
      mode: () => mode
    })[0]!.tools as LocalTool[]
    const tool = tools.find((candidate) => candidate.name === COMPACT_CONTEXT_TOOL_NAME)!
    expect(tool.shouldAdvertise?.(context('threadA'))).toBe(false)

    mode = 'windows'
    expect(tool.shouldAdvertise?.(context('threadA'))).toBe(false)

    mode = 'model_compact'
    expect(tool.shouldAdvertise?.(context('threadA'))).toBe(true)
  })

  it('rejects invocation when the frozen mode is not model_compact', async () => {
    const tools = buildContextCompactToolProviders({
      mode: () => 'windows',
      compact: async () => ({ output: { compacted: true } })
    })[0]!.tools as LocalTool[]
    const tool = tools[0]!
    const result = await tool.execute({}, context('threadA'))
    expect(result.isError).toBe(true)
  })

  it('force-compacts through the bound HistoryCompactionService', async () => {
    const sessionStore = new InMemorySessionStore()
    await sessionStore.appendItem('threadA', {
      id: 'u1',
      turnId: 'turn-1',
      threadId: 'threadA',
      kind: 'user_message',
      role: 'user',
      status: 'completed',
      createdAt: '2026-09-14T00:00:00.000Z',
      text: 'long history'
    })
    const compactIfNeeded = vi.fn(async () => ({
      history: [],
      triggered: true,
      compacted: true,
      replacedTokens: 1200
    }))
    const coordinator = new ContextCompactCoordinator({ sessionStore })
    coordinator.bind({ compactIfNeeded })
    const tools = buildContextCompactToolProviders({
      mode: () => 'model_compact',
      compact: coordinator.asTool()
    })[0]!.tools as LocalTool[]
    const result = await tools[0]!.execute({}, context('threadA'))
    expect(result.isError).toBeFalsy()
    expect(result.output).toMatchObject({ compacted: true, replacedTokens: 1200 })
    expect(compactIfNeeded).toHaveBeenCalledWith(expect.objectContaining({
      threadId: 'threadA',
      turnId: 'turn-1',
      model: 'test-model',
      force: { reason: 'model compact_context' }
    }))
  })
})
