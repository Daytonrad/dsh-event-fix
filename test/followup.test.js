/**
 * "What did the agent do right after a failure" — the recovery classifier.
 *
 * A failure episode is settled by the first tool call of a *later* step in the
 * same turn. Parallel calls inside one step never saw the error, so they must
 * not be read as recovery attempts.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRecord, createSessionState, emptyFollowups, sessionView } from '../src/analyzer.js'

const AT = 1_700_000_000_000

function replay(records, header = { id: 'followup', cwd: 'E:\\followup' }) {
  let state = createSessionState(header)
  for (const record of records) state = applyRecord(state, { time: AT, ...record })
  return sessionView(state)
}

function step(turn, number, ...events) {
  return [
    { type: 'step/start', data: { turn, step: number } },
    ...events.map(event => ({ ...event, data: { turn, step: number, ...event.data } })),
    { type: 'step/end', data: { turn, step: number } },
  ]
}

function call(callId, name, args = {}) {
  return { type: 'tool/call', data: { callId, name, arguments: JSON.stringify(args) } }
}

function result(callId, text = 'ok', isError = false) {
  return {
    type: 'tool/result',
    data: {
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

function nestedFailure(callId, text = 'command failed') {
  return {
    type: 'tool/result',
    data: {
      message: {
        role: 'user',
        source: { kind: 'tool', callId },
        content: [{ type: 'tool-result', toolCallId: callId, isError: true, content: [{ type: 'text', text }] }],
      },
    },
  }
}

test('empty followups are all zero', () => {
  assert.deepEqual(emptyFollowups(), {
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
  })
})

test('a same-signature retry that works is counted as a recovery', () => {
  const view = replay([
    ...step(1, 1, call('c1', 'read', { path: 'a' }), nestedFailure('c1')),
    ...step(1, 2, call('c2', 'read', { path: 'a' }), result('c2', 'contents')),
  ])
  assert.deepEqual(view.followups, {
    episodes: 1,
    same: 1,
    sameOk: 1,
    sameFail: 0,
    changedArgs: 0,
    changedArgsOk: 0,
    changedArgsFail: 0,
    changedTool: 0,
    changedToolOk: 0,
    changedToolFail: 0,
    unknown: 0,
    abandoned: 0,
  })
  const read = view.byTool.find(item => item.tool === 'read')
  assert.equal(read.recoveryEpisodes, 1)
  assert.equal(read.recovered, 1)
  assert.equal(view.recovered, 1)
  assert.equal(view.stillFailing, 0)
})

test('a same-signature retry that fails again is the expensive case', () => {
  const view = replay([
    ...step(1, 1, call('c1', 'pwsh', { command: 'npm test' }), result('c1', '(no output) [exit code: 1]')),
    ...step(1, 2, call('c2', 'pwsh', { command: 'npm test' }), result('c2', '(no output) [exit code: 1]')),
  ])
  assert.equal(view.followups.same, 1)
  assert.equal(view.followups.sameFail, 1)
  assert.equal(view.followups.sameOk, 0)
  const pwsh = view.byTool.find(item => item.tool === 'pwsh')
  assert.equal(pwsh.recoveryEpisodes, 1)
  assert.equal(pwsh.recovered, 0)
  assert.equal(view.stillFailing, 1)
})

test('same tool with other arguments counts as a changed-input retry', () => {
  const view = replay([
    ...step(1, 1, call('c1', 'read', { path: 'a' }), nestedFailure('c1')),
    ...step(1, 2, call('c2', 'read', { path: 'b' }), result('c2')),
  ])
  assert.equal(view.followups.changedArgs, 1)
  assert.equal(view.followups.changedArgsOk, 1)
  assert.equal(view.followups.same, 0)
})

test('another tool counts as a changed approach', () => {
  const view = replay([
    ...step(1, 1, call('c1', 'web_fetch', { url: 'x' }), nestedFailure('c1')),
    ...step(1, 2, call('c2', 'web_search', { query: 'x' }), result('c2')),
  ])
  assert.equal(view.followups.changedTool, 1)
  assert.equal(view.followups.changedToolOk, 1)
  // The recovery belongs to the tool that failed, not to the one that rescued it.
  assert.equal(view.byTool.find(item => item.tool === 'web_fetch').recovered, 1)
  assert.equal(view.byTool.find(item => item.tool === 'web_search').recoveryEpisodes, 0)
})

test('parallel calls in the failing step are not recovery attempts', () => {
  const view = replay([
    ...step(1, 1,
      call('c1', 'read', { path: 'a' }),
      call('c2', 'read', { path: 'b' }),
      nestedFailure('c1'),
      result('c2'),
    ),
    ...step(1, 2, call('c3', 'read', { path: 'a' }), result('c3')),
  ])
  assert.equal(view.followups.episodes, 1)
  assert.equal(view.followups.same, 1)
})

test('a turn that ends without a follow-up call counts as abandoned', () => {
  const view = replay([
    ...step(1, 1, call('c1', 'read', { path: 'a' }), nestedFailure('c1')),
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ])
  assert.equal(view.followups.episodes, 1)
  assert.equal(view.followups.abandoned, 1)
})

test('a new turn does not settle the previous failure', () => {
  const view = replay([
    { type: 'turn/start', data: { turn: 1 } },
    ...step(1, 1, call('c1', 'read', { path: 'a' }), nestedFailure('c1')),
    { type: 'turn/start', data: { turn: 2 } },
    ...step(2, 1, call('c2', 'read', { path: 'a' }), result('c2')),
  ])
  assert.equal(view.followups.abandoned, 1)
  assert.equal(view.followups.same, 0)
})

test('a retry without a call id is counted but its outcome stays unknown', () => {
  const view = replay([
    ...step(1, 1, call('c1', 'read', { path: 'a' }), nestedFailure('c1')),
    ...step(1, 2, call(undefined, 'read', { path: 'a' })),
  ])
  assert.equal(view.followups.same, 1)
  assert.equal(view.followups.unknown, 1)
  assert.equal(view.followups.sameOk + view.followups.sameFail, 0)
})

test('each tool carries the failure class it actually produces', () => {
  const view = replay([
    ...step(1, 1,
      call('c1', 'pwsh', { command: 'x' }),
      call('c2', 'web_fetch', { url: 'https://blocked.example' }),
      result('c1', 'Command timed out after 60000ms\n[exit code: 124]'),
      nestedFailure('c2', 'redirect not allowed: blocked.example'),
    ),
  ])
  const pwsh = view.byTool.find(item => item.tool === 'pwsh')
  const fetch = view.byTool.find(item => item.tool === 'web_fetch')
  assert.equal(pwsh.topClass.count, 1)
  assert.equal(fetch.topClass.count, 1)
  assert.notEqual(pwsh.topClass.id, fetch.topClass.id)
})

test('every episode lands in exactly one action bucket', () => {
  const view = replay([
    ...step(1, 1, call('c1', 'read', { path: 'a' }), nestedFailure('c1')),
    ...step(1, 2, call('c2', 'read', { path: 'b' }), result('c2')),
    ...step(1, 3, call('c3', 'web_fetch', { url: 'x' }), nestedFailure('c3')),
    ...step(1, 4, call('c4', 'read', { path: 'a' }), result('c4')),
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ])
  const f = view.followups
  assert.equal(f.episodes, 2)
  assert.equal(f.same + f.changedArgs + f.changedTool + f.abandoned, f.episodes)
  assert.equal(view.recovered + view.stillFailing + f.unknown + f.abandoned, f.episodes)
  assert.equal(view.recovered, 2)
})
