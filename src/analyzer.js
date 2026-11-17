/**
 * Step-level projection over DSH session events.
 *
 * Design note — this is a *side branch* of the event log, not a second source
 * of truth. Every number here can be recomputed from the raw session events:
 *
 *   session events --(this module)--> per-step facts --> per-session view
 *
 * Only unambiguous events are interpreted:
 *   step/start, step/end, turn/start, turn/end, assistant/message,
 *   tool/call, tool/result, llm/retry, approval/decided, command/done
 *
 * Nothing is inferred about why the model did something. A step is "invalid"
 * only when an event explicitly says something failed or repeated.
 */
import {
  STEP_KINDS,
  STEP_KIND_LABELS,
  callSignature,
  classLabel,
  classifyToolError,
  errorSnippet,
} from './taxonomy.js'

export const STATE_VERSION = 2
export const PROJECTION_KEY = 'step-errors'
export const MAX_RECENT = 20
const MAX_SEEN_CALLS = 5000
const MAX_TURNS = 500
const WRITE_TOOLS = new Set(['write', 'edit', 'apply_patch', 'patch', 'multi_edit', 'str_replace', 'notebook_edit'])

export function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
}

export function addUsage(target, usage) {
  if (usage === undefined || usage === null) return target
  const input = num(usage.inputTokens ?? usage.input ?? 0)
  const output = num(usage.outputTokens ?? usage.output ?? 0)
  const cacheRead = num(usage.cacheReadTokens ?? usage.cacheRead ?? 0)
  const cacheWrite = num(usage.cacheWriteTokens ?? usage.cacheWrite ?? 0)
  const totalRaw = num(usage.totalTokens ?? usage.total ?? 0)
  const total = totalRaw > 0 ? totalRaw : input + output + cacheRead + cacheWrite
  return {
    input: target.input + input,
    output: target.output + output,
    cacheRead: target.cacheRead + cacheRead,
    cacheWrite: target.cacheWrite + cacheWrite,
    total: target.total + total,
  }
}

export function totalOf(usage) {
  return usage?.total ?? 0
}

export function createSessionState(header = {}) {
  return {
    version: STATE_VERSION,
    sessionId: typeof header.id === 'string' ? header.id : null,
    cwd: typeof header.cwd === 'string' ? header.cwd : null,
    origin: typeof header.origin === 'string' ? header.origin : null,
    createdAt: num(header.createdAt ?? 0) || null,
    currentTurn: null,
    currentStep: null,
    openStep: null,
    totals: {
      steps: 0,
      usage: emptyUsage(),
      durationMs: 0,
      toolCalls: 0,
      toolErrors: 0,
      retries: 0,
      retryDelayMs: 0,
    },
    invalid: {
      steps: 0,
      usage: emptyUsage(),
      durationMs: 0,
      toolErrors: 0,
      duplicates: 0,
    },
    byKind: {},
    byClass: {},
    byTool: {},
    turns: {},
    turnOrder: [],
    failedTurns: 0,
    byTurnReason: {},
    recent: [],
    lastStep: null,
    lastCorrection: null,
    seenCalls: {},
    seenCallCount: 0,
    mutationCount: 0,
    updatedAt: null,
  }
}

function newStep(turn, step, at) {
  return {
    turn,
    step,
    startedAt: at,
    usage: emptyUsage(),
    calls: [],
    retries: 0,
    retryDelayMs: 0,
    denied: 0,
    commandError: false,
    commandMessage: '',
    textChars: 0,
    reasoningChars: 0,
  }
}

/** Apply one session event, returning the next state (no in-place mutation). */
export function applyRecord(state, event) {
  if (state === null || typeof state !== 'object') return state
  if (event === null || typeof event !== 'object') return state
  const type = event.type
  const data = event.data ?? {}
  const at = num(event.time) || null

  switch (type) {
    case 'turn/start':
      return startTurn(state, data, at)
    case 'step/start':
      return startStep(state, data, at)
    case 'assistant/message':
      return addAssistantMessage(state, data, at)
    case 'tool/call':
      return addToolCall(state, data, at)
    case 'tool/result':
      return addToolResult(state, data, at)
    case 'llm/retry':
      return addRetry(state, data, at)
    case 'approval/decided':
      return addApproval(state, data, at)
    case 'command/done':
      return addCommandResult(state, data, at)
    case 'step/end':
      return endStep(state, data, at)
    case 'turn/end':
      return endTurn(state, data, at)
    default:
      return state
  }
}

