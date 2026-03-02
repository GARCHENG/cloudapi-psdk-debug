## 1. 校验能力改造（lib）

- [x] 1.1 在 `src/lib/speakerAudioPlayStartValidation.ts` 扩展校验结果模型与错误码，覆盖 md5 相关失败场景（缺失、不匹配、计算失败）。
- [x] 1.2 在 `src/lib/speakerAudioPlayStartValidation.ts` 实现远程音频 md5 计算逻辑，并与现有 URL/PCM 校验串联为统一入口。
- [x] 1.3 为手动校验返回结构补充“可用于发送门控的快照字段”（至少包含规范化 URL 与 md5）。

## 2. PSDK Control 交互与状态改造（App）

- [x] 2.1 在 `src/App.tsx` 移除 `audioUrl` 变更后的自动校验 `useEffect`，新增 `handleValidateAudioPlayStart` 手动触发流程。
- [x] 2.2 在 `src/App.tsx` 中将 `audioUrl`、`audioMd5` 输入变更与“校验成功快照”绑定，任一字段变化后将状态重置为“需重新校验”。
- [x] 2.3 更新 `handleAudioPlayStart` 与 `audioValid` 门控逻辑，要求仅在最近一次手动校验成功且输入未变更时允许发送。

## 3. Audio Play Start 面板改造（UI）

- [x] 3.1 在 `src/components/app/SpeakerControlPanel.tsx` 新增 `Validate Audio` 按钮，并接入校验中/成功/失败视觉状态。
- [x] 3.2 调整校验反馈文案，区分 URL/协议错误、PCM 参数错误、md5 不匹配、网络或 CORS 问题。
- [x] 3.3 保持 `Send Audio Play Start` 的 MQTT payload 不变（`file.name/url/md5/format`），仅更新前置禁用条件。

## 4. 回归与验证

- [x] 4.1 运行 `npm run lint` 并修复新增代码问题。
- [x] 4.2 运行 `npm run build`，确认产物可构建。
- [ ] 4.3 手工验证连接流程：连接 MQTT 后在 `PSDK Control` 完成一次“手动校验成功 -> 发送命令 -> 收到 services_reply”闭环。
- [ ] 4.4 手工验证失败路径：md5 不一致或 URL 不可访问时，系统阻止发送且错误可定位。
- [ ] 4.5 手工验证超时路径：在无 ACK 场景下确认 `speaker_audio_play_start` 仍按既有 timeout 语义表现（无新增 topic/字段副作用）。
