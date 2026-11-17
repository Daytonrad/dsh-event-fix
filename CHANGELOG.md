# Changelog

## 0.1.2 — 2026-11-17

**口径修正：此前的失败数少了一半以上。** 用户反馈「体感远多于面板上的 8 次」，查下来是两个读取缺陷。

### 修复

- **嵌套结果结构未解析**：`tool/result.message.content[0]` 才是 `tool-result` 载体
  （`{ type:'tool-result', isError, toolCallId, content:[{type:'text',text}] }`），
  旧代码在 message 级找 `isError`、在 part 级找 `text`，两头落空。
  本机语料 418 条失败因此完全不可见，且所有 pwsh/edit 成功结果的文本都被读成空串。
- **工具名丢失**：嵌套结构的 `message.source` 只有 `callId`，旧代码回退到 `unknown`。
  现在维护 `callId → name` 映射，用更早的 `tool/call` 回填。
- **shell 退出码未计入**：DSH 不把命令非零退出当 `isError`。新增 `command-error`
  的退出码分支：shell 类工具结果出现 `[exit code: 非0]` 即计入（540 次）。
- 失败摘要改为优先取 stderr 的诊断行，而不是 `(no output)` / `[exit code: 1]`。
- 新增 `exit-code` 报错分类；`totals.commandFailures` 贯通到面板、CLI、报告。

### 数字变化（本机 215 会话 / 8715 步）

| 指标 | 0.1.1 | 0.1.2 |
|---|---|---|
| 无效步 | 680（7.8%） | 1403（16.1%） |
| 工具报错（调用） | 537 | 951 |
| 命令失败（步） | — | 469 |
| 浪费 token | 58.64M（5.6%） | 128.90M（12.2%） |
| pwsh 失败率 | 1.5% | 15.1% |
| subagent 失败率 | 28.9% | 34.9% |

### 兼容性

`STATE_VERSION` 2 → 3：旧投影状态会被丢弃并从事件重放，无需手工清理。

## 0.1.1 — 2026-11-17

安装可用性修复。0.1.0 的安装命令在自带 Node 运行时的绿色发行版上根本跑不起来。

### 修复

- **`dsh` 不在 PATH**：发行版把 CLI 放在 `app/node_modules/@deepseek-ai/dsh/lib/bin.js`，
  且必须配 `DSH_HOME` 与便携 Node。新增 `install/dsh.cmd` shim，README 补三条可执行路径。
- **shim 的代理处理**：启动 app 时清掉 `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`，
  只在 `plugin`（pnpm 走网络）时保留，避免代理残留导致的 `Connection error`。

### 已验证

- 宿主侧在真实 web profile 中挂载成功：`[event-fix] active; projection=step-errors; ledger=...`，
  `--dump-config` 中可见 `- id: event-fix` 行。
- 客户端 bundle 由 web 服务拼接进 `plugins/??...` 清单并以 200 返回，语法校验通过。
- profile 依赖与 bundle 自动登记（`dependencies["dsh-event-fix"]`、`dsh.profile.bundles`）。

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
