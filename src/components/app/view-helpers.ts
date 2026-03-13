import type { MqttStatus } from '../../hooks/useMqtt'
import {
  getCommandMethodLabel,
  getProgressStatusLabel,
  getProgressStepLabel,
  getText,
} from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import type {
  CommandPlayProgress,
  CommandStatus,
  PsdkCommandMethod,
  SpeakerPlayableCommandMethod,
} from '../../types/psdk'

export type OnlineState = 'online' | 'offline' | 'unknown'

export const mqttStatusTone: Record<MqttStatus, string> = {
  connected: 'border-signal-500/70 bg-signal-500/15 text-signal-400',
  connecting: 'border-amber-500/70 bg-amber-500/15 text-amber-400',
  reconnecting: 'border-amber-500/70 bg-amber-500/15 text-amber-400',
  offline: 'border-steel-600/60 bg-coal-900/50 text-steel-300',
  error: 'border-warn-500/70 bg-warn-500/10 text-warn-500',
}

export const onlineTone: Record<OnlineState, string> = {
  online: 'border-signal-500/70 bg-signal-500/15 text-signal-400',
  offline: 'border-warn-500/70 bg-warn-500/10 text-warn-500',
  unknown: 'border-steel-600/60 bg-coal-900/50 text-steel-300',
}

export const commandStatusTone: Record<CommandStatus, string> = {
  pending: 'border-amber-500/70 text-amber-400',
  success: 'border-signal-500/70 text-signal-400',
  failure: 'border-warn-500/70 text-warn-500',
  timeout: 'border-warn-500/70 text-warn-500',
}

export const PLAY_PROGRESS_COMMAND_METHODS: SpeakerPlayableCommandMethod[] = [
  'speaker_audio_play_start',
  'speaker_tts_play_start',
]

export const isPlayProgressCommandMethod = (
  method: PsdkCommandMethod,
): method is SpeakerPlayableCommandMethod =>
  PLAY_PROGRESS_COMMAND_METHODS.includes(method as SpeakerPlayableCommandMethod)

export const formatProgressStepLabel = (
  stepKey: string | undefined,
  language: AppLanguage,
) => getProgressStepLabel(language, stepKey)

export const formatProgressStatusLabel = (
  status: string | undefined,
  language: AppLanguage,
) => getProgressStatusLabel(language, status)

export const formatProgressLabel = (
  playProgress: CommandPlayProgress | undefined,
  language: AppLanguage,
) => {
  if (!playProgress) return getText(language).common.na

  const parts: string[] = []
  if (typeof playProgress.percent === 'number') {
    parts.push(`${playProgress.percent}%`)
  }
  const stepLabel = formatProgressStepLabel(playProgress.stepKey, language)
  if (stepLabel) {
    parts.push(stepLabel)
  }
  const statusLabel = formatProgressStatusLabel(playProgress.status, language)
  if (statusLabel) {
    parts.push(statusLabel)
  }

  if (parts.length === 0) {
    return language === 'zh-CN' ? '已接收' : 'Received'
  }
  return parts.join(' · ')
}

export const formatTimestamp = (
  value: number | null | undefined,
  language: AppLanguage,
) => {
  if (!value) return getText(language).common.na

  const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US'
  return new Date(value).toLocaleString(locale)
}

export const formatShortTid = (tid: string) => {
  if (tid.length <= 16) return tid
  return `${tid.slice(0, 8)}...${tid.slice(-6)}`
}

export const resolveCommandMethodLabel = (
  method: PsdkCommandMethod,
  language: AppLanguage,
) => getCommandMethodLabel(language, method)

