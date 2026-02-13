import { createId } from '../lib/id'

export interface BaseMessage<T = unknown> {
  bid: string
  tid: string
  timestamp: number
  method: string
  data: T
  gateway?: string
}

export interface FloatingWindowData {
  psdk_index: number
  value: string
}

export interface ServiceReplyData {
  result: number
}

export type SpeakerProgressMethod =
  | 'speaker_audio_play_start_progress'
  | 'speaker_tts_play_start_progress'

export interface SpeakerPlayProgressDetail {
  percent?: number
  step_key?: string
}

export interface SpeakerPlayProgressOutput {
  md5?: string
  progress?: SpeakerPlayProgressDetail
  psdk_index?: number
  status?: string
}

export interface SpeakerPlayProgressData {
  output?: SpeakerPlayProgressOutput
  result?: number
}

export interface CommandPlayProgress {
  method: SpeakerProgressMethod
  percent?: number
  status?: string
  stepKey?: string
  updatedAt: number
}

export type SpeakerCommandMethod =
  | 'speaker_audio_play_start'
  | 'speaker_tts_play_start'
  | 'speaker_replay'
  | 'speaker_play_stop'
  | 'speaker_play_mode_set'
  | 'speaker_play_volume_set'

export type PsdkCommandMethod =
  | SpeakerCommandMethod
  | 'psdk_input_box_text_set'
  | 'psdk_widget_value_set'

export type CommandStatus = 'pending' | 'success' | 'failure' | 'timeout'

export type CommandFeedbackStatus = Exclude<CommandStatus, 'pending'>

export interface CommandFeedback {
  id: string
  tid: string
  method: PsdkCommandMethod
  status: CommandFeedbackStatus
  result?: number
  createdAt: number
}

export interface CommandLogEntry {
  bid?: string
  tid: string
  method: PsdkCommandMethod
  sentAt: number
  status: CommandStatus
  result?: number
  playProgress?: CommandPlayProgress
}

export interface CommandSequenceStep {
  id: string
  method: PsdkCommandMethod
  data: Record<string, unknown>
  summary: string
  waitMs: number
}

export type SequenceRunStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failure'
  | 'stopped'

export type SequenceStepStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'failure'
  | 'timeout'
  | 'skipped'

export interface SequenceStepResult {
  status: SequenceStepStatus
  tid?: string
  result?: number
}

export interface SpeakerFile {
  format: 'pcm'
  md5: string
  name: string
  url: string
}

export interface SpeakerTts {
  md5: string
  name: string
  text: string
}

export interface StorageCredentials {
  access_key_id: string
  access_key_secret: string
  expire: number
  security_token: string
}

export interface StorageOutput {
  bucket: string
  credentials: StorageCredentials
  endpoint: string
  object_key_prefix: string
  provider: 'ali' | 'aws' | 'minio'
  region: string
}

export interface StorageConfigReplyData {
  output: StorageOutput
  result: number
}

export interface WidgetValue {
  index: number
  value: number
}

export interface SpeakerState {
  play_file_md5: string
  play_file_name: string
  play_mode: number
  play_volume: number
  system_state: number
  work_mode: number
}

export interface PsdkStateEntry {
  psdk_index: number
  psdk_lib_version?: string
  psdk_name?: string
  psdk_sn?: string
  psdk_version?: string
  speaker?: SpeakerState
  values?: WidgetValue[]
}

export interface PsdkStatePayload {
  psdk_widget_values?: PsdkStateEntry[]
}

export interface StorageRequestMeta {
  bid?: string
  tid?: string
  gateway?: string
  timestamp?: number
}

export function buildBaseMessage<T>(
  method: string,
  data: T,
  gateway?: string,
  overrides?: Partial<Pick<BaseMessage, 'bid' | 'tid' | 'timestamp'>>
): BaseMessage<T> {
  return {
    bid: overrides?.bid ?? createId(),
    tid: overrides?.tid ?? createId(),
    timestamp: overrides?.timestamp ?? Date.now(),
    method,
    data,
    ...(gateway ? { gateway } : {})
  }
}

export function extractMethod(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const record = payload as { method?: unknown }
  return typeof record.method === 'string' ? record.method : undefined
}

const PLAY_MODE_LABELS: Record<number, string> = {
  0: 'Single Play',
  1: 'Loop Single'
}

const WORK_MODE_LABELS: Record<number, string> = {
  0: 'TTS Mode',
  1: 'Recording Broadcast'
}

const SYSTEM_STATE_LABELS: Record<number, string> = {
  0: 'Idle',
  1: 'Transferring',
  2: 'Playing',
  3: 'Error',
  4: 'TTS Converting',
  99: 'Downloading'
}

const formatUnknown = (value?: number) =>
  value === undefined || value === null ? 'Unknown' : `Unknown (${value})`

export function getPlayModeLabel(value?: number) {
  if (value === undefined || value === null) return formatUnknown(value)
  return PLAY_MODE_LABELS[value] ?? formatUnknown(value)
}

export function getWorkModeLabel(value?: number) {
  if (value === undefined || value === null) return formatUnknown(value)
  return WORK_MODE_LABELS[value] ?? formatUnknown(value)
}

export function getSystemStateLabel(value?: number) {
  if (value === undefined || value === null) return formatUnknown(value)
  return SYSTEM_STATE_LABELS[value] ?? formatUnknown(value)
}
