# Changelog

## 0.1.0 — 2026-11-17

首个版本。定位：DSH 会话日志的 step 级无效动作统计，只读、可重放、可追溯。

### 新增

- **step 投影**（`src/analyzer.js`）：把 `step/start`、`assistant/message`、`tool/call`、
  `tool/result`、`llm/retry`、`approval/decided`、`command/done`、`step/end`、`turn/end`
  折叠成 per-step 事实，输出会话视图（totals / byKind / byClass / byTool / series / recent）。
- **错误分类**（`src/taxonomy.js`）：13 个工具报错类目，覆盖路径缺失、权限/沙箱、鉴权、
  限流、超时、网络、跨域重定向、内容类型、限制触发、调用方式、中断、未找到、其他。
- **无效步判定**：工具报错 / 模型重试 / 重复调用 / 空转步 / 审批被拒 / 命令失败 / 轮次中断。
  重复调用在「两次调用之间发生过成功写入」时自动抑制。
- **浪费核算**：无效步的 token 用量（input/output/cache read/cache write）与墙钟时长，
  同时给出绝对值与占比。
- **DSH 面板**：输入框下方胶囊（`无效 2/9 · 12.3k tok`）+ 分项面板（KPI、每轮占比折线、
  无效类型、报错分类、最近无效步）。挂载点 `conversation.composer.dock`，投影 key `step-errors`。
- **`/steps` 命令**：文本摘要，`/steps json` 输出完整视图。
- **CLI**（`bin/dsh-event-fix.mjs`）：`scan` 支持 `--root`、`--since`、`--session`、`--limit`、
  `--html`、`--json`；直接解码 `session.vN.jsonl.zstd` 多帧日志。
- **离线面板**（`src/report.js`）：零依赖自包含 HTML，含占比时序、每日浪费 token、
  错误分布、工具错误率、最近无效步、会话排行与口径说明。
- **step ledger**：可选 JSONL 落盘（`dsh.event-fix.step.v1`），带中断回填的 `correction` 记录。

### 实测

本机 215 会话 / 8715 步：无效步 7.8%，浪费 token 5.6%，浪费时长 15.3%；工具报错 537 次。
复盘 4.5 秒完成。

### 已知边界

只解释明确事件；重复调用是启发式；token 含缓存且不区分单价；并行工具会让步时长重叠；
subagent 会话独立统计；需要 Node ≥ 22.15（zstd）。
