## MODIFIED Requirements

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

## ADDED Requirements

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
