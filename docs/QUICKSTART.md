# dsh-event-fix 五分钟快速开始

目标：安装插件，看到一页真实的无效步、浪费 token、浪费时长和失败后的恢复统计。

## 1. 确认版本

```powershell
node --version
dsh --version
```

当前插件要求：

- Node.js `^22.19.0 || >=24.0.0`
- DSH `>=0.2.0-rc.2 <0.2.1`

DSH 是绿色发行版时，先确认 `dsh` 已在 PATH；没有的话按主 README 的 shim 方式配置。

## 2. 安装

```powershell
dsh plugin --profile web add dsh-event-fix@0.3.2
```

安装完成后重启 DSH web。日志出现下面这行表示宿主侧已加载：

```text
[event-fix] active; projection=step-errors; stats=/dsh-event-fix/stats
```

## 3. 打开设置页

进入：

```text
DSH → 设置 → 左侧导航「无效动作统计」
```

页面会自行读取本机会话日志。第一次打开时可能需要几秒扫描历史会话；右上角「重新扫描」可以重新重放。

## 4. 看哪四个数

| 指标 | 含义 | 先问什么 |
|---|---|---|
| 无效步占比 | 有明确浪费信号的 step 占比 | 哪类错误贡献最大？ |
| 浪费 token | 无效 step 附带的 usage 总和 | 是否集中在少数工具？ |
| 浪费时长 | 无效 step 的墙钟时长 | 主要卡在工具等待还是模型重试？ |
| 失败后下一步 | 失败下一次调用是否接住 | 哪些工具经常把整轮带进死胡同？ |

示例面板可直接打开 `docs/dashboard-demo.html` 查看结构，不需要先安装。

## 5. 只看一个会话

在 DSH 对话框中输入：

```text
/steps
```

输入框下方也会出现胶囊，例如：

```text
无效 2/9 · 12.3k tok
```

点开胶囊可以看到当前会话的分项面板。

## 6. 不装插件，只跑 CLI

```powershell
npx --yes dsh-event-fix@0.3.2 scan --since 7d
```

生成离线 HTML：

```powershell
npx --yes dsh-event-fix@0.3.2 scan --since 7d --html .\reports\report.html
```

## 常见问题

### 设置页显示 404

宿主侧代码不会热加载。重启 DSH web 后重新打开设置页。

### 设置页显示「当前响应来自旧版宿主模块」

浏览器客户端已更新，但宿主还运行着旧模块。重启 DSH web。

### 没有数据

确认 `DSH_HOME` 指向实际使用的 DSH 配置目录，并且 `$DSH_HOME/sessions` 中有会话文件。也可以先用 `scan --root <目录>` 验证 CLI 是否能读到。

### 面板数字和 `/steps` 不一致

先确认它们看的是同一个会话和同一时间窗口。跨会话设置页与单会话胶囊不是同一分母。
