import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { useMqtt } from "./hooks/useMqtt";
import { createId } from "./lib/id";
import {
  createMd5RequiredSpeakerAudioValidation,
  createRequiredSpeakerAudioValidation,
  createRevalidationRequiredSpeakerAudioValidation,
  createValidatingSpeakerAudioValidation,
  type SpeakerAudioPlayStartValidationSnapshot,
  type SpeakerAudioPlayStartValidationResult,
  validateSpeakerAudioPlayStartManual,
} from "./lib/speakerAudioPlayStartValidation";
import {
  buildEventsTopic,
  buildServicesReplyTopic,
  buildServicesTopic,
  buildStateTopic,
} from "./lib/psdk";
import {
  type ActivePlayProgress,
  type CommandFeedback,
  type CommandFeedbackStatus,
  type CommandLogEntry,
  type CommandPlayProgress,
  type CommandSequenceStep,
  type FloatingWindowData,
  type PsdkCommandMethod,
  type PsdkStatePayload,
  type SequenceRunStatus,
  type SequenceStepResult,
  type SequenceStepStatus,
  type ServiceReplyData,
  type SpeakerCommandMethod,
  type SpeakerPlayProgressData,
  type SpeakerPlayableCommandMethod,
  type SpeakerProgressMethod,
  buildBaseMessage,
} from "./types/psdk";
import {
  REQUIRED_DESKTOP_CONFIG_FIELDS,
  type DesktopConfigPayload,
  type DesktopConfigSource,
  type RequiredDesktopConfigField,
} from "./types/desktop";
import { CommandResultsPanel } from "./components/app/CommandResultsPanel";
import { CommandSequencePanel } from "./components/app/CommandSequencePanel";
import { ConnectionPanel } from "./components/app/ConnectionPanel";
import { FloatingWindowPanel } from "./components/app/FloatingWindowPanel";
import { PlayProgressPopup } from "./components/app/PlayProgressPopup";
import { PsdkStatePanel } from "./components/app/PsdkStatePanel";
import { SpeakerControlPanel } from "./components/app/SpeakerControlPanel";
import { StatusBadge } from "./components/app/ui";
import { formatShortTid, mqttStatusTone, onlineTone } from "./components/app/view-helpers";

const ONLINE_THRESHOLD_MS = 15000;
const MAX_LOGS = 50;
const DEFAULT_PSDK_INDEX = 2;
const DEFAULT_AUDIO_PLAY_NAME =
  import.meta.env.VITE_AUDIO_PLAY_DEFAULT_NAME ?? "";
const DEFAULT_AUDIO_PLAY_URL =
  import.meta.env.VITE_AUDIO_PLAY_DEFAULT_URL ?? "";
const DEFAULT_AUDIO_PLAY_MD5 =
  import.meta.env.VITE_AUDIO_PLAY_DEFAULT_MD5 ?? "";
const DESKTOP_REQUIRED_FIELD_LABELS: Record<RequiredDesktopConfigField, string> =
  {
    brokerUrl: "Broker URL",
    gatewaySn: "Gateway SN",
    deviceSn: "Device SN",
  };

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
  SpeakerPlayableCommandMethod
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

interface ProgressMessageIds {
  tid?: string;
  bid?: string;
}

const normalizeMessageId = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const isValidPercent = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampPercent = (value?: number) => {
  if (!isValidPercent(value)) return undefined;
  return Math.max(0, Math.min(100, value));
};

const resolveProgressLogIndex = (
  logs: CommandLogEntry[],
  ids: ProgressMessageIds,
  method: SpeakerProgressMethod,
) => {
  const expectedMethod = PROGRESS_TO_COMMAND_METHOD[method];
  const hasTid = typeof ids.tid === "string" && ids.tid.length > 0;
  const hasBid = typeof ids.bid === "string" && ids.bid.length > 0;

  if (hasTid) {
    return logs.findIndex((entry) => {
      if (entry.method !== expectedMethod || entry.tid !== ids.tid) {
        return false;
      }
      if (!hasBid) {
        return true;
      }
      return entry.bid === ids.bid;
    });
  }

  if (hasBid) {
    return logs.findIndex(
      (entry) => entry.method === expectedMethod && entry.bid === ids.bid,
    );
  }

  return -1;
};

