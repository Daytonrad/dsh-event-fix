/**
 * Host half of dsh-event-fix.
 *
 * It reads the session event stream and keeps one step-level projection per
 * session. It never edits requests, never blocks a tool call, never adds a
 * model-visible prompt section, and never calls an LLM.
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

export const name = 'event-fix'
export const inject = ['commands', 'sessionProjections']

const DEFAULT_LEDGER_PATH = fileURLToPath(new URL('../data/step-ledger.jsonl', import.meta.url))

export function resolveConfig(config = {}) {
  return {
    ledgerEnabled: config.ledgerEnabled !== false,
    ledgerPath: nonEmptyString(config.ledgerPath) ?? DEFAULT_LEDGER_PATH,
  }
}

export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  const ledgerStates = new Map()

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

  if (resolved.ledgerEnabled) {
    ctx.on('session/event', (session, event) => {
      try {
        const sessionId = String(session?.id ?? '')
        if (sessionId === '') return
        const previous = ledgerStates.get(sessionId) ?? createSessionState({
          id: sessionId,
          cwd: session?.header?.cwd,
          origin: session?.header?.origin,
          createdAt: session?.header?.createdAt,
        })
        const next = applyRecord(previous, event)
        ledgerStates.set(sessionId, next)
        if (event.type === 'step/end' && next.lastStep !== null) {
          appendRecord(resolved.ledgerPath, {
            schema: 'dsh.event-fix.step.v1',
            event: 'step',
            sessionId,
            cwd: session?.header?.cwd ?? null,
            ...summarizeStep(next.lastStep),
          })
        } else if (event.type === 'turn/end' && next.lastCorrection !== null) {
          appendRecord(resolved.ledgerPath, {
            schema: 'dsh.event-fix.step.v1',
            event: 'correction',
            sessionId,
            cwd: session?.header?.cwd ?? null,
            turn: next.lastCorrection.turn,
            step: next.lastCorrection.step,
            endedAt: next.lastCorrection.endedAt,
            durationMs: next.lastCorrection.durationMs,
            usage: next.lastCorrection.usage,
            invalid: true,
            kinds: ['turn-aborted'],
            reason: next.lastCorrection.reason,
          })
        }
      } catch (error) {
        warnOnce(`ledger:${String(session?.id ?? '')}`, error)
      }
    })
  }

  console.log(`[${name}] active; projection=${PROJECTION_KEY}; ledger=${resolved.ledgerEnabled ? resolved.ledgerPath : 'off'}`)
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
  console.warn(`[${name}] ${key}: ${error instanceof Error ? error.message : String(error)}`)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}
