## 1. 现状梳理与视图模型

- [ ] 1.1 审阅 `src/components/app/CommandSequencePanel.tsx`，列出当前 UI 区块与状态来源，形成重构映射清单（概览区/步骤区/反馈区）。
- [ ] 1.2 在 `CommandSequencePanel` 内新增统一状态派生逻辑（基于 `status`、`activeIndex`、`results`、`waitState`），避免分散判断并作为卡片渲染输入。

## 2. 面板结构与视觉重构

- [ ] 2.1 重构 `CommandSequencePanel` 顶部区域，新增序列运行概览（总步数、当前步、状态、倒计时、Stop 请求状态）。
- [ ] 2.2 将步骤列表改为状态化卡片视图，确保每步展示 method label、method、summary、wait 信息，并对 active/failed/timeout 做视觉区分。
- [ ] 2.3 优化空状态与按钮排布（Add/Run/Stop/Clear），在桌面与移动端保持可读、可点击和层次清晰。

## 3. 交互与失败诊断增强

- [ ] 3.1 在 `CommandSequencePanel` 内实现失败诊断区，展示失败步骤、method、result/timeout 原因，并与失败卡片联动高亮。
- [ ] 3.2 保持并验证步骤操作回调契约不变（`onMoveStep`、`onRemoveStep`、`onAddStep`、`onRun`、`onStop`、`onClear`），避免破坏 `App.tsx` 执行逻辑。
- [ ] 3.3 视情况微调 `src/components/app/CommandSequenceAddModal.tsx` 的入口与文案，使新增步骤路径与新面板结构一致。

## 4. 协议兼容与代码整理

- [ ] 4.1 复核 `src/App.tsx` 的 sequence 运行流程，确认 publish topic、reply 判定、超时（10s）和 stop 语义在重构后保持不变。
- [ ] 4.2 如需新增 UI 辅助类型，仅在视图层增量定义，确保不改动 `src/types/psdk.ts` 的 MQTT payload 合同。
- [ ] 4.3 清理重复样式与无效分支，保证 Tailwind class 分组可读且禁用态/运行态样式一致。

## 5. 验证与交付

- [ ] 5.1 运行 `npm run lint`，修复新增/改动代码触发的 ESLint 问题。
- [ ] 5.2 运行 `npm run build`，确认 TypeScript 与 Vite 生产构建通过。
- [ ] 5.3 手工验证连接与消息链路：Connect MQTT、发送命令 publish、接收 `services_reply` 成功与失败反馈。
- [ ] 5.4 手工验证序列行为：多步骤运行、等待倒计时、Stop 中断、ACK 超时后 timeout 与 skipped 标记是否符合 spec。
