import { createContext, useContext, type ComponentProps } from 'react'
import type { WriteAssistantPanel } from './WriteAssistantPanel'

/**
 * The Work assistant's full prop set (composer state, model routing, send,
 * interrupt, attachments). The workbench provides the exact object it hands
 * to the right assistant rail, so a center "stage" (the paper Agent research
 * view) can host the same conversation while the rail steps aside.
 */
export type WriteAssistantStageProps = Omit<ComponentProps<typeof WriteAssistantPanel>, 'className'>

export const WriteAssistantStageContext = createContext<WriteAssistantStageProps | null>(null)

export function useWriteAssistantStage(): WriteAssistantStageProps | null {
  return useContext(WriteAssistantStageContext)
}
