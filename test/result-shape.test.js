/**
 * The two shapes a DSH tool result can take, and the shell exit-code signal.
 *
 * Regression guard: the first release read only the flat shape and only
 * `message.isError`, so it missed every nested failure (418 in the local
 * corpus) and every non-zero shell exit (540).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRecord, createSessionState, resultText, sessionView } from '../src/analyzer.js'

const AT = 1_700_000_000_000

function replay(records) {
  let state = createSessionState({ id: 'shape-session', cwd: 'E:\\shape' })
  for (const record of records) state = applyRecord(state, { time: AT, ...record })
  return sessionView(state)
}

function call(callId, name, args = {}) {
  return { type: 'tool/call', data: { turn: 1, step: 1, callId, name, arguments: JSON.stringify(args) } }
}

/** Flat shape: role=tool, the flag sits on the message. */
function flatResult(callId, text, isError = false) {
  return {
    type: 'tool/result',
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'tool',
        isError,
        toolCallId: callId,
        source: { kind: 'tool', callId },
        content: [{ type: 'text', text }],
      },
    },
  }
}

/** Nested shape: role=user, the flag and the text sit one level deeper. */
function nestedResult(callId, text, isError = false) {
  return {
    type: 'tool/result',
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'user',
        source: { kind: 'tool', callId },
        content: [{
          type: 'tool-result',
          toolCallId: callId,
          isError,
          content: [{ type: 'text', text }],
        }],
      },
    },
  }
}

function oneStep(...middle) {
  return [
    { type: 'step/start', data: { turn: 1, step: 1 } },
    ...middle,
    { type: 'step/end', data: { turn: 1, step: 1 } },
  ]
}

test('resultText flattens both shapes', () => {
  assert.equal(resultText(flatResult('c', 'hello').data.message), 'hello')
  assert.equal(resultText(nestedResult('c', 'hello').data.message), 'hello')
  assert.equal(resultText(undefined), '')
})

test('nested part-level isError counts as a tool error and keeps the tool name', () => {
  const view = replay(oneStep(
    call('c1', 'edit'),
    nestedResult('c1', 'Error: cannot modify "x.js": file has not been read — read the file, then retry', true),
  ))
  assert.equal(view.totals.invalidSteps, 1)
  assert.equal(view.totals.toolErrors, 1)
  assert.equal(view.totals.commandFailures, 0)
  assert.deepEqual(view.byKind.map(item => item.id), ['tool-error'])
  assert.equal(view.byClass[0].id, 'tool-usage')
  assert.equal(view.byTool[0].tool, 'edit')
  assert.equal(view.byTool[0].errors, 1)
  assert.equal(view.recent[0].errors[0].tool, 'edit')
})

test('non-zero shell exit is a command failure even when nothing is flagged', () => {
  const view = replay(oneStep(
    call('c1', 'pwsh', { command: 'npm test' }),
    nestedResult('c1', '(no output)\n[exit code: 1]'),
  ))
  assert.equal(view.totals.invalidSteps, 1)
  assert.equal(view.totals.toolErrors, 0)
  assert.equal(view.totals.commandFailures, 1)
  assert.deepEqual(view.byKind.map(item => item.id), ['command-error'])
  assert.equal(view.byClass[0].id, 'exit-code')
  assert.equal(view.recent[0].errors[0].message, '命令退出码 1')
})

test('a failing shell command with a real message keeps the cause, not the exit marker', () => {
  const view = replay(oneStep(
    call('c1', 'pwsh', { command: 'uv pip install numpy' }),
    nestedResult('c1', 'uv.exe : error: Failed to initialize cache at C:\\Users\\x\n[exit code: 1]'),
  ))
  assert.equal(view.byKind[0].id, 'command-error')
  assert.match(view.recent[0].errors[0].message, /Failed to initialize cache/)
})

test('exit code 0 and non-shell results are not failures', () => {
  const zero = replay(oneStep(
    call('c1', 'pwsh', { command: 'echo ok' }),
    nestedResult('c1', 'ok\n[exit code: 0]'),
  ))
  assert.equal(zero.totals.invalidSteps, 0)

  const reader = replay(oneStep(
    call('c2', 'read', { file_path: 'log.txt' }),
    nestedResult('c2', 'build finished\n[exit code: 2]'),
  ))
  assert.equal(reader.totals.invalidSteps, 0)
})

test('flat errors still work, and a failed call does not count as a mutation', () => {
  const view = replay(oneStep(
    call('c1', 'write', { file_path: 'a.js' }),
    flatResult('c1', 'Error: EACCES: permission denied', true),
    call('c2', 'read', { file_path: 'a.js' }),
    nestedResult('c2', 'content'),
  ))
  assert.equal(view.totals.invalidSteps, 1)
  assert.equal(view.byTool.find(item => item.tool === 'write').errors, 1)
})

test('the same call repeated after a failed write still counts as a repeat', () => {
  const records = [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'step/start', data: { turn: 1, step: 1 } },
    call('c1', 'write', { file_path: 'a.js', content: 'x' }),
    flatResult('c1', 'Error: EACCES: permission denied', true),
    { type: 'step/end', data: { turn: 1, step: 1 } },
    { type: 'step/start', data: { turn: 1, step: 2 } },
    call('c2', 'write', { file_path: 'a.js', content: 'x' }),
    nestedResult('c2', 'Created file'),
    { type: 'step/end', data: { turn: 1, step: 2 } },
  ]
  const view = replay(records)
  assert.equal(view.totals.steps, 2)
  assert.deepEqual(view.byKind.map(item => item.id).sort(), ['repeated-call', 'tool-error'])
})
