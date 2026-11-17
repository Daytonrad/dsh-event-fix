import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { sessionView, summarizeRecords } from '../src/analyzer.js'
import { buildFixtureRecords } from './fixtures.js'

function fakeReact() {
  function createElement(type, props, ...children) {
    return { type, props: props ?? {}, children: children.flat() }
  }
  return {
    createElement,
    useState: initial => [initial, () => {}],
    useRef: () => ({ current: null }),
    useCallback: fn => fn,
    useEffect: () => {},
    useMemo: fn => fn(),
  }
}

function loadClientModule() {
  const code = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
  let loaded = null
  const style = { dataset: {}, textContent: '' }
  const sandbox = {
    console,
    window: {
      __ModuleLoader__: {
        load(options) {
          loaded = options
        },
      },
    },
    document: {
      querySelector: () => null,
      createElement: () => style,
      head: { appendChild: () => {} },
    },
  }
  vm.runInNewContext(code, sandbox, { filename: 'client.js' })
  assert.ok(loaded !== null, 'module loader was called')
  assert.equal(loaded.id, 'dsh-event-fix')
  const react = fakeReact()
  const module = loaded.factory(name => {
    if (name === 'react') return react
    if (name === 'react-dom') return { createPortal: element => element }
    throw new Error(`unexpected require ${name}`)
  })
  return { module, style }
}

function registerSlots(module) {
  const registered = []
  module.apply({
    slots: {
      inject(name, factory) {
        const entry = { slot: name, definition: null, component: null }
        registered.push(entry)
        entry.dispose = factory()
      },
      register(definition, component) {
        const entry = registered[registered.length - 1]
        entry.definition = definition
        entry.component = component
        return () => {}
      },
    },
  })
  return registered
}

function slotComponent(module, id) {
  const entry = registerSlots(module).find(item => item.definition?.id === id)
  assert.ok(entry !== undefined, `slot ${id} was registered`)
  return entry.component
}

test('client module registers the composer pill and the settings page', () => {
  const { module, style } = loadClientModule()
  assert.equal(module.name, 'event-fix-client')
  assert.deepEqual([...module.inject], ['slots'])

  const registered = registerSlots(module)
  assert.match(style.textContent, /data-event-fix-pill/)
  assert.match(style.textContent, /data-event-fix-page/)
  assert.equal(registered.length, 2)
  assert.deepEqual(registered.map(item => item.slot), ['conversation.composer.dock', 'settings.section'])
  assert.equal(registered[0].definition.id, 'event-fix-steps')
  assert.equal(registered[1].definition.id, 'event-fix-stats')
  assert.equal(registered[1].definition.order, 40)
  assert.equal(typeof registered[1].component, 'function')
})

test('pill renders a summary string from the projection view', () => {
  const { module } = loadClientModule()
  const component = slotComponent(module, 'event-fix-steps')
  const view = sessionView(summarizeRecords(buildFixtureRecords(), { id: 'fixture-session' }))
  const element = component({ useProjection: () => view })
  assert.equal(element.type, 'span')
  const button = element.children[0]
  assert.equal(button.props['data-event-fix-pill'], true)
  assert.equal(button.props['data-bad'], 'true')
  const label = button.children[1]
  assert.match(label.children[0], /无效 6\/7/)
  assert.match(label.children[0], /tok/)
})

test('pill renders nothing before the first step', () => {
  const { module } = loadClientModule()
  const component = slotComponent(module, 'event-fix-steps')
  assert.equal(component({ useProjection: () => undefined }), null)
  const empty = sessionView(summarizeRecords([], { id: 's' }))
  assert.equal(component({ useProjection: () => empty }), null)
})

test('settings page renders its shell before data arrives', () => {
  const { module } = loadClientModule()
  const page = slotComponent(module, 'event-fix-stats')
  const element = page({})
  assert.equal(element.props['data-event-fix-page'], true)
  const texts = []
  const walk = node => {
    if (node === null || node === undefined) return
    if (typeof node === 'string') { texts.push(node); return }
    if (typeof node === 'number') { texts.push(String(node)); return }
    for (const child of node.children ?? []) walk(child)
  }
  walk(element)
  const joined = texts.join(' | ')
  assert.match(joined, /无效动作统计/)
  assert.match(joined, /读取统计/)
})

