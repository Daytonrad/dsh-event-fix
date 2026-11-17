/**
 * Offline dashboard: cross-session aggregation + a self-contained HTML report.
 *
 * The report is a static file with no network access, no fonts, no scripts:
 * every chart is inline SVG so it can be opened from disk or attached to a PR.
 */
import { STEP_KINDS, STEP_KIND_LABELS, classLabel } from './taxonomy.js'
import { formatDuration, formatTokens, emptyFollowups, totalOf, turnReasonLabel } from './analyzer.js'

const DAY_MS = 86400000

/** Local calendar day key (YYYY-MM-DD) for a millisecond timestamp. */
export function dayKey(ms) {
  if (!Number.isFinite(ms)) return 'unknown'
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Fold per-session views into one report model.
 * @param {Array<{sessionId: string, cwd?: string, view: object}>} sessions
 */
export function buildReport(sessions, meta = {}) {
  const totals = {
    sessions: sessions.length,
    steps: 0,
    invalidSteps: 0,
    tokens: 0,
    wastedTokens: 0,
    durationMs: 0,
    wastedMs: 0,
    toolCalls: 0,
    toolErrors: 0,
    commandFailures: 0,
    retries: 0,
    failedTurns: 0,
  }
  const byKind = new Map()
  const byClass = new Map()
  const byTool = new Map()
  const byTurnReason = new Map()
  const days = new Map()
  const recent = []
  const perSession = []
  const followups = emptyFollowups()

  for (const session of sessions) {
    const view = session.view
    const t = view.totals
    totals.steps += t.steps
    totals.invalidSteps += t.invalidSteps
    totals.tokens += t.tokens
    totals.wastedTokens += t.wastedTokens
    totals.durationMs += t.durationMs
    totals.wastedMs += t.wastedMs
    totals.toolCalls += t.toolCalls
    totals.toolErrors += t.toolErrors
    totals.commandFailures += t.commandFailures ?? 0
    totals.retries += t.retries
    totals.failedTurns += t.failedTurns

    for (const item of view.byKind) byKind.set(item.id, (byKind.get(item.id) ?? 0) + item.count)
    for (const item of view.byClass) byClass.set(item.id, (byClass.get(item.id) ?? 0) + item.count)
    for (const item of view.byTool) {
      const entry = byTool.get(item.tool) ?? { calls: 0, errors: 0, recoveryEpisodes: 0, recovered: 0, classes: {} }
      const classes = { ...entry.classes }
      if (item.topClass !== null && item.topClass !== undefined) {
        classes[item.topClass.id] = (classes[item.topClass.id] ?? 0) + item.topClass.count
      }
      byTool.set(item.tool, {
        calls: entry.calls + item.calls,
        errors: entry.errors + item.errors,
        recoveryEpisodes: entry.recoveryEpisodes + (item.recoveryEpisodes ?? 0),
        recovered: entry.recovered + (item.recovered ?? 0),
        classes,
      })
    }
    if (view.followups !== undefined) {
      for (const key of Object.keys(followups)) followups[key] += view.followups[key] ?? 0
    }
    for (const item of view.byTurnReason) {
      byTurnReason.set(item.reason, (byTurnReason.get(item.reason) ?? 0) + item.count)
    }

    for (const turn of view.series) {
      const key = dayKey(turn.at ?? view.updatedAt ?? Date.now())
      const entry = days.get(key) ?? { day: key, steps: 0, invalid: 0, wastedTokens: 0, tokens: 0, wastedMs: 0 }
      entry.steps += turn.steps
      entry.invalid += turn.invalid
      entry.wastedTokens += turn.wastedTokens
      entry.tokens += turn.tokens
      entry.wastedMs += turn.wastedMs
      days.set(key, entry)
    }

    for (const item of view.recent) {
      recent.push({
        sessionId: session.sessionId,
        cwd: session.cwd ?? view.cwd ?? '',
        turn: item.turn,
        step: item.step,
        at: item.at,
        kinds: item.kinds,
        errors: item.errors,
        tokens: totalOf(item.usage),
        durationMs: item.durationMs,
      })
    }

    perSession.push({
      sessionId: session.sessionId,
      cwd: session.cwd ?? view.cwd ?? '',
      steps: t.steps,
      invalidSteps: t.invalidSteps,
      ratio: t.ratio,
      wastedTokens: t.wastedTokens,
      wastedMs: t.wastedMs,
      failedTurns: t.failedTurns,
    })
  }

  const daySeries = [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
  for (const entry of daySeries) entry.ratio = entry.steps > 0 ? Math.round((entry.invalid / entry.steps) * 1000) / 10 : 0

  recent.sort((a, b) => (b.at ?? 0) - (a.at ?? 0))

  return {
    generatedAt: meta.now ?? Date.now(),
    root: meta.root ?? '',
    since: meta.since ?? null,
    totals: {
      ...totals,
      ratio: totals.steps > 0 ? Math.round((totals.invalidSteps / totals.steps) * 1000) / 10 : 0,
      tokenRatio: totals.tokens > 0 ? Math.round((totals.wastedTokens / totals.tokens) * 1000) / 10 : 0,
      timeRatio: totals.durationMs > 0 ? Math.round((totals.wastedMs / totals.durationMs) * 1000) / 10 : 0,
    },
    byKind: [...byKind.entries()]
      .map(([id, count]) => ({ id, label: STEP_KIND_LABELS[id] ?? id, count }))
      .sort((a, b) => b.count - a.count),
    byClass: [...byClass.entries()]
      .map(([id, count]) => ({ id, label: classLabel(id), count }))
      .sort((a, b) => b.count - a.count),
    byTool: [...byTool.entries()]
      .map(([tool, entry]) => {
        const top = Object.entries(entry.classes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
        return {
          tool,
          calls: entry.calls,
          errors: entry.errors,
          recoveryEpisodes: entry.recoveryEpisodes,
          recovered: entry.recovered,
          topClass: top === undefined ? null : { id: top[0], label: classLabel(top[0]), count: top[1] },
        }
      })
      .sort((a, b) => b.errors - a.errors || b.calls - a.calls),
    followups,
    byTurnReason: [...byTurnReason.entries()]
      .map(([reason, count]) => ({ reason, label: turnReasonLabel(reason), count }))
      .sort((a, b) => b.count - a.count),
    daySeries,
    recent: recent.slice(0, 30),
    perSession: perSession.sort((a, b) => b.wastedTokens - a.wastedTokens),
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function chartGeometry(points, width, height) {
  const pad = { left: 46, right: 18, top: 16, bottom: 30 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const max = Math.max(1, ...points.map(point => point.value))
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0
  const x = index => (points.length > 1 ? pad.left + step * index : pad.left + innerWidth / 2)
  const y = value => pad.top + innerHeight - (value / max) * innerHeight
  return { pad, innerWidth, innerHeight, max, step, x, y }
}

function niceCeil(value) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return nice * magnitude
}

/** Line/area chart. points: [{label, value}] */
export function lineChart(points, options = {}) {
  const width = options.width ?? 880
  const height = options.height ?? 210
  if (points.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="暂无数据">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#9aa0a6" font-size="13">暂无数据</text>
    </svg>`
  }
  const color = options.color ?? '#d64545'
  const { pad, innerWidth, innerHeight, max, x, y } = chartGeometry(points, width, height)
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(pad.top + innerHeight).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerHeight).toFixed(1)} Z`
  const gridValues = [0, 0.5, 1].map(fraction => fraction * max)
  const grid = gridValues.map(value => {
    const yy = y(value).toFixed(1)
    return `<line x1="${pad.left}" y1="${yy}" x2="${pad.left + innerWidth}" y2="${yy}" stroke="#eef0f3" stroke-width="1"/>
      <text x="${pad.left - 8}" y="${Number(yy) + 4}" text-anchor="end" fill="#9aa0a6" font-size="10">${options.formatAxis ? options.formatAxis(value) : Math.round(value)}</text>`
  }).join('')
  const labelEvery = Math.max(1, Math.ceil(points.length / 10))
  const labels = points.map((point, index) => (index % labelEvery === 0 || index === points.length - 1)
    ? `<text x="${x(index).toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="#9aa0a6" font-size="10">${escapeHtml(point.label)}</text>`
    : '').join('')
  const dots = points.map((point, index) => `<circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="2.5" fill="${color}"><title>${escapeHtml(point.label)} · ${escapeHtml(options.formatValue ? options.formatValue(point.value) : point.value)}</title></circle>`).join('')
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.ariaLabel ?? '时序图')}">
    <defs><linearGradient id="${options.gradientId ?? 'g1'}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#${options.gradientId ?? 'g1'})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${labels}
  </svg>`
}

/** Bar chart. points: [{label, value}] */
export function barChart(points, options = {}) {
  const width = options.width ?? 880
  const height = options.height ?? 190
  if (points.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="暂无数据">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#9aa0a6" font-size="13">暂无数据</text>
    </svg>`
  }
  const color = options.color ?? '#c9a227'
  const padded = points.map(point => ({ ...point, value: point.value }))
  const { pad, innerWidth, innerHeight, max, x } = chartGeometry(padded, width, height)
  const barWidth = Math.min(28, Math.max(4, innerWidth / Math.max(1, padded.length) * 0.55))
  const bars = padded.map((point, index) => {
    const barHeight = (point.value / max) * innerHeight
    const xx = x(index) - barWidth / 2
    const yy = pad.top + innerHeight - barHeight
    return `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(0, barHeight).toFixed(1)}" rx="3" fill="${color}" opacity="0.85">
      <title>${escapeHtml(point.label)} · ${escapeHtml(options.formatValue ? options.formatValue(point.value) : point.value)}</title></rect>`
  }).join('')
  const grid = [0, 0.5, 1].map(fraction => {
    const value = fraction * max
    const yy = (pad.top + innerHeight - fraction * innerHeight).toFixed(1)
    return `<line x1="${pad.left}" y1="${yy}" x2="${pad.left + innerWidth}" y2="${yy}" stroke="#eef0f3" stroke-width="1"/>
      <text x="${pad.left - 8}" y="${Number(yy) + 4}" text-anchor="end" fill="#9aa0a6" font-size="10">${options.formatAxis ? options.formatAxis(value) : Math.round(value)}</text>`
  }).join('')
  const labelEvery = Math.max(1, Math.ceil(padded.length / 12))
  const labels = padded.map((point, index) => (index % labelEvery === 0 || index === padded.length - 1)
    ? `<text x="${x(index).toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="#9aa0a6" font-size="10">${escapeHtml(point.label)}</text>`
    : '').join('')
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.ariaLabel ?? '柱状图')}">
    ${grid}${bars}${labels}</svg>`
}

function kpiCard(label, value, note, tone = '') {
  return `<div class="kpi ${tone}">
    <div class="kpi-label">${escapeHtml(label)}</div>
    <div class="kpi-value">${escapeHtml(value)}</div>
    <div class="kpi-note">${escapeHtml(note)}</div>
  </div>`
}

function barRow(label, count, max, tone = '') {
  const width = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0
  return `<div class="bar-row">
    <span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
    <span class="bar-track"><span class="bar-fill ${tone}" style="width:${width}%"></span></span>
    <span class="bar-count">${count}</span>
  </div>`
}

/** Render the full standalone dashboard. */
export function renderHtmlReport(report, options = {}) {
  const t = report.totals
  const generated = new Date(report.generatedAt).toLocaleString('zh-CN', { hour12: false })
  const kindMax = Math.max(0, ...report.byKind.map(item => item.count))
  const classMax = Math.max(0, ...report.byClass.map(item => item.count))
  const dayPoints = report.daySeries.map(entry => ({ label: entry.day.slice(5), value: entry.ratio, raw: entry }))
  const tokenPoints = report.daySeries.map(entry => ({ label: entry.day.slice(5), value: entry.wastedTokens, raw: entry }))

  const recentRows = report.recent.map(item => `<tr>
      <td class="mono">${escapeHtml(dayKey(item.at ?? 0))}</td>
      <td>T${escapeHtml(item.turn)} · S${escapeHtml(item.step)}</td>
      <td>${item.kinds.map(kind => `<span class="tag">${escapeHtml(STEP_KIND_LABELS[kind] ?? kind)}</span>`).join(' ')}</td>
      <td>${item.errors.map(error => `<span class="mono">${escapeHtml(error.tool)}</span> <span class="muted">${escapeHtml(classLabel(error.class))}</span>`).join('<br/>') || '<span class="muted">—</span>'}</td>
      <td class="num">${escapeHtml(formatTokens(item.tokens))}</td>
      <td class="num">${escapeHtml(formatDuration(item.durationMs))}</td>
      <td class="path">${escapeHtml(item.cwd || item.sessionId)}</td>
    </tr>`).join('')

  const sessionRows = report.perSession.slice(0, 12).map(item => `<tr>
      <td class="path">${escapeHtml(item.cwd || item.sessionId)}</td>
      <td class="num">${item.steps}</td>
      <td class="num">${item.invalidSteps}</td>
      <td class="num">${item.ratio}%</td>
      <td class="num">${escapeHtml(formatTokens(item.wastedTokens))}</td>
      <td class="num">${escapeHtml(formatDuration(item.wastedMs))}</td>
      <td class="num">${item.failedTurns}</td>
    </tr>`).join('')

  const toolRows = report.byTool.slice(0, 12).map(item => `<tr>
      <td class="mono">${escapeHtml(item.tool)}</td>
      <td class="num">${item.calls}</td>
      <td class="num">${item.errors}</td>
      <td class="num">${item.calls > 0 ? Math.round((item.errors / item.calls) * 1000) / 10 : 0}%</td>
    </tr>`).join('')

  const reasonChips = report.byTurnReason
    .map(item => `<span class="chip">${escapeHtml(item.label)} <b>${item.count}</b></span>`)
    .join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DSH Step 无效动作分析</title>
<style>
  :root{color-scheme:light;--ink:#1c1f23;--muted:#6b7280;--line:#e6e8eb;--bg:#f6f7f9;--card:#ffffff;--red:#d64545;--amber:#c9a227;--teal:#2f7d78}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  main{max-width:980px;margin:0 auto;padding:32px 20px 64px}
  header h1{margin:0 0 6px;font-size:24px;letter-spacing:-.01em}
  header p{margin:0;color:var(--muted);font-size:13px}
  .meta{margin-top:10px;color:var(--muted);font-size:12px;word-break:break-all}
  .kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:22px 0 8px}
  @media (width<=760px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .kpi-label{color:var(--muted);font-size:12px}
  .kpi-value{font-size:26px;font-weight:600;margin:4px 0 2px;font-variant-numeric:tabular-nums}
  .kpi-note{color:var(--muted);font-size:11px}
  .kpi.bad .kpi-value{color:var(--red)}
  .kpi.warn .kpi-value{color:var(--amber)}
  section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-top:16px}
  section h2{margin:0 0 4px;font-size:15px;font-weight:600}
  section .sub{color:var(--muted);font-size:12px;margin:0 0 12px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  @media (max-width:820px){.grid2{grid-template-columns:1fr}}
  .bar-row{display:grid;grid-template-columns:140px 1fr 44px;align-items:center;gap:10px;margin:7px 0;font-size:12px}
  .bar-label{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bar-track{background:#eceef1;border-radius:6px;height:9px;overflow:hidden}
  .bar-fill{display:block;height:100%;background:var(--red);border-radius:6px}
  .bar-fill.amber{background:var(--amber)}
  .bar-count{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;color:var(--muted);font-weight:500;padding:8px 8px;border-bottom:1px solid var(--line)}
  td{padding:7px 8px;border-bottom:1px solid #f1f2f4;vertical-align:top}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
  .muted{color:var(--muted)}
  .path{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
  .tag{display:inline-block;background:#fdecec;color:#a52a2a;border-radius:6px;padding:0 6px;font-size:11px}
  .chip{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 10px;margin:0 6px 6px 0;font-size:12px;color:var(--muted)}
  .chip b{color:var(--ink)}
  footer{margin-top:18px;color:var(--muted);font-size:11.5px;line-height:1.8}
  footer b{color:var(--ink);font-weight:600}
</style>
</head>
<body>
<main>
  <header>
    <h1>DSH Step 无效动作分析</h1>
    <p>以 step 为粒度的错误形态与浪费统计 · event sourcing 的只读分支</p>
    <div class="meta">生成时间 ${escapeHtml(generated)} · 会话 ${t.sessions} 个 · 步 ${t.steps} · 数据源 ${escapeHtml(report.root || '—')}</div>
  </header>

  <div class="kpis">
    ${kpiCard('无效步占比', `${t.ratio}%`, `${t.invalidSteps} / ${t.steps} 步`, 'bad')}
    ${kpiCard('浪费 token', formatTokens(t.wastedTokens), `占总用量 ${t.tokenRatio}%`, 'warn')}
    ${kpiCard('浪费时长', formatDuration(t.wastedMs), `占总时长 ${t.timeRatio}%`, 'warn')}
    ${kpiCard('工具报错', String(t.toolErrors), `${t.toolCalls} 次调用中的失败`, '')}
    ${kpiCard('命令失败', String(t.commandFailures), 'shell 退出码非 0', '')}
    ${kpiCard('失败轮次', String(t.failedTurns), `重试 ${t.retries} 次`, '')}
  </div>

  <section>
    <h2>无效动作占比时序</h2>
    <p class="sub">按自然日聚合，纵轴为无效步占当日总步数的百分比。</p>
    ${lineChart(dayPoints, { ariaLabel: '无效步占比时序图', gradientId: 'ratio', color: '#d64545', formatAxis: value => `${Math.round(value)}%`, formatValue: value => `${value}%` })}
  </section>

  <section>
    <h2>每日浪费 token</h2>
    <p class="sub">无效步所消耗的 token 总量（含缓存读取），同一批 step 的另一面。</p>
    ${barChart(tokenPoints, { ariaLabel: '每日浪费 token', color: '#c9a227', formatAxis: value => formatTokens(value), formatValue: value => `${formatTokens(value)} tok` })}
  </section>

  <section class="grid2">
    <div>
      <h2>无效类型</h2>
      <p class="sub">一个 step 可同时命中多个类型。</p>
      ${report.byKind.map(item => barRow(item.label, item.count, kindMax)).join('') || '<p class="muted">无</p>'}
    </div>
    <div>
      <h2>工具报错分类</h2>
      <p class="sub">按错误文本首行归类，未知归入「其他」。</p>
      ${report.byClass.map(item => barRow(item.label, item.count, classMax, 'amber')).join('') || '<p class="muted">无</p>'}
    </div>
  </section>

  <section>
    <h2>工具错误率</h2>
    <p class="sub">错误次数最多的工具，及该工具自身的失败率。</p>
    <table>
      <thead><tr><th>工具</th><th class="num">调用</th><th class="num">报错</th><th class="num">失败率</th></tr></thead>
      <tbody>${toolRows || '<tr><td colspan="4" class="muted">无</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>轮次结束原因</h2>
    <p class="sub">非 completed 的轮次会把该轮最后一步标记为中断。</p>
    <div>${reasonChips || '<span class="muted">无</span>'}</div>
  </section>

  <section>
    <h2>最近无效步</h2>
    <p class="sub">按结束时间倒序，最多 30 条。路径列用于判断是哪类工作区反复踩坑。</p>
    <table>
      <thead><tr><th>日期</th><th>位置</th><th>类型</th><th>报错</th><th class="num">token</th><th class="num">耗时</th><th>工作区</th></tr></thead>
      <tbody>${recentRows || '<tr><td colspan="7" class="muted">无</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>会话排行</h2>
    <p class="sub">按浪费 token 排序的前 12 个会话。</p>
    <table>
      <thead><tr><th>工作区 / 会话</th><th class="num">步</th><th class="num">无效</th><th class="num">占比</th><th class="num">浪费 token</th><th class="num">浪费时长</th><th class="num">失败轮次</th></tr></thead>
      <tbody>${sessionRows || '<tr><td colspan="7" class="muted">无</td></tr>'}</tbody>
    </table>
  </section>

  <footer>
    <p><b>口径</b>：无效步 = 该 step 出现了明确的失败/重复/空转事件
    （工具 isError —— message 级与 part 级两种结果结构都算、shell 结果出现 <span class="mono">[exit code: 非0]</span>、
    同 step 内 llm/retry、与本会话早前同名同参的重复调用、审批被拒、command/done 失败、无文本无调用的空步、
    非 completed 轮次的最后一步）。</p>
    <p><b>浪费 token</b> = 这些 step 实际发生的 input/output/cache 用量之和，含缓存读取；它衡量「无效动作附带的算力」，
    不是供应商账单。缓存读取单价更低，因此 token 占比通常高于费用占比。</p>
    <p><b>浪费时长</b> = 无效步从 step/start 到 step/end 的墙钟时间之和，模型重试的退避时间包含在内。</p>
    <p>数据来自本机 DSH 会话日志（只读，不上传）。报告为静态 HTML，无外部依赖。</p>
  </footer>
</main>
</body>
</html>`
}

/** Plain-text summary for the CLI. */
export function renderTextReport(report) {
  const t = report.totals
  const lines = []
  lines.push(`DSH Step 无效动作分析 · ${t.sessions} 会话 / ${t.steps} 步`)
  lines.push(`无效步 ${t.invalidSteps}（${t.ratio}%） · 浪费 token ${formatTokens(t.wastedTokens)}（${t.tokenRatio}%） · 浪费时长 ${formatDuration(t.wastedMs)}（${t.timeRatio}%）`)
  lines.push(`工具调用 ${t.toolCalls}，报错 ${t.toolErrors} · 命令退出码非 0 ${t.commandFailures} · 模型重试 ${t.retries} · 失败轮次 ${t.failedTurns}`)
  if (report.byKind.length > 0) {
    lines.push('')
    lines.push('无效类型：')
    for (const item of report.byKind) lines.push(`  ${item.label.padEnd(8, ' ')} ${item.count}`)
  }
  if (report.byClass.length > 0) {
    lines.push('')
    lines.push('工具报错分类：')
    for (const item of report.byClass.slice(0, 10)) lines.push(`  ${item.label.padEnd(14, ' ')} ${item.count}`)
  }
  if (report.byTool.length > 0) {
    lines.push('')
    lines.push('Top 工具：')
    for (const item of report.byTool.slice(0, 8)) {
      const rate = item.calls > 0 ? Math.round((item.errors / item.calls) * 1000) / 10 : 0
      lines.push(`  ${item.tool.padEnd(16, ' ')} ${String(item.errors).padStart(4, ' ')}/${String(item.calls).padEnd(4, ' ')} ${rate}%`)
    }
  }
  if (report.daySeries.length > 0) {
    lines.push('')
    lines.push('按日（占比 / 浪费 token）：')
    for (const entry of report.daySeries.slice(-14)) {
      lines.push(`  ${entry.day}  ${String(entry.ratio).padStart(5, ' ')}%  ${formatTokens(entry.wastedTokens).padStart(8, ' ')}`)
    }
  }
  if (report.recent.length > 0) {
    lines.push('')
    lines.push('最近无效步：')
    for (const item of report.recent.slice(0, 8)) {
      const kinds = item.kinds.map(kind => STEP_KIND_LABELS[kind] ?? kind).join('/')
      lines.push(`  ${dayKey(item.at ?? 0)} T${item.turn}S${item.step} ${kinds} ${formatTokens(item.tokens)}tok ${item.cwd}`)
    }
  }
  return lines.join('\n')
}

export const STEP_KIND_ORDER = STEP_KINDS.map(item => item.id)
