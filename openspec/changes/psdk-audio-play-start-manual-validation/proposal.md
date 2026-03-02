## Why

当前 `PSDK Control` 的 `Audio Play Start` 会在每次填写或修改 `file.url` 时立即发起音频文件校验，导致频繁网络请求、交互阻塞和噪音提示。随着用户在调试时反复编辑 URL 与参数，这种“自动即时校验”体验成本较高，且无法明确区分“录入阶段”和“确认发送阶段”。

同时，现有流程缺少“文件内容完整性”和“用户输入 md5 一致性”的显式校验步骤，存在 URL 指向文件与预期文件不一致时仍被误发送的风险。需要将校验改为用户主动触发，并在同一步完成音频格式与 md5 匹配校验。

## What Changes

- 在 `PSDK Control` 的 `Audio Play Start` 区域新增“校验音频”按钮，替代“每次修改 URL 自动校验”行为。
- 仅在用户点击“校验音频”时请求远程音频并执行格式校验（PCM 单声道、16kHz、16bit）。
- 在同一次校验流程中计算远程音频文件 md5，并与用户填写的 `audioMd5` 进行一致性比对。
- 校验结果分层展示：URL/协议错误、音频参数不合规、md5 不匹配、校验成功。
- `Send Audio Play Start` 的可用状态改为依赖“最近一次主动校验成功”结果；未校验或校验失败时禁止发送。
- 命令发送 topic、payload 字段、ACK 判定语义保持不变（非 BREAKING）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `speaker-audio-pcm-url-validation`: 将校验触发机制从自动改为手动按钮触发，并新增“远程文件 md5 与用户输入 md5 一致性校验”要求。

## Impact

- 受影响前端模块：
  - `PSDK Control` 中 `Audio Play Start` 表单与发送按钮可用态逻辑。
  - 音频校验相关 hook/工具函数（触发时机、状态管理、错误原因结构）。
- 受影响交互流程：
  - 用户从“输入即校验”改为“输入完成后点击校验再发送”。
- MQTT 协议影响：
  - 无新增 topic。
  - 无 payload 字段变更。
  - 无 ACK/超时语义变更。
- 配置影响：
  - 无新增 `.env` 键。
