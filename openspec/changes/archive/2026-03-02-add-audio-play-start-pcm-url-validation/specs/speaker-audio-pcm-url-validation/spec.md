## ADDED Requirements

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
在 `PSDK Control` 的 `Audio Play Start` 区域，系统 SHALL 将发送按钮的可用性与 URL 校验结果绑定。未通过校验时用户不可发送该命令。

#### Scenario: 校验通过后允许发送
- **WHEN** `audioName`、`audioMd5`、`audioUrl` 非空且 URL 校验通过
- **THEN** 系统 MUST 允许触发 `Send Audio Play Start`，并按既有 topic/payload 发送命令

#### Scenario: 校验失败时禁用发送
- **WHEN** URL 校验状态为失败或校验中
- **THEN** 系统 MUST 禁用 `Send Audio Play Start` 或在点击时阻断发送，并展示失败原因

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
