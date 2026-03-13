## ADDED Requirements

### Requirement: Renderer MUST 提供显式的中英语言切换并持久化用户选择
系统 MUST 在顶层 renderer 界面提供可见的语言切换入口，至少支持 `zh-CN` 与 `en` 两种选择。用户切换语言后，所有已挂载的本地化界面内容 MUST 立即更新，并将该偏好持久化到 renderer 可读的本地存储中，以便后续刷新或重新打开应用时恢复。

#### Scenario: 用户手动切换到中文
- **WHEN** 用户在主界面语言切换入口中选择 `zh-CN`
- **THEN** 系统 MUST 在当前会话中立即将页头、面板、按钮、提示和 Modal 文案切换为中文

#### Scenario: 刷新后恢复用户选择
- **WHEN** 用户此前已经将界面语言切换为 `en` 或 `zh-CN`，随后刷新页面或重新启动桌面应用
- **THEN** 系统 MUST 优先恢复该已保存语言，而不是重新回退到运行环境默认语言

### Requirement: Renderer MUST 按既定优先级解析初始语言
当用户尚未保存语言偏好时，系统 MUST 按以下优先级选择初始界面语言：首先检查已保存偏好；若不存在，则检查运行环境 locale；当 locale 以 `zh` 开头时使用 `zh-CN`，否则使用 `en`。

#### Scenario: 已保存偏好优先于运行环境 locale
- **WHEN** 本地存储中已存在 `zh-CN` 或 `en` 语言偏好，且运行环境 locale 与之不同
- **THEN** 系统 MUST 使用已保存偏好作为初始语言

#### Scenario: 中文 locale 自动进入中文界面
- **WHEN** 本地存储中不存在语言偏好，且运行环境 locale 为 `zh-CN`、`zh-SG` 或其他 `zh-*`
- **THEN** 系统 MUST 以 `zh-CN` 初始化界面

#### Scenario: 非中文 locale 回退英文
- **WHEN** 本地存储中不存在语言偏好，且运行环境 locale 不以 `zh` 开头
- **THEN** 系统 MUST 以 `en` 初始化界面

### Requirement: 所有面向操作者的界面文案 MUST 随当前语言一致切换
系统 MUST 为操作者可见的主要 UI 文案提供双语版本，至少覆盖页头说明、面板标题、按钮、表单标签、placeholder、空态文案、状态标签、校验提示、运行时 `window.alert`、日志 Modal 和序列执行诊断文案。与命令相关的人类可读标签和播放进度标签 MUST 跟随当前语言变化。

#### Scenario: 切换语言后主要面板文案同步更新
- **WHEN** 用户在连接面板、控制面板、状态面板、序列面板或结果面板可见的情况下切换语言
- **THEN** 这些面板中的标题、按钮、placeholder、空态和说明文案 MUST 在同一会话内同步更新为目标语言

#### Scenario: 运行时提示使用当前语言
- **WHEN** 用户触发缺少 `Gateway SN`、未连接 MQTT、音频校验失败或其他当前已有的运行时提示
- **THEN** 系统 MUST 以当前语言显示对应 `window.alert` 或校验反馈文案

#### Scenario: 命令标签与进度标签随语言切换
- **WHEN** 用户切换界面语言后查看 `Command Results`、`Play Progress` 或 `Command Sequence`
- **THEN** 系统 MUST 将人类可读的 method label、状态 label 和进度说明切换为目标语言

### Requirement: 原始诊断标识 MUST 保持未翻译且可追踪
系统 MUST 保持协议级诊断标识的原样展示，不得对 method code、MQTT topic、`tid`、`bid`、SN、MD5 等原始值做翻译或改写。若某个界面同时展示人类可读标签与原始值，则两者 MUST 保持一一对应。

#### Scenario: 语言切换不影响 method code 与 TID
- **WHEN** 用户在任意语言下查看 `Command Results` 或 `Command Sequence` 详情
- **THEN** 系统 MUST 保持 method code 与 `tid` 的原始字符串不变

#### Scenario: MQTT topic 与 payload 关键字段保持原样
- **WHEN** 用户查看与 MQTT 相关的 topic 名称、payload 摘要、SN 或 MD5
- **THEN** 系统 MUST 显示原始技术值，而不是本地化后的替代文本

### Requirement: 中文界面 MUST 提供适配中文阅读的排版与布局
当当前语言为 `zh-CN` 时，系统 MUST 以适合中文阅读的方式展示共享标题、标签、badge 和按钮组，包括取消对中文文本的强制 uppercase、降低不必要的字距拉伸、允许较长中文标签换行，并在不影响调试信息可读性的前提下保持主要卡片、表格和按钮区域稳定。

#### Scenario: 中文标题与标签不使用英文式字距策略
- **WHEN** 当前语言为 `zh-CN`
- **THEN** 系统 MUST 让面板标题、辅助标签和 badge 避免出现只适用于英文缩写的 uppercase 与过宽 tracking 效果

#### Scenario: 中文长文案不应破坏关键布局
- **WHEN** 中文按钮文案、错误提示或卡片摘要长度明显长于英文
- **THEN** 系统 MUST 通过换行、堆叠或宽度调整保证按钮可点击、表格可读，且不得遮挡 `tid`、MD5、method code 等关键诊断信息

### Requirement: 语言切换 MUST 不改变 MQTT publish/subscribe 与 ACK 语义
无论当前界面语言为何，系统 MUST 继续使用既有 MQTT 消息流：订阅 `thing/product/{device_sn}/state`、`thing/product/{gateway_sn}/events`、`thing/product/{gateway_sn}/services_reply`，发布 `thing/product/{gateway_sn}/services`，并继续依据 `services_reply.data.result` 与当前 timeout 机制判定命令结果。

#### Scenario: 不同语言下发布同一命令
- **WHEN** 用户分别在 `en` 与 `zh-CN` 界面下发送同一条 PSDK 或 speaker 命令
- **THEN** 系统 MUST 发布到相同的 `services` topic，并保持相同的 payload 结构

#### Scenario: 不同语言下保持相同回执与 timeout 行为
- **WHEN** 用户在任一语言界面下发送命令并收到 `services_reply`，或在 timeout 时间内未收到回执
- **THEN** 系统 MUST 按既有规则更新 pending/success/failure/timeout 状态，而不得因为语言切换改变判定结果
