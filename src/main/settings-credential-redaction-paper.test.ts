import { describe, expect, it } from 'vitest'
import type { AppSettingsPatch, AppSettingsV1 } from '../shared/app-settings'
import { normalizeWritePaperModeSettings } from '../shared/app-settings-paper-mode'
import { preserveRedactedProviderCredentials } from './settings-credential-redaction'

function withSearchKeys(): AppSettingsV1 {
  return {
    write: {
      paperMode: normalizeWritePaperModeSettings({
        search: { semanticScholarApiKey: 's2-secret', coreApiKey: 'core-secret' }
      })
    }
  } as unknown as AppSettingsV1
}

function searchPatch(search: Record<string, unknown>): AppSettingsPatch {
  return { write: { paperMode: { search } } } as unknown as AppSettingsPatch
}

function searchOf(patch: AppSettingsPatch): Record<string, unknown> {
  return (patch.write as { paperMode: { search: Record<string, unknown> } }).paperMode.search
}

describe('paper search credential round-trip', () => {
  it('keeps stored keys when the redacted projection sends empty values', () => {
    const next = preserveRedactedProviderCredentials(
      withSearchKeys(),
      searchPatch({ semanticScholarApiKey: '', coreApiKey: '', openAlexMailto: 'me@example.org' })
    )
    expect(searchOf(next)).toMatchObject({ semanticScholarApiKey: 's2-secret', coreApiKey: 'core-secret' })
  })

  it('clears only the keys named in clearCredentials and never persists the marker', () => {
    const next = preserveRedactedProviderCredentials(
      withSearchKeys(),
      searchPatch({ semanticScholarApiKey: '', coreApiKey: '', clearCredentials: ['coreApiKey'] })
    )
    expect(searchOf(next)).toEqual({ semanticScholarApiKey: 's2-secret', coreApiKey: '' })
  })

  it('folds the legacy scholar key into the single search key', () => {
    const mode = normalizeWritePaperModeSettings({ scholar: { semanticScholarApiKey: 'legacy-key' } })
    expect(mode.search.semanticScholarApiKey).toBe('legacy-key')
    expect(mode.scholar.semanticScholarApiKey).toBe('')
  })
})
