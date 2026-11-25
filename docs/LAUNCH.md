# Launch kit

目标：在 7 天内获得 **5 个真实 star + 5 个真实 fork**。star 来自认为项目有用的人；fork 来自准备修改代码或复现实验的人。不要购买互动，不要用奖励换 star/fork，不要互刷。

## 一句话定位

中文：`dsh-event-fix` 是一个只读 DSH 插件，把会话里的失败 step 变成「浪费了多少 token/时间、失败后怎么接、下一步该改什么」。

English: `dsh-event-fix` turns DSH session failures into actionable evidence: wasted tokens/time, failure taxonomy, and what the agent does after a failed tool call.

## 30 秒演示

```powershell
dsh plugin --profile web add dsh-event-fix@0.3.2
```

重启 DSH web → 设置 → 无效动作统计。仓库里 `docs/dashboard-demo.png` 和 `docs/settings-page.png` 可直接用于配图。

## 发布文案

### GitHub Release / 项目介绍

```markdown
dsh-event-fix 是一个只读 DSH 插件，只回答一个窄问题：会话里哪些 step 白干了，白花了多少 token 和时间，失败之后 agent 是怎么接的。

- 工具报错、命令失败、模型重试、重复调用、轮次中断、空转步、审批被拒，逐条归因到事件
- 设置页跨会话趋势 + 输入框胶囊 + `/steps` + CLI 离线 HTML
- 失败回合：改参数 420 次（74% 成功） vs 换工具 288 次（92% 成功）
- 不修改会话、不调用模型、不上传数据

安装：`dsh plugin --profile web add dsh-event-fix@0.3.2`
```

### Hacker News / Reddit / X

```text
I built a read-only analytics plugin for DeepSeek Harness sessions. It attributes wasted steps to tool errors, shell exit codes, retries and interrupted turns, then shows what the agent did after each failure. In one local corpus, switching tools after a failure succeeded 92% of the time vs 74% for changing arguments. MIT, npm-installable, 53 tests on Node 22/24 across Ubuntu/Windows.
```

### 中文社区（V2EX / 掘金 / 知乎）

```text
我统计了自己 150 个 DSH 会话、5782 个 step，发现只看「失败率」几乎没有用：真正有信息量的是失败之后 agent 做了什么。换工具后下一步成功率 92%，改参数 74%，而字节级原样重试只有 0.3%。于是做了一个只读插件 dsh-event-fix，把每条无效 step 对回原始事件，并给出 token/时间浪费和失败回合恢复率。欢迎试用和挑错。
```

### 给真实用户的私信/回复

```text
我在做一个 DSH 只读分析插件 dsh-event-fix：它会告诉你哪些 step 因为工具报错、命令失败、重试或中断而白跑，以及失败后 agent 是怎么恢复的。如果你愿意试一下，安装是 `dsh plugin --profile web add dsh-event-fix@0.3.2`。觉得有用再 star；如果发现口径问题，直接开 issue 对我帮助更大。
```

### 给潜在贡献者

```text
仓库有 5 个 `good first issue`，都是能独立完成的真实任务：CLI `--version`、友好错误、英文 quickstart、npm pack 检查、事件字段映射。想练手的话 fork 一个，提个聚焦 PR 就行。
```

## 7 天执行清单

| 天 | 动作 | 目标 |
|---|---|---|
| D1 | 推送 README/CI/issue 模板；确认 4 环境 CI 全绿 | 降低不信任 |
| D2 | 两个 awesome list PR；两个目录提交 issue | 真实曝光 |
| D3 | 发布一篇「5782 step 教会我的事」技术帖，附真实数字和边界 | 建立价值 |
| D4 | 邀请 5 位真实 DSH 用户试用；只请求试用反馈，不请求 star | 试用反馈 |
| D5 | 对反馈做快速修复，公布修复前后差异 | 形成口碑 |
| D6 | 把 5 个 good-first issues 发给贡献者社区 | 争取真实 fork |
| D7 | 复盘 star/fork、网页浏览、安装命令、issue/PR 转化 | 决定下一步 |

## 成功口径

- 主目标：5 个真实 star、5 个真实 fork。
- 辅助指标：GitHub 网页独立访客、clone、npm 安装反馈、issue/PR、目录收录状态。
- 禁止口径：机器人账号、互赞群、购买服务、奖励换 star/fork、重复账号点击。

当前 CI 与文档状态见仓库 README；当前 5 个贡献任务见 `good first issue` 标签。
