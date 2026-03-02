## Why

当前 `Command Sequence` 的信息层级与交互路径偏平，用户在编辑步骤、观察执行进度、定位失败原因时需要频繁在列表、提示文案和结果状态之间来回比对，操作成本较高。随着调试任务复杂度上升（步骤更多、参数更多、重试更频繁），需要一次以“可视化优先、操作闭环优先”为目标的重构，提升可读性、可操作性和整体界面品质。

## What Changes

- 重构 `Command Sequence` 面板的信息架构：将“序列概览、步骤编辑、运行状态、失败定位”分层展示，降低扫描成本。
- 优化步骤编辑体验：提供更直观的步骤卡片与关键参数摘要，减少误操作并缩短构建序列时间。
- 优化运行反馈体验：强化当前执行步骤、等待倒计时、成功/失败状态的视觉区分，提升运行过程可理解性。
- 增强失败诊断可见性：将失败步骤、失败原因、上下文信息以就地可读方式展示，降低排障时间。
- 统一视觉样式：改进间距、对比度、排版和交互状态（hover/disabled/running），使页面更美观且一致。
- 保持 MQTT 消息语义与执行语义不变：不改变 topics、payload 字段、`10s` 回复超时默认策略与现有命令发送逻辑。
- Non-goals：
  - 不引入新的命令方法或新的 MQTT topic。
  - 不修改 `services_reply` 的判定规则与结果码语义。
  - 不新增后端接口与鉴权流程。

## Capabilities

### New Capabilities
- `command-sequence-experience`: 定义 Command Sequence 的可视化结构、编辑交互、运行反馈与失败呈现规范，确保“更直观、更易用、更美观”的行为可验证。

### Modified Capabilities
- 无

## Impact

- Affected code:
  - `src/components/app/CommandSequencePanel.tsx`
  - `src/components/app/CommandSequenceAddModal.tsx`
  - `src/App.tsx`（序列相关 state/回调透传与展示数据）
  - 可能涉及通用样式文件（如 `src/App.css` 或组件样式类）
- APIs / protocols:
  - 不变；继续使用 `thing/product/{gateway_sn}/services` 与 `thing/product/{gateway_sn}/services_reply`。
  - 不新增 `.env` 键，不调整现有默认值。
- Dependencies:
  - 预期不新增运行时依赖。
- Risks:
  - UI 重构可能引入状态映射偏差（例如 activeIndex、waitState 与步骤卡片高亮不同步）。
  - 交互重排可能导致局部可用性回退（键盘可达性、按钮禁用时机）。
  - 视觉增强若处理不当可能影响小屏布局可读性。
