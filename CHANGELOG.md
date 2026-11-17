# Changelog

## 0.2.1 — 2026-11-17

**设置页的失败态更诚实。** 用户装了 0.2.0 但在设置里看到「读取统计失败：HTTP 404」。

### 修复

- 404 时不再同时显示「正在读取统计…」和错误条（两个互斥状态被同时渲染）。
- 404 的文案直接说明成因：插件**源码**改动不会被 HMR 热加载（HMR 默认忽略
  `**/node_modules`，而 `link:` 安装的包在 `node_modules` 下，实际源码在仓库目录），
  所以宿主侧路由不存在，需要重启一次 DSH；设置页本身由浏览器从磁盘读取，因此能先渲染出来。

### 说明

- 0.2.0 的宿主路由代码本身没有问题：重启后的实例 `GET /dsh-event-fix/stats` 返回 200、
  5.6KB、20ms，`scan 150/150 ready`。

## 0.2.0 — 2026-11-17

**新增设置页。** 之前只有会话内的胶囊与 `/steps`，用户要的是「打开设置就有一页」，
而且不该为装一个插件重启 DSH。

### 新增

- **设置页**：`settings.section` 席位，导航名「无效动作统计」。KPI 四卡、近 30 天
  「每日无效占比 + 浪费 token」趋势、无效类型/报错分类排行、失败率最高的工具、
  浪费 token 最多的会话，右上角「重新扫描」重放日志补全历史。
- **宿主路由** `GET /dsh-event-fix/stats`（`:days=7..180`、`?refresh=1`）。
  跨会话数据不能走投影（投影是单会话的），也不该塞进配置项（配置写入有 revision
  与审计），因此用只读 JSON 端点承接。
- `src/history.js`：启动后 1.5s 分片重放最近 150 个会话作为基线，每 12 个文件让出
  一次事件循环，首个请求不会被 4s 扫描阻塞；响应 5.6KB / 7ms。
- `src/snapshot.js`：把会话视图折成页面快照，日序列补齐空白天，与离线面板同口径。

### 修复

- `webServer` 服务在插件加载后才挂载，`ctx.get('webServer')` 在 `apply` 时必然为空，
  路由会静默不存在（实测日志 `stats=off`）。改为 `ctx.inject(['webServer'], …)`。
- 趋势图纵轴刻度取整（88% → 100%），避免出现 44% 这类非整十刻度。

### 测试

36 个用例：新增 4 个快照用例、2 个路由用例（含 405、空日志根目录降级），
客户端用例覆盖两个席位的注册与设置页初始渲染。

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