function startTurn(state, data, at) {
  const turn = intOrNull(data.turn)
  if (turn === null) return state
  const turns = { ...state.turns }
  if (turns[turn] === undefined) {
    turns[turn] = {
      turn,
      startedAt: at,
      steps: 0,
      invalid: 0,
      usage: emptyUsage(),
      invalidUsage: emptyUsage(),
      durationMs: 0,
      invalidDurationMs: 0,
      failed: false,
    }
  }
  const turnOrder = state.turnOrder.includes(turn)
    ? state.turnOrder
    : [...state.turnOrder, turn].slice(-MAX_TURNS)
  return {
    ...state,
    currentTurn: turn,
    currentStep: null,
    openStep: null,
    turns,
    turnOrder,
    updatedAt: at ?? state.updatedAt,
  }
}

function startStep(state, data, at) {
  const turn = intOrNull(data.turn) ?? state.currentTurn
  const step = intOrNull(data.step)
  if (step === null) return state
  return {
    ...state,
    currentTurn: turn,
    currentStep: step,
    openStep: newStep(turn, step, at ?? Date.now()),
    updatedAt: at ?? state.updatedAt,
  }
}

function ensureStep(state, data, at) {
  if (state.openStep !== null) return state
  const turn = intOrNull(data.turn) ?? state.currentTurn
  const step = intOrNull(data.step) ?? state.currentStep
  if (step === null) return state
  return {
    ...state,
    currentTurn: turn,
    currentStep: step,
    openStep: newStep(turn, step, at ?? Date.now()),
  }
}

function addAssistantMessage(state, data, at) {
  const withStep = ensureStep(state, data, at)
  const usage = data.usage ?? data.message?.usage
  const content = Array.isArray(data.message?.content) ? data.message.content : []
  let textChars = withStep.openStep.textChars
  let reasoningChars = withStep.openStep.reasoningChars
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') textChars += part.text.trim().length
    else if (part?.type === 'reasoning' && typeof part.text === 'string') reasoningChars += part.text.length
  }
  const openStep = {
    ...withStep.openStep,
    usage: addUsage(withStep.openStep.usage, usage),
    textChars,
    reasoningChars,
  }
  return { ...withStep, openStep, updatedAt: at ?? withStep.updatedAt }
}

function addToolCall(state, data, at) {
  const withStep = ensureStep(state, data, at)
  const name = typeof data.name === 'string' ? data.name : 'unknown'
  const callId = typeof data.callId === 'string' ? data.callId : null
  const signature = callSignature(name, data.arguments)
  const previous = state.seenCalls[signature]
  const currentKey = withStep.openStep.turn !== null && withStep.openStep.step !== null
    ? `${withStep.openStep.turn}:${withStep.openStep.step}`
    : null
  // A repeat only counts when nothing was written in between: re-reading a
  // file after an edit is legitimate work, not a loop.
  const duplicate = previous !== undefined
    && previous.where !== currentKey
    && previous.mutations === state.mutationCount

  let seenCalls = state.seenCalls
  let seenCallCount = state.seenCallCount
  if (previous === undefined) {
    if (seenCallCount < MAX_SEEN_CALLS) {
      seenCalls = { ...state.seenCalls, [signature]: { where: currentKey, mutations: state.mutationCount } }
      seenCallCount += 1
    }
  }

  const call = {
    callId,
    name,
    signature,
    duplicate,
    isError: false,
    errorClass: null,
    snippet: '',
  }
  return {
    ...withStep,
    seenCalls,
    seenCallCount,
    openStep: { ...withStep.openStep, calls: [...withStep.openStep.calls, call] },
    updatedAt: at ?? withStep.updatedAt,
  }
}

