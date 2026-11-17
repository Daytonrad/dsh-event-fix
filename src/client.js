window.__ModuleLoader__.load({
  id: 'dsh-event-fix',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const name = 'event-fix-client'
    const inject = ['slots']
    const PROJECTION = 'step-errors'

    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-dsh-event-fix-css]') !== null) return
      const style = document.createElement('style')
      style.dataset.dshEventFixCss = 'true'
      style.textContent = `
[data-event-fix-pill-root]{min-width:0;display:inline-flex}
[data-event-fix-pill]{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;white-space:nowrap;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex;cursor:pointer;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px)}
[data-event-fix-pill]:hover,[data-event-fix-pill][aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
[data-event-fix-pill][data-bad=true]{color:#c0392b}
[data-event-fix-pill] svg{flex:none;width:13px;height:13px}
[data-event-fix-panel]{box-sizing:border-box;z-index:1100;width:396px;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:16px;font-size:12px;line-height:18px;position:fixed}
[data-event-fix-panel] .ef-head{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:12px;margin-bottom:4px;font-weight:500;font-size:13px;display:flex;align-items:center}
[data-event-fix-panel] .ef-head-label{align-items:center;gap:6px;min-width:0;display:inline-flex}
[data-event-fix-panel] .ef-head-label svg{flex:none;width:14px;height:14px}
[data-event-fix-panel] .ef-ratio{font-variant-numeric:tabular-nums;white-space:nowrap;color:#c0392b}
[data-event-fix-panel] .ef-sub{color:var(--dsw-alias-label-tertiary);margin-bottom:10px}
[data-event-fix-panel] .ef-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 2px}
[data-event-fix-panel] .ef-kpi{background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:6px 8px}
[data-event-fix-panel] .ef-kpi-label{color:var(--dsw-alias-label-tertiary);font-size:11px}
[data-event-fix-panel] .ef-kpi-value{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;font-size:14px;font-weight:500}
[data-event-fix-panel] .ef-section{margin-top:12px}
[data-event-fix-panel] .ef-section-title{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-bottom:4px}
[data-event-fix-panel] .ef-bar-row{display:grid;grid-template-columns:78px 1fr 30px;align-items:center;gap:8px;font-size:11px;margin:3px 0}
[data-event-fix-panel] .ef-bar-label{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-event-fix-panel] .ef-bar-track{background:var(--dsw-alias-border-l2);border-radius:4px;height:5px;overflow:hidden}
[data-event-fix-panel] .ef-bar-fill{display:block;height:100%;background:#c0392b;border-radius:4px}
[data-event-fix-panel] .ef-bar-count{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
[data-event-fix-panel] .ef-step{display:flex;gap:6px;align-items:baseline;padding:2px 0;color:var(--dsw-alias-label-secondary);font-size:11px}
[data-event-fix-panel] .ef-step-pos{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none}
[data-event-fix-panel] .ef-step-kind{color:#c0392b;flex:none}
[data-event-fix-panel] .ef-step-detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary)}
[data-event-fix-panel] .ef-note{color:var(--dsw-alias-label-tertiary);margin-top:10px;font-size:11px}
[data-event-fix-panel] .ef-empty{color:var(--dsw-alias-label-tertiary);padding:6px 0}
@media (width<=480px){[data-event-fix-panel]{width:calc(100vw - 24px)}}
`
      document.head.appendChild(style)
    }

    function formatTokens(tokens) {
      const value = Number.isFinite(tokens) ? tokens : 0
      if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
      return String(Math.round(value))
    }

    function formatDuration(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '0s'
      const seconds = ms / 1000
      if (seconds < 60) return `${seconds.toFixed(1)}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m`
      return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
    }

    function StepIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        'aria-hidden': true,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      h('path', { d: 'M2.5 4.5h7M2.5 8h11M2.5 11.5h5' }),
      h('circle', { cx: 12.6, cy: 4.5, r: 1.4 }),
      )
    }

    function RatioSpark({ series }) {
      if (!Array.isArray(series) || series.length === 0) return null
      const width = 360
      const height = 64
      const padding = 4
      const max = Math.max(10, ...series.map(point => point.ratio))
      const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0
      const x = index => padding + step * index
      const y = value => height - padding - (value / max) * (height - padding * 2)
      const path = series
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.ratio).toFixed(1)}`)
        .join(' ')
      const area = `${path} L${x(series.length - 1).toFixed(1)},${height - padding} L${x(0).toFixed(1)},${height - padding} Z`
      const dots = series.map((point, index) => h('circle', {
        key: `dot-${index}`,
        cx: x(index),
        cy: y(point.ratio),
        r: point.failed === true ? 2.4 : 1.6,
        fill: point.failed === true ? '#c0392b' : '#d98c8c',
      }))
      return h('svg', {
        viewBox: `0 0 ${width} ${height}`,
        width: '100%',
        height: 64,
        role: 'img',
        'aria-label': '每轮无效步占比',
        style: { display: 'block' },
      },
      h('path', { d: area, fill: 'rgba(192,57,43,0.12)' }),
      h('path', { d: path, fill: 'none', stroke: '#c0392b', strokeWidth: 1.6, strokeLinejoin: 'round' }),
      ...dots,
      )
    }

    function EventFixPanel({ view, anchorRef, onClose }) {
      const panelRef = React.useRef(null)
      const [position, setPosition] = React.useState(null)
      React.useEffect(() => {
        const update = () => {
          const rect = anchorRef.current?.getBoundingClientRect()
          if (rect === undefined) return
          const width = Math.min(396, window.innerWidth - 24)
          const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
          const estimated = 440
          const top = rect.top > estimated ? rect.top - estimated + 40 : Math.max(12, rect.bottom + 8)
          setPosition({ left, top, width })
        }
        update()
        const onPointerDown = event => {
          if (panelRef.current?.contains(event.target)) return
          if (anchorRef.current?.contains(event.target)) return
          onClose()
        }
        const onKeyDown = event => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('resize', update)
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          window.removeEventListener('resize', update)
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [anchorRef, onClose])
      if (position === null) return null

      const totals = view.totals ?? {}
      const kinds = (view.byKind ?? []).slice(0, 6)
      const kindMax = Math.max(1, ...kinds.map(item => item.count))
      const classes = (view.byClass ?? []).slice(0, 4)
      const recent = (view.recent ?? []).slice(0, 5)

      return ReactDOM.createPortal(
        h('div', {
          ref: panelRef,
          role: 'dialog',
          'aria-label': 'Step 无效动作统计',
          'data-event-fix-panel': true,
          style: position,
        },
        h('div', { className: 'ef-head' },
          h('span', { className: 'ef-head-label' }, h(StepIcon), '无效动作统计'),
          h('span', { className: 'ef-ratio' }, `${totals.ratio ?? 0}%`),
        ),
        h('div', { className: 'ef-sub' },
          `${totals.invalidSteps ?? 0} / ${totals.steps ?? 0} 步无效 · 有效成本之外的重复劳动`),

        h('div', { className: 'ef-kpis' },
          h('div', { className: 'ef-kpi' },
            h('div', { className: 'ef-kpi-label' }, '浪费 token'),
            h('div', { className: 'ef-kpi-value' }, formatTokens(totals.wastedTokens ?? 0)),
          ),
          h('div', { className: 'ef-kpi' },
            h('div', { className: 'ef-kpi-label' }, '浪费时长'),
            h('div', { className: 'ef-kpi-value' }, formatDuration(totals.wastedMs ?? 0)),
          ),
          h('div', { className: 'ef-kpi' },
            h('div', { className: 'ef-kpi-label' }, '工具报错'),
            h('div', { className: 'ef-kpi-value' }, `${totals.toolErrors ?? 0}`),
          ),
          h('div', { className: 'ef-kpi' },
            h('div', { className: 'ef-kpi-label' }, '命令失败'),
            h('div', { className: 'ef-kpi-value' }, `${totals.commandFailures ?? 0}`),
          ),
        ),

        h('div', { className: 'ef-section' },
          h('div', { className: 'ef-section-title' }, '每轮无效占比'),
          h(RatioSpark, { series: view.series ?? [] }),
        ),

        kinds.length > 0
          ? h('div', { className: 'ef-section' },
              h('div', { className: 'ef-section-title' }, '无效类型'),
              ...kinds.map(item => h('div', { className: 'ef-bar-row', key: item.id },
                h('span', { className: 'ef-bar-label' }, item.label),
                h('span', { className: 'ef-bar-track' },
                  h('span', { className: 'ef-bar-fill', style: { width: `${Math.round((item.count / kindMax) * 100)}%` } }),
                ),
                h('span', { className: 'ef-bar-count' }, String(item.count)),
              )),
            )
          : null,

        classes.length > 0
          ? h('div', { className: 'ef-section' },
              h('div', { className: 'ef-section-title' }, '报错分类'),
              ...classes.map(item => h('div', { className: 'ef-step', key: item.id },
                h('span', { className: 'ef-step-kind' }, item.label),
                h('span', { className: 'ef-step-detail' }, `${item.count} 次`),
              )),
            )
          : null,

        recent.length > 0
          ? h('div', { className: 'ef-section' },
              h('div', { className: 'ef-section-title' }, '最近无效步'),
              ...recent.map((item, index) => h('div', { className: 'ef-step', key: `recent-${index}` },
                h('span', { className: 'ef-step-pos' }, `T${item.turn}S${item.step}`),
                h('span', { className: 'ef-step-kind' }, (item.kinds ?? []).join('/')),
                h('span', { className: 'ef-step-detail' },
                  item.errors?.[0] === undefined
                    ? `${formatTokens(item.usage?.total ?? 0)} tok`
                    : `${item.errors[0].tool}: ${item.errors[0].message}`),
              )),
            )
          : h('div', { className: 'ef-empty' }, '本会话暂无无效步。'),

        h('div', { className: 'ef-note' },
          '口径：isError=true（message 级或 part 级）、shell 退出码非 0、重试、重复、空转、中断；完整面板用 `dsh-event-fix scan --html`。'),
      ),
        document.body,
      )
    }

    function EventFixPill(props) {
      const view = props.useProjection(PROJECTION)
      const [open, setOpen] = React.useState(false)
      const rootRef = React.useRef(null)
      const close = React.useCallback(() => setOpen(false), [])
      if (view === undefined || view === null) return null
      const totals = view.totals ?? {}
      if ((totals.steps ?? 0) === 0) return null
      const bad = (totals.invalidSteps ?? 0) > 0
      return h('span', { ref: rootRef, 'data-event-fix-pill-root': true },
        h('button', {
          type: 'button',
          'data-event-fix-pill': true,
          'data-bad': bad ? 'true' : 'false',
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-label': `无效步 ${totals.invalidSteps ?? 0} / ${totals.steps ?? 0}`,
          onClick: () => setOpen(!open),
        },
        h(StepIcon),
        h('span', null, `无效 ${totals.invalidSteps ?? 0}/${totals.steps ?? 0} · ${formatTokens(totals.wastedTokens ?? 0)} tok`),
        ),
        open ? h(EventFixPanel, { view, anchorRef: rootRef, onClose: close }) : null,
      )
    }

    function apply(ctx) {
      ensureStyles()
      ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'event-fix-steps',
        order: 20,
        label: '无效动作统计',
      }, EventFixPill))
    }

    Object.assign(exports, { name, inject, apply })
    return module.exports
  },
})
