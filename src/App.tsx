import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { useMqtt } from "./hooks/useMqtt";
import { createId } from "./lib/id";
import {
  buildEventsTopic,
  buildServicesReplyTopic,
  buildServicesTopic,
  buildStateTopic,
} from "./lib/psdk";
import {
  type CommandFeedback,
  type CommandFeedbackStatus,
  type CommandLogEntry,
  type FloatingWindowData,
  type PsdkCommandMethod,
  type PsdkStatePayload,
  type ServiceReplyData,
  type SpeakerCommandMethod,
  type SpeakerPlayProgressData,
  type SpeakerProgressMethod,
  buildBaseMessage,
} from "./types/psdk";
import { CommandResultsPanel } from "./components/app/CommandResultsPanel";
import { ConnectionPanel } from "./components/app/ConnectionPanel";
import { FloatingWindowPanel } from "./components/app/FloatingWindowPanel";
import { PsdkStatePanel } from "./components/app/PsdkStatePanel";
import { SpeakerControlPanel } from "./components/app/SpeakerControlPanel";
import { StatusBadge } from "./components/app/ui";
import { mqttStatusTone, onlineTone } from "./components/app/view-helpers";

const ONLINE_THRESHOLD_MS = 15000;
const MAX_LOGS = 50;
const DEFAULT_PSDK_INDEX = 2;
const DEFAULT_AUDIO_PLAY_NAME =
  import.meta.env.VITE_AUDIO_PLAY_DEFAULT_NAME ?? "";
const DEFAULT_AUDIO_PLAY_URL =
  import.meta.env.VITE_AUDIO_PLAY_DEFAULT_URL ?? "";
const DEFAULT_AUDIO_PLAY_MD5 =
  import.meta.env.VITE_AUDIO_PLAY_DEFAULT_MD5 ?? "";

const SPEAKER_METHODS: SpeakerCommandMethod[] = [
  "speaker_audio_play_start",
  "speaker_tts_play_start",
  "speaker_replay",
  "speaker_play_stop",
  "speaker_play_mode_set",
  "speaker_play_volume_set",
];

const COMMAND_METHODS: PsdkCommandMethod[] = [
  ...SPEAKER_METHODS,
  "psdk_input_box_text_set",
  "psdk_widget_value_set",
];

const SPEAKER_PROGRESS_METHODS: SpeakerProgressMethod[] = [
  "speaker_audio_play_start_progress",
  "speaker_tts_play_start_progress",
];

const PROGRESS_TO_COMMAND_METHOD: Record<
  SpeakerProgressMethod,
  SpeakerCommandMethod
> = {
  speaker_audio_play_start_progress: "speaker_audio_play_start",
  speaker_tts_play_start_progress: "speaker_tts_play_start",
};

const isCommandMethod = (value: string): value is PsdkCommandMethod =>
  COMMAND_METHODS.includes(value as PsdkCommandMethod);

const isSpeakerProgressMethod = (
  value: string,
): value is SpeakerProgressMethod =>
  SPEAKER_PROGRESS_METHODS.includes(value as SpeakerProgressMethod);

const COMMAND_FEEDBACK_TTL_MS = 6000;
const COMMAND_REPLY_TIMEOUT_MS = 10000;
const MAX_FEEDBACKS = 4;

interface PendingCommand {
  method: PsdkCommandMethod;
  sentAt: number;
}

interface TimeoutMeta {
  tid: string;
  method: PsdkCommandMethod;
}

