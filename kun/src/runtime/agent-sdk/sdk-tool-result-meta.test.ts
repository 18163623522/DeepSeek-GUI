import { afterEach, describe, expect, test } from 'vitest'
import { SdkEventMapper } from './sdk-event-mapper.js'
import type { SdkMessage } from './sdk-protocol.js'
import {
  clearSdkToolResultMetaForTests,
  stashSdkToolResultMeta,
  takeSdkToolResultMeta
} from './sdk-tool-result-meta.js'

function mapToolRound(mapper: SdkEventMapper, name: string, id: string): unknown {
  mapper.map({
    type: 'assistant',
    parent_tool_use_id: null,
    message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input: {} }] }
  } as SdkMessage)
  return mapper.map({
    type: 'user',
    parent_tool_use_id: null,
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] }
  } as SdkMessage)[0]
}

describe('SDK tool-result meta handoff', () => {
  afterEach(() => clearSdkToolResultMetaForTests())

  test('attaches parked meta to the synthesized Kun tool_result once', () => {
    let n = 0
    const mapper = new SdkEventMapper({ threadId: 'th', turnId: 'tn', nextId: (p) => `${p}_${++n}` })
    stashSdkToolResultMeta('th', 'toolu_1', { paperList: { version: 1, papers: [] } })
    expect(mapToolRound(mapper, 'mcp__kun__paper_report', 'toolu_1')).toMatchObject({
      item: { kind: 'tool_result', meta: { paperList: { version: 1 } } }
    })
    expect(takeSdkToolResultMeta('th', 'toolu_1')).toBeUndefined()
  })

  test('never attaches meta to non-Kun tools or other threads', () => {
    let n = 0
    const mapper = new SdkEventMapper({ threadId: 'th', turnId: 'tn', nextId: (p) => `${p}_${++n}` })
    stashSdkToolResultMeta('other', 'toolu_2', { x: 1 })
    stashSdkToolResultMeta('th', 'toolu_3', { x: 1 })
    const kunOtherThread = mapToolRound(mapper, 'mcp__kun__paper_search', 'toolu_2') as { item: { meta?: unknown } }
    const builtin = mapToolRound(mapper, 'Bash', 'toolu_3') as { item: { meta?: unknown } }
    expect(kunOtherThread.item.meta).toBeUndefined()
    expect(builtin.item.meta).toBeUndefined()
  })
})
