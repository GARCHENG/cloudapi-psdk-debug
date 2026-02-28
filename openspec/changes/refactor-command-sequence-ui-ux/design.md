## Context

当前 Command Sequence 相关能力由 `src/App.tsx` 管理执行状态与消息流，`src/components/app/CommandSequencePanel.tsx` 负责展示与交互，`CommandSequenceAddModal.tsx` 负责新增步骤。现状的问题不是 MQTT 协议能力不足，而是 UI 信息密度高、层次弱、状态提示分散，导致用户在“编辑-运行-诊断”链路上认知负担偏高。

约束条件：
- 必须保持现有 publish/subscribe 路径不变：
  - publish: `thing/product/{gateway_sn}/services`
  - subscribe: `thing/product/{gateway_sn}/services_reply`
  - 事件辅助显示仍可读取 `thing/product/{gateway_sn}/events`
- 不改变 `tid/bid` 关联与 `result` 判定语义，ACK 仍以 `services_reply` 为准。
- 不新增 `.env` 配置与运行时依赖。
- 复用既有 `useMqtt`、topic builder 和既有面板结构，避免不必要抽象。

## Goals / Non-Goals

**Goals:**
- 让步骤构建与调整更直观：用户能快速理解当前序列结构、每步关键参数和等待时间。
- 让运行过程更可解释：用户能即时识别“当前步、等待中、已完成、失败点”。
- 让失败定位更高效：失败原因与失败上下文在同一视觉区域可读。
- 提升视觉一致性与美观度，并保持移动端/窄屏可用。

**Non-Goals:**
- 不修改 MQTT 协议层、topic 结构、payload 字段与命令方法集合。
- 不改变命令超时默认值（`10s`）和 sequence 执行语义（顺序执行、可停止、逐步等待）。
- 不新增后端 API、不引入全新状态管理库。

## Decisions

1. 分层重构面板信息结构，保持执行逻辑在 `App.tsx`
- 决策：`App.tsx` 继续持有 sequence state 与 run loop，`CommandSequencePanel` 只负责展示和触发回调。
- 原因：避免触碰核心消息流与 ACK 逻辑，降低回归风险。
- 备选方案：把 run loop 下沉到新 hook（如 `useCommandSequenceRunner`）。
- 不选原因：本次目标聚焦交互与视觉，额外抽象会扩大变更面和验证成本。

2. 将步骤列表升级为“状态化步骤卡片”
- 决策：每步展示 method label、参数摘要、等待时长、执行状态标识（idle/pending/success/failure/timeout/skipped），并对 active step 提供显著高亮。
- 原因：通过卡片化和状态可视化减少用户跨区域比对。
- 备选方案：保持表格/行式列表，仅增加文本提示。
- 不选原因：可读性改善有限，仍难快速定位当前步和失败点。

3. 增强运行反馈区域，形成固定“运行概览条”
- 决策：在面板头部增加序列运行概览（总步数、当前步、倒计时、整体状态、停止请求状态），并和步骤卡片状态联动。
- 原因：将关键信息集中，降低注意力切换。
- 备选方案：只在原有状态文案上补充描述。
- 不选原因：信息仍分散，视觉权重不足。

4. 失败诊断就地呈现，不跳转其他面板
- 决策：当失败/超时时，在序列面板内展示失败步骤、失败 method、result/timeout 原因，并滚动定位到失败步。
- 原因：排障路径最短，避免用户去 Command Results 区域二次查找。
- 备选方案：仅保留 toast 或顶部错误字符串。
- 不选原因：瞬时反馈易丢失，定位效率低。

5. 保持 TypeScript 合同稳定，仅对视图模型做增量补充
- 决策：复用 `CommandSequenceStep`、`SequenceStepResult`、`SequenceRunStatus` 等既有类型；如需 UI 衍生字段，在组件内部通过 `useMemo` 派生，不改 MQTT payload 类型。
- 原因：确保协议合同稳定，避免引发跨模块连锁修改。
- 备选方案：新增一套 sequence UI DTO 并在多层传递。
- 不选原因：收益有限，复杂度上升。

## Risks / Trade-offs

- [步骤状态映射不一致] → Mitigation: 为 `activeIndex + results + waitState + sequenceStatus` 建立统一派生函数，避免各处重复判断。
- [视觉增强导致窄屏拥挤] → Mitigation: 使用响应式断点调整卡片布局与按钮排列，移动端降级为单列。
- [重构期间交互回退] → Mitigation: 保留原有回调签名（`onRun/onStop/onMoveStep/onRemoveStep/onAddStep`），通过手工回归关键路径验证。
- [失败提示与日志面板信息重复] → Mitigation: 序列面板展示“定位信息”，日志面板保留“历史明细”，职责分离。

## Migration Plan

1. 先重构 `CommandSequencePanel` 的结构与样式，不改 `App.tsx` 执行逻辑。
2. 接入统一状态派生并联动 `waitState/activeIndex/results`。
3. 增强失败信息展示与失败步定位。
4. 回归验证：新增步骤、调整顺序、运行成功、运行失败、超时、手动停止。
5. 若出现回归，可回滚到原面板组件实现，`App.tsx` 逻辑无需回退。

## Open Questions

- 是否需要在本次重构中加入“步骤折叠/展开”以处理超长序列？（默认先不做）
- 是否需要支持“复制步骤”快捷操作？（当前提案不包含）
- 是否要对失败步骤提供“一键重跑从该步开始”？（涉及执行语义变更，暂不纳入）
