## 1. Electron 基础脚手架与依赖

- [ ] 1.1 在 `package.json` 新增 `electron`、`electron-vite` 与打包相关依赖
- [ ] 1.2 新建 `electron.vite.config.ts` 并配置 main/preload/renderer 构建入口
- [ ] 1.3 新建 `electron/main/index.ts`，实现单实例与主窗口创建逻辑
- [ ] 1.4 新建 `electron/preload/index.ts`，初始化 `contextBridge` 白名单 API

## 2. 桌面命令与构建链路

- [ ] 2.1 更新 `package.json` scripts，新增 `dev:desktop`、`build:desktop`、`preview:desktop`（如适用）
- [ ] 2.2 保持并验证现有 `dev/build/preview` Web 脚本可用
- [ ] 2.3 配置桌面打包输出目录与应用元数据（名称、版本、图标占位）

## 3. 配置桥接与类型契约

- [ ] 3.1 在 `src/types` 新增桌面配置与 preload API 的 TypeScript 类型定义
- [ ] 3.2 在 main/preload 实现配置读取与保存（优先本地配置，回退 `.env`）
- [ ] 3.3 在 renderer 新增桌面环境配置读取入口，并与现有 MQTT 连接参数初始化对接
- [ ] 3.4 为配置缺失场景补充 UI 提示与阻断连接逻辑

## 4. MQTT 行为一致性适配

- [ ] 4.1 复用 `src/hooks/useMqtt.ts`，确保桌面运行时不改变 topic 构造逻辑
- [ ] 4.2 校验 `services` 发布与 `services_reply` 回执关联逻辑在桌面模式下保持一致
- [ ] 4.3 校验 pending/success/failure/timeout 状态流在桌面模式下与现有 UI 行为一致

## 5. 安全与稳定性

- [ ] 5.1 在 BrowserWindow 显式启用 `contextIsolation: true` 并禁用 `nodeIntegration`
- [ ] 5.2 收敛 IPC channel 常量与参数校验，拒绝未授权调用
- [ ] 5.3 增加主窗口异常关闭与应用退出处理，避免残留进程

## 6. 验证与交付

- [ ] 6.1 运行 `npm run lint`，修复新增 Electron 相关代码的静态检查问题
- [ ] 6.2 运行 `npm run build`，确认 Web 构建链路未回归
- [ ] 6.3 运行 `npm run build:desktop`，确认桌面打包产物可生成
- [ ] 6.4 手工验证：连接 MQTT broker 成功并收到 `state/events/services_reply` 订阅消息
- [ ] 6.5 手工验证：发布一条 `services` 指令后正确处理 `services_reply` 回执
- [ ] 6.6 手工验证：制造无回执场景并确认 timeout 状态按预期触发
