import type { ReactElement } from 'react'
import {
  InlineNoticeView,
  SettingRow,
  SettingsCard,
  Toggle
} from './settings-controls'

type Translate = (key: string) => string

export function ContextWindowSettingsPanel({
  t,
  modelInitiatedCompactionEnabled,
  windowModeEnabled,
  onModelInitiatedChange,
  onWindowModeChange
}: {
  t: Translate
  modelInitiatedCompactionEnabled: boolean
  windowModeEnabled: boolean
  onModelInitiatedChange: (enabled: boolean) => void
  onWindowModeChange: (windowModeEnabled: boolean) => void
}): ReactElement {
  return (
    <div className="mt-6">
      <SettingsCard title={t('labContextCompressionTitle')}>
        <div className="space-y-3 px-3 py-4">
          <InlineNoticeView notice={{
            tone: 'info',
            message: t('labContextCompressionDescription')
          }} />
        </div>
        <SettingRow
          title={t('labModelInitiatedCompactionEnabled')}
          description={t('labModelInitiatedCompactionEnabledDesc')}
          control={
            <Toggle
              checked={modelInitiatedCompactionEnabled}
              onChange={onModelInitiatedChange}
              ariaLabel={t('labModelInitiatedCompactionEnabled')}
            />
          }
        />
        <SettingRow
          title={t('labContextWindowEnabled')}
          description={t('labContextWindowEnabledDesc')}
          control={
            <Toggle
              checked={windowModeEnabled}
              onChange={onWindowModeChange}
              disabled={!modelInitiatedCompactionEnabled}
              ariaLabel={t('labContextWindowEnabled')}
            />
          }
        />
      </SettingsCard>
    </div>
  )
}
