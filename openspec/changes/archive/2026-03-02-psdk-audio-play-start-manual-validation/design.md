## Context

当前 `PSDK Control` 的 `Audio Play Start` 在用户输入 `audioUrl` 后会通过防抖自动触发远程音频校验，核心逻辑位于：
- `src/App.tsx`：`useEffect([audioUrl])` 自动调用 `validateAudioPlayStartUrl`
- `src/lib/speakerAudioPlayStartValidation.ts`：执行 URL 协议检查与 PCM 元数据检查
- `src/components/app/SpeakerControlPanel.tsx`：展示校验状态并控制发送按钮可用性

现状问题：
- 用户每次修改 URL 都会触发网络请求，交互成本高。
- `audioMd5` 当前仅作为发送参数，不参与前置校验，无法在发送前发现“远程文件与期望 md5 不一致”的风险。

约束：
- MQTT publish/subscribe 合同不变：继续使用 `thing/product/{gateway_sn}/services` 发送，等待 `thing/product/{gateway_sn}/services_reply`。
- `speaker_audio_play_start` payload 结构不变（`file.name/url/md5/format` 保持现状）。
- 优先复用现有校验库与面板，不新增跨模块复杂抽象。

## Goals / Non-Goals

**Goals:**
- 将 `Audio Play Start` 从“输入即校验”改为“点击按钮才校验”。
- 新增远程文件 md5 计算与比对，要求与用户输入 `audioMd5` 一致才算校验通过。
- 发送按钮仅在“最近一次手动校验成功且输入未变更”时可用。
- 明确区分校验失败原因（URL/协议、PCM 参数、网络/CORS、md5 不匹配）。

**Non-Goals:**
- 不修改 `CommandSequenceAddModal` 的既有行为（本次范围仅限 `PSDK Control`）。
- 不变更 MQTT topic、ACK 机制、超时策略。
- 不新增 `.env` 配置项。

## Decisions

### 决策 1：引入“手动校验”触发入口，移除 URL 变更自动校验
- 方案：在 `SpeakerControlPanel` 的 `Audio Play Start` 区块新增 `Validate Audio` 按钮，由 `App.tsx` 暴露 `handleValidateAudioPlayStart`。
- 原因：将频繁输入阶段与耗时网络校验解耦，避免不必要请求。
- 备选方案：保留自动校验并增加开关。
  - 放弃原因：复杂度更高，且默认行为仍会造成网络噪音，不能直接满足需求。

### 决策 2：扩展校验结果模型，纳入 md5 比对状态
- 方案：在 `src/lib/speakerAudioPlayStartValidation.ts` 增加 md5 校验能力，输出新增错误码（如 `MD5_REQUIRED`、`MD5_MISMATCH`、`MD5_CALCULATION_FAILED`）。
- 原因：保持“校验能力集中在 lib 层”，避免 UI 层拼装多段规则。
- 备选方案：在 `App.tsx` 单独计算 md5 并拼接结果消息。
  - 放弃原因：规则分散，不利于复用和后续测试。

### 决策 3：采用文件内容流式 md5 计算，避免全量内存峰值
- 方案：优先使用 `fetch(url)` + `ReadableStream` 增量读取并累计哈希；若运行环境限制导致流式不可用，降级为 `arrayBuffer` 路径并返回明确风险提示。
- 原因：兼顾大文件场景和浏览器兼容性，减少 OOM 风险。
- 备选方案：始终 `arrayBuffer` 后一次性计算 md5。
  - 放弃原因：大文件时内存占用不可控。

### 决策 4：发送门控绑定“校验快照”
- 方案：保存最近一次成功校验的快照（`url`、`md5`、时间戳/请求 id）。当 `audioUrl` 或 `audioMd5` 任何一项变更后，立即将状态重置为“待校验”。
- 原因：保证“发送前校验结果与当前输入一致”，避免用户修改后沿用旧成功态。
- 备选方案：只看 `audioValidation.status === valid`。
  - 放弃原因：可能出现“输入已变但状态仍为成功”的误发送风险。

### 决策 5：MQTT 合同保持不变，仅调整前置 UI/校验流程
- 方案：`handleAudioPlayStart` 在本地门控通过后仍调用现有 `sendCommand('speaker_audio_play_start', payload)`，不增加 topic 或字段。
- 原因：本需求不涉及设备端协议升级，保持兼容性与可回滚性。
- 备选方案：将校验结果附加到 payload。
  - 放弃原因：超出需求范围，且会改变消息合同。

## Risks / Trade-offs

- [Risk] 远程资源 CORS 限制导致无法读取内容计算 md5  
  → Mitigation：返回可定位错误文案（区分 HTTP 错误与 CORS/网络），并在 UI 中提示“该 URL 不支持前端校验”。

- [Risk] 流式 md5 在部分浏览器环境不稳定  
  → Mitigation：提供降级路径与错误码，保留统一失败提示，不影响其他命令功能。

- [Risk] 用户认为“校验成功后永久可发”但后续修改了输入  
  → Mitigation：输入变更即清空成功态，并在校验信息区域显示“参数已变更，请重新校验”。

- [Risk] 校验按钮增加一步操作，可能影响老用户习惯  
  → Mitigation：默认值填充后提供显式“校验音频”入口和成功态提示，降低迁移成本。

## Migration Plan

1. 增量改造 `speakerAudioPlayStartValidation`，先补齐 md5 校验 API 与类型定义。
2. 改造 `App.tsx`：移除 URL 自动校验 `useEffect`，增加手动校验 handler 与校验快照重置逻辑。
3. 改造 `SpeakerControlPanel.tsx`：新增 `Validate Audio` 按钮与状态展示文案。
4. 本地验证：`npm run lint` + 手工回归（输入 URL、修改 md5、点击校验、发送命令、检查 command log）。
5. 回滚策略：若线上发现兼容问题，可回退至本 change 之前版本；因 MQTT 合同未变，回滚风险低。

## Open Questions

- md5 计算库选型：是否引入轻量第三方库（如 `spark-md5`）还是使用现有项目依赖实现？
- 对超大音频文件是否需要增加前端最大校验体积限制与超时配置？