test('follow-up reading names the dominant failure mode', () => {
  const { module } = loadClientModule()
  const deterministic = module.interpretFollowups({
    episodes: 100, same: 40, sameOk: 5, sameFail: 35, changedArgs: 20,
    changedArgsOk: 10, changedArgsFail: 10, changedTool: 20, changedToolOk: 15,
    changedToolFail: 5, unknown: 0, abandoned: 0,
  })
  assert.match(deterministic, /原样重试占 40%/)
  assert.match(deterministic, /确定的/)

  const flailing = module.interpretFollowups({
    episodes: 100, same: 2, sameOk: 1, sameFail: 1, changedArgs: 50,
    changedArgsOk: 10, changedArgsFail: 40, changedTool: 40, changedToolOk: 10,
    changedToolFail: 30, unknown: 0, abandoned: 8,
  })
  assert.match(flailing, /只有 23% 成功/)
  assert.match(flailing, /试错/)

  const handled = module.interpretFollowups({
    episodes: 100, same: 2, sameOk: 2, sameFail: 0, changedArgs: 50,
    changedArgsOk: 48, changedArgsFail: 2, changedTool: 40, changedToolOk: 38,
    changedToolFail: 2, unknown: 0, abandoned: 8,
  })
  assert.match(handled, /接住/)

  const givingUp = module.interpretFollowups({
    episodes: 100, same: 0, sameOk: 0, sameFail: 0, changedArgs: 15,
    changedArgsOk: 10, changedArgsFail: 5, changedTool: 20, changedToolOk: 18,
    changedToolFail: 2, unknown: 0, abandoned: 65,
  })
  assert.match(givingUp, /放弃/)

  assert.match(module.interpretFollowups({ episodes: 0 }), /还没有/)
})

test('the settings prompt carries the numbers it asks about', () => {
  const { module } = loadClientModule()
  const prompt = module.buildFollowupPrompt({
    windowDays: 30,
    totals: { steps: 1000, invalidSteps: 150, ratio: 15, wastedTokens: 5_000_000, wastedMs: 3_600_000 },
    followups: {
      episodes: 90, same: 2, sameOk: 1, sameFail: 1, changedArgs: 50,
      changedArgsOk: 30, changedArgsFail: 20, changedTool: 25, changedToolOk: 20,
      changedToolFail: 5, unknown: 0, abandoned: 13,
    },
    tools: [
      {
        tool: 'pwsh', calls: 100, errors: 14, rate: 14,
        recoveryEpisodes: 12, recovered: 3,
        topClass: { id: 'timeout', label: '超时', count: 9 },
      },
    ],
  })
  assert.match(prompt, /150 步无效（15\.0%）/)
  assert.match(prompt, /下一步仍失败 26/)
  assert.match(prompt, /恢复率 66%/)
  assert.match(prompt, /做法与效果：/)
  assert.match(prompt, /改参数再试 50 次，其中 60% 的下一步成功/)
  assert.match(prompt, /换工具 25 次，其中 80% 的下一步成功/)
  assert.match(prompt, /pwsh：14\/100 次失败（14\.0%）/)
  assert.match(prompt, /主要是「超时」/)
  assert.match(prompt, /失败后下一步成功 25%（3\/12）/)
  assert.match(prompt, /不要泛泛而谈/)
})

test('the session prompt quotes the failing steps', () => {
  const { module } = loadClientModule()
  const view = sessionView(summarizeRecords(buildFixtureRecords(), { id: 'fixture-session' }))
  const prompt = module.buildSessionPrompt(view)
  assert.match(prompt, /复盘刚才这一轮/)
  assert.match(prompt, /本会话：/)
  assert.match(prompt, /T\d+S\d+ /)
  assert.match(prompt, /下次具体怎么做/)
})
