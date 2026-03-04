## Context

当前 `psdk-debug-front` 以 `React + Vite` 运行在浏览器中，核心价值是通过 MQTT 订阅/发布完成 DJI Cloud API PSDK 调试闭环。现有 topic 与消息流为：
- 订阅 `thing/product/{device_sn}/state`（state）与 `thing/product/{gateway_sn}/events`（events）
- 发布 `thing/product/{gateway_sn}/services`（services）
- 订阅 `thing/product/{gateway_sn}/services_reply`（services_reply）并以 `tid/method` 关联命令回执

迁移为桌面应用需要在不改变上述协议与业务语义的前提下，引入 Electron 运行时、构建打包链路与进程边界。约束包括：
- 现有 `src/hooks/useMqtt.ts`、`src/lib` 与功能面板应优先复用，避免 MQTT 业务逻辑重写
- 维持 `.env` 中 `VITE_` 配置的兼容行为，同时补充桌面端本地配置读取
- 保障 Electron 安全基线（`contextIsolation: true`、`nodeIntegration: false`）

## Goals / Non-Goals

**Goals:**
- 提供可运行于 Windows/macOS 的桌面壳，渲染层继续使用现有 React UI 与 MQTT 逻辑
- 基于 electron-vite 统一开发体验，支持一条命令启动桌面调试，支持生产构建与打包
- 提供受限 preload API，让渲染进程访问必要桌面能力（读取本地配置、基础应用信息）
- 确保命令发布与回执跟踪行为保持一致：services 发布后必须在 services_reply 中产生可匹配状态更新

**Non-Goals:**
- 不在本次引入自动更新（auto-updater）与代码签名流水线
- 不改造现有 MQTT payload 结构、topic 模板或命令编排业务规则
- 不引入多窗口、插件系统或远程配置中心

## Decisions

### 1) 使用 electron-vite 作为桌面脚手架与构建管线
- 决策：采用 `electron-vite` 管理 main/preload/renderer 三端构建。
- 原因：与现有 Vite 渲染层兼容好，TypeScript 支持完整，开发模式可同时热更新 renderer。
- 备选方案：
  - 手工 `electron + vite` 配置：灵活但维护成本高，易出现 main/preload 打包不一致。
  - Tauri：体积小，但迁移成本高且与当前 JS 生态工具链衔接需要额外改造。

### 2) 维持 MQTT 业务逻辑在渲染层，主进程只负责桌面能力
- 决策：`useMqtt` 和相关 UI 组件保持在 renderer，不迁移到 main。
- 原因：最小化行为回归；MQTT topic 订阅与回执状态机已在前端逻辑沉淀。
- 备选方案：将 MQTT 移到 main 并通过 IPC 转发。该方案可减轻 renderer 压力，但会显著增加 IPC 协议与状态同步复杂度。

### 3) 通过 preload 暴露最小 API，禁止直接 Node 能力下放
- 决策：新增 `preload`，仅暴露如 `desktop.getAppInfo()`、`desktop.readConfig()`、`desktop.saveConfig()` 等白名单 API。
- 原因：降低 XSS 场景下的系统能力暴露风险，符合 Electron 安全实践。
- 备选方案：开启 `nodeIntegration` 直接在 renderer 读写文件。该方案实现快但安全风险不可接受。

### 4) 配置优先级采用“本地文件 > .env 默认值”
- 决策：桌面端首次启动读取 `userData` 目录中的配置文件，缺失时回退到 `.env`（`VITE_MQTT_URL` 等）。
- 原因：桌面应用需要可持久化与可变配置，同时保持开发环境兼容。
- 备选方案：只依赖 `.env`。该方案对分发后用户不友好，需手改环境变量。

### 5) 保持 MQTT 消息流契约不变并补充可观察性
- 决策：topic 路径保持原样；发布 services 后继续等待 services_reply ack，并保留 pending/success/failure/timeout 状态流。
- 原因：避免破坏现有调试流程与后端契约，迁移只改变运行容器。
- 备选方案：增加新的本地代理 topic。会引入协议分叉，不适合本次改造范围。

## Risks / Trade-offs

- [Risk] 打包体积明显增加，首次安装成本上升 -> Mitigation：按需引入依赖，关闭无用 polyfill，分离开发与生产依赖。
- [Risk] Electron 进程间边界设计不当导致安全问题 -> Mitigation：强制 `contextIsolation`，preload API 白名单，统一 IPC channel 常量并校验参数。
- [Risk] 桌面配置与 `.env` 默认值冲突 -> Mitigation：定义明确优先级与冲突提示，UI 显示当前生效来源。
- [Risk] 不同平台打包差异导致 CI 复杂度上升 -> Mitigation：先以 Windows 主流程打通，预留 macOS 配置并在后续迭代完善签名。
- [Trade-off] MQTT 保持在 renderer 虽实现快，但网络能力仍依赖前端生命周期 -> Mitigation：增加重连与窗口恢复场景测试，后续再评估迁移到 main 的必要性。

## Migration Plan

1. 引入 Electron 与 electron-vite 依赖，建立 `electron/main`、`electron/preload` 目录与配置文件。
2. 调整 `package.json` scripts，新增桌面开发与打包命令，保留现有 Web 命令以支持并行验证。
3. 在 renderer 注入桌面环境检测与配置读取逻辑，不改变现有 MQTT topic 构造与命令状态机。
4. 联调发布/订阅链路：
   - 连接 broker 后订阅 `state/events/services_reply`
   - 发布 `services` 指令并验证 services_reply ack 能正确驱动 UI 状态
5. 进行回归验证（连接、订阅、命令发送、序列执行、超时处理）。
6. 发布试运行包；若出现严重问题，回滚到 Web 运行方式（保留原有 `npm run dev/build/preview`）。

## Open Questions

- 是否在本次提供统一的安装包格式（仅 NSIS）还是按平台拆分（NSIS/DMG）？
- 桌面端配置文件 schema 是否需要版本号与迁移策略（例如 `configVersion`）？
- 是否需要在首版就加入本地日志导出能力，便于现场问题定位？
