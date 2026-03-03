## ADDED Requirements

### Requirement: 播放进度事件必须与对应下发指令精准关联
系统 MUST 在收到 `speaker_audio_play_start_progress` 或 `speaker_tts_play_start_progress` 事件时，将其关联到同一次下发指令日志。关联流程 MUST 为：先校验 method 一一对应（`speaker_audio_play_start_progress -> speaker_audio_play_start`，`speaker_tts_play_start_progress -> speaker_tts_play_start`），再执行标识匹配，其中 `tid` 用于事务级匹配，`bid` 用于业务级归属校验与并发隔离。默认 MUST 使用双键一致匹配，仅当消息缺失单个标识时才允许降级为单键匹配。

#### Scenario: method 对应且双键一致时关联成功
- **WHEN** 前端收到 `speaker_audio_play_start_progress`，且存在 method 为 `speaker_audio_play_start` 且 `tid`、`bid` 均一致的指令日志
- **THEN** 系统 MUST 将该事件作为该日志的最新播放进度写入

#### Scenario: 单个标识缺失时允许降级匹配
- **WHEN** 前端收到 `speaker_tts_play_start_progress`，消息缺失 `tid` 但包含 `bid`，且存在 method 为 `speaker_tts_play_start` 且 `bid` 一致的指令日志
- **THEN** 系统 MUST 允许使用 `bid` 完成降级匹配并更新播放进度

#### Scenario: method 不一致时禁止更新
- **WHEN** 前端收到 `speaker_audio_play_start_progress`，命中的日志 method 为 `speaker_tts_play_start`
- **THEN** 系统 MUST 拒绝更新该日志的播放进度字段

#### Scenario: 双键存在但业务标识不一致时禁止更新
- **WHEN** 前端收到 `speaker_audio_play_start_progress`，与候选日志 `tid` 一致但 `bid` 不一致，且消息同时包含 `tid` 与 `bid`
- **THEN** 系统 MUST 视为业务归属不一致并拒绝更新该日志

### Requirement: Command Results 必须展示每条播放指令的最新进度
系统 MUST 在 `Command Results` 日志中为 `speaker_audio_play_start` 和 `speaker_tts_play_start` 展示 `Play Progress` 字段，且字段值 MUST 反映该指令最近一次有效进度事件（包含百分比、步骤与阶段状态）。

#### Scenario: 日志显示最新百分比与步骤
- **WHEN** 某条播放指令先后收到多个进度事件（例如 `percent` 从 25 到 60）
- **THEN** 该日志行的 `Play Progress` MUST 显示最新事件对应的进度信息

#### Scenario: 非播放指令保持 N/A
- **WHEN** 日志行 method 为非 `speaker_audio_play_start`/`speaker_tts_play_start`
- **THEN** 系统 SHALL 在 `Play Progress` 字段保持空值或 `N/A`

### Requirement: 前端必须向用户展示当前播放指令实时进度
系统 MUST 在播放进度事件到达时向用户展示当前指令的执行进度（可通过弹窗或等效弹层），至少包含指令类型、当前阶段（`status` / `step_key`）与进度百分比，并在后续事件到达时实时刷新。

#### Scenario: 进度事件触发弹层更新
- **WHEN** 用户下发 `speaker_audio_play_start` 后收到 `speaker_audio_play_start_progress`
- **THEN** 系统 MUST 展示进度弹层并实时更新阶段与百分比

#### Scenario: 用户可关闭进度弹层
- **WHEN** 用户主动关闭进度弹层
- **THEN** 系统 SHALL 隐藏该弹层且不影响后台进度写入日志

### Requirement: 进度事件不得改变既有 ACK 判定语义
系统 MUST 继续以 `services_reply` 的 `result` 作为命令成功/失败依据，播放进度事件仅用于可视化，不得直接改写命令最终状态判定。

#### Scenario: 进度到 100 但 ACK 未成功
- **WHEN** 某播放指令收到 `percent=100` 的进度事件，但 `services_reply.result != 0` 或超时
- **THEN** 系统 MUST 保持该命令状态为 failure/timeout，而非 success

#### Scenario: ACK 成功后仍可更新进度展示
- **WHEN** 某播放指令 `services_reply.result = 0` 后继续收到进度事件
- **THEN** 系统 SHALL 仅更新 `Play Progress` 展示，不更改已确定的 success 状态

### Requirement: 系统必须防止进度乱序导致回退显示
系统 MUST 使用进度事件时间戳进行单调更新控制；当新事件时间戳早于已记录的最新进度时间戳时，系统 MUST 忽略该旧事件。

#### Scenario: 乱序旧事件被丢弃
- **WHEN** 日志已记录 `updatedAt = T2` 的进度后，收到同指令 `updatedAt = T1` 且 `T1 < T2` 的事件
- **THEN** 系统 MUST 保持当前显示不变，不得将进度回退到旧值
