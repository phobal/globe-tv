# 实时中文字幕验证记录

日期：2026-10-16。环境：macOS、Google Chrome 155、`http://127.0.0.1:5179`。

## 已验证

- DW English 与 France 24 English 的 HLS 源在 Chrome 中可播放；两者的视频 `readyState` 为 4，播放时间持续前进。
- 在 DW English 播放时，通过真实 `getDisplayMedia` 选择当前标签页，得到 `label: "Tab audio"`、`readyState: "live"` 的音频轨。音频波形不是静音；把该轨传给真实 `SpeechRecognition.start(audioTrack)` 后，浏览器返回非空英文识别结果。
- 在首选语言设为简体中文的 Chrome 中，真实 `Translator.create({sourceLanguage:'en',targetLanguage:'zh'})` 完成语言包下载，`Good morning.` 被译为 `早上好。`。英语默认配置曾返回 `NotSupportedError`；`Translator.availability()` 的 `downloadable` 不能单独证明该语言对最终可用，界面会给出中文设置与重试提示。
- 在 DW English 上完成一次全真实链路：Chrome 自动化选择当前标签页，真实语音识别产生英文最终句，真实 Translator 译成中文，video.js 在视频下方显示“屠夫支持者来自全国各地，表示支持执政的SNS党”。识别器在这一句之前返回大量临时结果，最终句才显示造成明显延迟；随后增加了每 4 秒最多翻译一次较长临时结果的限频策略。改动后，约 4.3 秒出现第一条中文临时字幕，早于最终识别结果。
- France 24 English 也完成真实标签页捕获、真实语音识别、真实英译中和 video.js 字幕显示，首条中文约 3.7 秒出现。两次完整测试都用受控的 `SpeechRecognition.available()` 返回“本机不可用”，通过界面的显式授权按钮走 Chrome 管理的在线语音识别；本机语音包的安装流程有单元测试，尚未用真实语言包做端到端验证。
- 使用受控的音频捕获、识别和翻译结果走完整播放器状态机时，video.js 创建 `中文（实时）` 字幕轨，并在 DW English 普通播放和全屏中显示中文 cue；关闭字幕后轨道和画面文字消失。
- 受控浏览器验证了暂停清空字幕、恢复后显示新句、切源清空旧句并复用一次捕获授权；字幕面板不会遮住来源菜单。
- 单元测试覆盖捕获结束、延迟译文丢弃、本机语音包安装、在线识别知情授权、字幕轨道清理和界面状态。

## 尚需在目标设备人工确认

自动化已覆盖 DW English 与 France 24 English 的完整在线识别链路，但仍需在目标设备上确认原声可听、真正的本机语音包安装与识别，并覆盖暂停／恢复、切源、换台、全屏、停止共享和关闭播放器。不同 Chrome 首选语言、语言包下载状态、地区与直播源可能影响结果；首版不保证所有频道可用。
