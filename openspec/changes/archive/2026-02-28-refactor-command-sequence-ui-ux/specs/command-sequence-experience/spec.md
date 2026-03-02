## ADDED Requirements

### Requirement: 分层展示序列信息与运行概览
系统 MUST 在 Command Sequence 面板中提供清晰的分层结构，至少包含序列概览、步骤列表、运行反馈三个信息区，并在运行期间持续显示当前进度。

#### Scenario: 空序列状态可读
- **WHEN** 用户打开 Command Sequence 且当前无步骤
- **THEN** 系统 MUST 显示空状态引导，并明确下一步操作入口（如新增步骤）

#### Scenario: 运行中概览实时更新
- **WHEN** 序列处于 running 状态且 activeIndex 或 waitState 变化
- **THEN** 系统 MUST 在概览区实时展示当前步骤序号、总步骤数与等待倒计时

### Requirement: 步骤卡片需可快速识别关键参数
系统 SHALL 将每个步骤渲染为可识别卡片，卡片中 MUST 显示 method label、method 原值、关键参数摘要和等待时长，帮助用户在不展开详情的情况下完成比对。

#### Scenario: 步骤摘要一致性
- **WHEN** 用户新增或编辑一个步骤
- **THEN** 系统 MUST 立即更新该步骤卡片摘要，且摘要内容与发送 payload 关键字段一致

#### Scenario: 默认等待时间回填
- **WHEN** 步骤未显式设置 waitMs 且用户已设置默认等待时间
- **THEN** 系统 MUST 在卡片中显示生效的默认等待时长而非空值

### Requirement: 步骤状态与激活态需视觉区分
系统 MUST 对 `idle/pending/success/failure/timeout/skipped` 提供明确视觉状态，并对当前 active step 提供高优先级高亮，确保用户可在 1 次扫描内定位执行位置。

#### Scenario: 执行中状态切换
- **WHEN** 某步骤开始发送命令并等待 ACK
- **THEN** 该步骤 MUST 进入 pending 状态并成为 active step，高亮样式与其他状态可区分

#### Scenario: 成功后自动推进
- **WHEN** 当前步骤收到 `services_reply` 且 `result = 0`
- **THEN** 当前步骤 MUST 标记为 success，并在存在下一步时推进 active step

### Requirement: 失败与超时需就地诊断
系统 SHALL 在序列面板内直接展示失败诊断信息，至少包含失败步骤编号、method 与失败原因（result code 或 timeout），并提供失败步骤就地定位。

#### Scenario: result 非 0 的失败诊断
- **WHEN** 某步骤收到 `services_reply` 且 `result != 0`
- **THEN** 系统 MUST 将序列状态标记为 failure，并展示失败步骤与 result 值

#### Scenario: ACK 超时诊断
- **WHEN** 某步骤在默认超时时间内未收到 `services_reply`
- **THEN** 系统 MUST 将该步骤标记为 timeout，并展示 timeout 诊断文案

### Requirement: 协议与执行语义向后兼容
本次重构 MUST 不改变 MQTT publish/subscribe 话题、payload 字段结构、`tid/bid` 关联逻辑与默认超时策略，确保序列执行语义保持一致。

#### Scenario: 运行前后消息合同一致
- **WHEN** 用户在重构前后执行同一序列
- **THEN** 系统 MUST 发布到相同 `services` topic，且消息结构与 ACK 判定语义保持一致

#### Scenario: 停止逻辑保持一致
- **WHEN** 用户在 running 状态触发 Stop
- **THEN** 系统 MUST 保持既有 stop 语义：当前控制流停止推进并将后续步骤标记为 skipped
