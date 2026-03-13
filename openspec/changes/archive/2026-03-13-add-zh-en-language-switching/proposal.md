## Why

当前界面文案、状态提示、按钮文案和 `window.alert` 基本为英文，中文使用者在执行 MQTT 调试、命令下发和序列排障时需要额外做术语映射，增加了误判与误操作成本。与此同时，现有标题、标签、badge 大量使用 uppercase 和较宽 letter-spacing，适合英文短词，但在切换到中文后会出现视觉密度不一致、换行不自然和局部信息拥挤的问题，因此需要同时补齐中英切换能力与中文显示适配。

## What Changes

- 新增应用级语言切换能力，支持 `zh-CN` 与 `en` 两种界面语言，并在渲染层提供可见的切换入口。
- 为界面文案建立统一的本地化来源，覆盖页头、面板标题、按钮、表单标签、placeholder、状态标签、校验提示、空态文案和 `window.alert` 提示。
- 为中文界面增加 locale-aware 显示适配，包括标题/标签的字距与大小写策略、按钮与信息卡片的换行表现，以及中文长文案下的布局稳定性。
- 保持现有 MQTT `state/events/services/services_reply` topic、payload 结构、ACK/timeout 语义和桌面安全边界不变，本次变更仅影响 renderer 侧展示与交互文案。
- 非目标：不引入第三种语言，不改动后端 API 或 MQTT 协议，不新增 `.env` 配置项，不把语言偏好写入桌面本地配置文件。
- 风险：若有漏翻译或运行时拼接文案未收敛，可能出现中英文混排；中文标签长度上升后，局部按钮组和表格列宽可能需要微调。
- `.env` 影响：无新增或变更。

## Capabilities

### New Capabilities
- `ui-language-switching`: 提供中英界面切换、语言偏好持久化，以及面向中文文案的 renderer 页面显示适配。

### Modified Capabilities
- （无）

## Impact

- 受影响代码：
  - `src/App.tsx`（页头语言入口、运行时提示文案、本地语言状态）
  - `src/components/app/*`（各面板标题、按钮、空态、表格、Modal 文案接入本地化）
  - `src/components/app/view-helpers.ts` 与 `src/types/psdk.ts`（命令标签、状态标签、未知值回退文案）
  - `src/components/app/ui.tsx` 与 `src/index.css`（通用标题/标签/badge 的中文显示适配）
  - 可能新增 `src/lib/i18n.ts`、`src/types/app.ts` 或等价模块，用于集中管理语言字典与类型
- 对外 API / MQTT 协议：无变更，publish/subscribe topic 与 `services_reply` ACK 判定保持现状
- 依赖与构建：预期无需新增第三方依赖，可基于现有 React + TypeScript 能力实现
