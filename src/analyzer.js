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
 * A tool result reaches the log in two different shapes, and both must be
 * read — the flat one only carries failures:
 *
 *   flat    { message: { role: 'tool', isError: true, content: [{ type: 'text', text }] } }
 *   nested  { message: { role: 'user', content: [{ type: 'tool-result',
 *               isError, toolCallId, content: [{ type: 'text', text }] }] } }
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

export const STATE_VERSION = 4
export const PROJECTION_KEY = 'step-errors'
export const MAX_RECENT = 20
const MAX_SEEN_CALLS = 5000
const MAX_TURNS = 500
const WRITE_TOOLS = new Set(['write', 'edit', 'apply_patch', 'patch', 'multi_edit', 'str_replace', 'notebook_edit'])
// DSH reports a shell command's outcome as a normal result plus an exit marker,
// so a non-zero exit code never shows up as `isError`.
const SHELL_TOOLS = new Set(['pwsh', 'powershell', 'bash', 'sh', 'shell', 'exec', 'command', 'cmd', 'zsh'])
const EXIT_CODE = /\[exit code: (-?\d+)\]/i

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

/**
 * Counters for "what did the agent do right after a failure, and did it work".
 *
 * A failure episode starts when a tool call reports an error and is settled by
 * the first tool call of a *later step in the same turn*: parallel calls in the
 * same step never saw the error, so they are not recovery attempts.
 *
 * `episodes` counts settled episodes. Each is classified by what the next call
 * did — `same` (identical tool + arguments), `changedArgs` (same tool, other
 * arguments), `changedTool` (another tool) — and then by whether that call
 * worked: `*Ok` / `*Fail`. `unknown` covers a follow-up call without a call id,
 * whose result cannot be matched. `abandoned` is a turn that ended with the
 * failure still unanswered.
 *
 * In the local corpus literal retries are almost absent (2 of 708), so the
 * interesting number is not the retry rate but the recovery rate.
 */
export function emptyFollowups() {
  return {
    episodes: 0,
    same: 0,
    sameOk: 0,
    sameFail: 0,
    changedArgs: 0,
    changedArgsOk: 0,
    changedArgsFail: 0,
    changedTool: 0,
    changedToolOk: 0,
    changedToolFail: 0,
    unknown: 0,
    abandoned: 0,
  }
}

/** Times the action after a failure succeeded, across all three kinds. */
export function recoveredFollowups(followups) {
  const f = followups ?? {}
  return (f.sameOk ?? 0) + (f.changedArgsOk ?? 0) + (f.changedToolOk ?? 0)
}

