Plan



# psdk-debug-front 桌面化改造计划（Tauri 2 / Windows 首期）

## 简要摘要

- 目标：将现有 React + Vite 项目改造成可安装、可便携运行的 Windows 桌面应用，同时保留现有 Web 版本。
- 已锁定决策：Tauri 2、Windows only、1:1 功能迁移、自动保存非敏感配置、不保存 MQTT 密码、允许任意 MQTT 地址、应用名 PSDK Debug Desktop、安装包 + ZIP 便携版、自动更新暂不做、签名仅预留配置位。
- 非目标（首期不做）：托盘、开机自启、全局快捷键、自动更新服务、跨平台发布（macOS/Linux）。

## 实施方案（决策完整，可直接执行）

## 1) 引入 Tauri 2 基础工程（保留 Web 能力）

- 新增 src-tauri/ 标准目录（[Cargo.toml](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#)、[main.rs](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#)、[tauri.conf.json](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#) 等）。

- tauri.conf.json

   

  固定配置：

  - productName: PSDK Debug Desktop
  - identifier: com.psdk.debug.desktop
  - build.beforeDevCommand: npm run dev
  - build.beforeBuildCommand: npm run build
  - build.devUrl: http://localhost:5173
  - build.frontendDist: ../dist
  - 主窗口：title=PSDK Debug Desktop、resizable=true、width=1400、height=900、minWidth=1200、minHeight=760、center=true
  - bundle.targets: msi + nsis
  - 自动更新关闭（仅保留后续扩展空间，不启用 updater）

- 依赖变更：

  - devDependencies 增加 @tauri-apps/cli
  - dependencies 增加 @tauri-apps/api

- package.json

   

  新增命令（不改现有

   

  dev/build/preview/lint

  ）：

  - desktop:dev → tauri dev
  - desktop:build → tauri build --bundles msi,nsis
  - desktop:build:bin → tauri build --bundles none
  - desktop:build:portable → [package-portable.mjs](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#)

- .gitignore 增加桌面构建产物忽略（如 src-tauri/target、dist-desktop）。

## 2) 桌面端配置持久化（自动保存、密码不落盘）

- 新增

   

  desktopSettings.ts

  ，定义并实现本地持久化：

  - LOCAL_STORAGE_KEY = 'psdk_debug_desktop_settings_v1'
  - 类型：
    - DesktopSettingsV1：version、brokerUrl、mqttUsername、gatewaySn、deviceSn、psdkIndex、updatedAt
  - 方法：
    - loadDesktopSettings()
    - saveDesktopSettings()
    - clearInvalidDesktopSettings()

- 修改

   

  App.tsx

   

  状态初始化与同步逻辑：

  - 初始化优先级：localStorage > .env 默认值 > 空值
  - 仅持久化非敏感字段：brokerUrl/mqttUsername/gatewaySn/deviceSn/psdkIndex
  - mqttPassword 明确不保存，每次启动为空或 .env 回填（若用户本地配置）
  - 写入使用 300ms 去抖，避免频繁 IO
  - 解析异常时自动回退并清理坏数据

- 修改

   

  ConnectionPanel.tsx

  ：

  - 在密码输入区域增加固定提示：“密码不会被本地保存”。

## 3) 桌面安全与网络策略（匹配测试工具场景）

- 在 Tauri 安全配置中明确

   

  connect-src

   

  允许：

  - ws: / wss:（MQTT over WebSocket）
  - http: / https:（必要的网络访问）

- 不引入文件系统写入、shell 执行等额外高权限插件。

- 保持前端现有 [...')](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#) 机制；在打包版验收中验证静态资源可读性。

## 4) 便携版产物（ZIP 解压即用）

- 新增

   

  package-portable.mjs

  ：

  - 输入：desktop:build:bin 生成的 release 可执行文件
  - 输出：[PSDK-Debug-Desktop-portable.zip](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#)
  - ZIP 内容：
    - 主程序 [PSDK-Debug-Desktop.exe](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#)
    - [README-portable.txt](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#)（启动方式、WebView2 依赖说明、已知限制）

- 安装包产物路径按 Tauri 默认输出（msi + nsis），便携包走 dist-desktop 独立目录。

## 5) 文档与发布流程补齐

- 更新

   

  README.md

  ：

  - 新增桌面开发与构建命令
  - 新增前置要求：Rust toolchain、Windows WebView2 Runtime

- 新增

   

  desktop-release.md

  ：

  - 本地打包步骤（dev / build / portable）
  - 产物清单与验收清单
  - Windows 签名“预留位”说明（本期不启用）

- 可选新增

   

  desktop-signing-template.md

  ：

  - 记录后续签名流程占位（证书、时间戳、CI 注入点）。

## Public API / Interface / Type 变更

- 新增 npm 命令接口（对开发/发布流程是公开契约）：
  - desktop:dev
  - desktop:build
  - desktop:build:bin
  - desktop:build:portable
- 新增前端持久化类型契约：
  - DesktopSettingsV1（版本化结构，后续可迁移）
- 业务协议层（MQTT topic、payload 类型）不变，[psdk.ts](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#) 不改协议语义。

## 测试与验收场景

## 自动化命令验收

- npm run lint 通过。
- npm run build 通过（Web 构建保持可用）。
- npm run desktop:dev 可启动桌面窗口并加载页面。
- npm run desktop:build 产出 msi 与 nsis。
- npm run desktop:build:portable 产出 [portable.zip](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#)。

## 功能验收（手工）

- 首次启动：连接参数从 .env 正常回填。
- 修改 brokerUrl/mqttUsername/gatewaySn/deviceSn/psdkIndex 后重启：值保留。
- 输入 mqttPassword 后重启：密码为空（不保留）。
- MQTT 可连接 ws:// 与 wss:// 地址。
- [registry.json](https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/jzgar/.vscode/extensions/openai.chatgpt-0.4.71-win32-x64/webview/#) 与设备配置 JSON 在桌面打包版可正常加载。
- Web 端 npm run dev 功能不受影响。

## 异常与边界场景

- localStorage 数据被破坏：应用不崩溃，自动回退默认并清理坏数据。
- MQTT 地址非法：维持当前错误提示行为，不新增协议语义。
- 无网络环境：应用可启动，静态页面可用，网络操作给出原有失败提示。

## 假设与默认值（已锁定）

- 当前环境可用：Node v22.19.0、npm 10.9.3、Rust 1.83.0（已确认）。
- @tauri-apps/cli 当前仓库尚未安装（实施时补齐）。
- 首期仅 Windows x64 发布。
- 首期不引入自动更新、不启用代码签名，仅保留文档占位。
- 首期不做系统托盘/开机自启/全局快捷键等系统级增强，确保 1:1 功能迁移优先完成。