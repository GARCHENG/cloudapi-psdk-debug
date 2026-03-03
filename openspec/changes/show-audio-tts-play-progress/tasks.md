## 1. 类型与显示辅助完善

- [ ] 1.1 在 `src/types/psdk.ts` 校准并补充播放进度相关类型（进度字段、更新时间、弹层展示所需字段），确保 Audio/TTS 进度 payload 合同清晰可用。
- [ ] 1.2 在 `src/components/app/view-helpers.ts` 统一进度文本格式化与步骤文案映射，确保 `Play Progress` 与弹层显示一致。

## 2. 进度事件处理与日志关联

- [ ] 2.1 在 `src/App.tsx` 中实现并固化进度关联规则：`tid` 优先、`bid` 回退、method 必须匹配对应 Audio/TTS 指令。
- [ ] 2.2 在 `src/App.tsx` 增加进度乱序防护（按 `updatedAt` 单调更新），避免旧事件覆盖新进度。
- [ ] 2.3 在 `src/App.tsx` 保持 ACK 与进度解耦：`services_reply` 仅更新命令状态/结果，`events` 仅更新 `playProgress` 字段。

## 3. 实时进度弹层与日志展示

- [ ] 3.1 新增或扩展 `src/components/app` 组件，实现可关闭的播放进度弹层，显示当前指令 method、阶段、百分比与标识信息（如 short tid）。
- [ ] 3.2 在 `src/App.tsx` 接入弹层状态管理（出现、更新、关闭），并在收到播放进度事件时实时刷新。
- [ ] 3.3 在 `src/components/app/CommandResultsPanel.tsx` 确认 `Play Progress` 列始终呈现对应指令的最新进度，非 Audio/TTS 指令保持 `N/A`。

## 4. 回归与验证

- [ ] 4.1 运行 `npm run lint`，修复新增改动引入的 lint 问题。
- [ ] 4.2 运行 `npm run build`，确认 TypeScript 编译与打包通过。
- [ ] 4.3 手工验证连接与消息链路：完成 MQTT 连接并订阅 `events/services_reply/state` 后，发送 Audio/TTS 播放命令，确认弹层与日志进度实时更新且能按 `tid/bid` 关联。
- [ ] 4.4 手工验证异常路径：构造 `services_reply` 非 0 与 ACK 超时场景，确认命令状态仍按 failure/timeout 判定，进度展示不篡改最终状态。
