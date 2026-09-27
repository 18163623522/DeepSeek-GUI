/**
 * Client-facing tool-result sideband (`ToolResultTurnItem.meta`) for the
 * Agent SDK path. The SDK only carries `output` text back through its MCP
 * bridge, and the tool_result item is later synthesized from the SDK stream
 * (`sdk-event-mapper`), so Kun-executed tools park their `meta` here keyed
 * by thread + SDK tool_use id until the mapper claims it. Bounded so
 * results the stream never reports cannot accumulate.
 */

const MAX_ENTRIES = 256

const pending = new Map<string, Record<string, unknown>>()

function key(threadId: string, callId: string): string {
  return `${threadId}\u0000${callId}`
}

export function stashSdkToolResultMeta(
  threadId: string,
  callId: string | undefined,
  meta: Record<string, unknown> | undefined
): void {
  if (!callId || !meta) return
  const entryKey = key(threadId, callId)
  pending.delete(entryKey)
  pending.set(entryKey, meta)
  while (pending.size > MAX_ENTRIES) {
    const oldest = pending.keys().next()
    if (oldest.done) break
    pending.delete(oldest.value)
  }
}

export function takeSdkToolResultMeta(
  threadId: string,
  callId: string
): Record<string, unknown> | undefined {
  const entryKey = key(threadId, callId)
  const meta = pending.get(entryKey)
  if (meta) pending.delete(entryKey)
  return meta
}

export function clearSdkToolResultMetaForTests(): void {
  pending.clear()
}
