## 1. 共享校验能力实现

- [x] 1.1 在 `src/lib/` 新增 `speaker_audio_play_start` 的 URL 校验工具（HTTP(S) 协议校验 + 结构化错误码/消息返回）。
- [x] 1.2 在同一工具中实现远程音频参数预检（读取可用元数据并校验 `channels=1`、`sampleRate=16000`、`bitsPerSample=16`）。
- [x] 1.3 为校验结果补充可复用类型定义与结果格式（validating/valid/invalid），供 `App.tsx` 与 modal 统一消费。

## 2. Speaker Control 入口接入

- [x] 2.1 在 `src/App.tsx` 扩展 `audioValid` 判定逻辑：由“非空”升级为“非空 + URL 校验通过”，并在发送前进行最终阻断。
- [x] 2.2 在 `src/App.tsx` 的 `handleAudioPlayStart` 前接入异步校验调用，确保校验失败时不触发 `sendCommand('speaker_audio_play_start', ...)`。
- [x] 2.3 在 `src/components/app/SpeakerControlPanel.tsx` 增加校验状态展示与错误提示文案，并在校验中/失败时禁用发送按钮。

## 3. Command Sequence 新增步骤入口接入

- [x] 3.1 在 `src/components/app/CommandSequenceAddModal.tsx` 为 `speaker_audio_play_start` 新增与主入口一致的 URL 校验流程。
- [x] 3.2 调整 modal 的 `Add To Sequence` 点击逻辑：校验中禁用按钮，校验失败阻止添加并显示明确原因。
- [x] 3.3 保持 `onAddStep` 的 payload 结构不变，仅增加前置门控，不影响后续序列执行逻辑。

## 4. 协议兼容与回归验证

- [x] 4.1 回归确认 MQTT 消息合同未变：仍发布到 `thing/product/{gateway_sn}/services`，并由 `thing/product/{gateway_sn}/services_reply` 判定 ACK。
- [x] 4.2 运行 `npm run lint`，修复新增逻辑触发的 ESLint 问题。
- [x] 4.3 运行 `npm run build`，确认 TypeScript 与 Vite 构建通过。
- [ ] 4.4 手工验证连接与消息链路：Connect MQTT、发送有效 Audio Play Start、收到 `services_reply` 成功反馈。
- [ ] 4.5 手工验证失败与超时：非法 URL/不合规音频被前端阻断；其余命令在无回复时仍按既有超时语义处理。
