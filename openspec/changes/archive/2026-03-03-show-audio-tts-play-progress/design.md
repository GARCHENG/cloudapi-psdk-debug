## Context

当前系统的命令闭环以 `services_reply` 为主：发送命令后在 `Command Results` 中记录 `pending/success/failure/timeout`。  
对于 `speaker_audio_play_start` 与 `speaker_tts_play_start`，设备还会在 `thing/product/{gateway_sn}/events` 上报 `*_play_start_progress`，并且 `bid/tid` 与原指令一致。现有前端缺少面向操作者的实时进度提示，导致用户只能看到 ACK 结果，无法确认执行阶段（例如 upload/play）与进度百分比。

约束：
- MQTT topic 与 payload 合同不能变化。
- ACK 判定仍以 `services_reply.data.result` 为准。
- 进度事件可能乱序到达，且可能在短时间内高频更新。

## Goals / Non-Goals

**Goals:**
- 在不改变现有命令发送与 ACK 语义的前提下，展示 Audio/TTS 播放进度的“当前阶段 + 百分比 + 最新更新时间”。
- 提供一个可关闭的进度弹层（弹窗或浮层）用于展示“当前关注指令”的实时进度。
- 在 `Command Results` 的 `Play Progress` 列稳定展示该指令最新进度，且仅更新与 method 对应的 Audio/TTS 指令日志。
- 增加时间戳防护，避免旧进度覆盖新进度。

**Non-Goals:**
- 不新增或修改任何 MQTT topic、payload 字段或 `.env` 配置。
- 不改变 `COMMAND_REPLY_TIMEOUT_MS`、序列执行器或 stop 逻辑。
- 不把进度事件当作命令成功依据；命令成功仍由 `services_reply` 决定。

## Decisions

### 决策 1：采用“日志记录 + 当前进度弹层”双通道展示
- 方案：保留并强化 `CommandLogEntry.playProgress` 作为历史记录源，同时新增一份 UI 层的“当前进度视图状态”，用于弹层渲染。
- 原因：日志用于可追溯性，弹层用于实时可见性；两者职责不同。
- 备选方案：仅更新日志，不做弹层。  
  - 放弃原因：用户仍需手动打开日志查看，无法满足“调用时向用户展示当前执行进度”。

### 决策 2：先做 method 一一映射，再做 `tid/bid` 双维关联
- 方案：处理进度事件时，先强制 method 对应关系：`speaker_audio_play_start_progress -> speaker_audio_play_start`，`speaker_tts_play_start_progress -> speaker_tts_play_start`。在对应关系成立后，`tid` 用于事务级匹配，`bid` 用于业务级归属校验与并发隔离；默认使用双键一致匹配，仅当消息缺失单个标识时才允许单键降级匹配。
- 原因：同时满足事务匹配与业务边界管理，避免把不同业务或不同事务的进度写入同一日志。
- 备选方案：仅按 `tid` 关联。  
  - 放弃原因：无法覆盖业务级并发与重复请求隔离语义，且在异常重试场景容易发生跨业务误关联。

### 决策 3：进度更新引入“单调时间戳”保护
- 方案：若新事件时间戳 `<` 已存 `playProgress.updatedAt`，则忽略该事件。
- 原因：`events` 存在乱序风险，需防止显示回退。
- 备选方案：无时间戳校验，后到即覆盖。  
  - 放弃原因：会引发进度倒退和阶段闪烁。

### 决策 4：TypeScript 合同先行，复用既有模块
- 方案：在 `src/types/psdk.ts` 完整定义 `SpeakerPlayProgressData`、`CommandPlayProgress` 与 UI 需要的可选字段；在 `src/App.tsx` 复用现有 `handleMessage` 和 `updateLogFromProgress` 管线；UI 通过 `src/components/app` 现有面板扩展或新增轻量组件。
- 原因：降低重构风险，保持数据流集中在 `App.tsx`。
- 备选方案：新建全局状态库（如 Zustand）统一管理。  
  - 放弃原因：本次变更范围有限，引入新状态层成本过高。

### 决策 5：ACK 与进度分离显示
- 方案：`services_reply` 继续仅更新 `status/result`；`events` 仅更新 `playProgress`，两者互不覆盖。
- 原因：协议语义清晰，避免把“正在执行进度”误当“执行成功”。
- 备选方案：收到 `progress=100` 时直接改为 `success`。  
  - 放弃原因：与现有 ACK 判定冲突，可能产生错误成功态。

## Risks / Trade-offs

- [风险] 高频进度事件触发频繁渲染  
  -> 缓解：仅在值变化时更新状态；可选节流（例如 100-200ms）避免 UI 抖动。
- [风险] 旧事件乱序覆盖新进度  
  -> 缓解：按 `updatedAt` 单调更新，旧时间戳丢弃。
- [风险] 多个播放指令并发时弹层关注对象不明确  
  -> 缓解：默认展示“最近更新的一条播放指令”，并在弹层标明 method + short tid。
- [权衡] 新增弹层会增加界面干扰  
  -> 缓解：支持手动关闭；默认仅在收到进度事件时出现，完成后自动收起。

## Migration Plan

1. 在前端类型层补齐并确认进度字段契约（不改协议）。
2. 在 `App.tsx` 加入时间戳防护和“当前进度弹层状态”更新逻辑。
3. 在 `Command Results` 保持 `Play Progress` 显示最新值，验证 Audio/TTS method 一一映射与 `tid/bid` 关联规则正确。
4. 本地执行 `npm run lint` 与手工 MQTT 回放验证。
5. 回滚策略：若出现 UI 异常，仅回退前端变更即可，不涉及数据迁移或后端联动。

## Open Questions

- 弹层是否需要“固定显示直到手动关闭”，还是“完成后自动 3-5 秒关闭”为默认行为？
- 当 Audio 与 TTS 同时有进度更新时，是否需要在弹层中支持切换最近多条记录，而非只显示最新一条？