function addToolResult(state, data, at) {
  const withStep = ensureStep(state, data, at)
  const callId = data.toolCallId ?? data.message?.toolCallId ?? data.message?.source?.callId ?? null
  const isError = data.message?.isError === true
  const text = (Array.isArray(data.message?.content) ? data.message.content : [])
    .map(part => part?.text ?? '')
    .join('\n')
    .trim()

  const calls = [...withStep.openStep.calls]
  let index = callId === null ? -1 : calls.findIndex(call => call.callId === callId)
  if (index < 0) {
    calls.push({
      callId,
      name: String(data.message?.source?.toolName ?? data.toolName ?? 'unknown'),
      signature: null,
      duplicate: false,
      isError: false,
      errorClass: null,
      snippet: '',
    })
    index = calls.length - 1
  }
  const errorClass = isError ? classifyToolError(text) : null
  calls[index] = {
    ...calls[index],
    isError: isError || calls[index].isError,
    errorClass: errorClass ?? calls[index].errorClass,
    snippet: isError ? errorSnippet(text) : calls[index].snippet,
  }
  const mutated = !isError && WRITE_TOOLS.has(calls[index].name)
  return {
    ...withStep,
    mutationCount: withStep.mutationCount + (mutated ? 1 : 0),
    openStep: { ...withStep.openStep, calls },
    updatedAt: at ?? withStep.updatedAt,
  }
}

function addRetry(state, data, at) {
  const withStep = ensureStep(state, data, at)
  const delayMs = num(data.delayMs ?? 0)
  return {
    ...withStep,
    openStep: {
      ...withStep.openStep,
      retries: withStep.openStep.retries + 1,
      retryDelayMs: withStep.openStep.retryDelayMs + delayMs,
    },
    updatedAt: at ?? withStep.updatedAt,
  }
}

function addApproval(state, data, at) {
  const withStep = ensureStep(state, data, at)
  const outcome = String(data.outcome ?? '')
  if (outcome !== 'rejected' && outcome !== 'cancelled' && outcome !== 'denied') return withStep
  return {
    ...withStep,
    openStep: { ...withStep.openStep, denied: withStep.openStep.denied + 1 },
    updatedAt: at ?? withStep.updatedAt,
  }
}

function addCommandResult(state, data, at) {
  if (data.kind !== 'error') return state
  const withStep = ensureStep(state, data, at)
  return {
    ...withStep,
    openStep: {
      ...withStep.openStep,
      commandError: true,
      commandMessage: errorSnippet(data.text ?? ''),
    },
    updatedAt: at ?? withStep.updatedAt,
  }
}

function endStep(state, data, at) {
  const withStep = ensureStep(state, data, at)
  if (withStep.openStep === null) return state
  return finalizeStep(withStep, at ?? Date.now())
}

function finalizeStep(state, endedAt) {
  const step = state.openStep
  if (step === null) return state
  const errorCalls = step.calls.filter(call => call.isError)
  const duplicateCalls = step.calls.filter(call => call.duplicate)
  const kinds = []
  if (errorCalls.length > 0) kinds.push('tool-error')
  if (step.retries > 0) kinds.push('llm-retry')
  if (duplicateCalls.length > 0) kinds.push('repeated-call')
  if (step.denied > 0) kinds.push('approval-rejected')
  if (step.commandError) kinds.push('command-error')
  if (step.calls.length === 0 && step.textChars === 0 && !step.commandError) kinds.push('empty-step')

  const durationMs = step.startedAt !== null && endedAt !== null
    ? Math.max(0, endedAt - step.startedAt)
    : 0
  return commitStep(state, {
    turn: step.turn,
    step: step.step,
    endedAt,
    durationMs,
    usage: step.usage,
    kinds,
    errors: errorCalls.map(call => ({
      tool: call.name,
      class: call.errorClass ?? 'other',
      message: call.snippet,
      callId: call.callId,
    })),
    retries: step.retries,
    retryDelayMs: step.retryDelayMs,
    toolCalls: step.calls.length,
    toolErrors: errorCalls.length,
    duplicateCalls: duplicateCalls.length,
    calls: step.calls.map(call => ({
      name: call.name,
      isError: call.isError,
      errorClass: call.errorClass,
    })),
  })
}

