## 1. 状态模型拆分与类型约束

- [x] 1.1 在 `src/App.tsx` 新增 sequence builder 专用默认参数状态，并移除 `sequenceDefaults` 对 `PSDK Control` 输入状态的直接派生。
- [x] 1.2 在 `src/types` 或相关组件中补充/复用 sequence 默认参数类型，确保字段覆盖 `psdk_index`、speaker、TTS、input_box、widget、waitSeconds。
- [x] 1.3 校准默认值初始化策略：sequence 默认参数在页面会话内独立维护，不随 `PSDK Control` 输入变化自动更新。

## 2. Command Sequence 数据流改造

- [x] 2.1 调整 `src/components/app/CommandSequencePanel.tsx` 的 props 与回调，接入 sequence builder 独立默认参数。
- [x] 2.2 调整 `src/components/app/CommandSequenceAddModal.tsx` 草稿初始化与确认回写逻辑，使新增步骤后可更新 sequence 默认参数上下文。
- [x] 2.3 确保 `onAddStep` 仍按既有方式生成 `method/data/waitMs`，仅替换参数来源，不改变步骤结构与执行语义。

## 3. 手动命令与协议行为回归保护

- [x] 3.1 检查 `src/App.tsx` 中手动发送链路（`sendCommand` / `dispatchCommand`）仍仅使用 `PSDK Control` 状态构建 payload。
- [x] 3.2 检查序列运行链路（`runSequence` / `sendCommandWithAck`）仍沿用既有 ACK 判定与 timeout 处理。
- [x] 3.3 确认 MQTT topic 与消息合同无变化：继续发布 `thing/product/{gateway_sn}/services`，并由 `services_reply` 更新命令结果。

## 4. 验证与回归检查

- [x] 4.1 运行 `npm run lint` 并修复新增改动引入的问题。
- [x] 4.2 运行 `npm run build`，确认 TypeScript 编译与打包通过。
- [ ] 4.3 手工验证连接流程：完成 MQTT connect，确认 `events/state/services_reply` 订阅与状态展示正常。
- [ ] 4.4 手工验证独立性：在 `PSDK Control` 修改参数后，`Add Sequence Step` 对应参数不联动；在 `Add Sequence Step` 修改并新增后，`PSDK Control` 参数不联动。
- [ ] 4.5 手工验证命令链路：分别执行手动命令与序列命令，确认 publish 成功、`services_reply` 正常回填、非 0 result 与 ACK timeout 行为保持原语义。
