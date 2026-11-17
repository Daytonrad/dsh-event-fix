import assert from 'node:assert/strict'
import test from 'node:test'
import { sessionView, summarizeRecords } from '../src/analyzer.js'
import { buildSnapshot, fillDays, shortenPath } from '../src/snapshot.js'
import { buildFixtureRecords } from './fixtures.js'

const view = sessionView(summarizeRecords(buildFixtureRecords(), { id: 'fixture-session', cwd: 'E:\\programs\\demo' }))

test('fillDays returns one continuous entry per requested day', () => {
  const now = Date.parse('2026-11-17T12:00:00+08:00')
  const days = fillDays([{ day: '2026-11-17', steps: 4, invalid: 1, ratio: 25, wastedTokens: 100 }], now, 5)
  assert.equal(days.length, 5)
  assert.equal(days[4].day, '2026-11-17')
  assert.equal(days[4].ratio, 25)
  assert.equal(days[0].steps, 0)
  assert.deepEqual(days.map(item => item.day), [
    '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17',
  ])
})

test('snapshot mirrors the report totals for one session', () => {
  const snapshot = buildSnapshot([{ sessionId: 'fixture-session', cwd: 'E:\\programs\\demo', view }], {
    now: Date.parse('2026-11-10T03:00:00Z'),
    windowDays: 3,
  })
  assert.equal(snapshot.state, 'ready')
  assert.equal(snapshot.totals.sessions, 1)
  assert.equal(snapshot.totals.steps, 7)
  assert.equal(snapshot.totals.invalidSteps, 6)
  assert.equal(snapshot.totals.wastedTokens, view.totals.wastedTokens)
  assert.equal(snapshot.days.length, 3)
  assert.equal(snapshot.tools[0].rate >= 0, true)
  assert.equal(snapshot.sessions[0].cwd, '…/programs/demo')
  assert.ok(snapshot.kinds.length > 0)
})

test('loading state is carried through to the page', () => {
  const snapshot = buildSnapshot([], { loading: true, windowDays: 7 })
  assert.equal(snapshot.state, 'loading')
  assert.equal(snapshot.totals.steps, 0)
  assert.equal(snapshot.totals.ratio, 0)
})

test('shortenPath keeps the last two segments', () => {
  assert.equal(shortenPath('E:\\programs\\dsh-event-fix'), '…/programs/dsh-event-fix')
  assert.equal(shortenPath('E:\\a'), 'E:\\a')
  assert.equal(shortenPath(''), '')
})
