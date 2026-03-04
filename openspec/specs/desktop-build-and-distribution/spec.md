# desktop-build-and-distribution Specification

## Purpose
TBD - created by archiving change migrate-to-electron-vite-desktop. Update Purpose after archive.
## Requirements
### Requirement: 桌面开发模式统一入口
系统 MUST 提供基于 electron-vite 的桌面开发命令，以同时启动 Electron 主进程与渲染层开发服务。开发模式下渲染界面变更 SHALL 支持热更新或快速刷新。

#### Scenario: 启动桌面开发环境
- **WHEN** 开发者执行约定的桌面开发脚本（如 `npm run dev:desktop`）
- **THEN** 系统启动可交互的桌面窗口，并加载当前本地代码版本用于调试

### Requirement: 生产构建与打包产物
系统 MUST 提供桌面生产构建与打包命令，输出可分发的安装包或可执行文件。构建流程 SHALL 包含 main、preload、renderer 三端产物并保持版本一致。

#### Scenario: 执行桌面生产打包
- **WHEN** 开发者执行桌面打包脚本（如 `npm run build:desktop`）
- **THEN** 系统生成可安装或可执行的桌面分发产物，且可在目标系统启动应用

### Requirement: Web 构建链路兼容保留
引入 Electron 后系统 MUST 保留既有 Web 运行与构建命令（`npm run dev/build/preview`）的可用性，避免影响现有纯浏览器调试与回归流程。

#### Scenario: 继续执行 Web 构建命令
- **WHEN** 开发者执行现有 Web 构建命令
- **THEN** 系统成功完成原有流程，且不依赖 Electron 运行时

