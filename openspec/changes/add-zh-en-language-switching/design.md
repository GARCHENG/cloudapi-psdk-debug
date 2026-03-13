## Context

`psdk-debug-front` 当前是一个运行在 Web / Electron renderer 中的 MQTT 调试控制台，主要通过以下固定消息路径与设备交互：

- 订阅 `thing/product/{device_sn}/state`
- 订阅 `thing/product/{gateway_sn}/events`
- 订阅 `thing/product/{gateway_sn}/services_reply`
- 发布 `thing/product/{gateway_sn}/services`

命令成功或失败仍以 `services_reply.data.result` 为准，未收到回执时继续沿用当前 10 秒 timeout 语义。本次需求不改变任何 topic、payload、ACK 逻辑或桌面 IPC 边界，只在 renderer 侧新增语言偏好与本地化展示。

从代码现状看，用户可见文案分散在 `src/App.tsx`、`src/components/app/*`、`src/components/app/view-helpers.ts` 和 `src/types/psdk.ts` 中，且大量标题、标签、badge 依赖共享样式类（如 `.panel-title`、`.label`、`.badge`）实现 uppercase 与大字距展示。当前 body 已使用 `Noto Sans SC`，但标题与标签仍明显偏向英文视觉节奏，因此仅替换文案无法满足“页面适配中文显示”的目标。

## Goals / Non-Goals

**Goals:**
- 提供显式的中英语言切换入口，支持 `zh-CN` 与 `en`
- 在 renderer 内持久化语言偏好，并在刷新或桌面重新打开后恢复用户选择
- 将面板标题、按钮、placeholder、状态标签、空态、校验提示、`window.alert` 和进度/结果说明统一接入本地化
- 针对中文界面调整共享排版与布局策略，避免 uppercase、过宽字距和长文案导致的挤压/换行问题
- 确保两种语言下 MQTT 连接、命令发布、`services_reply` 回执匹配和 timeout 行为完全一致

**Non-Goals:**
- 不修改 MQTT topic、payload 字段、ACK 判定或序列执行语义
- 不引入新的桌面 IPC、preload API 或主进程配置持久化能力
- 不翻译 `tid`、`bid`、method code、topic 字符串、SN、MD5 等原始诊断标识
- 不在本次引入第三方 i18n 框架；优先复用现有 React + TypeScript 能力
- 不扩展到 `zh-CN` / `en` 之外的更多语言

## Decisions

### 1) 采用 renderer 侧语言状态 + `localStorage` 持久化

- 决策：在 `src/App.tsx` 建立应用级语言状态，优先读取持久化偏好；无持久化值时，根据运行环境 locale 选择默认语言。
- 原因：该能力同时适用于 Web 与 Electron renderer，不需要改动 `window.desktop`、IPC 或桌面配置文件，能以最小影响满足“可切换 + 可记住”的体验。
- 备选方案：
  - 通过桌面配置文件持久化：会扩大到 IPC / preload / main 进程，不适合纯 UI 变更。
  - 仅按浏览器语言自动切换、不提供手动切换：无法满足用户显式切换语言的需求。

### 2) 使用类型化字典集中管理用户可见文案

- 决策：新增类似 `src/lib/i18n.ts` 与 `src/types/app.ts` 的模块，定义 `AppLanguage`、字典结构、查找 helper，以及公共状态/错误/按钮文案映射。
- 原因：当前字符串散落在多个组件和 helper 中，若继续内联条件判断，极易遗漏 `window.alert`、fallback 文案和 Modal 内容，导致中英文混排。类型化字典可以在实现阶段更容易发现缺失项。
- 备选方案：
  - 在每个组件中写 `language === 'zh-CN' ? ... : ...`：改动快，但维护成本高、容易漏项。
  - 引入 `i18next` / `react-intl`：功能完备，但对当前只有两种静态语言的单页应用来说过重。

### 3) 本地化“用户读物”，保留“协议读物”

