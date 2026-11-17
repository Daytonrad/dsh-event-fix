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

test('client module registers one composer dock slot', () => {
  const { module, style } = loadClientModule()
  assert.equal(module.name, 'event-fix-client')
  assert.deepEqual([...module.inject], ['slots'])

  const registered = []
  const ctx = {
    slots: {
      inject(name, factory) {
        assert.equal(name, 'conversation.composer.dock')
        factory()
      },
      register(definition, component) {
        registered.push({ definition, component })
      },
    },
  }
  module.apply(ctx)
  assert.match(style.textContent, /data-event-fix-pill/)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].definition.id, 'event-fix-steps')
  assert.equal(typeof registered[0].component, 'function')
})

test('pill renders a summary string from the projection view', () => {
  const { module } = loadClientModule()
  let component = null
  module.apply({
    slots: {
      inject: (name, factory) => factory(),
      register: (definition, registered) => {
        component = registered
      },
    },
  })
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
  let component = null
  module.apply({
    slots: {
      inject: (name, factory) => factory(),
      register: (definition, registered) => {
        component = registered
      },
    },
  })
  assert.equal(component({ useProjection: () => undefined }), null)
  const empty = sessionView(summarizeRecords([], { id: 's' }))
  assert.equal(component({ useProjection: () => empty }), null)
})
