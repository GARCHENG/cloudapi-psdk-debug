## 1. 语言基础设施与入口

- [x] 1.1 在 `src/types` 与 `src/lib` 中新增语言类型、存储 key 和双语字典模块，覆盖共享按钮、状态、错误、提示和面板文案
- [x] 1.2 更新 `src/App.tsx`，接入语言初始化与持久化逻辑，并在页头提供中英切换入口

## 2. 组件文案本地化

- [x] 2.1 更新 `src/components/app/ui.tsx`、`src/components/app/view-helpers.ts` 与 `src/types/psdk.ts`，让共享标题、badge、命令标签、进度标签和未知值回退文案支持双语
- [x] 2.2 更新 `src/components/app/ConnectionPanel.tsx`、`src/components/app/SpeakerControlPanel.tsx`、`src/components/app/CommandResultsPanel.tsx`、`src/components/app/PlayProgressPopup.tsx` 和 `src/App.tsx` 中的运行时提示，使连接、控制、结果和 alert 文案支持双语
- [x] 2.3 更新 `src/components/app/CommandSequencePanel.tsx`、`src/components/app/CommandSequenceAddModal.tsx`、`src/components/app/PsdkStatePanel.tsx`、`src/components/app/FloatingWindowPanel.tsx` 和 `src/components/app/WidgetValueExampleModal.tsx`，使序列、状态和示例选择相关文案支持双语

## 3. 中文显示适配

- [x] 3.1 更新 `src/index.css` 与共享样式使用方式，为中文界面的标题、标签、badge 和按钮组提供去 uppercase、收紧 tracking 与可换行支持
- [x] 3.2 调整 `src/App.tsx` 与受影响面板的布局细节，确保中文长文案下的按钮组、卡片摘要、表格列和 Modal 在桌面与窄宽度下保持可读

## 4. 验证与回归

- [x] 4.1 运行 `npm run lint`，修复本地化与样式改动引入的静态检查问题
- [x] 4.2 运行 `npm run build` 与 `npm run build:desktop`，确认 Web 和桌面构建链路均可通过
- [x] 4.3 手工验证 `en` 与 `zh-CN` 两种语言下的 MQTT 连接、命令发布、`services_reply` 成功/失败处理和 timeout 行为，确认 topic、payload 与 ACK 判定未发生变化
- [x] 4.4 手工验证中文界面的标题、标签、按钮、placeholder、空态、错误提示、序列卡片、日志表格与 raw 诊断标识显示，确认中文排版稳定且 method code / `tid` / MD5 未被翻译
