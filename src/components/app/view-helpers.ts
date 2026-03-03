import type { MqttStatus } from '../../hooks/useMqtt'
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

export const COMMAND_METHOD_LABELS: Record<PsdkCommandMethod, string> = {
  speaker_audio_play_start: 'Audio Play Start',
  speaker_tts_play_start: 'TTS Play Start',
  speaker_replay: 'Replay',
  speaker_play_stop: 'Stop',
  speaker_play_mode_set: 'Play Mode Set',
  speaker_play_volume_set: 'Play Volume Set',
  psdk_input_box_text_set: 'Input Box Text Set',
  psdk_widget_value_set: 'Widget Value Set',
}

export const PLAY_PROGRESS_COMMAND_METHODS: SpeakerPlayableCommandMethod[] = [
  'speaker_audio_play_start',
  'speaker_tts_play_start',
]

const PLAY_PROGRESS_STEP_LABELS: Record<string, string> = {
  download: 'Download',
  downloading: 'Downloading',
  prepare: 'Prepare',
  preparing: 'Preparing',
  upload: 'Upload',
  uploading: 'Uploading',
  play: 'Play',
  playing: 'Playing',
  complete: 'Complete',
  completed: 'Completed',
  finish: 'Finish',
  finished: 'Finished',
}

const PLAY_PROGRESS_STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  pending: 'Pending',
  running: 'Running',
  success: 'Success',
  failure: 'Failure',
  failed: 'Failed',
  timeout: 'Timeout',
  done: 'Done',
  completed: 'Completed',
}

const normalizeProgressToken = (value?: string) => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

const toReadableText = (value?: string) => {
  if (!value) return undefined
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const isPlayProgressCommandMethod = (
  method: PsdkCommandMethod,
): method is SpeakerPlayableCommandMethod =>
  PLAY_PROGRESS_COMMAND_METHODS.includes(method as SpeakerPlayableCommandMethod)

export const formatProgressStepLabel = (stepKey?: string) => {
  const normalized = normalizeProgressToken(stepKey)
  if (!normalized) return undefined
  return PLAY_PROGRESS_STEP_LABELS[normalized] ?? toReadableText(stepKey)
}

export const formatProgressStatusLabel = (status?: string) => {
  const normalized = normalizeProgressToken(status)
  if (!normalized) return undefined
  return PLAY_PROGRESS_STATUS_LABELS[normalized] ?? toReadableText(status)
}

export const formatProgressLabel = (playProgress?: CommandPlayProgress) => {
  if (!playProgress) return 'N/A'

  const parts: string[] = []
  if (typeof playProgress.percent === 'number') {
    parts.push(`${playProgress.percent}%`)
  }
  const stepLabel = formatProgressStepLabel(playProgress.stepKey)
  if (stepLabel) {
    parts.push(stepLabel)
  }
  const statusLabel = formatProgressStatusLabel(playProgress.status)
  if (statusLabel) {
    parts.push(statusLabel)
  }

  if (parts.length === 0) return 'Received'
  return parts.join(' · ')
}

export const formatTimestamp = (value?: number | null) => {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString()
}

export const formatShortTid = (tid: string) => {
  if (tid.length <= 16) return tid
  return `${tid.slice(0, 8)}...${tid.slice(-6)}`
}
