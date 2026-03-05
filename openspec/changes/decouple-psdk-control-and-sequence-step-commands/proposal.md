## Why

当前 `PSDK Control` 与 `Command Sequence -> Add Sequence Step` 共享同一组命令输入状态，导致两处参数会相互影响。用户在 `PSDK Control` 中临时修改参数后，会意外改写后续新增序列步骤的默认值；反之在序列构建过程中调整参数，也会干扰手动单次下发命令的输入上下文。该耦合会增加误操作风险，降低调试可预测性。

## What Changes

- 将 `PSDK Control` 与 `Add Sequence Step` 的参数状态拆分为两套独立状态源，互不读写、互不覆盖。
- `Add Sequence Step` 打开时使用其独立默认参数（序列构建上下文），不再从 `PSDK Control` 当前输入实时派生。
- 在序列构建过程中，用户更新序列参数后，仅影响后续“新增序列步骤”时的默认值，不影响 `PSDK Control`。
- 保持既有 MQTT topic、payload 字段、命令 ACK/超时语义与步骤执行逻辑不变，仅调整前端状态归属与交互行为。
- 非目标：不新增命令类型、不改动 `services/services_reply/events/state` 消息流、不改动 `.env` 配置。
- 风险：状态拆分后若初始化策略不清晰，可能出现“用户认为两处应同步”的预期偏差；需在设计中明确初始化与重置边界。
- `.env` 影响：无新增或变更。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `command-sequence-experience`：修改序列步骤新增流程的参数来源与状态边界，要求与 `PSDK Control` 参数编辑独立。

## Impact

- 受影响代码：
  - `src/App.tsx`（状态拆分、props 传递、默认值初始化策略）
  - `src/components/app/CommandSequencePanel.tsx`（序列新增入口对独立默认参数的接入）
  - `src/components/app/CommandSequenceAddModal.tsx`（草稿状态与默认值生命周期管理）
  - 可能涉及 `src/types/psdk.ts` 或组件局部类型（若引入新的默认参数类型）
- 对外 API / MQTT 协议：无变更
- 依赖与构建：无新增第三方依赖
