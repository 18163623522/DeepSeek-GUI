import { describe, expect, it } from 'vitest'
import {
  contextModeRequiresToolCalling,
  resolveContextWindowMode
} from './context-window-mode.js'

describe('resolveContextWindowMode', () => {
  it('defaults to summary when both flags are off or missing', () => {
    expect(resolveContextWindowMode()).toBe('summary')
    expect(resolveContextWindowMode({})).toBe('summary')
    expect(resolveContextWindowMode({ windowModeEnabled: true })).toBe('summary')
    expect(resolveContextWindowMode({
      modelInitiatedCompactionEnabled: false,
      windowModeEnabled: true
    })).toBe('summary')
  })

  it('selects model_compact when only the parent switch is on', () => {
    expect(resolveContextWindowMode({
      modelInitiatedCompactionEnabled: true
    })).toBe('model_compact')
    expect(resolveContextWindowMode({
      modelInitiatedCompactionEnabled: true,
      windowModeEnabled: false
    })).toBe('model_compact')
  })

  it('selects windows only when both switches are on', () => {
    expect(resolveContextWindowMode({
      modelInitiatedCompactionEnabled: true,
      windowModeEnabled: true
    })).toBe('windows')
  })
})

describe('contextModeRequiresToolCalling', () => {
  it('requires tools for model_compact and windows', () => {
    expect(contextModeRequiresToolCalling('summary')).toBe(false)
    expect(contextModeRequiresToolCalling('model_compact')).toBe(true)
    expect(contextModeRequiresToolCalling('windows')).toBe(true)
  })
})
