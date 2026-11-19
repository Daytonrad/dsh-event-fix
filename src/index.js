/**
 * Host half of dsh-event-fix.
 *
 * It reads the session event stream and keeps one step-level projection per
 * session. It never edits requests, never blocks a tool call, never adds a
 * model-visible prompt section, and never calls an LLM.
 *
 * Two consumers sit on top of that projection:
 *   - `/steps` + the composer pill, per session, live;
 *   - the settings page, cross-session, served as JSON from a host route.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PROJECTION_KEY,
  STATE_VERSION,
  applyRecord,
  createSessionState,
  renderSummary,
  sessionView,
  stateSchema,
  viewSchema,
} from './analyzer.js'
import { loadHistoricalStates } from './history.js'
import { listSessionFiles, readSessionRecords, resolveSessionsRoot } from './session-store.js'
import { buildSnapshot } from './snapshot.js'

export const name = 'event-fix'
export const inject = ['commands', 'sessionProjections', 'connection']

const DEFAULT_LEDGER_PATH = fileURLToPath(new URL('../data/step-ledger.jsonl', import.meta.url))
const STATS_PATH = '/dsh-event-fix/stats'
const SNAPSHOT_TTL_MS = 1500
const BASELINE_DELAY_MS = 1500
const MAX_REBASE = 20

export function resolveConfig(config = {}) {
  return {
    ledgerEnabled: config.ledgerEnabled !== false,
    ledgerPath: nonEmptyString(config.ledgerPath) ?? DEFAULT_LEDGER_PATH,
    windowDays: Number.isSafeInteger(config.windowDays) && config.windowDays > 0 ? config.windowDays : 30,
    historySessions: Number.isSafeInteger(config.historySessions) && config.historySessions > 0
      ? config.historySessions
      : 150,
    sessionsRoot: nonEmptyString(config.sessionsRoot) ?? null,
  }
}

export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  /** sessionId -> { sessionId, cwd, state, mtime, origin } */
  const sessions = new Map()

  let baseline = { state: 'idle', done: 0, total: 0, skipped: 0, startedAt: 0, finishedAt: 0, error: null }
  let baselineRun = null
  let snapshot = null
  let snapshotAt = 0
  let rebaseNeeded = new Set()

  ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: STATE_VERSION,
    stateSchema,
    init: header => createSessionState(header ?? {}),
    apply: (state, event) => applyRecord(state, event),
    wire: {
      viewSchema,
      view: state => sessionView(state),
    },
  })

  ctx.commands.register({
    name: 'steps',
    description: '查看 step 级无效动作、浪费 token 与耗时统计',
    input: { hint: '[json]' },
    handler: (invocation) => {
      const state = readState(ctx, invocation.agent?.session)
      if (state === null) {
        return { kind: 'error', text: '当前会话还没有 step 数据。跑一轮后重试 `\/steps`。' }
      }
      const view = sessionView(state)
      if (String(invocation.rawInput ?? '').trim() === 'json') {
        return { kind: 'success', text: JSON.stringify(view, null, 2) }
      }
      return { kind: 'success', text: renderSummary(view) }
    },
  })

  ctx.on('session/event', (session, event) => {
    try {
      track(session, event)
    } catch (error) {
      warnOnce(`track:${String(session?.id ?? '')}`, error)
    }
  })

  // The settings page needs a cross-session number, which no projection can
  // provide. Serve it from a host route instead of abusing a config field:
  // config writes are revisioned and audited, a read-only JSON endpoint is not.
  //
  // `webServer` is mounted by the web app after plugins load, so it must be
  // injected rather than fetched: ctx.get('webServer') is still empty at apply
  // time and the route would silently never exist.
  const mount = hostContext => {
    const server = hostContext?.webServer ?? hostContext?.get?.('webServer')
    if (server === undefined || server === null || typeof server.register !== 'function') return undefined
    const dispose = server.register({
      kind: 'exact',
      path: STATS_PATH,
      handler: serveStats,
    })
    scheduleBaseline()
    return dispose
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], mount)
  } else {
    const immediate = mount(ctx)
    if (typeof immediate === 'function' && typeof ctx.effect === 'function') ctx.effect(() => immediate)
  }

  function scheduleBaseline() {
    const timer = setTimeout(() => { void runBaseline() }, BASELINE_DELAY_MS)
    if (typeof timer.unref === 'function') timer.unref()
    if (typeof ctx.effect === 'function') ctx.effect(() => () => clearTimeout(timer))
  }

  console.log(
    `[${name}] active; projection=${PROJECTION_KEY}; stats=${STATS_PATH}; `
    + `ledger=${resolved.ledgerEnabled ? resolved.ledgerPath : 'off'}`,
  )

  /** Replay one event onto the tracked state for its session. */
  function track(session, event) {
    const sessionId = String(session?.id ?? '')
    if (sessionId === '') return
    const header = session?.header ?? {}
    const previous = sessions.get(sessionId)
    const base = previous?.state ?? createSessionState({
      id: sessionId,
      cwd: header.cwd,
      origin: header.origin,
      createdAt: header.createdAt,
    })
    const state = applyRecord(base, event)
    // A session tracked before the baseline landed misses its own history; flag
    // it so the next baseline replaces the shallow state with a full replay.
    const shallow = previous === undefined && baseline.state !== 'ready'
    if (shallow) rebaseNeeded.add(sessionId)
    sessions.set(sessionId, {
      sessionId,
      cwd: header.cwd ?? previous?.cwd ?? state.cwd ?? '',
      origin: header.origin ?? previous?.origin ?? null,
      state,
      mtime: Date.now(),
    })
    snapshot = null

    if (!resolved.ledgerEnabled) return
    if (event.type === 'step/end' && state.lastStep !== null) {
      appendRecord(resolved.ledgerPath, {
        schema: 'dsh.event-fix.step.v1',
        event: 'step',
        sessionId,
        cwd: header.cwd ?? null,
        ...summarizeStep(state.lastStep),
      })
    } else if (event.type === 'turn/end' && state.lastCorrection !== null) {
      appendRecord(resolved.ledgerPath, {
        schema: 'dsh.event-fix.step.v1',
        event: 'correction',
        sessionId,
        cwd: header.cwd ?? null,
        turn: state.lastCorrection.turn,
        step: state.lastCorrection.step,
        endedAt: state.lastCorrection.endedAt,
        durationMs: state.lastCorrection.durationMs,
        usage: state.lastCorrection.usage,
        invalid: true,
        kinds: ['turn-aborted'],
        reason: state.lastCorrection.reason,
      })
    }
  }

  async function runBaseline() {
    if (baselineRun !== null) return baselineRun
    baseline = { state: 'loading', done: 0, total: 0, skipped: 0, startedAt: Date.now(), finishedAt: 0, error: null }
    baselineRun = loadHistoricalStates({
      root: resolved.sessionsRoot ?? undefined,
      limit: resolved.historySessions,
      onProgress: (done, total) => {
        baseline = { ...baseline, done, total }
      },
    }).then(async result => {
      // Sessions touched while the scan ran are rebased from their own log so a
      // live event never truncates a session's history.
      const rebaseIds = [...rebaseNeeded].slice(0, MAX_REBASE)
      rebaseNeeded = new Set()
      const rebound = await rebase(rebaseIds)
      for (const item of result.states) {
        if (sessions.has(item.sessionId)) continue
        sessions.set(item.sessionId, {
          sessionId: item.sessionId,
          cwd: item.cwd,
          origin: null,
          state: item.state,
          mtime: item.mtime,
        })
      }
      for (const item of rebound) {
        sessions.set(item.sessionId, {
          sessionId: item.sessionId,
          cwd: item.cwd,
          origin: null,
          state: item.state,
          mtime: item.mtime,
        })
      }
      baseline = {
        ...baseline,
        state: 'ready',
        done: result.total,
        total: result.total,
        skipped: result.skipped,
        finishedAt: Date.now(),
      }
      snapshot = null
      return baseline
    }).catch(error => {
      baseline = { ...baseline, state: 'failed', error: messageOf(error), finishedAt: Date.now() }
      warnOnce('baseline', error)
      return baseline
    }).finally(() => {
      baselineRun = null
    })
    return baselineRun
  }

  /** Re-read specific session logs and replace their (shallow) live state. */
  async function rebase(sessionIds) {
    if (sessionIds.length === 0) return []
    const wanted = new Set(sessionIds)
    const out = []
    let files = []
    try {
      files = listSessionFiles(resolveSessionsRoot(resolved.sessionsRoot ?? undefined))
    } catch {
      return out
    }
    for (const file of files) {
      if (!wanted.has(file.sessionId)) continue
      try {
        const records = readSessionRecords(file.file)
        const header = records.find(record => record.type === 'session') ?? {}
        let state = createSessionState({ id: header.id ?? file.sessionId, cwd: header.cwd })
        for (const record of records) state = applyRecord(state, record)
        out.push({ sessionId: file.sessionId, cwd: header.cwd ?? '', mtime: file.mtime, state })
        wanted.delete(file.sessionId)
      } catch {
        // keep the shallow state; the next baseline will pick the session up
      }
      if (wanted.size === 0) break
    }
    return out
  }

  function currentSnapshot(windowDays) {
    const now = Date.now()
    if (snapshot !== null && now - snapshotAt < SNAPSHOT_TTL_MS && snapshot.windowDays === windowDays) {
      return snapshot
    }
    const views = []
    for (const entry of sessions.values()) {
      views.push({ sessionId: entry.sessionId, cwd: entry.cwd, view: sessionView(entry.state) })
    }
    snapshot = buildSnapshot(views, {
      now,
      windowDays,
      root: resolveSessionsRoot(resolved.sessionsRoot ?? undefined),
      loading: baseline.state === 'loading',
    })
    snapshot.scan = {
      state: baseline.state,
      done: baseline.done,
      total: baseline.total,
      skipped: baseline.skipped,
      startedAt: baseline.startedAt,
      finishedAt: baseline.finishedAt,
      error: baseline.error,
      limit: resolved.historySessions,
    }
    snapshotAt = now
    return snapshot
  }

  function serveStats(request, response) {
    try {
      if (rejectUnadmitted(request, response)) return
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' })
        response.end('method not allowed')
        return
      }
      const url = new URL(request.url ?? STATS_PATH, 'http://127.0.0.1')
      const requested = Number(url.searchParams.get('days'))
      const windowDays = Number.isSafeInteger(requested) && requested > 0 && requested <= 180
        ? requested
        : resolved.windowDays
      if (url.searchParams.get('refresh') === '1') void runBaseline()
      const body = JSON.stringify(currentSnapshot(windowDays))
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body),
      })
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch (error) {
      warnOnce('stats-route', error)
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      }
      response.end(JSON.stringify({ error: messageOf(error) }))
    }
  }

  /**
   * Exact web-server routes bypass the host's API middleware, so they must ask
   * the Connection service's own Host/Origin and browser-session fence first.
   * Older hosts without the service keep the route available.
   */
  function rejectUnadmitted(request, response) {
    const connection = ctx.connection ?? ctx.get?.('connection')
    if (typeof connection?.requestRejection !== 'function') return false
    const rejection = connection.requestRejection(request)
    if (rejection === undefined) return false
    response.writeHead(rejection, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    })
    response.end()
    return true
  }
}

function summarizeStep(step) {
  return {
    turn: step.turn,
    step: step.step,
    endedAt: step.endedAt,
    durationMs: step.durationMs,
    usage: step.usage,
    invalid: step.invalid,
    kinds: step.kinds,
    toolErrors: step.toolErrors,
    commandFailures: step.commandFailures ?? 0,
    retries: step.retries,
  }
}

function readState(ctx, session) {
  if (session === undefined || session === null) return null
  try {
    return ctx.sessionProjections.stateOf(session, PROJECTION_KEY) ?? null
  } catch {
    return null
  }
}

function appendRecord(path, record) {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8')
}

function warnOnce(key, error) {
  const seen = warnOnce.seen ??= new Set()
  if (seen.has(key)) return
  seen.add(key)
  console.warn(`[${name}] ${key}: ${messageOf(error)}`)
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}
