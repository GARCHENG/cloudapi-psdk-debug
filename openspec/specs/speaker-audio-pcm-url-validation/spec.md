# speaker-audio-pcm-url-validation Specification

## Purpose
Define front-end validation requirements for `speaker_audio_play_start` PCM URL checks in both direct send and sequence-add flows.

## Requirements
### Requirement: Audio Play Start 文件地址必须是 HTTP(S) URL
系统 MUST 在处理 `speaker_audio_play_start` 的 `file.url` 前校验 URL 可解析且协议为 `http` 或 `https`。对于非 HTTP(S) 协议或无效 URL，系统 MUST 阻止后续发送与步骤添加。

#### Scenario: URL 协议不合规时阻断
- **WHEN** 用户输入 `file.url` 为 `ftp://...`、`file://...`、空字符串或不可解析地址
- **THEN** 系统 MUST 标记校验失败并阻止发送 `speaker_audio_play_start` 请求

#### Scenario: URL 协议合规时进入音频参数校验
- **WHEN** 用户输入 `http://...` 或 `https://...` 且 URL 可解析
- **THEN** 系统 MUST 进入音频参数校验流程，而不是仅凭非空放行

### Requirement: Audio Play Start 必须验证 PCM 音频参数
系统 MUST 对 `file.url` 指向的音频进行参数校验，确认声道数为 `1`、采样率为 `16000 Hz`、位宽为 `16 bit`。任一条件不满足时 MUST 视为不合规。

#### Scenario: 音频参数全部满足
- **WHEN** 远程音频元数据显示 `channels=1`、`sampleRate=16000`、`bitsPerSample=16`
- **THEN** 系统 MUST 将该 URL 判定为可用于 `speaker_audio_play_start`

#### Scenario: 音频参数任一不满足
- **WHEN** 远程音频元数据中任一字段不符合要求（例如双声道、48kHz 或 24bit）
- **THEN** 系统 MUST 返回失败结果并阻止后续命令发送或步骤添加

### Requirement: Speaker Control 发送前必须通过 URL 校验
在 `PSDK Control` 的 `Audio Play Start` 区域，系统 SHALL 提供显式“校验音频”操作入口。系统 MUST 仅在用户主动触发校验后，依据最近一次校验结果决定 `Send Audio Play Start` 是否可发送；未校验、校验中、校验失败或校验结果已因参数变更失效时，系统 MUST 阻止发送。

#### Scenario: 用户点击按钮后触发校验
- **WHEN** `audioName`、`audioMd5`、`audioUrl` 已填写且用户点击“校验音频”
- **THEN** 系统 MUST 发起 URL 协议与音频参数校验流程，并展示进行中状态

#### Scenario: 校验成功后允许发送
- **WHEN** 最近一次由用户主动触发的校验结果为成功，且当前 `audioUrl` 与 `audioMd5` 未发生变更
- **THEN** 系统 MUST 允许触发 `Send Audio Play Start`，并按既有 topic/payload 发送命令

#### Scenario: 未校验或校验失效时阻断发送
- **WHEN** 用户未执行手动校验，或在成功校验后修改了 `audioUrl` / `audioMd5`
- **THEN** 系统 MUST 禁用 `Send Audio Play Start` 或在点击时阻断发送，并提示需要重新校验


### Requirement: Command Sequence 新增 Audio Play Start 步骤前必须通过同一校验
在 `CommandSequenceAddModal` 中新增 `speaker_audio_play_start` 步骤时，系统 MUST 复用与 Speaker Control 相同的 URL 校验规则。

#### Scenario: 序列新增步骤校验成功
- **WHEN** 用户在 modal 中配置 `speaker_audio_play_start` 且 URL 校验通过
- **THEN** 系统 MUST 允许将该步骤加入序列

#### Scenario: 序列新增步骤校验失败
- **WHEN** 用户在 modal 中配置 `speaker_audio_play_start` 但 URL 协议或音频参数不合规
- **THEN** 系统 MUST 阻止 `Add To Sequence`，并给出可定位的错误提示

### Requirement: MQTT 消息合同与 ACK 语义保持不变
该校验能力 MUST 仅作为前置门控，不得改变 `speaker_audio_play_start` 的 topic、payload 结构、`tid/bid` 关联与 `services_reply` 成功/失败判定语义。

#### Scenario: 校验通过后的发送合同不变
- **WHEN** URL 校验通过并触发命令发送
- **THEN** 系统 MUST 继续发布到 `thing/product/{gateway_sn}/services`，并按既有逻辑等待 `thing/product/{gateway_sn}/services_reply`

#### Scenario: 校验失败时无新增协议副作用
- **WHEN** URL 校验失败
- **THEN** 系统 MUST 不发送该命令，且不得引入新的 MQTT topic 或 payload 字段

### Requirement: Audio Play Start 手动校验必须验证远程文件 MD5 与输入值一致
系统 MUST 在 `Audio Play Start` 的手动校验流程中计算远程音频文件的 md5，并与用户输入的 `audioMd5` 做严格一致性比较；仅当 md5 一致时才可视为校验通过。

#### Scenario: MD5 一致时校验通过
- **WHEN** 远程音频文件可访问、音频参数合规，且计算得到的 md5 与 `audioMd5` 完全一致
- **THEN** 系统 MUST 返回校验成功状态，并允许后续发送

#### Scenario: MD5 不一致时校验失败
- **WHEN** 远程音频文件 md5 与用户输入 `audioMd5` 不一致
- **THEN** 系统 MUST 返回校验失败状态，明确提示 md5 不匹配，并阻止发送

#### Scenario: 无法计算远程 MD5 时校验失败
- **WHEN** URL 因网络、HTTP 错误或 CORS 限制导致无法读取足够内容完成 md5 计算
- **THEN** 系统 MUST 返回校验失败状态，给出可定位失败原因，并阻止发送

