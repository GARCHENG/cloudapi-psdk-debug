import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import type { ReactNode } from 'react'
import { useMqtt } from './hooks/useMqtt'
import type { MqttStatus } from './hooks/useMqtt'
import { buildBaseMessage } from './types/psdk'
import type {
  CommandPlayProgress,
  CommandLogEntry,
  FloatingWindowData,
  PsdkStatePayload,
  ServiceReplyData,
  SpeakerCommandMethod,
  SpeakerPlayProgressData,
  SpeakerProgressMethod
} from './types/psdk'
import {
  buildEventsTopic,
  buildServicesReplyTopic,
  buildServicesTopic,
  buildStateTopic,
  getPlayModeLabel,
  getSystemStateLabel,
  getWorkModeLabel
} from './lib/psdk'
import { createId } from './lib/id'

const ONLINE_THRESHOLD_MS = 15000
const MAX_LOGS = 50
const DEFAULT_PSDK_INDEX = 2

const SPEAKER_METHODS: SpeakerCommandMethod[] = [
  'speaker_audio_play_start',
  'speaker_tts_play_start',
  'speaker_replay',
  'speaker_play_stop',
  'speaker_play_mode_set',
  'speaker_play_volume_set'
]

const SPEAKER_PROGRESS_METHODS: SpeakerProgressMethod[] = [
  'speaker_audio_play_start_progress',
  'speaker_tts_play_start_progress'
]

const PROGRESS_TO_COMMAND_METHOD: Record<
  SpeakerProgressMethod,
  SpeakerCommandMethod
> = {
  speaker_audio_play_start_progress: 'speaker_audio_play_start',
  speaker_tts_play_start_progress: 'speaker_tts_play_start'
}

const isSpeakerMethod = (value: string): value is SpeakerCommandMethod =>
  SPEAKER_METHODS.includes(value as SpeakerCommandMethod)

const isSpeakerProgressMethod = (value: string): value is SpeakerProgressMethod =>
  SPEAKER_PROGRESS_METHODS.includes(value as SpeakerProgressMethod)

const formatProgressLabel = (playProgress?: CommandPlayProgress) => {
  if (!playProgress) return 'N/A'

  const parts: string[] = []
  if (typeof playProgress.percent === 'number') {
    parts.push(`${playProgress.percent}%`)
  }
  if (playProgress.stepKey) {
    parts.push(playProgress.stepKey)
  }
  if (playProgress.status) {
    parts.push(playProgress.status)
  }

  if (parts.length === 0) return 'Received'
  return parts.join(' · ')
}

const formatTimestamp = (value?: number | null) => {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString()
}

const StatusBadge = ({ label, tone }: { label: string; tone: string }) => (
  <span className={`badge ${tone}`}>
    <span className="h-2 w-2 rounded-full bg-current" />
    {label}
  </span>
)

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div>
    <p className="panel-title">{subtitle}</p>
    <h2 className="panel-heading">{title}</h2>
  </div>
)

const HoverDetailRow = ({
  label,
  available,
  detail
}: {
  label: string
  available: boolean
  detail: ReactNode
}) => (
  <div className="group relative flex cursor-help items-center justify-between gap-3 rounded-lg border border-steel-700/60 bg-coal-900/55 px-3 py-2">
    <span className="text-steel-400">{label}</span>
    <span
      className={`chip shrink-0 ${
        available
          ? 'border-signal-500/70 text-signal-400'
          : 'border-steel-700/80 text-steel-400'
      }`}
    >
      {available ? 'Available' : 'No Data'}
    </span>
    <div className="pointer-events-none absolute -top-2 right-0 z-20 w-72 -translate-y-full rounded-lg border border-steel-700/80 bg-coal-950/95 p-3 text-xs text-steel-200 opacity-0 shadow-panel transition duration-150 group-hover:opacity-100">
      {detail}
    </div>
  </div>
)

const mqttStatusTone: Record<MqttStatus, string> = {
  connected: 'border-signal-500/70 bg-signal-500/15 text-signal-400',
  connecting: 'border-amber-500/70 bg-amber-500/15 text-amber-400',
  reconnecting: 'border-amber-500/70 bg-amber-500/15 text-amber-400',
  offline: 'border-steel-600/60 bg-coal-900/50 text-steel-300',
  error: 'border-warn-500/70 bg-warn-500/10 text-warn-500'
}

