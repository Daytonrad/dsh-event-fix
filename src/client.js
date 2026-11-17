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
[data-event-fix-page]{box-sizing:border-box;max-width:860px;padding:4px 2px 24px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
[data-event-fix-page] .efp-head{align-items:flex-start;justify-content:space-between;gap:16px;display:flex}
[data-event-fix-page] .efp-title{color:var(--dsw-alias-label-primary);font-size:20px;line-height:28px;font-weight:600}
[data-event-fix-page] .efp-sub{color:var(--dsw-alias-label-tertiary);font-size:12px;margin-top:2px}
[data-event-fix-page] .efp-btn{box-sizing:border-box;height:28px;padding:0 12px;flex:none;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
[data-event-fix-page] .efp-btn:hover:enabled{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-event-fix-page] .efp-btn:disabled{cursor:default;opacity:.6}
[data-event-fix-page] .efp-strip{margin-top:12px;padding:8px 12px;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);font-size:12px}
[data-event-fix-page] .efp-strip-error{color:#c0392b}
[data-event-fix-page] .efp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:10px;margin:18px 0 0}
[data-event-fix-page] .efp-kpi{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,12px);padding:10px 12px;background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2))}
[data-event-fix-page] .efp-kpi-label{color:var(--dsw-alias-label-tertiary);font-size:11px}
[data-event-fix-page] .efp-kpi-value{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;font-size:19px;line-height:26px;font-weight:500}
[data-event-fix-page] .efp-kpi-hint{color:var(--dsw-alias-label-tertiary);font-size:11px}
[data-event-fix-page] .efp-card{margin-top:12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,12px);padding:14px 16px;background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2))}
[data-event-fix-page] .efp-card-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;margin-bottom:2px}
[data-event-fix-page] .efp-card-sub{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-bottom:10px}
[data-event-fix-page] .efp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
[data-event-fix-page] .efp-grid2 .efp-card{margin-top:0}
[data-event-fix-page] .efp-bar-row{display:grid;grid-template-columns:104px 1fr 36px;align-items:center;gap:8px;margin:5px 0;font-size:12px}
[data-event-fix-page] .efp-bar-label{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-event-fix-page] .efp-bar-track{background:var(--dsw-alias-border-l1);border-radius:4px;height:6px;overflow:hidden}
[data-event-fix-page] .efp-bar-fill{display:block;height:100%;border-radius:4px}
[data-event-fix-page] .efp-bar-count{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:11px}
[data-event-fix-page] .efp-table{width:100%;border-collapse:collapse;font-size:12px}
[data-event-fix-page] .efp-table th{color:var(--dsw-alias-label-tertiary);font-weight:400;font-size:11px;text-align:right;padding:0 0 6px}
[data-event-fix-page] .efp-table td{padding:5px 0;border-top:.5px solid var(--dsw-alias-border-l1);text-align:right;color:var(--dsw-alias-label-secondary)}
[data-event-fix-page] .efp-table .efp-th-left,[data-event-fix-page] .efp-table td:first-child{text-align:left}
[data-event-fix-page] .efp-mono{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,monospace);font-size:11px;color:var(--dsw-alias-label-primary)}
[data-event-fix-page] .efp-num{font-variant-numeric:tabular-nums}
[data-event-fix-page] .efp-path{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px}
[data-event-fix-page] .efp-note{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-top:14px}
[data-event-fix-page] .efp-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:8px 0}
@media (width<=720px){[data-event-fix-page] .efp-grid2{grid-template-columns:1fr}}
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

    // ── settings page ───────────────────────────────────────────────────────
    // The page is cross-session, so it cannot read a projection. The host serves
    // the aggregate from /dsh-event-fix/stats and this page only draws it.
    const STATS_ENDPOINT = '/dsh-event-fix/stats'

    function statsUrl(params) {
      const query = new URLSearchParams(params || {})
      if (typeof window !== 'undefined') {
        const token = new URLSearchParams(window.location.search).get('token')
        if (token !== null) query.set('token', token)
      }
      const text = query.toString()
      return text === '' ? STATS_ENDPOINT : `${STATS_ENDPOINT}?${text}`
    }

    function exact(value) {
      return Number.isFinite(value) ? String(Math.round(value)) : '0'
    }

    function niceMax(value) {
      if (!Number.isFinite(value) || value <= 5) return 5
      const magnitude = 10 ** Math.floor(Math.log10(value))
      const normalized = value / magnitude
      const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
      return nice * magnitude
    }

    function TrendChart({ days }) {
      if (!Array.isArray(days) || days.length === 0) return null
      const width = 640
      const height = 172
      const pad = { left: 36, right: 14, top: 12, bottom: 26 }
      const innerW = width - pad.left - pad.right
      const innerH = height - pad.top - pad.bottom
      const maxRatio = niceMax(Math.max(5, ...days.map(day => day.ratio ?? 0)))
      const maxTokens = Math.max(1, ...days.map(day => day.wastedTokens ?? 0))
      const step = days.length > 1 ? innerW / (days.length - 1) : innerW
      const x = index => pad.left + (days.length > 1 ? step * index : innerW / 2)
      const y = value => pad.top + innerH - (value / maxRatio) * innerH
      const barWidth = Math.max(2, Math.min(9, step * 0.5))
      const line = days
        .map((day, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(day.ratio ?? 0).toFixed(1)}`)
        .join(' ')
      const area = `${line} L${x(days.length - 1).toFixed(1)},${pad.top + innerH} L${x(0).toFixed(1)},${pad.top + innerH} Z`
      const ticks = [0, 0.5, 1]
      const labelIndexes = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])]

      return h('svg', {
        viewBox: `0 0 ${width} ${height}`,
        width: '100%',
        height,
        role: 'img',
        'aria-label': '每日无效步占比与浪费 token',
        style: { display: 'block' },
      },
      ...ticks.map(ratioFraction => {
        const top = pad.top + innerH - innerH * ratioFraction
        const value = maxRatio * ratioFraction
        return h('g', { key: `tick-${ratioFraction}` },
          h('line', {
            x1: pad.left,
            y1: top,
            x2: width - pad.right,
            y2: top,
            stroke: 'var(--dsw-alias-border-l1)',
            strokeWidth: 0.5,
            strokeDasharray: ratioFraction === 0 ? 'none' : '3 3',
          }),
          h('text', {
            x: pad.left - 6,
            y: top + 3,
            textAnchor: 'end',
            fontSize: 10,
            fill: 'var(--dsw-alias-label-tertiary)',
          }, `${Math.round(value)}%`),
        )
      }),
      ...days.map((day, index) => {
        const barHeight = ((day.wastedTokens ?? 0) / maxTokens) * innerH * 0.55
        return h('rect', {
          key: `bar-${day.day}`,
          x: x(index) - barWidth / 2,
          y: pad.top + innerH - barHeight,
          width: barWidth,
          height: Math.max(0, barHeight),
          rx: 1,
          fill: 'var(--dsw-alias-border-l2)',
        })
      }),
      h('path', { d: area, fill: 'rgba(192,57,43,0.10)' }),
      h('path', { d: line, fill: 'none', stroke: '#c0392b', strokeWidth: 1.6, strokeLinejoin: 'round' }),
      ...days.map((day, index) => (day.ratio ?? 0) > 0
        ? h('circle', {
            key: `dot-${day.day}`,
            cx: x(index),
            cy: y(day.ratio),
            r: 1.8,
            fill: '#c0392b',
          })
        : null),
      ...labelIndexes.map(index => h('text', {
        key: `label-${index}`,
        x: x(index),
        y: height - 8,
        textAnchor: index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle',
        fontSize: 10,
        fill: 'var(--dsw-alias-label-tertiary)',
      }, String(days[index]?.day ?? '').slice(5))),
      )
    }

    function BarList({ items, tone }) {
      if (!Array.isArray(items) || items.length === 0) {
        return h('div', { className: 'efp-empty' }, '暂无')
      }
      const max = Math.max(1, ...items.map(item => item.count ?? 0))
      return h('div', null, ...items.map(item => h('div', { className: 'efp-bar-row', key: item.id },
        h('span', { className: 'efp-bar-label' }, item.label ?? item.id),
        h('span', { className: 'efp-bar-track' },
          h('span', {
            className: 'efp-bar-fill',
            style: { width: `${Math.max(2, Math.round(((item.count ?? 0) / max) * 100))}%`, background: tone ?? '#c0392b' },
          }),
        ),
        h('span', { className: 'efp-bar-count' }, exact(item.count)),
      )))
    }

    function ToolTable({ items }) {
      if (!Array.isArray(items) || items.length === 0) {
        return h('div', { className: 'efp-empty' }, '暂无工具调用')
      }
      return h('table', { className: 'efp-table' },
        h('thead', null, h('tr', null,
          h('th', { className: 'efp-th-left' }, '工具'),
          h('th', null, '调用'),
          h('th', null, '失败'),
          h('th', null, '失败率'),
        )),
        h('tbody', null, ...items.map(item => h('tr', { key: item.tool },
          h('td', { className: 'efp-mono' }, item.tool),
          h('td', { className: 'efp-num' }, exact(item.calls)),
          h('td', { className: 'efp-num' }, exact(item.errors)),
          h('td', { className: 'efp-num', style: { color: item.rate >= 20 ? '#c0392b' : undefined } }, `${Number(item.rate ?? 0).toFixed(1)}%`),
        ))),
      )
    }

    function SessionTable({ items }) {
      if (!Array.isArray(items) || items.length === 0) {
        return h('div', { className: 'efp-empty' }, '暂无会话')
      }
      return h('table', { className: 'efp-table' },
        h('thead', null, h('tr', null,
          h('th', { className: 'efp-th-left' }, '会话'),
          h('th', null, '步'),
          h('th', null, '无效'),
          h('th', null, '占比'),
          h('th', null, '浪费 token'),
        )),
        h('tbody', null, ...items.map(item => h('tr', { key: item.sessionId },
          h('td', { className: 'efp-path', title: item.sessionId }, item.cwd || item.sessionId.slice(-12)),
          h('td', { className: 'efp-num' }, exact(item.steps)),
          h('td', { className: 'efp-num' }, exact(item.invalidSteps)),
          h('td', { className: 'efp-num' }, `${Number(item.ratio ?? 0).toFixed(1)}%`),
          h('td', { className: 'efp-num' }, formatTokens(item.wastedTokens ?? 0)),
        ))),
      )
    }

    function Kpi({ label, value, hint }) {
      return h('div', { className: 'efp-kpi' },
        h('div', { className: 'efp-kpi-label' }, label),
        h('div', { className: 'efp-kpi-value' }, value),
        hint === undefined ? null : h('div', { className: 'efp-kpi-hint' }, hint),
      )
    }

    function StatsPage() {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const alive = React.useRef(true)

      const load = React.useCallback(async (force) => {
        try {
          const url = statsUrl(force ? { refresh: '1' } : null)
          const response = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const json = await response.json()
          if (!alive.current) return
          setData(json)
          setError(null)
        } catch (failure) {
          if (!alive.current) return
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }, [])

      React.useEffect(() => {
        alive.current = true
        load(false)
        const timer = setInterval(() => { load(false) }, 30000)
        return () => {
          alive.current = false
          clearInterval(timer)
        }
      }, [load])

      const refresh = () => {
        setBusy(true)
        void load(true)
        setTimeout(() => { void load(false) }, 2500)
        setTimeout(() => { void load(false); setBusy(false) }, 6000)
      }

      const totals = data?.totals ?? {}
      const scan = data?.scan ?? {}
      const loading = data === null
      const scanning = scan.state === 'loading'
      const updated = data?.generatedAt
        ? new Date(data.generatedAt).toLocaleTimeString('zh-CN', { hour12: false })
        : '—'

      return h('div', { 'data-event-fix-page': true },
        h('div', { className: 'efp-head' },
          h('div', null,
            h('div', { className: 'efp-title' }, '无效动作统计'),
            h('div', { className: 'efp-sub' },
              `step 级失败与浪费 · 近 ${data?.windowDays ?? 30} 天 · 更新于 ${updated}`),
          ),
          h('button', {
            type: 'button',
            className: 'efp-btn',
            onClick: refresh,
            disabled: busy,
          }, busy ? '扫描中…' : '重新扫描'),
        ),

        scanning
          ? h('div', { className: 'efp-strip' },
              `正在汇总历史会话 ${scan.done ?? 0}/${scan.total ?? 0}…数字会随后刷新`)
          : null,
        scan.state === 'failed'
          ? h('div', { className: 'efp-strip efp-strip-error' }, `历史汇总失败：${scan.error ?? '原因未知'}`)
          : null,
        error === null
          ? null
          : h('div', { className: 'efp-strip efp-strip-error' },
              error === 'HTTP 404'
                ? '读取统计失败：HTTP 404 —— 宿主侧路由没有注册。插件源码改动不会被 HMR 热加载，需要重启一次 DSH（设置页本身由浏览器从磁盘读取，所以能先显示出来）。'
                : `读取统计失败：${error}。`),

        loading && error === null
          ? h('div', { className: 'efp-empty' }, '正在读取统计…')
          : loading
            ? null
            : h('div', null,
              h('div', { className: 'efp-kpis' },
                h(Kpi, { label: '无效步', value: `${exact(totals.invalidSteps)} / ${exact(totals.steps)}`, hint: `占比 ${Number(totals.ratio ?? 0).toFixed(1)}%` }),
                h(Kpi, { label: '浪费 token', value: formatTokens(totals.wastedTokens ?? 0), hint: `占总用量 ${Number(totals.tokenRatio ?? 0).toFixed(1)}%` }),
                h(Kpi, { label: '浪费时长', value: formatDuration(totals.wastedMs ?? 0), hint: `占墙钟 ${Number(totals.timeRatio ?? 0).toFixed(1)}%` }),
                h(Kpi, {
                  label: '失败调用',
                  value: exact(totals.toolErrors),
                  hint: `命令失败 ${exact(totals.commandFailures)} · 重试 ${exact(totals.retries)}`,
                }),
              ),

              h('div', { className: 'efp-card' },
                h('div', { className: 'efp-card-title' }, '每日无效占比与浪费 token'),
                h('div', { className: 'efp-card-sub' }, '折线 = 当日无效步占比 · 灰柱 = 当日浪费 token'),
                h(TrendChart, { days: data.days ?? [] }),
              ),

              h('div', { className: 'efp-grid2' },
                h('div', { className: 'efp-card' },
                  h('div', { className: 'efp-card-title' }, '无效类型'),
                  h(BarList, { items: data.kinds ?? [] }),
                ),
                h('div', { className: 'efp-card' },
                  h('div', { className: 'efp-card-title' }, '报错分类'),
                  h(BarList, { items: data.classes ?? [], tone: '#a06a3c' }),
                ),
              ),

              h('div', { className: 'efp-card' },
                h('div', { className: 'efp-card-title' }, '失败最多的工具'),
                h(ToolTable, { items: data.tools ?? [] }),
              ),

              h('div', { className: 'efp-card' },
                h('div', { className: 'efp-card-title' }, '浪费 token 最多的会话'),
                h(SessionTable, { items: data.sessions ?? [] }),
              ),

              h('div', { className: 'efp-note' },
                `扫描范围：最近 ${scan.limit ?? 150} 个会话（已汇总 ${exact(totals.sessions)} 个）· `
                + '口径见 docs/TAXONOMY.md；本页只统计明确的失败/重试/重复/空转事件。'),
            ),
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
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'event-fix-stats',
        order: 40,
        label: '无效动作统计',
      }, StatsPage))
    }

    Object.assign(exports, { name, inject, apply })
    return module.exports
  },
})