const buildCommandProgress = (
  method: SpeakerProgressMethod,
  data: SpeakerPlayProgressData,
  updatedAt: number,
): CommandPlayProgress => {
  const progress = data.output?.progress;
  const rawPercent = progress?.percent;
  const rawStepKey = progress?.step_key;
  const rawStatus = data.output?.status;
  const rawPsdkIndex = data.output?.psdk_index;
  const rawMd5 = data.output?.md5;

  return {
    method,
    commandMethod: PROGRESS_TO_COMMAND_METHOD[method],
    percent: clampPercent(rawPercent),
    stepKey: typeof rawStepKey === "string" ? rawStepKey : undefined,
    status: typeof rawStatus === "string" ? rawStatus : undefined,
    psdkIndex: typeof rawPsdkIndex === "number" ? rawPsdkIndex : undefined,
    md5: typeof rawMd5 === "string" ? rawMd5 : undefined,
    updatedAt,
  };
};

const COMMAND_FEEDBACK_TTL_MS = 6000;
const COMMAND_REPLY_TIMEOUT_MS = 10000;
const MAX_FEEDBACKS = 4;
const DEFAULT_SEQUENCE_WAIT_MS = 3000;

interface PendingCommand {
  method: PsdkCommandMethod;
  sentAt: number;
}

interface TimeoutMeta {
  tid: string;
  method: PsdkCommandMethod;
}

type CommandAwaiter = (result: SequenceStepResult) => void;

interface SequenceWaitState {
  index: number;
  remainingMs: number;
  totalMs: number;
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
  const [desktopConfigSource, setDesktopConfigSource] =
    useState<DesktopConfigSource | null>(null);
  const [desktopConfigMessage, setDesktopConfigMessage] = useState<
    string | null
  >(null);
  const isDesktopRuntime = useMemo(
    () => typeof window.desktop !== "undefined",
    [],
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
  const [sequenceSteps, setSequenceSteps] = useState<CommandSequenceStep[]>([]);
  const [sequenceResults, setSequenceResults] = useState<SequenceStepResult[]>([]);
  const [sequenceStatus, setSequenceStatus] =
    useState<SequenceRunStatus>("idle");
  const [sequenceActiveIndex, setSequenceActiveIndex] = useState<number | null>(
    null,
  );
  const [sequenceError, setSequenceError] = useState<string | null>(null);
  const [sequenceDefaultWaitSeconds, setSequenceDefaultWaitSeconds] = useState(
    DEFAULT_SEQUENCE_WAIT_MS / 1000,
  );
  const [sequenceWait, setSequenceWait] = useState<SequenceWaitState | null>(
    null,
  );
  const [audioValidation, setAudioValidation] =
    useState<SpeakerAudioPlayStartValidationResult>(
      createRequiredSpeakerAudioValidation,
    );
  const [audioValidationSnapshot, setAudioValidationSnapshot] =
    useState<SpeakerAudioPlayStartValidationSnapshot | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [activePlayProgress, setActivePlayProgress] =
    useState<ActivePlayProgress | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pendingCommandsRef = useRef<Map<string, PendingCommand>>(new Map());
  const feedbackTimerRef = useRef<Map<string, number>>(new Map());
  const commandTimeoutRef = useRef<Map<string, number>>(new Map());
  const commandAwaitersRef = useRef<Map<string, CommandAwaiter>>(new Map());
  const sequenceRunIdRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);
  const audioValidationRequestRef = useRef(0);

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

  useEffect(() => {
    if (!isDesktopRuntime || !window.desktop) return;

    let isMounted = true;
    const loadDesktopConfig = async () => {
      const result = await window.desktop!.readConfig();
      if (!isMounted) return;

      setDesktopConfigSource(result.source);
      setDesktopConfigMessage(result.ok ? null : result.message ?? null);
      setBrokerUrl(result.config.brokerUrl);
      setMqttUsername(result.config.mqttUsername);
      setMqttPassword(result.config.mqttPassword);
      setGatewaySn(result.config.gatewaySn);
      setDeviceSn(result.config.deviceSn);
    };

    void loadDesktopConfig();

    return () => {
      isMounted = false;
    };
  }, [isDesktopRuntime]);

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

  const resolveAwaiter = useCallback(
    (tid: string, result: SequenceStepResult) => {
      const awaiter = commandAwaitersRef.current.get(tid);
      if (!awaiter) return;
      commandAwaitersRef.current.delete(tid);
      awaiter(result);
    },
    [],
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

      setCommandLogs((prev) => {
        const idx = prev.findIndex((entry) => entry.tid === tid);
        if (idx === -1) return prev;
        if (prev[idx].status !== "pending") return prev;

        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: "timeout",
        };
        return updated;
      });

