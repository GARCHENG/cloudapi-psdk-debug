## Context

当前实现中，`src/App.tsx` 维护一组用于命令输入的状态（如 `psdkIndex`、`playVolume`、`audioUrl` 等），这组状态同时驱动：
- `PSDK Control` 的手动下发参数输入
- `Command Sequence` 中 `Add Sequence Step` 的默认参数（通过 `sequenceDefaults` 派生）

因此二者形成隐式耦合：在 `PSDK Control` 编辑参数会影响后续新增序列步骤默认值，偏离“手动调试上下文”和“序列编排上下文”应相互独立的预期。

约束：
- MQTT publish/subscribe 路径保持不变：
  - publish: `thing/product/{gateway_sn}/services`
  - subscribe: `thing/product/{gateway_sn}/services_reply`、`thing/product/{gateway_sn}/events`、`thing/product/{device_sn}/state`
- ACK 语义保持不变：命令成功仍由 `services_reply.data.result === 0` 判定，超时策略保持现状。
- 不引入新依赖，不改动后端协议，不新增 `.env` 变量。

## Goals / Non-Goals

**Goals:**
- 将 `PSDK Control` 与 `Add Sequence Step` 的参数状态拆分为两套独立来源，互不联动。
- 使序列构建拥有独立且可持续使用的默认参数上下文，避免被手动调试输入覆盖。
- 在保持现有命令下发、ACK、超时、序列执行流程不变的前提下完成改造。

**Non-Goals:**
- 不修改任何 MQTT topic、payload 字段结构、`tid/bid` 关联规则。
- 不新增命令方法，不改动 `runSequence` 的执行推进语义。
- 不引入全局状态库或跨模块架构重构。

## Decisions

### 决策 1：在 `App.tsx` 引入独立的序列默认参数状态
- 方案：新增一组专用于 sequence builder 的默认参数状态（可为对象状态或等价的字段状态），与 `PSDK Control` 使用的输入状态彻底分离。
- 原因：`App.tsx` 已是命令与序列的汇聚层，在此拆分状态可以最小化改动面并避免跨层同步复杂度。
- 备选方案：继续复用手动参数状态，仅在打开弹窗时复制快照。
  - 放弃原因：快照来源仍是手动状态，无法满足“长期独立上下文”的需求。

### 决策 2：`CommandSequenceAddModal` 仅消费 sequence 默认参数并回写 sequence 上下文
- 方案：`CommandSequenceAddModal` 打开时以 sequence 默认参数初始化草稿；用户确认新增步骤后，将本次草稿回写为“下一次新增步骤默认值”（仅回写 sequence 上下文）。
- 原因：符合用户对“序列编排是连续工作流”的操作习惯，同时保持与手动面板隔离。
- 备选方案：草稿仅在弹窗内临时存在，不回写默认值。
  - 放弃原因：每次新增步骤都需要重复输入，不利于批量编排。

### 决策 3：保持命令构建与协议链路不变，仅替换参数来源
- 方案：手动命令仍使用 `PSDK Control` 状态构建 payload；序列新增步骤改为使用 sequence 默认参数构建 step `data`。
- 原因：变更仅针对前端状态归属，不应影响消息合同与回复判定。
- 备选方案：统一改造命令构建函数签名与调用路径。
  - 放弃原因：会扩大回归面，且对本需求收益有限。

### 决策 4：在类型层抽象共享字段结构，减少双份状态漂移风险
- 方案：为 sequence 默认参数定义明确 TypeScript 类型（复用或新增），约束字段完整性与取值范围。
- 原因：拆分状态后最常见风险是字段遗漏或校验不一致，类型约束可提前暴露问题。
- 备选方案：完全依赖 `Record<string, unknown>`。
  - 放弃原因：难以保证字段一致性，重构成本高。

## Risks / Trade-offs

- [风险] 双状态源可能出现校验规则不一致  
  -> 缓解：复用已有校验逻辑与 helper，尽量共用同一验证函数。
- [风险] 用户可能期待“手动参数一键带入序列”  
  -> 缓解：本次明确保持独立；如后续需要可增加显式“从 PSDK Control 复制”按钮（非本次范围）。
- [权衡] 相比当前实现，状态与 props 数量会增加  
  -> 缓解：优先在 `App.tsx` 局部封装并保持命名清晰，避免额外抽象层。

## Migration Plan

1. 在 `src/App.tsx` 增加 sequence 默认参数状态，并停止 `sequenceDefaults` 对手动输入状态的直接派生。
2. 调整 `CommandSequencePanel` / `CommandSequenceAddModal` 入参与回调，使 sequence 草稿只读写 sequence 默认参数。
3. 保持 `dispatchCommand`、`sendCommandWithAck`、`runSequence` 主链路不变，验证 payload 与 ACK 语义未回归。
4. 执行 `npm run lint` 与 `npm run build`。
5. 手工验证场景：
   - 在 `PSDK Control` 修改参数后，`Add Sequence Step` 对应字段不被联动修改。
   - 在 `Add Sequence Step` 修改参数并新增步骤后，`PSDK Control` 对应字段不变化。

## Open Questions

- 是否需要在 UI 上增加“重置序列默认参数”为初始值的显式入口？
- 是否需要未来增加“显式从 PSDK Control 复制当前参数到 sequence 默认参数”的便捷操作？
