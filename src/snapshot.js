/**
 * Compact aggregate snapshot for the DSH settings page.
 *
 * The page lives in the browser and cannot read session logs, so the host folds
 * per-session views into this small JSON document and publishes it through the
 * plugin's settings namespace. Numbers come from the same fold the offline
 * dashboard uses, so the page and `scan --html` never disagree.
 */
import { buildReport } from './report.js'
import { dayKey } from './report.js'

const DAY_MS = 86400000

/**
 * @param {Array<{sessionId: string, cwd?: string, view: object}>} sessions
 * @param {{now?: number, windowDays?: number, root?: string, loading?: boolean}} options
 */
export function buildSnapshot(sessions, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now()
  const windowDays = Number.isFinite(options.windowDays) ? Math.max(1, Math.min(180, options.windowDays)) : 30
  const report = buildReport(sessions, { now, root: options.root ?? '' })

  const totals = report.totals
  return {
    state: options.loading === true ? 'loading' : 'ready',
    generatedAt: now,
    windowDays,
    scannedSessions: sessions.length,
    totals: {
      sessions: totals.sessions,
      steps: totals.steps,
      invalidSteps: totals.invalidSteps,
      ratio: totals.ratio,
      tokens: totals.tokens,
      wastedTokens: totals.wastedTokens,
      tokenRatio: totals.tokenRatio,
      durationMs: totals.durationMs,
      wastedMs: totals.wastedMs,
      timeRatio: totals.timeRatio,
      toolCalls: totals.toolCalls,
      toolErrors: totals.toolErrors,
      commandFailures: totals.commandFailures,
      retries: totals.retries,
      failedTurns: totals.failedTurns,
    },
    days: fillDays(report.daySeries, now, windowDays),
    kinds: report.byKind.slice(0, 8),
    classes: report.byClass.slice(0, 8),
    tools: report.byTool.slice(0, 12).map(item => ({
      tool: item.tool,
      calls: item.calls,
      errors: item.errors,
      rate: item.calls > 0 ? Math.round((item.errors / item.calls) * 1000) / 10 : 0,
    })),
    sessions: report.perSession.slice(0, 8).map(item => ({
      sessionId: item.sessionId,
      cwd: shortenPath(item.cwd),
      steps: item.steps,
      invalidSteps: item.invalidSteps,
      ratio: item.ratio,
      wastedTokens: item.wastedTokens,
    })),
  }
}

/** One entry per calendar day, so the sparkline axis has no gaps. */
export function fillDays(series, now, windowDays) {
  const byDay = new Map(series.map(entry => [entry.day, entry]))
  const out = []
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const day = dayKey(now - offset * DAY_MS)
    const entry = byDay.get(day)
    out.push({
      day,
      steps: entry?.steps ?? 0,
      invalid: entry?.invalid ?? 0,
      ratio: entry?.ratio ?? 0,
      wastedTokens: entry?.wastedTokens ?? 0,
    })
  }
  return out
}

export function shortenPath(value) {
  const text = String(value ?? '')
  if (text === '') return ''
  const parts = text.split(/[\\/]+/u).filter(Boolean)
  return parts.length <= 2 ? text : `…/${parts.slice(-2).join('/')}`
}
