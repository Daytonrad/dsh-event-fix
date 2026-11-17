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
    route: null,
    effects: [],
    sessionStates: new Map(),
    services: new Map(),
    on(event, handler) {
      ctx.listeners.push({ event, handler })
    },
    get(service) {
      return ctx.services.get(service)
    },
    effect(factory) {
      const dispose = factory()
      if (typeof dispose === 'function') ctx.effects.push(dispose)
      return dispose
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

function attachWebServer(ctx) {
  ctx.services.set('webServer', {
    register(route) {
      ctx.route = route
      return () => {
        ctx.route = null
      }
    },
  })
  return ctx
}

function callRoute(route, url, method = 'GET') {
  return new Promise(resolve => {
    const chunks = []
    const response = {
      headersSent: false,
      status: 0,
      headers: {},
      writeHead(status, headers) {
        this.status = status
        this.headers = headers ?? {}
        this.headersSent = true
      },
      end(body) {
        if (body !== undefined) chunks.push(String(body))
        resolve({ status: this.status, headers: this.headers, body: chunks.join('') })
      },
    }
    route.handler({ method, url }, response)
  })
}

test('host plugin registers projection and command', () => {
  const ctx = createFakeCtx()
  apply(ctx, { ledgerEnabled: false })
  assert.equal(name, 'event-fix')
  assert.equal(ctx.projection.key, PROJECTION_KEY)
  assert.equal(ctx.command.name, 'steps')
  assert.equal(ctx.listeners.filter(item => item.event === 'session/event').length, 1)
  assert.equal(ctx.route, null, 'no web server means no stats route')
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

test('stats route serves the cross-session snapshot', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-event-fix-stats-'))
  try {
    const ctx = attachWebServer(createFakeCtx())
    apply(ctx, { ledgerEnabled: false, sessionsRoot: dir, historySessions: 1 })
    assert.equal(ctx.route.path, '/dsh-event-fix/stats')

    const session = { id: 'fixture-session', header: { id: 'fixture-session', cwd: 'E://fixture' } }
    const track = ctx.listeners.find(item => item.event === 'session/event').handler
    for (const record of buildFixtureRecords()) track(session, record)

    const response = await callRoute(ctx.route, '/dsh-event-fix/stats?days=7')
    assert.equal(response.status, 200)
    assert.match(response.headers['content-type'], /application\/json/)
    const snapshot = JSON.parse(response.body)
    assert.equal(snapshot.windowDays, 7)
    assert.equal(snapshot.totals.sessions, 1)
    assert.equal(snapshot.totals.steps, 7)
    assert.equal(snapshot.totals.invalidSteps, 6)
    assert.equal(snapshot.days.length, 7)
    assert.ok(snapshot.kinds.length > 0)
    assert.ok(snapshot.tools.some(item => item.tool !== ''))
    assert.equal(snapshot.sessions[0].sessionId, 'fixture-session')

    const rejected = await callRoute(ctx.route, '/dsh-event-fix/stats', 'POST')
    assert.equal(rejected.status, 405)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('stats route degrades when the sessions root is empty', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-event-fix-empty-'))
  try {
    const ctx = attachWebServer(createFakeCtx())
    apply(ctx, { ledgerEnabled: false, sessionsRoot: dir })
    const response = await callRoute(ctx.route, '/dsh-event-fix/stats')
    const snapshot = JSON.parse(response.body)
    assert.equal(response.status, 200)
    assert.equal(snapshot.totals.steps, 0)
    assert.equal(snapshot.totals.ratio, 0)
    assert.equal(snapshot.state, 'ready')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