function commitStep(state, info) {
  const invalid = info.kinds.length > 0
  const totals = {
    steps: state.totals.steps + 1,
    usage: addUsage(state.totals.usage, info.usage),
    durationMs: state.totals.durationMs + info.durationMs,
    toolCalls: state.totals.toolCalls + info.toolCalls,
    toolErrors: state.totals.toolErrors + info.toolErrors,
    retries: state.totals.retries + info.retries,
    retryDelayMs: state.totals.retryDelayMs + info.retryDelayMs,
  }
  const byClass = { ...state.byClass }
  const byTool = { ...state.byTool }
  for (const error of info.errors) {
    byClass[error.class] = (byClass[error.class] ?? 0) + 1
  }
  for (const call of info.calls) {
    const entry = byTool[call.name] ?? { calls: 0, errors: 0 }
    byTool[call.name] = {
      calls: entry.calls + 1,
      errors: entry.errors + (call.isError ? 1 : 0),
    }
  }

  const turnEntry = state.turns[info.turn] ?? {
    turn: info.turn,
    startedAt: info.endedAt,
    steps: 0,
    invalid: 0,
    usage: emptyUsage(),
    invalidUsage: emptyUsage(),
    durationMs: 0,
    invalidDurationMs: 0,
    failed: false,
  }
  const turns = {
    ...state.turns,
    [info.turn]: {
      ...turnEntry,
      steps: turnEntry.steps + 1,
      invalid: turnEntry.invalid + (invalid ? 1 : 0),
      usage: addUsage(turnEntry.usage, info.usage),
      invalidUsage: invalid ? addUsage(turnEntry.invalidUsage, info.usage) : turnEntry.invalidUsage,
      durationMs: turnEntry.durationMs + info.durationMs,
      invalidDurationMs: turnEntry.invalidDurationMs + (invalid ? info.durationMs : 0),
    },
  }

  let invalidAgg = state.invalid
  let byKind = state.byKind
  let recent = state.recent
  if (invalid) {
    invalidAgg = {
      steps: state.invalid.steps + 1,
      usage: addUsage(state.invalid.usage, info.usage),
      durationMs: state.invalid.durationMs + info.durationMs,
      toolErrors: state.invalid.toolErrors + info.toolErrors,
      duplicates: state.invalid.duplicates + info.duplicateCalls,
    }
    byKind = { ...state.byKind }
    for (const kind of info.kinds) byKind[kind] = (byKind[kind] ?? 0) + 1
    recent = [{
      turn: info.turn,
      step: info.step,
      at: info.endedAt,
      kinds: info.kinds,
      errors: info.errors.slice(0, 3),
      usage: info.usage,
      durationMs: info.durationMs,
      retries: info.retries,
    }, ...state.recent].slice(0, MAX_RECENT)
  }

  const lastStep = {
    turn: info.turn,
    step: info.step,
    endedAt: info.endedAt,
    durationMs: info.durationMs,
    usage: info.usage,
    invalid,
    kinds: info.kinds,
    toolErrors: info.toolErrors,
    retries: info.retries,
  }

  return {
    ...state,
    openStep: null,
    currentStep: info.step,
    totals,
    invalid: invalidAgg,
    byKind,
    byClass,
    byTool,
    turns,
    recent,
    lastStep,
    lastCorrection: null,
    updatedAt: info.endedAt ?? state.updatedAt,
  }
}

