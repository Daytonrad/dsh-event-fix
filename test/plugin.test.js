import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply, name, resolveConfig } from '../src/index.js'
import { PROJECTION_KEY, sessionView } from '../src/analyzer.js'
import { buildFixtureRecords } from './fixtures.js'

function createFakeCtx() {
  const ctx = {
    listeners: [],
    projection: null,
    command: null,
    sessionStates: new Map(),
    on(event, handler) {
      ctx.listeners.push({ event, handler })
    },
    sessionProjections: {
      register(definition) {
        ctx.projection = definition
      },
      stateOf(session) {
        return ctx.sessionStates.get(String(session.id)) ?? null
      },
    },
    commands: {
      register(definition) {
        ctx.command = definition
      },
    },
  }
  return ctx
}

test('host plugin registers projection and command', () => {
  const ctx = createFakeCtx()
  apply(ctx, { ledgerEnabled: false })
  assert.equal(name, 'event-fix')
  assert.equal(ctx.projection.key, PROJECTION_KEY)
  assert.equal(ctx.command.name, 'steps')
  assert.equal(ctx.listeners.length, 0)
})

test('projection replays fixture and /steps renders a summary', () => {
  const ctx = createFakeCtx()
  apply(ctx, { ledgerEnabled: false })
  const records = buildFixtureRecords()
  const session = { id: 'fixture-session', header: { id: 'fixture-session', cwd: 'E:\\fixture' } }
  let state = ctx.projection.init(session.header)
  for (const record of records) state = ctx.projection.apply(state, record)
  ctx.sessionStates.set(session.id, state)

  const view = ctx.projection.wire.view(state)
  assert.equal(view.totals.steps, 7)
  assert.equal(view.totals.invalidSteps, 6)

  const result = ctx.command.handler({ agent: { session }, rawInput: '' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /无效 6 步/)
  assert.match(result.text, /浪费 token/)
  assert.match(result.text, /工具报错分类/)

  const json = ctx.command.handler({ agent: { session }, rawInput: 'json' })
  assert.equal(JSON.parse(json.text).totals.invalidSteps, 6)
})

test('missing session yields an error message instead of throwing', () => {
  const ctx = createFakeCtx()
  apply(ctx, { ledgerEnabled: false })
  const result = ctx.command.handler({ agent: { session: { id: 'unknown' } }, rawInput: '' })
  assert.equal(result.kind, 'error')
})

test('ledger appends one record per step plus turn corrections', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-event-fix-ledger-'))
  const ledgerPath = join(dir, 'step-ledger.jsonl')
  try {
    const ctx = createFakeCtx()
    apply(ctx, { ledgerPath })
    const records = buildFixtureRecords()
    const session = { id: 'fixture-session', header: { id: 'fixture-session', cwd: 'E:\\fixture' } }
    let state = ctx.projection.init(session.header)
    for (const record of records) {
      state = ctx.projection.apply(state, record)
      ctx.sessionStates.set(session.id, state)
      for (const listener of ctx.listeners) listener.handler(session, record)
    }

    const lines = readFileSync(ledgerPath, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    const stepRecords = lines.filter(line => line.event === 'step')
    const corrections = lines.filter(line => line.event === 'correction')
    assert.equal(stepRecords.length, 7)
    assert.equal(corrections.length, 2)
    assert.equal(stepRecords[0].schema, 'dsh.event-fix.step.v1')
    assert.equal(stepRecords.length + corrections.length, lines.length)
    assert.ok(lines.some(line => line.kinds?.includes('turn-aborted')))

    // The ledger state and the projection must agree.
    const projected = sessionView(state).totals
    const ledgerTokens = stepRecords.reduce((sum, line) => sum + (line.usage?.total ?? 0), 0)
    assert.equal(ledgerTokens, projected.tokens)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('resolveConfig honors overrides', () => {
  assert.equal(resolveConfig({}).ledgerEnabled, true)
  assert.equal(resolveConfig({ ledgerEnabled: false }).ledgerEnabled, false)
  assert.match(resolveConfig({ ledgerPath: 'C:\\tmp\\a.jsonl' }).ledgerPath, /a\.jsonl$/)
})
