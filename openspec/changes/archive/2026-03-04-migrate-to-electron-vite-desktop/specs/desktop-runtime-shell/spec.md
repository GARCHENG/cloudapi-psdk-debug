## ADDED Requirements

### Requirement: 桌面主窗口生命周期
系统 MUST 以 Electron 主进程启动单实例桌面应用，并在启动后创建主窗口承载现有 React 调试界面。主窗口关闭时 SHALL 触发受控退出流程，避免异常残留进程。

#### Scenario: 正常启动桌面应用
- **WHEN** 用户执行桌面开发或生产启动命令
- **THEN** 系统创建单个主窗口并加载渲染页面，界面可进入 MQTT 调试流程

#### Scenario: 重复启动应用
- **WHEN** 用户在已有实例运行时再次启动应用
- **THEN** 系统 SHALL 聚焦已运行实例且不再创建第二个主窗口

### Requirement: 渲染进程安全边界
系统 MUST 在 BrowserWindow 中启用 `contextIsolation: true` 且禁用 `nodeIntegration`，并仅通过 preload 暴露白名单 API。渲染进程 MUST NOT 直接访问 Node.js 文件系统或进程 API。

#### Scenario: 渲染进程请求未授权 Node 能力
- **WHEN** 渲染进程尝试直接访问 Node 全局对象或未暴露 API
- **THEN** 系统拒绝访问并保持应用继续运行

### Requirement: MQTT 消息流行为保持一致
桌面化后系统 SHALL 保持现有 topic 模板与命令状态机不变：
- 订阅 `thing/product/{device_sn}/state`
- 订阅 `thing/product/{gateway_sn}/events`
- 发布 `thing/product/{gateway_sn}/services`
- 订阅 `thing/product/{gateway_sn}/services_reply`
发布 services 指令后 MUST 依据 services_reply 回执更新 pending/success/failure/timeout 状态。

#### Scenario: 服务指令回执驱动状态更新
- **WHEN** 用户在桌面应用中发布 services 指令并收到对应 services_reply
- **THEN** 系统按回执结果更新指令状态，且展示逻辑与 Web 版本一致
