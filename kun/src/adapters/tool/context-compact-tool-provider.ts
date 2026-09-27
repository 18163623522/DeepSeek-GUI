import type { ToolHostContext } from '../../ports/tool-host.js'
import type { CapabilityToolProvider } from './capability-registry.js'
import { LocalToolHost } from './local-tool-host.js'
import { COMPACT_CONTEXT_TOOL_NAME } from '../../services/context-compact-coordinator.js'
import type { ContextWindowModeSource } from './context-window-tool-provider.js'

export type CompactContextTransition = (
  context: ToolHostContext,
  args: Record<string, unknown>
) => Promise<{ output: unknown; isError?: boolean }>

function modeDisabledOutput(): { output: unknown; isError: boolean } {
  return {
    output: {
      error: `tool ${COMPACT_CONTEXT_TOOL_NAME} requires model-initiated summary compression for this turn`
    },
    isError: true
  }
}

/**
 * Single exclusive summary-compaction tool advertised only in `model_compact`.
 * Window mode keeps `new_context` instead; summary mode keeps host auto-compact.
 */
export function buildContextCompactToolProviders(input: {
  mode: ContextWindowModeSource
  compact?: CompactContextTransition
}): CapabilityToolProvider[] {
  const gated = (context: ToolHostContext) => input.mode(context) === 'model_compact'
  return [{
    id: 'context-compact',
    kind: 'built-in',
    enabled: true,
    available: true,
    effects: {
      network: false,
      externalWrite: false,
      processExecution: false,
      guiAutomation: false
    },
    tools: [
      LocalToolHost.defineTool({
        name: COMPACT_CONTEXT_TOOL_NAME,
        description: 'Summarize older conversation into a compact recap using Kun\'s existing context-summary compression. Call it exclusively, never mixed with other tool calls in one batch.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        },
        policy: 'auto',
        sideEffect: 'unknown',
        shouldAdvertise: gated,
        execute: async (args, context) => {
          if (!gated(context)) return modeDisabledOutput()
          if (input.compact) return input.compact(context, args)
          return {
            output: { error: 'compact_context is not available in this runtime build yet' },
            isError: true
          }
        }
      })
    ]
  }]
}