- 决策：本地化面板标题、操作按钮、placeholder、状态说明、空态、校验失败原因、进度状态标签与运行时弹窗；继续保留 method code、topic、`tid`、`bid`、`gateway_sn`、`device_sn`、`md5` 等原始值。
- 原因：该项目是调试工具，操作者需要更容易理解交互意图，但在查看 `services_reply`、步骤详情或日志时仍必须对照原始协议标识定位问题。
- 备选方案：
  - 所有字符串都翻译：会削弱排障时对原始字段的可追踪性。
  - 只翻译标题和按钮：会保留大量英文 alert、状态文案与 fallback，无法真正完成中英切换。

### 4) 通过根级 locale 标记驱动共享样式的中文适配

- 决策：在根节点设置 `lang` 或 `data-language` 标记，让 `src/index.css`、`src/components/app/ui.tsx` 以及共享 class 组合根据当前语言调整显示策略。对中文界面取消强制 uppercase、收紧 tracking、允许按钮与信息卡片适度换行，同时保留 raw ID / code 区域的 monospace 样式。
- 原因：当前不适配中文的主要问题集中在共享样式层。优先修正通用 primitives，能避免在每个面板里重复写局部覆盖逻辑。
- 备选方案：
  - 每个组件分别修 CSS：可行，但容易产生样式漂移和遗漏。
  - 不做样式适配、仅替换文字：中文会继续出现视觉密度失衡和局部拥挤。

### 5) MQTT 消息流保持不变，只本地化派生展示

- 决策：不改动 `src/hooks/useMqtt.ts`、topic builder、命令 publish payload 与 pending/success/failure/timeout 状态机，只本地化基于这些状态生成的展示文本，如 `COMMAND_METHOD_LABELS`、进度标签、未知值回退文案、序列失败诊断与 `window.alert`。
- 原因：语言切换不应改变任何业务合同或消息流，最稳妥的做法是把改动限制在文案层和通用展示层。
- 备选方案：
  - 借本次机会重构命令流：风险高，且超出需求范围。

## Risks / Trade-offs

- [Risk] 仍有零散硬编码字符串遗漏，导致局部中英文混排 -> Mitigation：在实现阶段使用 `rg` 审核用户可见字符串，并要求所有新增文案进入统一字典
- [Risk] 中文字符串长度增加后，按钮组、卡片摘要和表格列宽更容易拥挤 -> Mitigation：为关键区域增加 `flex-wrap`、响应式堆叠和可换行文本策略，并在桌面/窄宽度下手工验证
- [Risk] 语言偏好保存在 renderer 存储中，无法跨设备或跨 profile 同步 -> Mitigation：接受为本次范围内的合理折中；该偏好不影响协议和业务数据
- [Risk] 本地化命令标签后，用户在排障时可能分不清“人类可读标签”和“协议 method” -> Mitigation：在日志、步骤详情等诊断场景继续同时展示原始 method 值

## Migration Plan

1. 新增语言类型、存储 key、字典模块与运行时 locale fallback 逻辑，约定优先级为“持久化偏好 > 运行环境 locale > `en`”
2. 在 `src/App.tsx` 接入语言状态、头部切换入口和全局 alert/描述文案
3. 改造共享 UI primitives、helper 与主要面板组件，使其从统一字典读取文案
4. 调整共享 CSS 与关键布局，确保中文模式下标题、标签、按钮和表格区域可读
5. 回归验证现有消息流：
   - 继续订阅 `state/events/services_reply`
   - 继续发布 `services`
   - 继续依据 `services_reply.data.result` 判定成功/失败
   - 继续使用现有 timeout 逻辑
6. 如上线后发现严重 UI 回归，可直接回滚 renderer 侧提交；已写入的语言偏好仅是本地存储键值，不需要数据迁移或清理

## Open Questions

- 是否在本次同步本地化 `public/widget-configs` 派生的设备类型与示例说明文案；当前先假设保留源数据原文，仅本地化框架 UI
- 是否需要在未来版本补充更多地区语言；本次会预留字典扩展结构，但不纳入交付范围