const onlineTone: Record<'online' | 'offline' | 'unknown', string> = {
  online: 'border-signal-500/70 bg-signal-500/15 text-signal-400',
  offline: 'border-warn-500/70 bg-warn-500/10 text-warn-500',
  unknown: 'border-steel-600/60 bg-coal-900/50 text-steel-300'
}

function App() {
  const [mqttEnabled, setMqttEnabled] = useState(false)
  const [brokerUrl, setBrokerUrl] = useState(
    import.meta.env.VITE_MQTT_URL ?? ''
  )
  const [mqttUsername, setMqttUsername] = useState(
    import.meta.env.VITE_MQTT_USERNAME ?? ''
  )
  const [mqttPassword, setMqttPassword] = useState(
    import.meta.env.VITE_MQTT_PASSWORD ?? ''
  )
  const [gatewaySn, setGatewaySn] = useState(
    import.meta.env.VITE_GATEWAY_SN ?? ''
  )
  const [deviceSn, setDeviceSn] = useState(
    import.meta.env.VITE_DEVICE_SN ?? ''
  )

  const [psdkIndex, setPsdkIndex] = useState(DEFAULT_PSDK_INDEX)
  const [audioName, setAudioName] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioMd5, setAudioMd5] = useState('')
  const [ttsName, setTtsName] = useState('')
  const [ttsText, setTtsText] = useState('')
  const [ttsMd5, setTtsMd5] = useState('')
  const [playMode, setPlayMode] = useState<0 | 1>(0)
  const [playVolume, setPlayVolume] = useState(20)

  const [floatingWindow, setFloatingWindow] = useState<{
    text: string
    psdkIndex: number
    timestamp: number
  } | null>(null)
  const [psdkState, setPsdkState] = useState<PsdkStatePayload | null>(null)
  const [psdkStateAt, setPsdkStateAt] = useState<number | null>(null)
  const [commandLogs, setCommandLogs] = useState<CommandLogEntry[]>([])
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const clientId = useMemo(() => `psdk-debug-${createId()}`, [])

  const mqttOptions = useMemo(
    () => ({
      username: mqttUsername || undefined,
      password: mqttPassword || undefined,
      clientId,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 2000
    }),
    [clientId, mqttPassword, mqttUsername]
  )

  const eventsTopic = useMemo(
    () => (gatewaySn ? buildEventsTopic(gatewaySn) : ''),
    [gatewaySn]
  )
  const servicesTopic = useMemo(
    () => (gatewaySn ? buildServicesTopic(gatewaySn) : ''),
    [gatewaySn]
  )
  const servicesReplyTopic = useMemo(
    () => (gatewaySn ? buildServicesReplyTopic(gatewaySn) : ''),
    [gatewaySn]
  )
  const stateTopic = useMemo(
    () => (deviceSn ? buildStateTopic(deviceSn) : ''),
    [deviceSn]
  )

  const updateLogFromReply = useCallback(
    (
      ids: { tid?: string; bid?: string },
      method: SpeakerCommandMethod,
      result: number,
      ts?: number
    ) => {
      setCommandLogs((prev) => {
        const nextStatus = result === 0 ? 'success' : 'failure'
        const idx = prev.findIndex(
          (entry) =>
            (ids.tid && entry.tid === ids.tid) ||
            (ids.bid && entry.bid === ids.bid)
        )

        const tid = ids.tid
        if (idx === -1) {
          if (!tid) return prev

          const entry: CommandLogEntry = {
            bid: ids.bid,
            tid,
            method,
            sentAt: ts ?? Date.now(),
            status: nextStatus,
            result
          }
          return [entry, ...prev].slice(0, MAX_LOGS)
        }
        const updated = [...prev]
        updated[idx] = { ...updated[idx], status: nextStatus, result }
        return updated
      })
    },
    []
  )

  const updateLogFromProgress = useCallback(
    (
      ids: { tid?: string; bid?: string },
      method: SpeakerProgressMethod,
      data: SpeakerPlayProgressData,
      ts?: number
    ) => {
      setCommandLogs((prev) => {
        const idx = prev.findIndex((entry) => {
          const idMatched =
            (ids.tid && entry.tid === ids.tid) ||
            (ids.bid && entry.bid === ids.bid)
          if (!idMatched) return false

          const expectedMethod = PROGRESS_TO_COMMAND_METHOD[method]
          return entry.method === expectedMethod
        })
        if (idx === -1) return prev

        const percent =
          typeof data.output?.progress?.percent === 'number'
            ? data.output.progress.percent
            : undefined
        const stepKey =
          typeof data.output?.progress?.step_key === 'string'
            ? data.output.progress.step_key
            : undefined
        const status =
          typeof data.output?.status === 'string' ? data.output.status : undefined

        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          playProgress: {
            method,
            percent,
            stepKey,
            status,
            updatedAt: ts ?? Date.now()
          }
        }

        return updated
      })
    },
    []
  )

  const handleMessage = useCallback(
    (topic: string, message: string) => {
      let payload: unknown
      try {
        payload = JSON.parse(message)
      } catch {
        return
      }

      if (!payload || typeof payload !== 'object') return
      const record = payload as {
        method?: string
        data?: unknown
        bid?: string
        tid?: string
        timestamp?: number
      }

      if (record.method === 'psdk_floating_window_text') {
        const data = record.data as FloatingWindowData | undefined
        if (data && typeof data.value === 'string') {
          const timestamp = record.timestamp ?? Date.now()
          const nextIndex =
            typeof data.psdk_index === 'number'
              ? data.psdk_index
              : Number(data.psdk_index ?? 0)
          setFloatingWindow({
            text: data.value,
            psdkIndex: Number.isFinite(nextIndex) ? nextIndex : 0,
            timestamp
          })
        }
      }

      if (stateTopic && topic === stateTopic) {
        const data = record.data as PsdkStatePayload | undefined
        if (data && Array.isArray(data.psdk_widget_values)) {
          setPsdkState(data)
          setPsdkStateAt(record.timestamp ?? Date.now())
        }
      }

      if (servicesReplyTopic && topic === servicesReplyTopic) {
        const data = record.data as ServiceReplyData | undefined
        if (
          data &&
          typeof data.result === 'number' &&
          record.method &&
          isSpeakerMethod(record.method)
        ) {
          updateLogFromReply(
            {
              tid: record.tid,
              bid: record.bid
            },
            record.method,
            data.result,
            record.timestamp
          )
        }
      }

      if (
        eventsTopic &&
        topic === eventsTopic &&
        record.method &&
        isSpeakerProgressMethod(record.method)
      ) {
        const data = record.data as SpeakerPlayProgressData | undefined
        if (data && (record.tid || record.bid)) {
          updateLogFromProgress(
            {
              tid: record.tid,
              bid: record.bid
            },
            record.method,
            data,
            record.timestamp
          )
        }
      }
    },
    [
      eventsTopic,
      servicesReplyTopic,
      stateTopic,
      updateLogFromProgress,
      updateLogFromReply
    ]
  )

  const { isConnected, status, error, subscribe, unsubscribe, publish } = useMqtt({
    brokerUrl,
    options: mqttOptions,
    enabled: mqttEnabled,
    onMessage: handleMessage
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isConnected) return
    const topics = [eventsTopic, servicesReplyTopic, stateTopic].filter(
      (topic) => topic.length > 0
    )
    topics.forEach(subscribe)
    return () => {
      topics.forEach(unsubscribe)
    }
  }, [eventsTopic, isConnected, servicesReplyTopic, stateTopic, subscribe, unsubscribe])

  useEffect(() => {
    if (!logModalOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLogModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [logModalOpen])

  const lastFloatingAt = floatingWindow?.timestamp ?? null
  const onlineState = lastFloatingAt
    ? now - lastFloatingAt <= ONLINE_THRESHOLD_MS
      ? 'online'
      : 'offline'
    : 'unknown'

  const psdkEntries = psdkState?.psdk_widget_values ?? []
  const activeEntry =
    psdkEntries.find((entry) => entry.psdk_index === psdkIndex) ??
    psdkEntries[0]

  const canConnect =
    brokerUrl.trim().length > 0 &&
    gatewaySn.trim().length > 0 &&
    deviceSn.trim().length > 0

  const connectionCollapsed = status === 'connected'
  const canSend = isConnected

  const sendCommand = useCallback(
    (method: SpeakerCommandMethod, data: Record<string, unknown>) => {
      if (!isConnected) {
        window.alert('MQTT 未连接，请先连接后再下发指令。')
        return
      }

      if (!servicesTopic) {
        window.alert('缺少 Gateway SN，无法下发指令。')
        return
      }

      const message = buildBaseMessage(method, data)
      const payload = JSON.stringify(message)
      setCommandLogs((prev) => {
        const entry: CommandLogEntry = {
          bid: message.bid,
          tid: message.tid,
          method,
          sentAt: message.timestamp,
          status: 'pending'
        }
        return [entry, ...prev].slice(0, MAX_LOGS)
      })
      publish(servicesTopic, payload)
    },
    [isConnected, publish, servicesTopic]
  )

  const handleAudioPlayStart = () => {
    sendCommand('speaker_audio_play_start', {
      psdk_index: psdkIndex,
      file: {
        format: 'pcm',
        md5: audioMd5,
        name: audioName,
        url: audioUrl
      }
    })
  }

  const handleTtsPlayStart = () => {
    sendCommand('speaker_tts_play_start', {
      psdk_index: psdkIndex,
      tts: {
        md5: ttsMd5,
        name: ttsName,
        text: ttsText
      }
    })
  }

  const handleReplay = () => {
    sendCommand('speaker_replay', { psdk_index: psdkIndex })
  }

  const handleStop = () => {
    sendCommand('speaker_play_stop', { psdk_index: psdkIndex })
  }

  const handlePlayModeSet = () => {
    sendCommand('speaker_play_mode_set', {
      psdk_index: psdkIndex,
      play_mode: playMode
    })
  }

  const handleVolumeSet = () => {
    sendCommand('speaker_play_volume_set', {
      psdk_index: psdkIndex,
      play_volume: playVolume
    })
  }

  const audioValid =
    audioName.trim().length > 0 &&
    audioUrl.trim().length > 0 &&
    audioMd5.trim().length > 0

  const ttsValid =
    ttsName.trim().length > 0 &&
    ttsText.trim().length > 0 &&
    ttsMd5.trim().length > 0

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-signal-400">
              PSDK MQTT
            </p>
            <h1 className="mt-2 text-3xl text-glow">PSDK Test Console</h1>
            <p className="mt-2 text-sm text-steel-300">
              Manual control surface for speaker workflows, floating window
              status, and command diagnostics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={`MQTT ${status}`} tone={mqttStatusTone[status]} />
            <StatusBadge
              label={`PSDK ${onlineState}`}
              tone={onlineTone[onlineState]}
            />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="panel">
            <div className="w-full">
              <SectionHeader title="Connection" subtitle="MQTT / Identity" />
            </div>

            {connectionCollapsed ? (
              <div className="mt-6 rounded-xl border border-steel-700/55 bg-coal-900/55 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={`MQTT ${status}`}
                    tone={mqttStatusTone[status]}
                  />
                  <span className="chip border-signal-500/40 text-signal-400">
                    Connection Stable
                  </span>
                  <button
                    className="btn btn-danger ml-auto"
                    onClick={() => setMqttEnabled(false)}
                    disabled={!mqttEnabled}
                  >
                    Disconnect
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-steel-500">
                      Broker
                    </p>
                    <p className="mt-1 break-all text-sm text-steel-100" title={brokerUrl}>
                      {brokerUrl}
                    </p>
                  </div>

                  <div className="rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-steel-500">
                      Gateway SN
                    </p>
                    <p className="mt-1 break-all text-sm text-steel-100" title={gatewaySn}>
                      {gatewaySn}
                    </p>
                  </div>

                  <div className="rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-steel-500">
                      Client ID
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-steel-200" title={clientId}>
                      {clientId}
                    </p>
                  </div>

                  <div className="rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-steel-500">
                      Device SN
                    </p>
                    <p className="mt-1 break-all text-sm text-steel-100" title={deviceSn}>
                      {deviceSn}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-steel-500">
                  Subscribed topics: events, state, services_reply
                </p>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Broker URL</label>
                    <input
                      className="input mt-2"
                      value={brokerUrl}
                      onChange={(event) => setBrokerUrl(event.target.value)}
                      placeholder="ws://broker/mqtt"
                    />
                  </div>
                  <div>
                    <label className="label">Gateway SN</label>
                    <input
                      className="input mt-2"
                      value={gatewaySn}
                      onChange={(event) => setGatewaySn(event.target.value)}
                      placeholder="Gateway serial"
                    />
                  </div>
                  <div>
                    <label className="label">Username</label>
                    <input
                      className="input mt-2"
                      value={mqttUsername}
                      onChange={(event) => setMqttUsername(event.target.value)}
                      placeholder="MQTT username"
                    />
                  </div>
                  <div>
                    <label className="label">Device SN</label>
                    <input
                      className="input mt-2"
                      value={deviceSn}
                      onChange={(event) => setDeviceSn(event.target.value)}
                      placeholder="Device serial"
                    />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <input
                      className="input mt-2"
                      type="password"
                      value={mqttPassword}
                      onChange={(event) => setMqttPassword(event.target.value)}
                      placeholder="MQTT password"
                    />
                  </div>
                  <div>
                    <label className="label">PSDK Index</label>
                    <input
                      className="input mt-2"
                      type="number"
                      min={0}
                      max={3}
                      step={1}
                      value={psdkIndex}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        setPsdkIndex(Number.isFinite(nextValue) ? nextValue : 0)
                      }}
                    />
                  </div>
                  <div className="flex flex-col justify-between">
                    <span className="label">Client ID</span>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="chip font-mono text-[11px] text-steel-200">
                        {clientId}
                      </span>
                      <span className="text-xs text-steel-500">
                        Auto-generated
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    className="btn btn-primary"
                    onClick={() => setMqttEnabled(true)}
                    disabled={!canConnect || mqttEnabled}
                  >
                    Connect
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => setMqttEnabled(false)}
                    disabled={!mqttEnabled}
                  >
                    Disconnect
                  </button>
                  <span className="text-xs text-steel-500">
                    Subscribed topics: events, state, services_reply
                  </span>
                </div>
              </>
            )}

            {status === 'error' && (
              <div className="mt-4 rounded-lg border border-warn-500/40 bg-warn-500/10 px-4 py-2 text-sm text-warn-500">
                MQTT connection failed: {error ?? 'Please verify broker and credentials.'}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="w-full">
              <SectionHeader title="Live Status" subtitle="Heartbeat" />
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-steel-400">MQTT Status</span>
                <span className="text-steel-100">{status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-steel-400">PSDK Online</span>
                <span className="text-steel-100">{onlineState}</span>
              </div>
              <HoverDetailRow
                label="Last Floating"
                available={Boolean(lastFloatingAt)}
                detail={
                  floatingWindow ? (
                    <div className="space-y-2">
                      <p>Updated: {formatTimestamp(lastFloatingAt)}</p>
                      <p className="break-words text-steel-300">
                        Text: {floatingWindow.text}
                      </p>
                    </div>
                  ) : (
                    'No floating window message yet.'
                  )
                }
              />
              <HoverDetailRow
                label="State Sync"
                available={Boolean(psdkStateAt)}
                detail={
                  psdkStateAt
                    ? `Last synchronized: ${formatTimestamp(psdkStateAt)}`
                    : 'No state payload received yet.'
                }
              />
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="panel">
            <SectionHeader
              title="Floating Window"
              subtitle="Latest psdk_floating_window_text"
            />
            <div className="mt-6 rounded-xl border border-steel-700/40 bg-coal-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-steel-400">
                Current Text
              </p>
              <p className="mt-3 text-lg text-steel-100">
                {floatingWindow?.text ?? 'No floating window message yet.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-steel-400">
                <span>PSDK Index: {floatingWindow?.psdkIndex ?? 'N/A'}</span>
                <span>Updated: {formatTimestamp(floatingWindow?.timestamp)}</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <SectionHeader title="PSDK State" subtitle="Device / Speaker" />
            <div className="mt-6 space-y-4 text-sm">
              {activeEntry ? (
                <>
                  <div className="rounded-xl border border-steel-700/40 bg-coal-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.2em] text-steel-400">
                        Active Payload
                      </span>
                      <span className="chip">Index {activeEntry.psdk_index}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-steel-300">
                      <span>Name: {activeEntry.psdk_name ?? 'N/A'}</span>
                      <span>SN: {activeEntry.psdk_sn ?? 'N/A'}</span>
                      <span>Version: {activeEntry.psdk_version ?? 'N/A'}</span>
                      <span>Lib: {activeEntry.psdk_lib_version ?? 'N/A'}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-steel-700/40 bg-coal-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-steel-400">
                      Speaker State
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-steel-300">
                      <span>
                        Mode: {getWorkModeLabel(activeEntry.speaker?.work_mode)}
                      </span>
                      <span>
                        Play Mode:{' '}
                        {getPlayModeLabel(activeEntry.speaker?.play_mode)}
                      </span>
                      <span>
                        System:{' '}
                        {getSystemStateLabel(activeEntry.speaker?.system_state)}
                      </span>
                      <span>Volume: {activeEntry.speaker?.play_volume ?? 'N/A'}</span>
                      <span>File: {activeEntry.speaker?.play_file_name ?? 'N/A'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-steel-700/40 bg-coal-900/40 p-4 text-sm text-steel-400">
                  No /state payload received yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="panel">
          <SectionHeader title="Speaker Control" subtitle="Commands" />
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-steel-700/40 bg-coal-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-steel-400">
                Audio Play Start
              </p>
              <div className="mt-3 grid gap-3">
                <input
                  className="input"
                  value={audioName}
                  onChange={(event) => setAudioName(event.target.value)}
                  placeholder="File name"
                />
                <input
                  className="input"
                  value={audioUrl}
                  onChange={(event) => setAudioUrl(event.target.value)}
                  placeholder="File URL (PCM)"
                />
                <input
                  className="input"
                  value={audioMd5}
                  onChange={(event) => setAudioMd5(event.target.value)}
                  placeholder="File MD5"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAudioPlayStart}
                  disabled={!canSend || !audioValid}
                >
                  Send Audio Play Start
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-steel-700/40 bg-coal-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-steel-400">
                TTS Play Start
              </p>
              <div className="mt-3 grid gap-3">
                <input
                  className="input"
                  value={ttsName}
                  onChange={(event) => setTtsName(event.target.value)}
                  placeholder="TTS name"
                />
                <textarea
                  className="textarea h-24"
                  value={ttsText}
                  onChange={(event) => setTtsText(event.target.value)}
                  placeholder="TTS text"
                />
                <input
                  className="input"
                  value={ttsMd5}
                  onChange={(event) => setTtsMd5(event.target.value)}
                  placeholder="TTS MD5"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleTtsPlayStart}
                  disabled={!canSend || !ttsValid}
                >
                  Send TTS Play Start
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-steel-700/40 bg-coal-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-steel-400">
                Playback Actions
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="btn"
                  onClick={handleReplay}
                  disabled={!canSend}
                >
                  Replay
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleStop}
                  disabled={!canSend}
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-steel-700/40 bg-coal-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-steel-400">
                Play Mode & Volume
              </p>
              <div className="mt-3 grid gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={playMode === 0}
                      onChange={() => setPlayMode(0)}
                    />
                    Single
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={playMode === 1}
                      onChange={() => setPlayMode(1)}
                    />
                    Loop
                  </label>
                  <button
                    className="btn"
                    onClick={handlePlayModeSet}
                    disabled={!canSend}
                  >
                    Apply Mode
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={playVolume}
                    onChange={(event) =>
                      setPlayVolume(Number(event.target.value))
                    }
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={playVolume}
                    onChange={(event) =>
                      setPlayVolume(Number(event.target.value))
                    }
                    className="input w-24"
                  />
                  <button
                    className="btn"
                    onClick={handleVolumeSet}
                    disabled={!canSend}
                  >
                    Apply Volume
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeader title="Command Results" subtitle="services_reply" />
            <button
              className="btn"
              onClick={() => setLogModalOpen(true)}
            >
              Log ({commandLogs.length})
            </button>
          </div>
          <p className="mt-6 text-sm text-steel-400">
            Click Log to view command history in a modal.
          </p>
        </section>

        {logModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6"
            onClick={() => setLogModalOpen(false)}
          >
            <div
              className="panel w-full max-w-6xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionHeader title="Command Results" subtitle="services_reply" />
                <button className="btn btn-danger" onClick={() => setLogModalOpen(false)}>
                  Close
                </button>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-steel-700/40">
                <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-coal-900/70 text-steel-400">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Play Progress</th>
                        <th className="px-4 py-3">Result</th>
                        <th className="px-4 py-3">TID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-steel-700/30">
                      {commandLogs.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-center text-sm text-steel-400"
                            colSpan={6}
                          >
                            No commands sent yet.
                          </td>
                        </tr>
                      ) : (
                        commandLogs.map((entry) => (
                          <tr key={entry.tid}>
                            <td className="px-4 py-3 text-steel-300">
                              {formatTimestamp(entry.sentAt)}
                            </td>
                            <td className="px-4 py-3 text-steel-100">
                              {entry.method}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`chip ${
                                  entry.status === 'success'
                                    ? 'border-signal-500/70 text-signal-400'
                                    : entry.status === 'failure'
                                    ? 'border-warn-500/70 text-warn-500'
                                    : 'border-amber-500/70 text-amber-400'
                                }`}
                              >
                                {entry.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-steel-300">
                              {formatProgressLabel(entry.playProgress)}
                            </td>
                            <td className="px-4 py-3 text-steel-300">
                              {entry.result ?? 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-steel-500">
                              {entry.tid}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
