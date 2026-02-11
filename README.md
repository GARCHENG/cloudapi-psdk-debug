# PSDK Debug Front

针对 **大疆上云 API（Cloud API）PSDK 负载** 的前端快速调试工具。

本项目严格遵循 DJI 上云 API 中与 PSDK 相关的协议，帮助开发者快速完成 **PSDK 设备调试、测试与调用**。

## 项目定位

这个项目面向需要对 PSDK 负载做联调和验证的开发者，核心目标是：

- 降低 PSDK 指令调试门槛
- 可视化查看负载状态和回包结果
- 提供可复用的内置控件配置与交互面板
- 支持用户上传 `widget_config.json` 做动态识别与映射

## 核心功能

- PSDK 在线检测与连接状态展示
- PSDK 当前状态查看（含状态字段与控件值）
- PSDK 浮窗文本显示（`psdk_floating_window_text`）
- PSDK 相关指令调用
  - 指令发送
  - 回包结果展示（`services_reply`）
  - 指令日志记录与状态跟踪（pending/success/failure/timeout）
- 内置多款现有 PSDK 产品控件配置，便于直接调用
- 控件状态映射显示（按 widget 配置解析状态语义）
- 支持用户自定义上传 `widget_config.json` 并进行识别
- 指令拖拽式编排执行（待实现）

## 当前支持的典型指令

- `speaker_audio_play_start`
- `speaker_tts_play_start`
- `speaker_replay`
- `speaker_play_stop`
- `speaker_play_mode_set`
- `speaker_play_volume_set`
- `psdk_input_box_text_set`
- `psdk_widget_value_set`

## MQTT 主题（项目内使用）

- 状态主题：`thing/product/{device_sn}/state`
- 事件主题：`thing/product/{gateway_sn}/events`
- 指令下发：`thing/product/{gateway_sn}/services`
- 指令回包：`thing/product/{gateway_sn}/services_reply`

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 配置环境变量

在项目根目录创建/修改 `.env`：

```env
VITE_MQTT_URL=ws://your-broker:port/mqtt
VITE_MQTT_USERNAME=your_username
VITE_MQTT_PASSWORD=your_password
VITE_GATEWAY_SN=your_gateway_sn
VITE_DEVICE_SN=your_device_sn

# 可选：默认音频播放参数
VITE_AUDIO_PLAY_DEFAULT_NAME=
VITE_AUDIO_PLAY_DEFAULT_URL=
VITE_AUDIO_PLAY_DEFAULT_MD5=
```

### 3) 启动开发环境

```bash
npm run dev
```

### 4) 构建生产版本

```bash
npm run build
```

### 5) 本地预览

```bash
npm run preview
```

### 6) 代码检查

```bash
npm run lint
```

## Widget 配置说明

项目支持两类控件配置来源：

- 内置配置：放置在 `public/widget-configs/`
- 自定义配置：在页面中上传 `widget_config.json`

内置配置文件命名约定：

- `{deviceType}_widget_config.json`

例如：

- `JZ_t30s_widget_config.json`
- `JZ_t40s_widget_config.json`

运行 `dev/build/preview` 前会自动执行脚本生成注册表：

- 脚本：`scripts/generate-widget-config-registry.mjs`
- 输出：`public/widget-configs/registry.json`

## 项目结构

```text
src/
  components/app/      # 主要调试面板
  hooks/useMqtt.ts     # MQTT 连接与收发封装
  lib/                 # topic 构建、widget 配置解析等工具
  types/               # PSDK 相关类型定义
public/widget-configs/ # 内置 widget 配置
scripts/               # 构建前辅助脚本
```

## 已知规划

- 指令拖拽式编排执行（Workflow）能力待实现

## License

[MIT](./LICENSE)
