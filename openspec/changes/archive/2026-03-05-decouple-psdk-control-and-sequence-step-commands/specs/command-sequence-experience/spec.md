## ADDED Requirements

### Requirement: PSDK Control 与 Add Sequence Step 的参数状态必须隔离
系统 MUST 为 `PSDK Control` 与 `Command Sequence` 的 `Add Sequence Step` 使用彼此独立的参数状态源。对相同命令字段（包括 `psdk_index`、音频/TTS 参数、`play_mode`、`play_volume`、`input_box_text`、`widget index/value`）的编辑不得跨区域自动同步。

#### Scenario: 手动面板改动不影响序列新增默认值
- **WHEN** 用户在 `PSDK Control` 修改任意命令输入参数后打开 `Add Sequence Step`
- **THEN** 系统 MUST 使用 sequence builder 的独立默认参数，而不是刚刚在手动面板修改的值

#### Scenario: 序列新增草稿改动不影响手动面板
- **WHEN** 用户在 `Add Sequence Step` 中修改参数并确认新增步骤
- **THEN** 系统 MUST 保持 `PSDK Control` 当前输入值不变

### Requirement: Sequence builder 必须维护独立且可复用的默认参数上下文
系统 MUST 记住 sequence builder 最近一次确认新增步骤时的参数草稿，并在下一次打开 `Add Sequence Step` 时作为默认值继续使用；该上下文仅服务于 sequence builder。

#### Scenario: 连续新增步骤复用序列上下文
- **WHEN** 用户在 `Add Sequence Step` 中将 `speaker_play_volume_set` 的 `play_volume` 设为 `80` 并新增步骤，然后再次打开 `Add Sequence Step`
- **THEN** 系统 MUST 默认展示 `play_volume = 80`（除非用户在 sequence builder 内再次修改）

#### Scenario: 清空序列步骤不应回写手动输入上下文
- **WHEN** 用户执行 `Clear Sequence` 清空步骤列表
- **THEN** 系统 MUST 不修改 `PSDK Control` 的输入参数

### Requirement: 状态解耦不得改变消息合同与 ACK 判定
参数状态拆分后，系统 MUST 保持命令下发与反馈判定语义不变：手动与序列命令仍发布到 `thing/product/{gateway_sn}/services`，并继续以 `services_reply.data.result` 判定成功/失败；超时行为保持现状。

#### Scenario: 手动命令协议行为保持一致
- **WHEN** 用户在 `PSDK Control` 发送任意支持的命令
- **THEN** 系统 MUST 按既有 payload 结构发布消息，并按既有 ACK/timeout 规则更新状态

#### Scenario: 序列命令协议行为保持一致
- **WHEN** 用户运行包含多个步骤的 `Command Sequence`
- **THEN** 系统 MUST 按既有步骤执行与 ACK 判定逻辑运行，不因参数状态解耦改变执行语义