function endTurn(state, data, at) {
  const turn = intOrNull(data.turn) ?? state.currentTurn
  const reason = String(data.reason?.kind ?? 'unknown')
  let next = finalizeStep(state, at ?? Date.now())
  const byTurnReason = { ...next.byTurnReason, [reason]: (next.byTurnReason[reason] ?? 0) + 1 }
  next = { ...next, byTurnReason, currentTurn: turn, updatedAt: at ?? next.updatedAt }

  if (reason === 'completed' || turn === null) {
    return { ...next, lastCorrection: null }
  }

  const turns = { ...next.turns }
  const entry = turns[turn]
  if (entry !== undefined) turns[turn] = { ...entry, failed: true }
  next = { ...next, turns, failedTurns: next.failedTurns + 1 }

  const last = next.lastStep
  if (last === null || last.turn !== turn) return { ...next, lastCorrection: null }

  if (!last.invalid) {
    const withKind = { ...next, byKind: { ...next.byKind, 'turn-aborted': (next.byKind['turn-aborted'] ?? 0) + 1 } }
    const turnsAfter = { ...withKind.turns }
    const target = turnsAfter[turn]
    if (target !== undefined) {
      turnsAfter[turn] = {
        ...target,
        invalid: target.invalid + 1,
        invalidUsage: addUsage(target.invalidUsage, last.usage),
        invalidDurationMs: target.invalidDurationMs + last.durationMs,
      }
    }
    next = {
      ...withKind,
      turns: turnsAfter,
      invalid: {
        steps: withKind.invalid.steps + 1,
        usage: addUsage(withKind.invalid.usage, last.usage),
        durationMs: withKind.invalid.durationMs + last.durationMs,
        toolErrors: withKind.invalid.toolErrors + last.toolErrors,
        duplicates: withKind.invalid.duplicates,
      },
      recent: [{
        turn: last.turn,
        step: last.step,
        at: last.endedAt,
        kinds: ['turn-aborted'],
        errors: [],
        usage: last.usage,
        durationMs: last.durationMs,
        retries: last.retries,
      }, ...withKind.recent].slice(0, MAX_RECENT),
      lastStep: { ...last, invalid: true, kinds: [...last.kinds, 'turn-aborted'] },
    }
  } else if (!last.kinds.includes('turn-aborted')) {
    next = {
      ...next,
      byKind: { ...next.byKind, 'turn-aborted': (next.byKind['turn-aborted'] ?? 0) + 1 },
      lastStep: { ...last, kinds: [...last.kinds, 'turn-aborted'] },
    }
  }
  return {
    ...next,
    lastCorrection: {
      kind: 'turn-aborted',
      reason,
      turn: last.turn,
      step: last.step,
      endedAt: last.endedAt,
      durationMs: last.durationMs,
      usage: last.usage,
    },
  }
}

function ratio(part, whole) {
  if (!(whole > 0)) return 0
  return Math.round((part / whole) * 10000) / 100
}

/** Client-facing view. Keep it small: it is serialised on every projection tick. */
export function sessionView(state) {
  const totalTokens = totalOf(state.totals.usage)
  const wastedTokens = totalOf(state.invalid.usage)
  const series = state.turnOrder
    .map(turn => state.turns[turn])
    .filter(entry => entry !== undefined && entry.steps > 0)
    .map(entry => ({
      turn: entry.turn,
      at: entry.startedAt,
      steps: entry.steps,
      invalid: entry.invalid,
      ratio: ratio(entry.invalid, entry.steps),
      tokens: totalOf(entry.usage),
      wastedTokens: totalOf(entry.invalidUsage),
      durationMs: entry.durationMs,
      wastedMs: entry.invalidDurationMs,
      failed: entry.failed === true,
    }))
  return {
    phase: state.openStep === null ? 'idle' : 'active',
    sessionId: state.sessionId,
    cwd: state.cwd,
    updatedAt: state.updatedAt,
    totals: {
      steps: state.totals.steps,
      invalidSteps: state.invalid.steps,
      ratio: ratio(state.invalid.steps, state.totals.steps),
      tokens: totalTokens,
      wastedTokens,
      tokenRatio: ratio(wastedTokens, totalTokens),
      durationMs: state.totals.durationMs,
      wastedMs: state.invalid.durationMs,
      toolCalls: state.totals.toolCalls,
      toolErrors: state.totals.toolErrors,
      retries: state.totals.retries,
      retryDelayMs: state.totals.retryDelayMs,
      failedTurns: state.failedTurns,
    },
    wastedBreakdown: state.invalid.usage,
    byKind: STEP_KINDS
      .map(item => ({ id: item.id, label: item.label, count: state.byKind[item.id] ?? 0 }))
      .filter(item => item.count > 0),
    byClass: Object.entries(state.byClass)
      .map(([id, count]) => ({ id, label: classLabel(id), count }))
      .sort((a, b) => b.count - a.count),
    byTool: Object.entries(state.byTool)
      .map(([tool, entry]) => ({ tool, calls: entry.calls ?? 0, errors: entry.errors ?? 0 }))
      .sort((a, b) => b.errors - a.errors || a.tool.localeCompare(b.tool)),
    byTurnReason: Object.entries(state.byTurnReason)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    series,
    recent: state.recent,
  }
}

