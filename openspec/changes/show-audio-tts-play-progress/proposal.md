## Why

当前前端仅在 `services_reply` 中展示 `speaker_audio_play_start` 与 `speaker_tts_play_start` 的 ACK 结果，用户无法直观看到“已下发后正在执行到哪一步”。`events` 已提供可与原指令关联的播放进度消息，其中 `tid` 用于事务级通信匹配，`bid` 用于业务级并发与重复请求隔离。现在需要把这部分信息显式展示出来，降低排障与操作等待成本。

## What Changes

- 为 `speaker_audio_play_start` 与 `speaker_tts_play_start` 新增“执行中进度可视化”，在收到对应 `*_progress` 事件时向用户展示当前阶段、阶段文案与百分比。
- 新增可关闭的进度弹窗（或等效弹层）用于展示“当前指令最新进度”，并在进度变更时实时刷新。
- 在 `Command Results` 日志的 `Play Progress` 列中，针对上述两类指令持续展示“该指令最新进度”，并保持与对应 `tid/bid` 的关联一致。
- 明确匹配规则：进度 method 与下发指令 method 必须一一对应，`speaker_audio_play_start_progress` 仅对应 `speaker_audio_play_start`，`speaker_tts_play_start_progress` 仅对应 `speaker_tts_play_start`；在对应关系成立后，以 `tid` 完成事务级匹配，以 `bid` 完成业务级归属校验与并发隔离，仅当消息缺失单个标识时才允许降级到单键匹配。
- 非目标：不变更 MQTT topic、payload 字段、ACK 超时策略、命令下发流程与后端协议。
- 风险：若出现重复业务触发、异常重试或消息乱序，可能导致同一事务与业务边界判断混淆；需在设计中约束“双键优先匹配 + 最新时间戳更新”。
- `.env` 影响：无新增必填环境变量。

## Capabilities

### New Capabilities
- `speaker-play-progress-visibility`: 将 Audio/TTS 播放进度事件与命令日志关联，并提供实时进度展示能力（弹窗 + 日志字段）。

### Modified Capabilities
- （无）

## Impact

- 受影响代码：
  - `src/App.tsx`（事件解析、日志更新、进度状态管理）
  - `src/components/app/CommandResultsPanel.tsx`（日志列表进度展示）
  - `src/components/app/SpeakerControlPanel.tsx` 或新增进度弹窗组件（用户可见进度 UI）
  - `src/components/app/view-helpers.ts`（进度字段格式化）
  - `src/types/psdk.ts`（进度数据结构与状态类型）
- 受影响系统：MQTT `events` 处理链路与前端命令诊断展示。
- 外部依赖与 API：无新增第三方依赖；仅复用现有 DJI Cloud API 事件字段。
