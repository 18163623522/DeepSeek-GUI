import { describe, expect, it } from 'vitest'
import { settingsPatchSchema } from './app-ipc-schemas'

describe('settings:set context compaction patch', () => {
  it('accepts turning model-initiated compression off', () => {
    const payload = settingsPatchSchema.parse({
      agents: {
        kun: {
          contextCompaction: {
            defaultsVersion: 2,
            defaultSoftThreshold: 192_000,
            defaultHardThreshold: 217_600,
            summaryMode: 'model',
            modelInitiatedCompactionEnabled: false,
            windowModeEnabled: false,
            summaryTimeoutMs: 15_000,
            summaryMaxTokens: 2_048,
            summaryInputMaxBytes: 96 * 1024
          }
        }
      }
    })
    expect(payload.agents?.kun?.contextCompaction).toMatchObject({
      modelInitiatedCompactionEnabled: false,
      windowModeEnabled: false
    })
  })

  it('accepts enabling model-initiated compression without windowed context', () => {
    const payload = settingsPatchSchema.parse({
      agents: {
        kun: {
          contextCompaction: {
            modelInitiatedCompactionEnabled: true,
            windowModeEnabled: false
          }
        }
      }
    })
    expect(payload.agents?.kun?.contextCompaction?.modelInitiatedCompactionEnabled).toBe(true)
  })
})