      pushFeedback({
        tid,
        method: pendingCommand.method ?? method,
        status: "timeout",
      });
      resolveAwaiter(tid, { status: "timeout", tid });
    },
    [pushFeedback, removePendingCommand, resolveAwaiter],
  );

  useEffect(
    () => () => {
      commandTimeoutRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      commandTimeoutRef.current.clear();
      commandAwaitersRef.current.clear();

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

      if (tid) {
        resolveAwaiter(tid, { status: nextStatus, result, tid });
      }

      if (tid && pendingCommand) {
        pushFeedback({
          tid,
          method: pendingCommand.method,
          status: nextStatus,
          result,
        });
      }
    },
    [pushFeedback, removePendingCommand, resolveAwaiter],
  );

  const updateLogFromProgress = useCallback(
    (
      ids: ProgressMessageIds,
      method: SpeakerProgressMethod,
      data: SpeakerPlayProgressData,
      ts?: number,
    ) => {
      const updatedAt = typeof ts === "number" ? ts : Date.now();
      const nextProgress = buildCommandProgress(method, data, updatedAt);
      let nextActiveProgress: ActivePlayProgress | null = null;
      const popupTid = ids.tid ?? ids.bid;

      setCommandLogs((prev) => {
        const idx = resolveProgressLogIndex(prev, ids, method);
        if (idx === -1) return prev;

        const entry = prev[idx];
        const currentUpdatedAt = entry.playProgress?.updatedAt;
        if (
          typeof currentUpdatedAt === "number" &&
          nextProgress.updatedAt < currentUpdatedAt
        ) {
          return prev;
        }

        const updatedEntry: CommandLogEntry = {
          ...entry,
          playProgress: nextProgress,
        };
        nextActiveProgress = {
          commandMethod: nextProgress.commandMethod,
          tid: updatedEntry.tid,
          bid: updatedEntry.bid,
          shortTid: formatShortTid(updatedEntry.tid),
          progress: nextProgress,
        };
        const updated = [...prev];
        updated[idx] = updatedEntry;

        return updated;
      });

      if (!nextActiveProgress && popupTid) {
        nextActiveProgress = {
          commandMethod: nextProgress.commandMethod,
          tid: popupTid,
          bid: ids.bid,
          shortTid: formatShortTid(popupTid),
          progress: nextProgress,
        };
      }

      if (nextActiveProgress) {
        setActivePlayProgress(nextActiveProgress);
      }
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
        bid?: unknown;
        tid?: unknown;
        timestamp?: number;
      };
      const messageIds: ProgressMessageIds = {
        tid: normalizeMessageId(record.tid),
        bid: normalizeMessageId(record.bid),
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
        const methodFromTid = messageIds.tid
          ? pendingCommandsRef.current.get(messageIds.tid)?.method
          : undefined;
        const replyMethod =
          record.method && isCommandMethod(record.method)
            ? record.method
            : methodFromTid;
        if (data && typeof data.result === "number" && replyMethod) {
          updateLogFromReply(
            {
              tid: messageIds.tid,
              bid: messageIds.bid,
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
        if (data && (messageIds.tid || messageIds.bid)) {
          updateLogFromProgress(
            {
              tid: messageIds.tid,
              bid: messageIds.bid,
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

  const closePlayProgress = useCallback(() => {
    setActivePlayProgress(null);
  }, []);

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

  const missingDesktopRequiredFields = useMemo(() => {
    const currentConfig: DesktopConfigPayload = {
      brokerUrl,
      gatewaySn,
      deviceSn,
    };

    return REQUIRED_DESKTOP_CONFIG_FIELDS.filter(
      (field) => currentConfig[field]?.trim().length === 0,
    );
  }, [brokerUrl, deviceSn, gatewaySn]);

  const desktopConfigHint = useMemo(() => {
    if (!isDesktopRuntime) return null;

    if (missingDesktopRequiredFields.length > 0) {
      const labels = missingDesktopRequiredFields
        .map((field) => DESKTOP_REQUIRED_FIELD_LABELS[field])
        .join(", ");
      return `Desktop config incomplete. Please fill: ${labels}.`;
    }

    if (desktopConfigMessage) {
      return desktopConfigMessage;
    }

    if (desktopConfigSource === "local") {
      return "Desktop config source: local file.";
    }

    if (desktopConfigSource === "env") {
      return "Desktop config source: .env defaults.";
    }

    return "Desktop config source: renderer input (not saved yet).";
  }, [
    desktopConfigMessage,
    desktopConfigSource,
    isDesktopRuntime,
    missingDesktopRequiredFields,
  ]);

  const handleConnect = useCallback(async () => {
    if (
      isDesktopRuntime &&
      missingDesktopRequiredFields.length > 0
    ) {
      const labels = missingDesktopRequiredFields
        .map((field) => DESKTOP_REQUIRED_FIELD_LABELS[field])
        .join(", ");
      setDesktopConfigMessage(
        `Desktop config incomplete. Missing: ${labels}.`,
      );
      setMqttEnabled(false);
      return;
    }

    if (isDesktopRuntime && window.desktop) {
      const saveResult = await window.desktop.saveConfig({
        brokerUrl,
        mqttUsername,
        mqttPassword,
        gatewaySn,
        deviceSn,
      });
      if (!saveResult.ok) {
        setDesktopConfigMessage(
          saveResult.message ?? "Failed to persist desktop config.",
        );
        setMqttEnabled(false);
        return;
      }
      setDesktopConfigSource("local");
      setDesktopConfigMessage(null);
    }

    setMqttEnabled(true);
  }, [
    brokerUrl,
    deviceSn,
    gatewaySn,
    isDesktopRuntime,
    missingDesktopRequiredFields,
    mqttPassword,
    mqttUsername,
  ]);

  const canConnect =
    brokerUrl.trim().length > 0 &&
    gatewaySn.trim().length > 0 &&
    deviceSn.trim().length > 0;

  const connectionCollapsed = status === "connected";
  const sequenceRunning = sequenceStatus === "running";
  const canSend = isConnected && !sequenceRunning;

  const dispatchCommand = useCallback(
    (
      method: PsdkCommandMethod,
      data: Record<string, unknown>,
      options?: {
        skipChecks?: boolean;
        onBeforePublish?: (tid: string) => void;
      },
    ) => {
      const skipChecks = options?.skipChecks ?? false;

      if (!skipChecks) {
        if (sequenceRunning) {
          window.alert(
            "Sequence running. Please wait for it to finish before sending manual commands.",
          );
          return null;
        }
        if (onlineState !== "online") {
          window.alert(
            "PSDK is offline. Please confirm the device is online before sending commands.",
          );
          return null;
        }

        if (!isConnected) {
          window.alert("MQTT not connected. Please connect before sending.");
          return null;
        }
      }

      if (!servicesTopic) {
        if (!skipChecks) {
          window.alert("Missing Gateway SN. Unable to send commands.");
        }
        return null;
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

      options?.onBeforePublish?.(message.tid);
      publish(servicesTopic, payload);
      return message.tid;
    },
    [
      isConnected,
      markCommandTimeout,
      onlineState,
      publish,
      sequenceRunning,
      servicesTopic,
    ],
  );

  const sendCommand = useCallback(
    (method: PsdkCommandMethod, data: Record<string, unknown>) => {
      dispatchCommand(method, data);
    },
    [dispatchCommand],
  );

  const sendCommandWithAck = useCallback(
    (method: PsdkCommandMethod, data: Record<string, unknown>) =>
      new Promise<SequenceStepResult>((resolve) => {
        const tid = dispatchCommand(method, data, {
          skipChecks: true,
          onBeforePublish: (nextTid) => {
            commandAwaitersRef.current.set(nextTid, resolve);
          },
        });
        if (!tid) {
          resolve({ status: "failure" });
        }
      }),
    [dispatchCommand],
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

  const resetAudioValidationForInputChange = useCallback(
    (nextUrl: string, nextMd5: string) => {
      audioValidationRequestRef.current += 1;
      const normalizedUrl = nextUrl.trim();
      const normalizedMd5 = nextMd5.trim();

      if (!normalizedUrl) {
        setAudioValidation(createRequiredSpeakerAudioValidation());
      } else if (!normalizedMd5) {
        setAudioValidation(createMd5RequiredSpeakerAudioValidation(normalizedUrl));
      } else {
        setAudioValidation(
          createRevalidationRequiredSpeakerAudioValidation(
            normalizedUrl,
            normalizedMd5,
          ),
        );
      }

      setAudioValidationSnapshot(null);
    },
    [],
  );

  const handleAudioUrlChange = useCallback((value: string) => {
    setAudioUrl(value);
    resetAudioValidationForInputChange(value, audioMd5);
  }, [audioMd5, resetAudioValidationForInputChange]);

  const handleAudioMd5Change = useCallback((value: string) => {
    setAudioMd5(value);
    resetAudioValidationForInputChange(audioUrl, value);
  }, [audioUrl, resetAudioValidationForInputChange]);

  const handleValidateAudioPlayStart = useCallback(async () => {
    const normalizedUrl = audioUrl.trim();
    const normalizedMd5 = audioMd5.trim();
    const requestId = audioValidationRequestRef.current + 1;
    audioValidationRequestRef.current = requestId;

    if (!normalizedUrl) {
      const required = createRequiredSpeakerAudioValidation();
      if (audioValidationRequestRef.current === requestId) {
        setAudioValidation(required);
        setAudioValidationSnapshot(null);
      }
      return required;
    }

    if (!normalizedMd5) {
      const md5Required = createMd5RequiredSpeakerAudioValidation(normalizedUrl);
      if (audioValidationRequestRef.current === requestId) {
        setAudioValidation(md5Required);
        setAudioValidationSnapshot(null);
      }
      return md5Required;
    }

    setAudioValidation(
      createValidatingSpeakerAudioValidation(normalizedUrl, normalizedMd5),
    );

    const result = await validateSpeakerAudioPlayStartManual(
      normalizedUrl,
      normalizedMd5,
    );
    if (audioValidationRequestRef.current === requestId) {
      setAudioValidation(result);
      setAudioValidationSnapshot(
        result.status === "valid" && result.snapshot ? result.snapshot : null,
      );
    }

    return result;
  }, [audioMd5, audioUrl]);

  const handleAudioPlayStart = () => {
    const normalizedName = audioName.trim();
    const normalizedUrl = audioUrl.trim();
    const normalizedMd5 = audioMd5.trim();

    if (!normalizedName || !normalizedUrl || !normalizedMd5) {
      window.alert("Audio name, URL, and MD5 are required.");
      return;
    }

    if (!audioValid) {
      window.alert("Please click Validate Audio and wait for a successful result before sending.");
      return;
    }

    sendCommand("speaker_audio_play_start", {
      psdk_index: psdkIndex,
      file: {
        format: "pcm",
        md5: normalizedMd5,
        name: normalizedName,
        url: normalizedUrl,
      },
    });
  };

  const handleFillDefaultAudioPlay = () => {
    setAudioName(DEFAULT_AUDIO_PLAY_NAME);
    setAudioUrl(DEFAULT_AUDIO_PLAY_URL);
    setAudioMd5(DEFAULT_AUDIO_PLAY_MD5);
    resetAudioValidationForInputChange(
      DEFAULT_AUDIO_PLAY_URL,
      DEFAULT_AUDIO_PLAY_MD5,
    );
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

  const canValidateAudio =
    audioName.trim().length > 0 &&
    audioUrl.trim().length > 0 &&
    audioMd5.trim().length > 0;
  const pendingAudioValidation = audioValidation.status === "validating";

  const audioValid =
    audioName.trim().length > 0 &&
    audioUrl.trim().length > 0 &&
    audioMd5.trim().length > 0 &&
    audioValidation.status === "valid" &&
    audioValidationSnapshot !== null;

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

  const formatSummaryValue = useCallback((value: string, max = 24) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return "N/A";
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max)}...`;
  }, []);

  const buildStepData = useCallback(
    (method: PsdkCommandMethod) => {
      switch (method) {
        case "speaker_audio_play_start":
          if (!audioValid) return null;
          return {
            psdk_index: psdkIndex,
            file: {
              format: "pcm",
              md5: audioMd5,
              name: audioName,
              url: audioUrl,
            },
          };
        case "speaker_tts_play_start":
          if (!ttsValid) return null;
          return {
            psdk_index: psdkIndex,
            tts: {
              md5: ttsMd5,
              name: ttsName,
              text: ttsText,
            },
          };
        case "speaker_replay":
          return { psdk_index: psdkIndex };
        case "speaker_play_stop":
          return { psdk_index: psdkIndex };
        case "speaker_play_mode_set":
          return {
            psdk_index: psdkIndex,
            play_mode: playMode,
          };
        case "speaker_play_volume_set":
          return {
            psdk_index: psdkIndex,
            play_volume: playVolume,
          };
        case "psdk_input_box_text_set":
          if (!inputBoxTextValid) return null;
          return {
            psdk_index: psdkIndex,
            value: inputBoxText,
          };
        case "psdk_widget_value_set":
          if (!widgetIndexValid || !widgetValueValid) return null;
          return {
            psdk_index: psdkIndex,
            index: widgetIndex,
            value: widgetValue,
          };
        default:
          return null;
      }
    },
    [
      audioMd5,
      audioName,
      audioUrl,
      audioValid,
      inputBoxText,
      inputBoxTextValid,
      playMode,
      playVolume,
      psdkIndex,
      ttsMd5,
      ttsName,
      ttsText,
      ttsValid,
      widgetIndex,
      widgetIndexValid,
      widgetValue,
      widgetValueValid,
    ],
  );

  const buildStepSummary = useCallback(
    (method: PsdkCommandMethod, data: Record<string, unknown>) => {
      switch (method) {
        case "speaker_audio_play_start": {
          const payload = data as {
            psdk_index?: number;
            file?: { name?: string; url?: string; md5?: string };
          };
          const name = payload.file?.name ?? "";
          const url = payload.file?.url ?? "";
          const md5 = payload.file?.md5 ?? "";
          return `psdk=${payload.psdk_index ?? "N/A"} | name=${formatSummaryValue(
            name,
            18,
          )} | url=${formatSummaryValue(url, 20)} | md5=${formatSummaryValue(
            md5,
            12,
          )}`;
        }
        case "speaker_tts_play_start": {
          const payload = data as {
            psdk_index?: number;
            tts?: { name?: string; text?: string; md5?: string };
          };
          const name = payload.tts?.name ?? "";
          const text = payload.tts?.text ?? "";
          const md5 = payload.tts?.md5 ?? "";
          return `psdk=${payload.psdk_index ?? "N/A"} | name=${formatSummaryValue(
            name,
            18,
          )} | text=${formatSummaryValue(text, 20)} | md5=${formatSummaryValue(
            md5,
            12,
          )}`;
        }
        case "speaker_replay": {
          const payload = data as { psdk_index?: number };
          return `psdk=${payload.psdk_index ?? "N/A"}`;
        }
        case "speaker_play_stop": {
          const payload = data as { psdk_index?: number };
          return `psdk=${payload.psdk_index ?? "N/A"}`;
        }
        case "speaker_play_mode_set": {
          const payload = data as { psdk_index?: number; play_mode?: number };
          return `psdk=${payload.psdk_index ?? "N/A"} | mode=${
            payload.play_mode ?? "N/A"
          }`;
        }
        case "speaker_play_volume_set": {
          const payload = data as {
            psdk_index?: number;
            play_volume?: number;
          };
          return `psdk=${payload.psdk_index ?? "N/A"} | volume=${
            payload.play_volume ?? "N/A"
          }`;
        }
        case "psdk_input_box_text_set": {
          const payload = data as { psdk_index?: number; value?: string };
          return `psdk=${payload.psdk_index ?? "N/A"} | value=${formatSummaryValue(
            payload.value ?? "",
            28,
          )}`;
        }
        case "psdk_widget_value_set": {
          const payload = data as {
            psdk_index?: number;
            index?: number;
            value?: number;
          };
          const sourceLabel = widgetConfigSourceType
            ? ` | source=${widgetConfigSourceType}`
            : "";
          return `psdk=${payload.psdk_index ?? "N/A"} | index=${
            payload.index ?? "N/A"
          } | value=${payload.value ?? "N/A"}${sourceLabel}`;
        }
        default:
          return "N/A";
      }
    },
    [formatSummaryValue, widgetConfigSourceType],
  );

  const resetSequenceMeta = useCallback(() => {
    setSequenceResults([]);
    setSequenceStatus("idle");
    setSequenceActiveIndex(null);
    setSequenceError(null);
    setSequenceWait(null);
    setStopRequested(false);
    stopRequestedRef.current = false;
  }, []);

  const addSequenceStep = useCallback(
    (
      method: PsdkCommandMethod,
      dataOverride?: Record<string, unknown>,
      waitSeconds?: number,
    ) => {
      if (sequenceRunning) return;
      const data = dataOverride ?? buildStepData(method);
      if (!data) return;
      const summary = buildStepSummary(method, data);
      const fallbackWaitMs = Number.isFinite(sequenceDefaultWaitSeconds)
        ? Math.max(0, sequenceDefaultWaitSeconds) * 1000
        : DEFAULT_SEQUENCE_WAIT_MS;
      const waitMs =
        typeof waitSeconds === "number" && Number.isFinite(waitSeconds)
          ? Math.max(0, waitSeconds) * 1000
        : fallbackWaitMs;
      setSequenceSteps((prev) => [
        ...prev,
        {
          id: createId(),
          method,
          data,
          summary,
          waitMs,
        },
      ]);
      resetSequenceMeta();
    },
    [
      buildStepData,
      buildStepSummary,
      resetSequenceMeta,
      sequenceDefaultWaitSeconds,
      sequenceRunning,
    ],
  );

  const moveSequenceStep = useCallback(
    (index: number, direction: "up" | "down") => {
      if (sequenceRunning) return;
      setSequenceSteps((prev) => {
        const nextIndex = direction === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= prev.length) return prev;
        const next = [...prev];
        const temp = next[index];
        next[index] = next[nextIndex];
        next[nextIndex] = temp;
        return next;
      });
      resetSequenceMeta();
    },
    [resetSequenceMeta, sequenceRunning],
  );

  const removeSequenceStep = useCallback(
    (index: number) => {
      if (sequenceRunning) return;
      setSequenceSteps((prev) => prev.filter((_, idx) => idx !== index));
      resetSequenceMeta();
    },
    [resetSequenceMeta, sequenceRunning],
  );

  const clearSequenceSteps = useCallback(() => {
    if (sequenceRunning) return;
    setSequenceSteps([]);
    resetSequenceMeta();
  }, [resetSequenceMeta, sequenceRunning]);

  const runSequence = useCallback(async () => {
    if (sequenceRunning) return;

    if (sequenceSteps.length === 0) {
      window.alert("Sequence is empty. Please add steps first.");
      return;
    }

    if (onlineState !== "online") {
      window.alert(
        "PSDK is offline. Please confirm the device is online before running.",
      );
      return;
    }

    if (!isConnected) {
      window.alert("MQTT not connected. Please connect before running.");
      return;
    }

    if (!servicesTopic) {
      window.alert("Missing Gateway SN. Unable to run sequence.");
      return;
    }

    const stepsSnapshot = [...sequenceSteps];
    const runId = createId();
    sequenceRunIdRef.current = runId;
    stopRequestedRef.current = false;
    setStopRequested(false);
    setSequenceError(null);
    setSequenceWait(null);
    setSequenceStatus("running");
    setSequenceActiveIndex(null);
    setSequenceResults(
      stepsSnapshot.map(() => ({ status: "idle" as SequenceStepStatus })),
    );

    const updateResult = (index: number, result: SequenceStepResult) => {
      setSequenceResults((prev) => {
        const base =
          prev.length === stepsSnapshot.length
            ? [...prev]
            : stepsSnapshot.map(() => ({
                status: "idle" as SequenceStepStatus,
              }));
        base[index] = { ...base[index], ...result };
        return base;
      });
    };

    const markSkipped = (fromIndex: number) => {
      setSequenceResults((prev) => {
        const base =
          prev.length === stepsSnapshot.length
            ? [...prev]
            : stepsSnapshot.map(() => ({
                status: "idle" as SequenceStepStatus,
              }));
        for (let idx = fromIndex; idx < stepsSnapshot.length; idx += 1) {
          base[idx] = { status: "skipped" };
        }
        return base;
      });
    };

    const waitForDelay = async (delayMs: number, stepIndex: number) => {
      const totalMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
      if (totalMs <= 0) {
        setSequenceWait(null);
        return true;
      }

      const startedAt = Date.now();
      setSequenceWait({ index: stepIndex, remainingMs: totalMs, totalMs });

      while (Date.now() - startedAt < totalMs) {
        if (sequenceRunIdRef.current !== runId) {
          setSequenceWait(null);
          return false;
        }
        if (stopRequestedRef.current) {
          setSequenceWait(null);
          return false;
        }
        const remaining = Math.max(0, totalMs - (Date.now() - startedAt));
        setSequenceWait({ index: stepIndex, remainingMs: remaining, totalMs });
        const nextTick = Math.min(250, remaining);
        await new Promise((resolve) => window.setTimeout(resolve, nextTick));
      }

      setSequenceWait(null);
      return true;
    };

    for (let index = 0; index < stepsSnapshot.length; index += 1) {
      if (sequenceRunIdRef.current !== runId) return;

      if (stopRequestedRef.current) {
        setSequenceStatus("stopped");
        setSequenceActiveIndex(null);
        setSequenceWait(null);
        markSkipped(index);
        setStopRequested(false);
        stopRequestedRef.current = false;
        return;
      }

      setSequenceActiveIndex(index);
      updateResult(index, { status: "pending" });

      const result = await sendCommandWithAck(
        stepsSnapshot[index].method,
        stepsSnapshot[index].data,
      );

      if (sequenceRunIdRef.current !== runId) return;

      updateResult(index, result);

      if (result.status !== "success") {
        const stepMethod = stepsSnapshot[index]?.method ?? "unknown";
        const failureMessage =
          result.status === "timeout"
            ? `Step ${index + 1} (${stepMethod}) timed out (10s).`
            : `Step ${index + 1} (${stepMethod}) failed (result ${
                result.result ?? "N/A"
              }).`;
        setSequenceError(failureMessage);
        setSequenceStatus("failure");
        setSequenceActiveIndex(null);
        setSequenceWait(null);
        markSkipped(index + 1);
        setStopRequested(false);
        stopRequestedRef.current = false;
        return;
      }

      if (stopRequestedRef.current) {
        setSequenceStatus("stopped");
        setSequenceActiveIndex(null);
        setSequenceWait(null);
        markSkipped(index + 1);
        setStopRequested(false);
        stopRequestedRef.current = false;
        return;
      }

      if (index < stepsSnapshot.length - 1) {
        const fallbackWaitMs = Number.isFinite(sequenceDefaultWaitSeconds)
          ? Math.max(0, sequenceDefaultWaitSeconds) * 1000
          : DEFAULT_SEQUENCE_WAIT_MS;
        const stepWaitMs = stepsSnapshot[index]?.waitMs;
        const waitMs =
          typeof stepWaitMs === "number" && Number.isFinite(stepWaitMs)
          ? Math.max(0, stepWaitMs)
          : fallbackWaitMs;
        const shouldContinue = await waitForDelay(waitMs, index);
        if (sequenceRunIdRef.current !== runId) return;
        if (!shouldContinue) {
          setSequenceStatus("stopped");
          setSequenceActiveIndex(null);
          markSkipped(index + 1);
          setSequenceWait(null);
          setStopRequested(false);
          stopRequestedRef.current = false;
          return;
        }
      }
    }

    setSequenceStatus("success");
    setSequenceActiveIndex(null);
    setSequenceError(null);
    setSequenceWait(null);
    setStopRequested(false);
    stopRequestedRef.current = false;
  }, [
    isConnected,
    onlineState,
    sendCommandWithAck,
    sequenceRunning,
    sequenceSteps,
    sequenceDefaultWaitSeconds,
    servicesTopic,
  ]);

  const stopSequence = useCallback(() => {
    if (!sequenceRunning) return;
    stopRequestedRef.current = true;
    setStopRequested(true);
  }, [sequenceRunning]);

  const normalizedSequenceDefaultWaitSeconds = useMemo(() => {
    if (!Number.isFinite(sequenceDefaultWaitSeconds)) {
      return DEFAULT_SEQUENCE_WAIT_MS / 1000;
    }
    return Math.max(0, sequenceDefaultWaitSeconds);
  }, [sequenceDefaultWaitSeconds]);

  const sequenceDefaults = useMemo(
    () => ({
      psdkIndex,
      playMode,
      playVolume,
      audioName,
      audioUrl,
      audioMd5,
      ttsName,
      ttsText,
      ttsMd5,
      inputBoxText,
      widgetIndex,
      widgetValue,
      waitSeconds: normalizedSequenceDefaultWaitSeconds,
    }),
    [
      audioMd5,
      audioName,
      audioUrl,
      inputBoxText,
      playMode,
      playVolume,
      psdkIndex,
      ttsMd5,
      ttsName,
      ttsText,
      normalizedSequenceDefaultWaitSeconds,
      widgetIndex,
      widgetValue,
    ],
  );

  const canRunSequence = sequenceSteps.length > 0 && !sequenceRunning;

  return (
    <div className="min-h-screen">
      <div className="sticky top-3 z-30 px-6 pt-4">
        <div className="mx-auto flex max-w-6xl justify-end">
          <div className="flex flex-wrap items-center gap-3 rounded-full border border-steel-700/70 bg-coal-950/80 px-3 py-2 shadow-panel backdrop-blur">
            <StatusBadge
              label={`MQTT ${status}`}
              tone={mqttStatusTone[status]}
            />
            <StatusBadge
              label={`PSDK ${onlineState}`}
              tone={onlineTone[onlineState]}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-6">
        <header className="flex flex-col gap-4">
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
        </header>

        <div className="grid gap-6">
          <ConnectionPanel
            status={status}
            error={error}
            desktopConfigHint={desktopConfigHint}
            connectionCollapsed={connectionCollapsed}
            mqttEnabled={mqttEnabled}
            setMqttEnabled={setMqttEnabled}
            onConnect={() => {
              void handleConnect();
            }}
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
          setAudioUrl={handleAudioUrlChange}
          audioMd5={audioMd5}
          setAudioMd5={handleAudioMd5Change}
          canValidateAudio={canValidateAudio}
          audioValid={audioValid}
          audioValidation={audioValidation}
          pendingAudioValidation={pendingAudioValidation}
          handleValidateAudioPlayStart={handleValidateAudioPlayStart}
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

        <CommandSequencePanel
          steps={sequenceSteps}
          results={sequenceResults}
          status={sequenceStatus}
          activeIndex={sequenceActiveIndex}
          stopRequested={stopRequested}
          errorMessage={sequenceError ?? undefined}
          defaults={sequenceDefaults}
          defaultWaitSeconds={sequenceDefaultWaitSeconds}
          onDefaultWaitSecondsChange={setSequenceDefaultWaitSeconds}
          waitState={sequenceWait}
          canRun={canRunSequence}
          onRun={runSequence}
          onStop={stopSequence}
          onClear={clearSequenceSteps}
          onMoveStep={moveSequenceStep}
          onRemoveStep={removeSequenceStep}
          onAddStep={addSequenceStep}
        />

        <CommandResultsPanel
          commandLogs={commandLogs}
          logModalOpen={logModalOpen}
          setLogModalOpen={setLogModalOpen}
        />
        <PlayProgressPopup
          progress={activePlayProgress}
          onClose={closePlayProgress}
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
