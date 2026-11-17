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
