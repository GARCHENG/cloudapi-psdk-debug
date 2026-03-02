## Why

当前 `Audio Play Start` 仅校验 `name/url/md5` 非空，未验证 `File URL (PCM)` 的协议与音频参数。用户即使填入不可用 URL 或不符合要求的音频（非单声道、非 16kHz、非 16bit）也能发送命令，导致设备端播放失败并增加排障成本。需要在前端发送前增加可执行的参数校验，尽早阻断无效请求。

## What Changes

- 为 `speaker_audio_play_start` 增加 `File URL (PCM)` 规则校验：仅允许 `http`/`https` URL。
- 新增音频参数校验能力：校验目标音频为单声道（1 channel）、采样率 `16 kHz`、位宽 `16 bit`。
- 在单次发送入口（Speaker Control）增加即时校验反馈与按钮禁用条件，避免发送不合规 payload。
- 在序列步骤新增入口（Command Sequence Add Modal）复用同一套校验规则，确保序列模式与单次发送行为一致。
- 明确错误提示文案，指出具体不符合项（URL 协议/声道/采样率/位宽）。
- 保持 MQTT topic、payload 字段和命令方法不变，不新增命令。
- Non-goals:
  - 不变更 `speaker_audio_play_start` payload 结构（仍使用 `file.format/md5/name/url`）。
  - 不改动 `services`/`services_reply` topic 与 ACK 判定逻辑。
  - 不新增后端 API 或代理服务。

## Capabilities

### New Capabilities
- `speaker-audio-pcm-url-validation`: 定义 `Audio Play Start` 对 `File URL (PCM)` 的协议与音频参数校验要求，并统一单次发送与序列新增步骤的校验行为。

### Modified Capabilities
- 无

## Impact

- Affected code:
  - `src/App.tsx`（`audioValid` 与序列步骤构建前校验）
  - `src/components/app/SpeakerControlPanel.tsx`（输入反馈与发送按钮可用态）
  - `src/components/app/CommandSequenceAddModal.tsx`（新增步骤校验与错误提示）
  - 可能新增 `src/lib/` 下音频 URL 校验工具
- APIs / protocols:
  - 不变；继续发布到 `thing/product/{gateway_sn}/services`，接收 `thing/product/{gateway_sn}/services_reply`。
  - 不新增 `.env` 键，不调整默认值。
- Dependencies:
  - 预期不新增第三方依赖（优先使用浏览器原生能力与现有代码结构）。
- Risks:
  - 远程音频元数据探测可能受 CORS/网络波动影响，需定义失败时的降级与提示策略。
  - 若不同入口使用不同校验时机，可能出现体验不一致；需要统一规则与错误文案。