/** Times the action after a failure failed again. */
export function failedFollowups(followups) {
  const f = followups ?? {}
  return (f.sameFail ?? 0) + (f.changedArgsFail ?? 0) + (f.changedToolFail ?? 0)
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
      commandFailures: 0,
      retries: 0,
      retryDelayMs: 0,
    },
    invalid: {
      steps: 0,
      usage: emptyUsage(),
      durationMs: 0,
      toolErrors: 0,
      commandFailures: 0,
      duplicates: 0,
    },
    byKind: {},
    byClass: {},
    byTool: {},
    /** tool -> { episodes, recovered }: a failure of this tool and how often the next call worked. */
    byToolRecovery: {},
    /** tool -> { [classId]: count }: which failure each tool actually produces. */
    byToolClass: {},
    followups: emptyFollowups(),
    /** A failure waiting for the next step: { tool, signature, turn, step }. */
    pendingFailure: null,
    /** A same-turn follow-up waiting for its own result: { callId, kind, failedTool }. */
    pendingRetry: null,
    turns: {},
    turnOrder: [],
    failedTurns: 0,
    byTurnReason: {},
    recent: [],
    lastStep: null,
    lastCorrection: null,
    seenCalls: {},
    seenCallCount: 0,
    callNames: {},
    callNameCount: 0,
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
  // A failure left hanging from an earlier turn had no follow-up call: the log
  // may simply lack its turn/end, so close it here instead of dropping it.
  const base = abandonFailure(state, state.pendingFailure?.turn ?? null)
  const turns = { ...base.turns }
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
  const turnOrder = base.turnOrder.includes(turn)
    ? base.turnOrder
    : [...base.turnOrder, turn].slice(-MAX_TURNS)
  return {
    ...base,
    currentTurn: turn,
    currentStep: null,
    openStep: null,
    turns,
    turnOrder,
    updatedAt: at ?? base.updatedAt,
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
  const opened = ensureStep(state, data, at)
  const name = typeof data.name === 'string' ? data.name : 'unknown'
  const callId = typeof data.callId === 'string' ? data.callId : null
  const signature = callSignature(name, data.arguments)
  // Was this call the agent's answer to a failure it just saw?
  const withStep = answerFailure(opened, {
    name,
    signature,
    callId,
    turn: opened.openStep.turn,
    step: opened.openStep.step,
  })
  const previous = withStep.seenCalls[signature]
  const currentKey = withStep.openStep.turn !== null && withStep.openStep.step !== null
    ? `${withStep.openStep.turn}:${withStep.openStep.step}`
    : null
  // A repeat only counts when nothing was written in between: re-reading a
  // file after an edit is legitimate work, not a loop.
  const duplicate = previous !== undefined
    && previous.where !== currentKey
    && previous.mutations === withStep.mutationCount

  let seenCalls = withStep.seenCalls
  let seenCallCount = withStep.seenCallCount
  if (previous === undefined) {
    if (seenCallCount < MAX_SEEN_CALLS) {
      seenCalls = { ...withStep.seenCalls, [signature]: { where: currentKey, mutations: withStep.mutationCount } }
      seenCallCount += 1
    }
  }

  const call = {
    callId,
    name,
    signature,
    duplicate,
    isError: false,
    commandFailure: false,
    exitCode: null,
    errorClass: null,
    snippet: '',
  }
  // Results often arrive without a tool name (`source` only carries `callId`),
  // so remember the binding while the call is still in view.
  let callNames = withStep.callNames
  let callNameCount = withStep.callNameCount
  if (callId !== null && callNames[callId] === undefined && callNameCount < MAX_SEEN_CALLS) {
    callNames = { ...callNames, [callId]: name }
    callNameCount += 1
  }
  return {
    ...withStep,
    seenCalls,
    seenCallCount,
    callNames,
    callNameCount,
    openStep: { ...withStep.openStep, calls: [...withStep.openStep.calls, call] },
    updatedAt: at ?? withStep.updatedAt,
  }
}

/**
 * Settle one failure episode with the call that followed it.
 *
 * Rules, in order:
 * - a turn change is not a recovery attempt (the user spoke again);
 * - the same step is not a recovery attempt (parallel calls never saw the error);
 * - same signature = the agent retried literally the same call;
 * - same tool, other arguments = it tried to fix the input;
 * - another tool = it changed approach.
 *
 * A settled episode is removed from `pendingFailure`; the retry is parked in
 * `pendingRetry` until its own result says whether the retry worked.
 */
function answerFailure(state, call) {
  const pending = state.pendingFailure ?? null
  if (pending === null) return state
  if (call.turn === null || call.step === null) return state
  if (call.turn !== pending.turn) return state
  if (call.step <= pending.step) return state

  const sameSignature = pending.signature !== null && call.signature === pending.signature
  const kind = sameSignature ? 'same' : call.name === pending.tool ? 'changedArgs' : 'changedTool'
  const followups = { ...state.followups }
  followups.episodes += 1
  followups[kind] += 1
  if (call.callId === null) followups.unknown += 1

  const byToolRecovery = { ...(state.byToolRecovery ?? {}) }
  const entry = byToolRecovery[pending.tool] ?? { episodes: 0, recovered: 0 }
  byToolRecovery[pending.tool] = { ...entry, episodes: entry.episodes + 1 }

  return {
    ...state,
    followups,
    byToolRecovery,
    pendingFailure: null,
    pendingRetry: call.callId === null
      ? null
      : { callId: call.callId, kind, failedTool: pending.tool },
  }
}

/** Close a failure episode whose turn ended without any follow-up call. */
function abandonFailure(state, turn) {
  const pending = state.pendingFailure ?? null
  if (pending === null) return state
  if (turn !== null && pending.turn !== turn) return state
  const byToolRecovery = { ...(state.byToolRecovery ?? {}) }
  const entry = byToolRecovery[pending.tool] ?? { episodes: 0, recovered: 0 }
  byToolRecovery[pending.tool] = { ...entry, episodes: entry.episodes + 1 }
  return {
    ...state,
    followups: {
      ...state.followups,
      episodes: state.followups.episodes + 1,
      abandoned: state.followups.abandoned + 1,
    },
    byToolRecovery,
    pendingFailure: null,
    pendingRetry: null,
  }
}

