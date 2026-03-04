# desktop-config-bridge Specification

## Purpose
TBD - created by archiving change migrate-to-electron-vite-desktop. Update Purpose after archive.
## Requirements
### Requirement: 桌面配置读取优先级
系统 MUST 支持桌面端 MQTT 配置读取优先级：本地持久化配置 > `.env` 默认值。若本地配置缺失且 `.env` 也缺少必要字段，系统 SHALL 阻止连接并给出可操作提示。

#### Scenario: 本地配置存在
- **WHEN** 桌面应用启动且本地配置文件包含有效 MQTT 参数
- **THEN** 系统使用本地配置建立连接，不回退到 `.env` 值

#### Scenario: 配置缺失导致连接受阻
- **WHEN** 本地配置和 `.env` 都缺少关键参数（如 broker URL）
- **THEN** 系统拒绝发起 MQTT 连接并提示用户补全配置

### Requirement: 受限 preload 配置 API
系统 MUST 通过 preload 暴露受限配置 API（读取、保存、查询应用信息），并使用固定 channel 与参数校验。渲染层 MUST 仅通过该 API 访问桌面配置能力。

#### Scenario: 渲染层调用配置保存 API
- **WHEN** 用户在界面中提交新的 MQTT 连接配置
- **THEN** 系统经 preload 校验后写入本地配置并返回成功或失败结果

### Requirement: 桌面桥接类型契约
系统 MUST 定义 TypeScript 类型用于约束 preload API 输入输出与配置 schema，确保渲染层、preload、main 对配置字段语义一致。类型变更 SHALL 与实现同步更新。

#### Scenario: 新增配置字段
- **WHEN** 开发者为桌面配置增加新字段
- **THEN** 系统在类型检查阶段识别未同步更新的调用点，防止不完整字段进入运行时

