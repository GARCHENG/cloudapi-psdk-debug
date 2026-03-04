## Why

当前项目仅支持浏览器运行，在本地设备调试、离线部署、窗口级资源管理与原生分发方面受限。将应用升级为桌面端可提升稳定性与交付一致性，并为后续日志落盘、自动更新、系统级集成打基础。

## What Changes

- 引入 Electron + electron-vite 桌面运行时，新增主进程、预加载脚本与安全通信桥接。
- 迁移开发与构建流程：支持桌面端开发调试、生产打包与分发产物输出。
- 维持现有 MQTT 调试工作流（topic 订阅、服务发布、指令序列）在桌面端行为一致。
- 增加桌面端配置读取策略（优先本地配置，其次 `.env` 默认值），避免硬编码 broker 与设备标识。
- 明确非目标：本次不实现自动更新、远程配置中心与多窗口协同。

## Capabilities

### New Capabilities
- `desktop-runtime-shell`: 使用 Electron 承载 React 调试界面，定义窗口生命周期、单实例与安全边界（contextIsolation + preload API）。
- `desktop-build-and-distribution`: 使用 electron-vite 管理桌面开发/构建/打包流程，产出可安装或可执行桌面发行物。
- `desktop-config-bridge`: 定义桌面端配置与渲染进程访问机制，保证 MQTT 连接参数与调试行为在桌面环境可持续使用。

### Modified Capabilities
- 无

## Impact

- 依赖：新增 `electron`、`electron-vite` 及配套构建/打包依赖。
- 构建系统：新增 Electron 入口与打包配置，调整 `npm` scripts（如 `dev:desktop`、`build:desktop`）。
- 代码结构：新增主进程/预加载目录，渲染进程通过受限 IPC API 访问桌面能力。
- MQTT 消息流影响：topic 模板与 payload 结构保持不变；仅运行容器从浏览器切换为桌面壳。
- `.env` 影响：不强制新增 `VITE_` 键；若缺失 MQTT 默认值，桌面端将提示或使用本地配置文件回退策略。
- 风险：打包体积增大、跨平台签名与分发策略复杂度提升、IPC 边界配置不当可能带来安全风险。