/**
 * Settle a parked follow-up call with its own result, then let a fresh failure
 * open the next episode.
 */
function settleRetry(state, info) {
  let next = state
  const pendingRetry = state.pendingRetry ?? null
  if (pendingRetry !== null && info.callId !== null && pendingRetry.callId === info.callId) {
    const followups = { ...next.followups }
    const key = `${pendingRetry.kind}${info.failed ? 'Fail' : 'Ok'}`
    followups[key] = (followups[key] ?? 0) + 1
    let byToolRecovery = next.byToolRecovery ?? {}
    if (!info.failed) {
      const entry = byToolRecovery[pendingRetry.failedTool] ?? { episodes: 0, recovered: 0 }
      byToolRecovery = {
        ...byToolRecovery,
        [pendingRetry.failedTool]: { ...entry, recovered: entry.recovered + 1 },
      }
    }
    next = { ...next, followups, byToolRecovery, pendingRetry: null }
  }
  if (info.failed) {
    next = {
      ...next,
      pendingFailure: {
        tool: info.tool,
        signature: info.signature ?? null,
        turn: next.openStep?.turn ?? null,
        step: next.openStep?.step ?? null,
      },
    }
  }
  return next
}

/** Flatten both tool-result shapes into plain text. */
export function resultText(message) {
  const parts = Array.isArray(message?.content) ? message.content : []
  const out = []
  for (const part of parts) {
    if (typeof part?.text === 'string') out.push(part.text)
    if (Array.isArray(part?.content)) {
      for (const inner of part.content) if (typeof inner?.text === 'string') out.push(inner.text)
    }
  }
  return out.join('\n').trim()
}

function addToolResult(state, data, at) {
  const withStep = ensureStep(state, data, at)
  const message = data.message ?? {}
  const parts = Array.isArray(message.content) ? message.content : []
  const callId = message.toolCallId ?? data.toolCallId ?? message.source?.callId ?? parts[0]?.toolCallId ?? null
  const text = resultText(message)
  // Flat results carry the flag on the message; nested ones carry it on the part.
  const flagged = message.isError === true || parts.some(part => part?.isError === true)

  const calls = [...withStep.openStep.calls]
  let index = callId === null ? -1 : calls.findIndex(call => call.callId === callId)
  if (index < 0) {
    const known = callId === null ? undefined : withStep.callNames[callId]
    calls.push({
      callId,
      name: String(message.source?.toolName ?? data.toolName ?? known ?? 'unknown'),
      signature: null,
      duplicate: false,
      isError: false,
      commandFailure: false,
      exitCode: null,
      errorClass: null,
      snippet: '',
    })
    index = calls.length - 1
  }

  const name = calls[index].name
  const exitMatch = EXIT_CODE.exec(text)
  const exitCode = exitMatch === null ? null : Number(exitMatch[1])
  const commandFailure = !flagged && SHELL_TOOLS.has(name) && exitCode !== null && exitCode !== 0
  const failed = flagged || commandFailure
  const errorClass = failed ? classifyToolError(text) : null
  const snippet = failed ? resultSnippet(text, exitCode) : calls[index].snippet

  calls[index] = {
    ...calls[index],
    isError: flagged || calls[index].isError,
    commandFailure: commandFailure || calls[index].commandFailure === true,
    exitCode: exitCode ?? calls[index].exitCode ?? null,
    errorClass: errorClass ?? calls[index].errorClass,
    snippet,
  }
  const settled = settleRetry(withStep, {
    callId,
    tool: name,
    signature: calls[index].signature,
    failed,
  })
  const mutated = !failed && WRITE_TOOLS.has(name)
  return {
    ...settled,
    mutationCount: settled.mutationCount + (mutated ? 1 : 0),
    openStep: { ...settled.openStep, calls },
    updatedAt: at ?? settled.updatedAt,
  }
}

/**
 * One-line explanation of a failed call. Shell output is mostly noise
 * ("(no output)", "[exit code: 1]"), so prefer the line that names the cause.
 */
