# Changelog

## 0.3.0 — 2026-11-17

**从「哪里坏了」走到「坏了之后怎么办」。** 设置页删掉一节、图变可交互、
新增失败回合分析，并把数字直接变成对话框里的问题。

### 新增

- **失败回合（failure episode）分析**：以每次失败调用为起点，看同一轮更晚 step 的下一次调用
  怎么接（`same` / `changedArgs` / `changedTool` / `abandoned` / `unknown`），
  以及那次调用成功了没有。页面上呈现为「失败之后 agent 做了什么」：
  堆叠条 + 动作行的成功率 + 一句判读。
- **每个工具多一列 `失败后下一步`**（如 `76% · 280/369`，低于 50% 标红）：
  失败率只说明哪里坏，恢复率说明坏完之后有没有把整轮带进死胡同。
- **一键 prompt**：设置页与胶囊面板都能把当前数字压成结构化排查指令写进草稿。
  三级降级 `captureInsertion+insertText` → `setDraft` → 剪贴板；
  **插件不调模型、不自动发送**，只把问题快照写清楚。
- **趋势图可悬停**：鼠标移到任意一天，高亮该日柱与折点，当场显示
  「日期 / 无效 x/y 步 z% / 浪费 n tok」；空白日显示 `当天无 step` 而非 `0%`。
- `docs/ANALYSIS-IDEAS.md`：为什么选这个指标、还有哪些分析方向、六种把数字变成动作的方式、
  优先级排序与「会骗人的指标」反面清单。

### 删除

- 设置页「浪费 token 最多的会话」一节。会话排行只回答「谁最贵」，不改变任何动作，
  而且单会话成本几乎完全由任务长度决定。原始数据仍在 CLI 的 `--json` 输出里。

### 变更

- `STATE_VERSION` 3 → 4：新增 `followups`、`byToolRecovery`、`byToolClass` 与
  `pendingFailure` / `pendingRetry`，旧投影状态会被丢弃并从事件重放。
- 快照不再携带 `sessions` 数组（页面不再需要），`snapshot.js` 去掉 `shortenPath`。
- 表格单元格左右内边距改为 10px、首尾归零，修掉列挤在一起的问题。

### 实测（150 会话 / 5782 步）

```text
无效步 866（15.0%）· 浪费 token 78.62M（11.0%）· 浪费时长 25h27m（19.9%）
失败回合 733 → 下一步成功 574（78.3%）· 仍失败 134（18.3%）· 放弃 25（3.4%）
改参数再试 420（74%）· 换工具 288（92%）· 原样重试 0
```

原样重试为 0 是这次最关键的一个发现：**「重试率」在这个语料上恒为零，没有区分度**。
有信息量的是动作分布 × 动作后的成功率——它给出了一条可执行的结论
（换工具比改参数有效 18 个百分点），而「重试率」只能给出一个 0。

### 测试

50 个用例。新增 `test/followup.test.js`（11 个：同签名恢复、改参数、换工具、
并行调用不计、跨轮不结算、缺 callId 记 unknown、每回合恰好落进一个桶），
客户端新增判读句、prompt 文本、`buildSessionPrompt` 三组断言。

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
