# 错误分类细则

分类的唯一目标是**让每个数字都能追溯到一条事件**。因此这里只处理显式信号，
所有规则都是「事件字段优先，文本兜底」。

## 一、无效步的判定

一个 step 完成时（`step/end`），满足任意一条即记为无效步：

| kind | 触发事件 | 归因位置 |
|---|---|---|
| `tool-error` | `tool/result` 的 `isError === true`（message 级 **或** part 级） | 该 step |
| `llm-retry` | 该 step 内出现 `llm/retry` | 该 step |
| `repeated-call` | `tool/call` 的 `name+arguments` 与更早的调用完全一致，且两次之间没有成功的写入类工具调用 | 后一次调用所在 step |
| `empty-step` | 该 step 有 `assistant/message`，但既无 `text` 内容也无 `tool-call` | 该 step |
| `approval-rejected` | `approval/decided.outcome ∈ {rejected, cancelled, denied}` | 该 step |
| `command-error` | shell 类工具的 `tool/result` 文本含 `[exit code: 非0]`，或 `command/done.kind === 'error'` | 该 step |
| `turn-aborted` | `turn/end.reason.kind ∈ {error, aborted, interrupted, max-tokens}` | 该轮最后一步 |

一个 step 可以同时命中多个 kind（例如「审批被拒」通常同时是一条工具报错）。
`无效步数` 按 step 去重；`无效类型` 计数按 kind 累加，因此两者不必相等。
`工具报错` KPI 数的是**失败调用次数**，同一 step 内 3 个调用失败记 3；`无效类型` 里的
`工具报错` 数的是**step 数**，记 1。这是同一批事件的两种单位，不是两个口径。

### 工具结果的两种结构

日志里同时存在两种形状，**只读一种会漏掉一半失败**：

```text
扁平  { message: { role: 'tool',  isError: true,  content: [{ type: 'text', text }] } }
嵌套  { message: { role: 'user',  content: [{ type: 'tool-result', isError,
               toolCallId, content: [{ type: 'text', text }] }] } }
```

本机语料上：扁平形状只有 538 条（全是失败），嵌套形状 5555 条，其中 418 条的
`isError` 只出现在 part 上。只读 `message.isError` 会把工具报错从 956 次误报成 538 次。
嵌套形状的 `source` 只有 `callId` 没有工具名，因此实现里维护 `callId → name` 的映射，
用更早的 `tool/call` 回填。

### 为什么读取 shell 退出码

DSH 不把「命令非零退出」当 `isError`：`pwsh` 成功执行并返回
`(no output)\n[exit code: 1]`，`message.isError` 仍是 `false`。只看 `isError`，
`pwsh` 的失败率是 1.5%；读退出码后是 15.1%（3776 次调用里 571 次）。

代价是 `git diff --quiet`、`Test-Path` 这类以退出码表达布尔结果的命令会被计成失败。
因此失败摘要优先展示 stderr 的诊断行，而不是 `[exit code: 1]`——看到具体原因就能判断真伪。

`turn-aborted` 是**回填**的：`step/end` 先落盘，`turn/end` 到达时才知道这一轮失败了。
实现上会对该轮最后一步做一次修正（ledger 里表现为一条 `event: "correction"` 记录），
如果该步已经因为别的原因无效，只补记 kind，不重复计入无效步数。

### 为什么空转步也计入

只有 reasoning 没有正文、也没有工具调用的 step，在事件层面等价于「这次请求没有产出任何可执行的东西」。
它通常来自被中断的轮次或模型空回复，重跑时输入 token 要再付一遍。

### 重复调用的抑制条件

同一会话内 `read a.txt` 出现两次不一定是浪费：

- 如果两次之间发生过成功的 `write` / `edit` / `apply_patch` 等写入，视为「改完再读」，**不计**重复；
- 如果中间没有任何写入，内容和结果都不会变，**计入**重复。

已知局限：文件名通过不同工具参数间接表达（例如 `pwsh` 里 `Get-Content a.txt`）时无法识别，
只做字节级的参数比对。

## 二、工具报错的细分

按 `tool/result` 文本首行做**有序**匹配，命中即停。顺序即优先级，因为同一条错误可能同时含有
多个关键词（例如 `HTTP 401 ... Connection error` 应归为鉴权）。

| class | 含义 | 典型文本 |
|---|---|---|
| `path-missing` | 路径/文件不存在 | `IO error for operation`、`os error 2`、`系统找不到指定的文件` |
| `permission-denied` | 权限/沙箱拒绝 | `SetNamedSecurityInfoW`、`Win32 (5)`、`rejected escalating` |
| `auth` | 鉴权/密钥失效 | `HTTP 401`、`invalid_api_key`、`Authentication Fails` |
| `rate-limit` | 限流/配额 | `HTTP 429`、`rate limit`、`quota exceeded` |
| `timeout` | 超时 | `timed out`、`ETIMEDOUT`、`DEADLINE_EXCEEDED` |
| `network` | 网络/连接失败 | `fetch failed`、`Connection error`、`ECONNRESET` |
| `redirect` | 跨域重定向 | `cross-origin redirect ... not followed` |
| `unsupported-content` | 内容类型不支持 | `unsupported content type "application/pdf"` |
| `limit` | 限制触发 | `exceeds maxDepth`、`budget limit`、上下文超限 |
| `tool-usage` | 调用方式错误 | `file has not been read`、`cannot modify`、`invalid argument` |
| `interrupted` | 执行被中断 | `tool call was interrupted after it was recorded` |
| `not-found` | 未找到/无匹配 | `no matches found`、`not found` |
| `exit-code` | 退出码非 0 | `[exit code: 1]`，且没有命中更具体的关键词 |
| `other` | 其余 | — |

分类表在 `src/taxonomy.js` 的 `ERROR_CLASSES` 中，新增规则只需往对应项追加正则。
`other` 是留白而不是垃圾桶：如果 `other` 长期占比高，说明有一类新错误值得单独建项。

## 三、会读取的事件

```text
turn/start   step/start   assistant/message   tool/call   tool/result
llm/retry    approval/decided   command/done   step/end   turn/end
```

其余事件（`reasoning-chunks`、`text-chunks`、`request/header`、`session/title` 等）一律忽略。
这样做的代价是放弃了一些信号（例如逐 chunk 的实际生成耗时），收益是投影足够小、
可以在 DSH 里实时维护，也能在 CLI 里 4 秒重放 215 个会话。

## 四、口径里的坑

- `usage` 由 `assistant/message` 提供，一个 step 内可能有多条（多次尝试），全部累加。
- 缺少 `usage` 的 step 仍然计入步数，但贡献 0 token——这会让「占比」看起来比实际乐观。
- 步时长是墙钟，同一 step 内并行工具调用不会叠加；跨 step 的工具等待会算进各自的 step。
- 会话如果在中途崩溃（没有 `step/end`），最后一步不会被计入，直到 `turn/end` 触发回填。