function resultSnippet(text, exitCode) {
  const lines = String(text ?? '')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line !== '')
  const noise = /^[[(]?(?:exit code: -?\d+|no output|stderr|stdout)[\])]?$/i
  const causal = lines.find(line => !noise.test(line) && /error|fail|cannot|denied|refus|not found|no such|unknown|invalid|missing/i.test(line))
  const informative = causal ?? lines.find(line => !noise.test(line))
  if (informative !== undefined) return clip(informative, 160)
  if (exitCode !== null && exitCode !== 0) return `命令退出码 ${exitCode}`
  return clip(lines[0] ?? '', 160)
}

function clip(value, limit) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}…` : text
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
  const failedCalls = step.calls.filter(call => call.isError || call.commandFailure === true)
  const commandCalls = step.calls.filter(call => call.commandFailure === true)
  const duplicateCalls = step.calls.filter(call => call.duplicate)
  const kinds = []
  if (errorCalls.length > 0) kinds.push('tool-error')
  if (step.retries > 0) kinds.push('llm-retry')
  if (duplicateCalls.length > 0) kinds.push('repeated-call')
  if (step.denied > 0) kinds.push('approval-rejected')
  if (step.commandError || commandCalls.length > 0) kinds.push('command-error')
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
    errors: failedCalls.map(call => ({
      tool: call.name,
      class: call.errorClass ?? 'other',
      message: call.snippet,
      callId: call.callId,
      kind: call.isError ? 'tool-error' : 'exit-code',
      exitCode: call.exitCode ?? null,
    })),
    retries: step.retries,
    retryDelayMs: step.retryDelayMs,
    toolCalls: step.calls.length,
    toolErrors: errorCalls.length,
    commandFailures: commandCalls.length,
    duplicateCalls: duplicateCalls.length,
    calls: step.calls.map(call => ({
      name: call.name,
      isError: call.isError,
      commandFailure: call.commandFailure === true,
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
    commandFailures: (state.totals.commandFailures ?? 0) + info.commandFailures,
    retries: state.totals.retries + info.retries,
    retryDelayMs: state.totals.retryDelayMs + info.retryDelayMs,
  }
  const byClass = { ...state.byClass }
  const byTool = { ...state.byTool }
  const byToolClass = { ...(state.byToolClass ?? {}) }
  for (const error of info.errors) {
    byClass[error.class] = (byClass[error.class] ?? 0) + 1
    const classes = byToolClass[error.tool] ?? {}
    byToolClass[error.tool] = { ...classes, [error.class]: (classes[error.class] ?? 0) + 1 }
  }
  for (const call of info.calls) {
    const entry = byTool[call.name] ?? { calls: 0, errors: 0 }
    const failed = call.isError || call.commandFailure === true
    byTool[call.name] = {
      calls: entry.calls + 1,
      errors: entry.errors + (failed ? 1 : 0),
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
      commandFailures: (state.invalid.commandFailures ?? 0) + info.commandFailures,
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
    commandFailures: info.commandFailures,
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
    byToolClass,
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
  // The turn ended while a failure was still waiting for a follow-up call.
  next = abandonFailure(next, turn)
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
        commandFailures: withKind.invalid.commandFailures ?? 0,
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
      commandFailures: state.totals.commandFailures ?? 0,
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
      .map(([tool, entry]) => {
        const recovery = (state.byToolRecovery ?? {})[tool] ?? { episodes: 0, recovered: 0 }
        const classes = (state.byToolClass ?? {})[tool] ?? {}
        const top = Object.entries(classes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
        return {
          tool,
          calls: entry.calls ?? 0,
          errors: entry.errors ?? 0,
          recoveryEpisodes: recovery.episodes ?? 0,
          recovered: recovery.recovered ?? 0,
          topClass: top === undefined ? null : { id: top[0], label: classLabel(top[0]), count: top[1] },
        }
      })
      .sort((a, b) => b.errors - a.errors || a.tool.localeCompare(b.tool)),
    followups: state.followups ?? emptyFollowups(),
    recovered: recoveredFollowups(state.followups ?? emptyFollowups()),
    stillFailing: failedFollowups(state.followups ?? emptyFollowups()),
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
    `工具调用 ${totals.toolCalls} 次，报错 ${totals.toolErrors} 次；命令退出码非 0 ${totals.commandFailures} 次；`
    + `模型重试 ${totals.retries} 次，退避 ${formatDuration(totals.retryDelayMs)}；失败轮次 ${totals.failedTurns}`,
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
