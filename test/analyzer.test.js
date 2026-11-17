import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRecord, createSessionState, sessionView, summarizeRecords } from '../src/analyzer.js'
import { classifyToolError, callSignature } from '../src/taxonomy.js'
import { FIXTURE_EXPECTATION, buildFixtureRecords } from './fixtures.js'

test('classifyToolError maps the observed DSH error forms', () => {
  assert.equal(classifyToolError('Error: IO error for operation on x: 系统找不到指定的文件。 (os error 2)'), 'path-missing')
  assert.equal(classifyToolError('Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite(E:\\programs\\x)'), 'permission-denied')
  assert.equal(classifyToolError('Error: DeepSeek API error (HTTP 401): Authentication Fails, Your api key is invalid'), 'auth')
  assert.equal(classifyToolError('Error: web fetch failed: TypeError: fetch failed'), 'network')
  assert.equal(classifyToolError('Error: cross-origin redirect to https://docs.volcengine.com is not followed automatically'), 'redirect')
  assert.equal(classifyToolError('Error: tool call timed out after 30000ms'), 'timeout')
  assert.equal(classifyToolError('Error: subagent depth 2 exceeds maxDepth 1'), 'limit')
  assert.equal(classifyToolError('Error: unsupported content type "application/pdf"'), 'unsupported-content')
  assert.equal(classifyToolError('Error: cannot modify "x": file has not been read'), 'tool-usage')
  assert.equal(classifyToolError('The tool call was interrupted after it was recorded'), 'interrupted')
  assert.equal(classifyToolError('Error: something nobody anticipated'), 'other')
  assert.equal(classifyToolError(''), 'other')
})

test('callSignature is order-insensitive and drops volatile ids', () => {
  const a = callSignature('read', '{"file_path":"a.txt","offset":1,"id":"x"}')
  const b = callSignature('read', { offset: 1, file_path: 'a.txt' })
  assert.equal(a, b)
  assert.notEqual(callSignature('read', { file_path: 'a.txt' }), callSignature('grep', { file_path: 'a.txt' }))
  assert.equal(callSignature('pwsh', 'not json'), 'pwsh#not json')
})

test('fixture session produces the documented step facts', () => {
  const state = summarizeRecords(buildFixtureRecords(), { id: 'fixture-session', cwd: 'E:\\fixture' })
  const view = sessionView(state)

  assert.equal(view.totals.steps, FIXTURE_EXPECTATION.steps)
  assert.equal(view.totals.invalidSteps, FIXTURE_EXPECTATION.invalidSteps)
  assert.equal(view.phase, 'idle')
  assert.equal(view.totals.toolErrors, FIXTURE_EXPECTATION.toolErrors)
  assert.equal(view.totals.retries, FIXTURE_EXPECTATION.retries)
  assert.equal(view.totals.tokens, FIXTURE_EXPECTATION.totalTokens)
  assert.equal(view.totals.wastedTokens, FIXTURE_EXPECTATION.wastedTokens)
  assert.equal(view.totals.durationMs, FIXTURE_EXPECTATION.totalMs)
  assert.equal(view.totals.wastedMs, FIXTURE_EXPECTATION.wastedMs)
  assert.equal(view.totals.failedTurns, FIXTURE_EXPECTATION.failedTurns)
  assert.equal(view.totals.ratio, 85.71)
  assert.equal(view.totals.tokenRatio, 85.71)

  const kinds = Object.fromEntries(view.byKind.map(item => [item.id, item.count]))
  assert.deepEqual(kinds, FIXTURE_EXPECTATION.byKind)

  const classes = Object.fromEntries(view.byClass.map(item => [item.id, item.count]))
  assert.equal(classes['path-missing'], 1)
  assert.equal(classes['permission-denied'], 1)

  // Turn series keeps the failed turn marker so the client can draw it.
  assert.equal(view.series.length, 3)
  assert.equal(view.series[0].steps, 4)
  assert.equal(view.series[0].invalid, 3)
  assert.equal(view.series[1].failed, true)
  assert.equal(view.series[2].failed, true)
  assert.equal(view.series[2].invalid, 1)

  // Aborted turn 2 must not double-count its already invalid last step.
  assert.equal(view.recent.length, 6)
})

test('projection replays incrementally to the same result', () => {
  const records = buildFixtureRecords()
  const once = summarizeRecords(records, { id: 'fixture-session' })
  let incremental = createSessionState({ id: 'fixture-session' })
  for (const record of records) incremental = applyRecord(incremental, record)
  assert.deepEqual(sessionView(incremental).totals, sessionView(once).totals)
})

test('unknown events are ignored and step counts stay stable', () => {
  let state = createSessionState({ id: 's' })
  const before = JSON.stringify(sessionView(state))
  state = applyRecord(state, { type: 'session/title', time: 1, data: { title: 'x' } })
  assert.equal(JSON.stringify(sessionView(state)), before)
})

function replayCallSequence(withEdit) {
  const records = []
  const at = Date.parse('2026-11-10T00:00:00.000Z')
  let time = at
  const push = (type, data) => {
    time += 100
    records.push({ type, time, data })
  }
  const step = (turn, index, name, args, callId) => {
    push('step/start', { turn, step: index })
    push('tool/call', { turn, step: index, callId, name, arguments: JSON.stringify(args) })
    push('tool/result', {
      turn,
      step: index,
      toolCallId: callId,
      message: { role: 'tool', isError: false, toolCallId: callId, content: [{ type: 'text', text: 'ok' }] },
    })
    push('step/end', { turn, step: index })
  }
  step(1, 1, 'read', { file_path: 'a.txt' }, 'c1')
  if (withEdit) step(1, 2, 'edit', { file_path: 'a.txt', old_string: 'x', new_string: 'y' }, 'c2')
  step(1, withEdit ? 3 : 2, 'read', { file_path: 'a.txt' }, 'c3')
  return records
}

test('identical call is flagged, but not when a write happened in between', () => {
  const repeated = sessionView(summarizeRecords(replayCallSequence(false), { id: 's' }))
  assert.equal(repeated.byKind.find(item => item.id === 'repeated-call')?.count, 1)

  const afterEdit = sessionView(summarizeRecords(replayCallSequence(true), { id: 's' }))
  assert.equal(afterEdit.byKind.find(item => item.id === 'repeated-call'), undefined)
})
