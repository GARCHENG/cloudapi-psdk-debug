## Context

`psdk-debug-front` 当前在两个入口构造 `speaker_audio_play_start` payload：
- `src/App.tsx` + `src/components/app/SpeakerControlPanel.tsx`：直接发送 Audio Play Start
- `src/components/app/CommandSequenceAddModal.tsx`：加入序列步骤后由 Sequence Runner 发送

现状仅做非空校验（`audioName/audioUrl/audioMd5`），未对 `audioUrl` 做协议与音频参数校验，导致不合规文件在发送后才由设备端失败。该变更需要在前端发送前完成校验，且两条入口的行为一致。

约束：
- MQTT publish/subscribe 与 ACK 语义必须保持不变：
  - publish: `thing/product/{gateway_sn}/services`
  - subscribe: `thing/product/{gateway_sn}/services_reply`
- `speaker_audio_play_start` payload 合同不变（`file.format/md5/name/url`）
- 不新增 `.env` 配置和后端 API

## Goals / Non-Goals

**Goals:**
- 校验 `File URL (PCM)` 仅允许 `http` 或 `https`。
- 校验音频格式参数满足：`1 channel`、`16 kHz`、`16 bit`。
- 在单次发送和序列新增步骤中复用同一套校验逻辑与错误语义。
- 在 UI 中提供可理解的失败原因，并阻止不合规命令进入发送流程。

**Non-Goals:**
- 不调整 MQTT topics、`tid/bid` 关联和 `services_reply` 处理逻辑。
- 不扩展到 `speaker_tts_play_start` 或其他命令参数校验。
- 不引入服务端文件转码或代理验证。

## Decisions

1. 新增共享校验模块，集中实现 URL 与音频参数验证
- 决策：在 `src/lib/` 新增音频 URL 校验工具（例如 `audioFileValidation.ts`），暴露统一 `validatePcmAudioUrl(url)` 接口，返回结构化结果：`valid`、`errorCode`、`message`、`metadata`。
- 原因：避免 `App.tsx` 与 `CommandSequenceAddModal.tsx` 重复实现，保证规则和文案一致。
- 备选方案：在两个组件内各自实现校验。
- 不选原因：规则漂移风险高，后续维护成本高。

2. 协议校验采用同步，音频参数校验采用异步预检
- 决策：
  - 第一步同步校验 URL 可解析且协议为 `http:`/`https:`。
  - 第二步异步校验音频元数据：请求远程文件头并解析 `WAV PCM` 的 `fmt` 信息，验证 `channels=1`、`sampleRate=16000`、`bitsPerSample=16`。
- 原因：位宽校验需要容器头信息，仅靠 `AudioContext.decodeAudioData` 无法可靠得到 `bitsPerSample`。
- 备选方案：仅做 URL 正则校验；或仅使用 `decodeAudioData`。
- 不选原因：无法满足用户明确提出的音频参数约束，尤其是 `16 bit`。

3. 将“可发送条件”升级为包含远程预检状态
- 决策：新增校验状态机（`idle | validating | valid | invalid`），并把 `audioValid` 扩展为“必填通过 + 预检通过”。
- 原因：当前 `audioValid` 仅依赖字符串非空，无法表达异步预检过程。
- 备选方案：仅在点击发送瞬间校验，不暴露状态。
- 不选原因：用户等待反馈滞后，重复点击与误操作概率高。

4. 两个入口统一阻断策略，但触发时机不同
- 决策：
  - Speaker Control：URL 变化后可触发预检；点击 `Send Audio Play Start` 前若未通过则阻断并显示错误。
  - Command Sequence Add Modal：点击 `Add To Sequence` 时执行同一校验；校验中禁用按钮并展示进度文案。
- 原因：单次发送侧重即时可见，序列新增侧重“提交时确定性”。
- 备选方案：仅改 Speaker Control，不改序列。
- 不选原因：会造成同一命令在不同入口行为不一致。

5. 保持消息流与类型合同稳定
- 决策：`sendCommand('speaker_audio_play_start', payload)` 与现有 ACK 等待逻辑不变，只在调用前增加校验门控；不变更 `src/types/psdk.ts` 的 payload 结构定义。
- 原因：本次是前置验证能力，不是协议升级。
- 备选方案：在 payload 中新增“已校验标记”字段。
- 不选原因：无后端消费方支持，且会引入破坏性变更。

## Risks / Trade-offs

- [远程 URL 因 CORS 或网络失败导致无法读取元数据] -> Mitigation: 将校验失败明确区分为“网络/跨域失败”和“格式不符合”，并阻止发送，提示用户更换可访问地址。
- [部分文件并非 WAV 封装而是裸 PCM，无法可靠判断位宽/声道] -> Mitigation: 本阶段仅支持可解析元数据的 PCM 文件（WAV PCM）；在文案中明确该约束。
- [异步校验引入额外等待时间] -> Mitigation: 增加 validating 状态提示、按钮禁用态与结果缓存（同一 URL 在会话内复用）。
- [双入口校验实现不一致] -> Mitigation: 强制复用 `src/lib` 单一校验函数，组件只消费结果。

## Migration Plan

1. 增加共享校验工具与类型定义（不改消息协议）。
2. 在 `App.tsx` 接入 Audio Play Start 校验状态，更新 `audioValid` 与发送前阻断逻辑。
3. 在 `SpeakerControlPanel.tsx` 增加校验状态展示与错误提示。
4. 在 `CommandSequenceAddModal.tsx` 引入相同校验并在 `Add To Sequence` 前阻断。
5. 回归验证：单次发送成功路径、协议错误、参数错误、网络失败、序列新增步骤阻断。
6. 若出现回归，可回滚到原非空校验逻辑；MQTT 流程与命令结构无需回滚。

## Open Questions

- 设备侧“pcm”是否保证为 `WAV PCM` 封装而非裸 PCM？若存在裸 PCM 场景，需要额外输入元数据或改为“弱校验策略”。
- 是否需要“仅校验 URL 协议，不强制远程元数据可读”的宽松模式？当前设计默认严格阻断。
