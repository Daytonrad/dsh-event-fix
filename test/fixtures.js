/** Synthetic session records covering every kind the analyzer claims to detect. */
const BASE = Date.parse('2026-11-10T02:00:00.000Z')
const USAGE = { inputTokens: 100, outputTokens: 10, totalTokens: 110 }

function rec(seq, type, offsetMs, data) {
  return { type, seq, time: BASE + offsetMs, data }
}

function stepStart(turn, step, at) {
  return [
    { type: 'step/start', time: at, data: { turn, step } },
  ]
}

function assistant(turn, step, at, parts, usage = USAGE) {
  return {
    type: 'assistant/message',
    time: at,
    data: {
      turn,
      step,
      usage,
      message: {
        role: 'assistant',
        content: parts,
        id: `msg-${turn}-${step}-${at}`,
        source: { provider: 'fake', model: 'fake' },
      },
    },
  }
}

function toolCall(turn, step, at, callId, name, args) {
  return {
    type: 'tool/call',
    time: at,
    data: { turn, step, callId, name, arguments: JSON.stringify(args) },
  }
}

function toolResult(turn, step, at, callId, text, isError = false) {
  return {
    type: 'tool/result',
    time: at,
    data: {
      turn,
      step,
      toolCallId: callId,
      message: {
        role: 'tool',
        isError,
        toolCallId: callId,
        content: [{ type: 'text', text }],
        source: { kind: 'tool', callId },
        id: `res-${callId}`,
      },
    },
  }
}

export function buildFixtureRecords() {
  const records = []
  let seq = 0
  const push = (item) => {
    seq += 1
    records.push({ ...item, seq })
  }

  push({ type: 'session', version: 4, id: 'fixture-session', createdAt: BASE, cwd: 'E:\\fixture' })

  // ---- Turn 1: one clean step, then tool error, retry, empty step ----
  push(rec(seq, 'turn/start', 0, { turn: 1 }))

  // step 1 — clean
  for (const item of stepStart(1, 1, BASE + 100)) push(item)
  push(assistant(1, 1, BASE + 200, [{ type: 'text', text: 'reading the file' }]))
  push(toolCall(1, 1, BASE + 300, 'call-a', 'read', { file_path: 'E:\\fixture\\a.txt' }))
  push(toolResult(1, 1, BASE + 400, 'call-a', 'file body'))
  push({ type: 'step/end', time: BASE + 1100, data: { turn: 1, step: 1 } })

  // step 2 — tool error (path missing)
  for (const item of stepStart(1, 2, BASE + 1200)) push(item)
  push(assistant(1, 2, BASE + 1300, [{ type: 'text', text: 'reading b' }]))
  push(toolCall(1, 2, BASE + 1400, 'call-b', 'read', { file_path: 'E:\\fixture\\missing.txt' }))
  push(toolResult(1, 2, BASE + 1500, 'call-b', "Error: IO error for operation on E:\\fixture\\missing.txt: 系统找不到指定的文件。 (os error 2)", true))
  push({ type: 'step/end', time: BASE + 2200, data: { turn: 1, step: 2 } })

  // step 3 — model retry inside the step
  for (const item of stepStart(1, 3, BASE + 2300)) push(item)
  push({
    type: 'llm/retry',
    time: BASE + 2350,
    data: { retryId: 'r1', turn: 1, step: 3, provider: 'fake', retry: 1, maxRetries: 5, delayMs: 500, failure: { message: 'Connection error.', code: 'TRANSPORT' } },
  })
  push(assistant(1, 3, BASE + 3000, [{ type: 'text', text: 'ok now' }]))
  push({ type: 'step/end', time: BASE + 3300, data: { turn: 1, step: 3 } })

  // step 4 — empty step (no text, no call)
  for (const item of stepStart(1, 4, BASE + 3400)) push(item)
  push(assistant(1, 4, BASE + 3500, [{ type: 'reasoning', text: 'thinking only' }]))
  push({ type: 'step/end', time: BASE + 4400, data: { turn: 1, step: 4 } })

  push(rec(seq, 'turn/end', 5000, { turn: 1, reason: { kind: 'completed' } }))

  // ---- Turn 2: repeated call + rejected approval, turn aborted ----
  push(rec(seq, 'turn/start', 6000, { turn: 2 }))

  for (const item of stepStart(2, 1, BASE + 6100)) push(item)
  push(assistant(2, 1, BASE + 6200, [{ type: 'text', text: 'reading a again' }]))
  push(toolCall(2, 1, BASE + 6300, 'call-c', 'read', { file_path: 'E:\\fixture\\a.txt' }))
  push(toolResult(2, 1, BASE + 6400, 'call-c', 'file body'))
  push({ type: 'step/end', time: BASE + 7100, data: { turn: 2, step: 1 } })

  for (const item of stepStart(2, 2, BASE + 7200)) push(item)
  push(assistant(2, 2, BASE + 7300, [{ type: 'text', text: 'escalate' }]))
  push(toolCall(2, 2, BASE + 7400, 'call-d', 'pwsh', { command: 'rm -rf /' }))
  push({ type: 'approval/asked', time: BASE + 7450, data: { id: 'ap1', toolName: 'pwsh', callId: 'call-d' } })
  push({ type: 'approval/decided', time: BASE + 7500, data: { id: 'ap1', outcome: 'rejected' } })
  push(toolResult(2, 2, BASE + 7600, 'call-d', 'Error: the user rejected escalating this command', true))
  push({ type: 'step/end', time: BASE + 8100, data: { turn: 2, step: 2 } })

  push(rec(seq, 'turn/end', 8300, { turn: 2, reason: { kind: 'aborted' } }))

  // ---- Turn 3: clean step, then the turn itself errors ----
  push(rec(seq, 'turn/start', 9000, { turn: 3 }))
  for (const item of stepStart(3, 1, BASE + 9100)) push(item)
  push(assistant(3, 1, BASE + 9200, [{ type: 'text', text: 'final attempt' }]))
  push(toolCall(3, 1, BASE + 9300, 'call-e', 'glob', { pattern: '**/*.js' }))
  push(toolResult(3, 1, BASE + 9400, 'call-e', 'a.js'))
  push({ type: 'step/end', time: BASE + 10100, data: { turn: 3, step: 1 } })
  push(rec(seq, 'turn/end', 10300, { turn: 3, reason: { kind: 'error' } }))

  return records
}

export const FIXTURE_EXPECTATION = {
  steps: 7,
  invalidSteps: 6,
  toolErrors: 2,
  retries: 1,
  totalTokens: 770,
  wastedTokens: 660,
  totalMs: 6900,
  wastedMs: 5900,
  byKind: {
    'tool-error': 2,
    'llm-retry': 1,
    'empty-step': 1,
    'repeated-call': 1,
    'approval-rejected': 1,
    'turn-aborted': 2,
  },
  failedTurns: 2,
}