function App() {
  const [mqttEnabled, setMqttEnabled] = useState(false);
  const [brokerUrl, setBrokerUrl] = useState(
    import.meta.env.VITE_MQTT_URL ?? "",
  );
  const [mqttUsername, setMqttUsername] = useState(
    import.meta.env.VITE_MQTT_USERNAME ?? "",
  );
  const [mqttPassword, setMqttPassword] = useState(
    import.meta.env.VITE_MQTT_PASSWORD ?? "",
  );
  const [gatewaySn, setGatewaySn] = useState(
    import.meta.env.VITE_GATEWAY_SN ?? "",
  );
  const [deviceSn, setDeviceSn] = useState(
    import.meta.env.VITE_DEVICE_SN ?? "",
  );

  const [psdkIndex, setPsdkIndex] = useState(DEFAULT_PSDK_INDEX);
  const [audioName, setAudioName] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioMd5, setAudioMd5] = useState("");
  const [ttsName, setTtsName] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [ttsMd5, setTtsMd5] = useState("");
  const [inputBoxText, setInputBoxText] = useState("");
  const [widgetIndex, setWidgetIndex] = useState(0);
  const [widgetValue, setWidgetValue] = useState(0);
  const [widgetConfigSourceType, setWidgetConfigSourceType] = useState("");
  const [playMode, setPlayMode] = useState<0 | 1>(0);
  const [playVolume, setPlayVolume] = useState(20);

  const [floatingWindow, setFloatingWindow] = useState<{
    text: string;
    psdkIndex: number;
    timestamp: number;
  } | null>(null);
  const [psdkState, setPsdkState] = useState<PsdkStatePayload | null>(null);
  const [psdkStateAt, setPsdkStateAt] = useState<number | null>(null);
  const [commandLogs, setCommandLogs] = useState<CommandLogEntry[]>([]);
  const [commandFeedbacks, setCommandFeedbacks] = useState<CommandFeedback[]>(
    [],
  );
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pendingCommandsRef = useRef<Map<string, PendingCommand>>(new Map());
  const feedbackTimerRef = useRef<Map<string, number>>(new Map());
  const commandTimeoutRef = useRef<Map<string, number>>(new Map());

  const clientId = useMemo(() => `psdk-debug-${createId()}`, []);

  const mqttOptions = useMemo(
    () => ({
      username: mqttUsername || undefined,
      password: mqttPassword || undefined,
      clientId,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 2000,
    }),
    [clientId, mqttPassword, mqttUsername],
  );

  const eventsTopic = useMemo(
    () => (gatewaySn ? buildEventsTopic(gatewaySn) : ""),
    [gatewaySn],
  );
  const servicesTopic = useMemo(
    () => (gatewaySn ? buildServicesTopic(gatewaySn) : ""),
    [gatewaySn],
  );
  const servicesReplyTopic = useMemo(
    () => (gatewaySn ? buildServicesReplyTopic(gatewaySn) : ""),
    [gatewaySn],
  );
  const stateTopic = useMemo(
    () => (deviceSn ? buildStateTopic(deviceSn) : ""),
    [deviceSn],
  );

  const removeFeedback = useCallback((id: string) => {
    const timer = feedbackTimerRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      feedbackTimerRef.current.delete(id);
    }
    setCommandFeedbacks((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCommandTimeout = useCallback((tid: string) => {
    const timeoutId = commandTimeoutRef.current.get(tid);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      commandTimeoutRef.current.delete(tid);
    }
  }, []);

  const removePendingCommand = useCallback(
    (tid: string) => {
      pendingCommandsRef.current.delete(tid);
      clearCommandTimeout(tid);
    },
    [clearCommandTimeout],
  );

  const pushFeedback = useCallback(
    (params: Pick<CommandFeedback, "tid" | "method" | "status" | "result">) => {
      const id = createId();
      const next: CommandFeedback = {
        ...params,
        id,
        createdAt: Date.now(),
      };

      setCommandFeedbacks((prev) => [next, ...prev].slice(0, MAX_FEEDBACKS));
      const timer = window.setTimeout(() => {
        removeFeedback(id);
      }, COMMAND_FEEDBACK_TTL_MS);
      feedbackTimerRef.current.set(id, timer);
    },
    [removeFeedback],
  );

  const markCommandTimeout = useCallback(
    ({ tid, method }: TimeoutMeta) => {
      const pendingCommand = pendingCommandsRef.current.get(tid);
      if (!pendingCommand) return;

      removePendingCommand(tid);

      let didTimeout = false;
      setCommandLogs((prev) => {
        const idx = prev.findIndex((entry) => entry.tid === tid);
        if (idx === -1) return prev;
        if (prev[idx].status !== "pending") return prev;

        didTimeout = true;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: "timeout",
        };
        return updated;
      });

      if (didTimeout) {
        pushFeedback({
          tid,
          method: pendingCommand.method ?? method,
          status: "timeout",
        });
      }
    },
    [pushFeedback, removePendingCommand],
  );

  useEffect(
    () => () => {
      commandTimeoutRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      commandTimeoutRef.current.clear();

      feedbackTimerRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      feedbackTimerRef.current.clear();
    },
    [],
  );

  const updateLogFromReply = useCallback(
    (
      ids: { tid?: string; bid?: string },
      method: PsdkCommandMethod,
      result: number,
      ts?: number,
    ) => {
      const nextStatus: CommandFeedbackStatus =
        result === 0 ? "success" : "failure";
      const tid = ids.tid;
      const pendingCommand = tid
        ? pendingCommandsRef.current.get(tid)
        : undefined;

      if (tid && pendingCommand) {
        removePendingCommand(tid);
      }

      setCommandLogs((prev) => {
        const idx = prev.findIndex(
          (entry) =>
            (tid && entry.tid === tid) || (ids.bid && entry.bid === ids.bid),
        );

        if (idx === -1) {
          if (!tid) return prev;

          const entry: CommandLogEntry = {
            bid: ids.bid,
            tid,
            method: pendingCommand?.method ?? method,
            sentAt: pendingCommand?.sentAt ?? ts ?? Date.now(),
            status: nextStatus,
            result,
          };
          return [entry, ...prev].slice(0, MAX_LOGS);
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], status: nextStatus, result };
        return updated;
      });

      if (tid && pendingCommand) {
        pushFeedback({
          tid,
          method: pendingCommand.method,
          status: nextStatus,
          result,
        });
      }
    },
    [pushFeedback, removePendingCommand],
  );

  const updateLogFromProgress = useCallback(
    (
      ids: { tid?: string; bid?: string },
      method: SpeakerProgressMethod,
      data: SpeakerPlayProgressData,
      ts?: number,
    ) => {
      setCommandLogs((prev) => {
        const idx = prev.findIndex((entry) => {
          const idMatched =
            (ids.tid && entry.tid === ids.tid) ||
            (ids.bid && entry.bid === ids.bid);
          if (!idMatched) return false;

          const expectedMethod = PROGRESS_TO_COMMAND_METHOD[method];
          return entry.method === expectedMethod;
        });
        if (idx === -1) return prev;

        const percent =
          typeof data.output?.progress?.percent === "number"
            ? data.output.progress.percent
            : undefined;
        const stepKey =
          typeof data.output?.progress?.step_key === "string"
            ? data.output.progress.step_key
            : undefined;
        const status =
          typeof data.output?.status === "string"
            ? data.output.status
            : undefined;

        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          playProgress: {
            method,
            percent,
            stepKey,
            status,
            updatedAt: ts ?? Date.now(),
          },
        };

        return updated;
      });
    },
    [],
  );

  const handleMessage = useCallback(
    (topic: string, message: string) => {
      let payload: unknown;
      try {
        payload = JSON.parse(message);
      } catch {
        return;
      }

      if (!payload || typeof payload !== "object") return;
      const record = payload as {
        method?: string;
        data?: unknown;
        bid?: string;
        tid?: string;
        timestamp?: number;
      };

      if (record.method === "psdk_floating_window_text") {
        const data = record.data as FloatingWindowData | undefined;
        if (data && typeof data.value === "string") {
          const timestamp = Date.now();
          const nextIndex =
            typeof data.psdk_index === "number"
              ? data.psdk_index
              : Number(data.psdk_index ?? 0);
          setFloatingWindow({
            text: data.value,
            psdkIndex: Number.isFinite(nextIndex) ? nextIndex : 0,
            timestamp,
          });
        }
      }

      if (stateTopic && topic === stateTopic) {
        const data = record.data as PsdkStatePayload | undefined;
        if (data && Array.isArray(data.psdk_widget_values)) {
          setPsdkState(data);
          setPsdkStateAt(Date.now());
        }
      }

      if (servicesReplyTopic && topic === servicesReplyTopic) {
        const data = record.data as ServiceReplyData | undefined;
        const methodFromTid = record.tid
          ? pendingCommandsRef.current.get(record.tid)?.method
          : undefined;
        const replyMethod =
          record.method && isCommandMethod(record.method)
            ? record.method
            : methodFromTid;
        if (data && typeof data.result === "number" && replyMethod) {
          updateLogFromReply(
            {
              tid: record.tid,
              bid: record.bid,
            },
            replyMethod,
            data.result,
            record.timestamp,
          );
        }
      }

      if (
        eventsTopic &&
        topic === eventsTopic &&
        record.method &&
        isSpeakerProgressMethod(record.method)
      ) {
        const data = record.data as SpeakerPlayProgressData | undefined;
        if (data && (record.tid || record.bid)) {
          updateLogFromProgress(
            {
              tid: record.tid,
              bid: record.bid,
            },
            record.method,
            data,
            record.timestamp,
          );
        }
      }
    },
    [
      eventsTopic,
      servicesReplyTopic,
      stateTopic,
      updateLogFromProgress,
      updateLogFromReply,
    ],
  );

  const { isConnected, status, error, subscribe, unsubscribe, publish } =
    useMqtt({
      brokerUrl,
      options: mqttOptions,
      enabled: mqttEnabled,
      onMessage: handleMessage,
    });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const topics = [eventsTopic, servicesReplyTopic, stateTopic].filter(
      (topic) => topic.length > 0,
    );
    topics.forEach(subscribe);
    return () => {
      topics.forEach(unsubscribe);
    };
  }, [
    eventsTopic,
    isConnected,
    servicesReplyTopic,
    stateTopic,
    subscribe,
    unsubscribe,
  ]);

  useEffect(() => {
    if (!logModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLogModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [logModalOpen]);

  const lastFloatingAt = floatingWindow?.timestamp ?? null;
  const onlineState = lastFloatingAt
    ? now - lastFloatingAt <= ONLINE_THRESHOLD_MS
      ? "online"
      : "offline"
    : "unknown";

  const psdkEntries = psdkState?.psdk_widget_values ?? [];
  const activeEntry =
    psdkEntries.find((entry) => entry.psdk_index === psdkIndex) ??
    psdkEntries[0];

  const canConnect =
    brokerUrl.trim().length > 0 &&
    gatewaySn.trim().length > 0 &&
    deviceSn.trim().length > 0;

  const connectionCollapsed = status === "connected";
  const canSend = isConnected;

  const sendCommand = useCallback(
    (method: PsdkCommandMethod, data: Record<string, unknown>) => {
      if (onlineState !== "online") {
        window.alert("PSDK 不在线，请确认设备在线后再下发指令。");
        return;
      }

      if (!isConnected) {
        window.alert("MQTT 未连接，请先连接后再下发指令。");
        return;
      }

      if (!servicesTopic) {
        window.alert("缺少 Gateway SN，无法下发指令。");
        return;
      }

      const message = buildBaseMessage(method, data);
      const payload = JSON.stringify(message);
      pendingCommandsRef.current.set(message.tid, {
        method,
        sentAt: message.timestamp,
      });

      const timeoutId = window.setTimeout(() => {
        markCommandTimeout({
          tid: message.tid,
          method,
        });
      }, COMMAND_REPLY_TIMEOUT_MS);
      commandTimeoutRef.current.set(message.tid, timeoutId);

      setCommandLogs((prev) => {
        const entry: CommandLogEntry = {
          bid: message.bid,
          tid: message.tid,
          method,
          sentAt: message.timestamp,
          status: "pending",
        };
        return [entry, ...prev].slice(0, MAX_LOGS);
      });
      publish(servicesTopic, payload);
    },
    [isConnected, markCommandTimeout, onlineState, publish, servicesTopic],
  );

  const pendingCommandSet = useMemo(() => {
    const next = new Set<PsdkCommandMethod>();
    commandLogs.forEach((entry) => {
      if (entry.status === "pending") {
        next.add(entry.method);
      }
    });
    return next;
  }, [commandLogs]);

  const pendingTotal = useMemo(
    () => commandLogs.filter((entry) => entry.status === "pending").length,
    [commandLogs],
  );
  const pendingAudioPlayStart = pendingCommandSet.has(
    "speaker_audio_play_start",
  );
  const pendingTtsPlayStart = pendingCommandSet.has("speaker_tts_play_start");
  const pendingReplay = pendingCommandSet.has("speaker_replay");
  const pendingStop = pendingCommandSet.has("speaker_play_stop");
  const pendingPlayModeSet = pendingCommandSet.has("speaker_play_mode_set");
  const pendingVolumeSet = pendingCommandSet.has("speaker_play_volume_set");
  const pendingInputBoxTextSet = pendingCommandSet.has(
    "psdk_input_box_text_set",
  );
  const pendingWidgetValueSet = pendingCommandSet.has("psdk_widget_value_set");

  const handleAudioPlayStart = () => {
    sendCommand("speaker_audio_play_start", {
      psdk_index: psdkIndex,
      file: {
        format: "pcm",
        md5: audioMd5,
        name: audioName,
        url: audioUrl,
      },
    });
  };

  const handleFillDefaultAudioPlay = () => {
    setAudioName(DEFAULT_AUDIO_PLAY_NAME);
    setAudioUrl(DEFAULT_AUDIO_PLAY_URL);
    setAudioMd5(DEFAULT_AUDIO_PLAY_MD5);
  };

  const handleTtsPlayStart = () => {
    sendCommand("speaker_tts_play_start", {
      psdk_index: psdkIndex,
      tts: {
        md5: ttsMd5,
        name: ttsName,
        text: ttsText,
      },
    });
  };

  const handleReplay = () => {
    sendCommand("speaker_replay", { psdk_index: psdkIndex });
  };

  const handleStop = () => {
    sendCommand("speaker_play_stop", { psdk_index: psdkIndex });
  };

  const handlePlayModeSet = () => {
    sendCommand("speaker_play_mode_set", {
      psdk_index: psdkIndex,
      play_mode: playMode,
    });
  };

  const handleVolumeSet = () => {
    sendCommand("speaker_play_volume_set", {
      psdk_index: psdkIndex,
      play_volume: playVolume,
    });
  };

  const handleInputBoxTextSet = () => {
    sendCommand("psdk_input_box_text_set", {
      psdk_index: psdkIndex,
      value: inputBoxText,
    });
  };

  const handleWidgetValueSet = () => {
    sendCommand("psdk_widget_value_set", {
      psdk_index: psdkIndex,
      index: widgetIndex,
      value: widgetValue,
    });
  };

  const audioValid =
    audioName.trim().length > 0 &&
    audioUrl.trim().length > 0 &&
    audioMd5.trim().length > 0;

  const ttsValid =
    ttsName.trim().length > 0 &&
    ttsText.trim().length > 0 &&
    ttsMd5.trim().length > 0;

  const inputBoxTextBytes = useMemo(
    () => new TextEncoder().encode(inputBoxText).length,
    [inputBoxText],
  );
  const inputBoxTextValid =
    inputBoxText.trim().length > 0 && inputBoxTextBytes <= 128;
  const widgetIndexValid = Number.isInteger(widgetIndex) && widgetIndex >= 0;
  const widgetValueValid = Number.isInteger(widgetValue);

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
            <StatusBadge
              label={`MQTT ${status}`}
              tone={mqttStatusTone[status]}
            />
            <StatusBadge
              label={`PSDK ${onlineState}`}
              tone={onlineTone[onlineState]}
            />
          </div>
        </header>

        <div className="grid gap-6">
          <ConnectionPanel
            status={status}
            error={error}
            connectionCollapsed={connectionCollapsed}
            mqttEnabled={mqttEnabled}
            setMqttEnabled={setMqttEnabled}
            brokerUrl={brokerUrl}
            setBrokerUrl={setBrokerUrl}
            gatewaySn={gatewaySn}
            setGatewaySn={setGatewaySn}
            mqttUsername={mqttUsername}
            setMqttUsername={setMqttUsername}
            deviceSn={deviceSn}
            setDeviceSn={setDeviceSn}
            mqttPassword={mqttPassword}
            setMqttPassword={setMqttPassword}
            psdkIndex={psdkIndex}
            setPsdkIndex={setPsdkIndex}
            clientId={clientId}
            canConnect={canConnect}
          />

          {/* <LiveStatusPanel
            status={status}
            onlineState={onlineState}
            lastFloatingAt={lastFloatingAt}
            floatingWindow={floatingWindow}
            psdkStateAt={psdkStateAt}
          /> */}
        </div>

        <div className="grid gap-6">
          <FloatingWindowPanel floatingWindow={floatingWindow} />
          <PsdkStatePanel
            activeEntry={activeEntry}
            linkedSourceType={widgetConfigSourceType}
            stateReceivedAt={psdkStateAt}
          />
        </div>

        <SpeakerControlPanel
          pendingTotal={pendingTotal}
          commandFeedbacks={commandFeedbacks}
          removeFeedback={removeFeedback}
          canSend={canSend}
          playMode={playMode}
          setPlayMode={setPlayMode}
          pendingPlayModeSet={pendingPlayModeSet}
          handlePlayModeSet={handlePlayModeSet}
          playVolume={playVolume}
          setPlayVolume={setPlayVolume}
          pendingVolumeSet={pendingVolumeSet}
          handleVolumeSet={handleVolumeSet}
          pendingReplay={pendingReplay}
          handleReplay={handleReplay}
          pendingStop={pendingStop}
          handleStop={handleStop}
          audioName={audioName}
          setAudioName={setAudioName}
          audioUrl={audioUrl}
          setAudioUrl={setAudioUrl}
          audioMd5={audioMd5}
          setAudioMd5={setAudioMd5}
          audioValid={audioValid}
          pendingAudioPlayStart={pendingAudioPlayStart}
          handleAudioPlayStart={handleAudioPlayStart}
          handleFillDefaultAudioPlay={handleFillDefaultAudioPlay}
          ttsName={ttsName}
          setTtsName={setTtsName}
          ttsText={ttsText}
          setTtsText={setTtsText}
          ttsMd5={ttsMd5}
          setTtsMd5={setTtsMd5}
          ttsValid={ttsValid}
          pendingTtsPlayStart={pendingTtsPlayStart}
          handleTtsPlayStart={handleTtsPlayStart}
          inputBoxText={inputBoxText}
          setInputBoxText={setInputBoxText}
          inputBoxTextBytes={inputBoxTextBytes}
          inputBoxTextValid={inputBoxTextValid}
          pendingInputBoxTextSet={pendingInputBoxTextSet}
          handleInputBoxTextSet={handleInputBoxTextSet}
          widgetIndex={widgetIndex}
          setWidgetIndex={setWidgetIndex}
          widgetValue={widgetValue}
          setWidgetValue={setWidgetValue}
          widgetIndexValid={widgetIndexValid}
          widgetValueValid={widgetValueValid}
          pendingWidgetValueSet={pendingWidgetValueSet}
          handleWidgetValueSet={handleWidgetValueSet}
          widgetConfigSourceType={widgetConfigSourceType}
          setWidgetConfigSourceType={setWidgetConfigSourceType}
        />

        <CommandResultsPanel
          commandLogs={commandLogs}
          logModalOpen={logModalOpen}
          setLogModalOpen={setLogModalOpen}
        />

        <footer className="pt-2 text-center text-xs text-steel-500">
          Created by <span className="text-steel-300">GARCHENG</span> · Powered
          by <span className="text-steel-300">Codex</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