export const stateSchema = {
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('step-errors state must be an object')
    }
    if (value.version !== STATE_VERSION) {
      throw new TypeError(`step-errors state version ${String(value.version)} is not ${STATE_VERSION}`)
    }
    return value
  },
}

export const viewSchema = {
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('step-errors view must be an object')
    }
    if (value.totals === undefined || !Array.isArray(value.series)) {
      throw new TypeError('step-errors view lacks totals/series')
    }
    return value
  },
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${Math.round(seconds % 60)}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${String(minutes % 60).padStart(2, '0')}m`
}

export function formatTokens(tokens) {
  const value = Number.isFinite(tokens) ? tokens : 0
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
  return String(Math.round(value))
}

const TURN_REASON_LABELS = {
  completed: '正常结束',
  error: '模型/请求报错',
  aborted: '用户中止',
  interrupted: '被打断',
  'max-tokens': '触顶 max-tokens',
}

export function turnReasonLabel(reason) {
  return TURN_REASON_LABELS[reason] ?? reason
}

/** `/steps` command output. */
export function renderSummary(view) {
  const lines = []
  const { totals } = view
  lines.push(`Step 无效动作统计 · ${totals.steps} 步，其中无效 ${totals.invalidSteps} 步（${totals.ratio}%）`)
  lines.push(
    `浪费 token ${formatTokens(totals.wastedTokens)}（总 ${formatTokens(totals.tokens)}，占 ${totals.tokenRatio}%）`
    + ` · 浪费时长 ${formatDuration(totals.wastedMs)}（总 ${formatDuration(totals.durationMs)}）`,
  )
  lines.push(
    `工具调用 ${totals.toolCalls} 次，报错 ${totals.toolErrors} 次；模型重试 ${totals.retries} 次，`
    + `退避 ${formatDuration(totals.retryDelayMs)}；失败轮次 ${totals.failedTurns}`,
  )
  if (view.byKind.length > 0) {
    lines.push('')
    lines.push('无效类型：')
    for (const item of view.byKind) lines.push(`  ${item.label} ${item.count}`)
  }
  if (view.byClass.length > 0) {
    lines.push('')
    lines.push('工具报错分类：')
    for (const item of view.byClass.slice(0, 8)) lines.push(`  ${item.label} ${item.count}`)
  }
  if (view.recent.length > 0) {
    lines.push('')
    lines.push('最近无效步：')
    for (const item of view.recent.slice(0, 6)) {
      const kinds = item.kinds.map(kind => STEP_KIND_LABELS[kind] ?? kind).join('/')
      const detail = item.errors[0] === undefined ? '' : ` ${item.errors[0].tool}: ${item.errors[0].message}`
      lines.push(`  T${item.turn}S${item.step} ${kinds} ${formatTokens(totalOf(item.usage))}tok${detail}`)
    }
  }
  lines.push('')
  lines.push(`口径：无效步 = 出现明确失败/重试/重复/空转事件的 step；浪费 token = 这些 step 的用量。`)
  return lines.join('\n')
}

export function num(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

export function intOrNull(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/** Convenience for offline analysis: replay a record list into one state. */
export function summarizeRecords(records, header = {}) {
  let state = createSessionState(header)
  for (const record of records) state = applyRecord(state, record)
  return state
}
