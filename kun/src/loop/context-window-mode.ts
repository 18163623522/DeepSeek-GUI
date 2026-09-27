import type { ContextWindowMode } from '../contracts/context-windows.js'

export type ContextWindowModeFlags = {
  modelInitiatedCompactionEnabled?: boolean
  windowModeEnabled?: boolean
}

/**
 * Effective frozen-turn mode from the two Laboratory flags. Window mode is
 * only live when the parent model-initiated switch is also on.
 */
export function resolveContextWindowMode(
  compaction?: ContextWindowModeFlags
): ContextWindowMode {
  if (compaction?.modelInitiatedCompactionEnabled !== true) return 'summary'
  return compaction.windowModeEnabled === true ? 'windows' : 'model_compact'
}

export function contextModeRequiresToolCalling(mode: ContextWindowMode): boolean {
  return mode === 'windows' || mode === 'model_compact'
}
