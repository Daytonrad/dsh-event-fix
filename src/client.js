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
[data-event-fix-page] .efp-table th{color:var(--dsw-alias-label-tertiary);font-weight:400;font-size:11px;text-align:right;padding:0 10px 6px}
[data-event-fix-page] .efp-table td{padding:5px 10px;border-top:.5px solid var(--dsw-alias-border-l1);text-align:right;color:var(--dsw-alias-label-secondary)}
[data-event-fix-page] .efp-table th:first-child,[data-event-fix-page] .efp-table td:first-child{padding-left:0}
[data-event-fix-page] .efp-table th:last-child,[data-event-fix-page] .efp-table td:last-child{padding-right:0}
[data-event-fix-page] .efp-table .efp-th-left,[data-event-fix-page] .efp-table td:first-child{text-align:left}
[data-event-fix-page] .efp-mono{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,monospace);font-size:11px;color:var(--dsw-alias-label-primary)}
[data-event-fix-page] .efp-num{font-variant-numeric:tabular-nums}
[data-event-fix-page] .efp-path{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px}
[data-event-fix-page] .efp-note{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-top:14px}
[data-event-fix-page] .efp-stale{margin:0 0 14px;padding:9px 12px;border-radius:8px;border:.5px solid rgba(180,95,6,.35);background:rgba(250,222,100,.14);color:#8a5a00;font-size:12px;line-height:1.55}
[data-event-fix-page] .efp-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:8px 0}
[data-event-fix-page] .efp-stack{display:flex;height:10px;border-radius:5px;overflow:hidden;gap:1px;margin:4px 0 10px}
[data-event-fix-page] .efp-stack-seg{display:block;height:100%;min-width:2px}
[data-event-fix-page] .efp-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:8px}
[data-event-fix-page] .efp-legend-item{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
[data-event-fix-page] .efp-legend-dot{width:7px;height:7px;border-radius:2px;flex:none}
[data-event-fix-page] .efp-legend-pct{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
[data-event-fix-page] .efp-inline{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12px;color:var(--dsw-alias-label-tertiary);padding:6px 0 2px;border-top:.5px solid var(--dsw-alias-border-l1)}
[data-event-fix-page] .efp-actrows{margin:6px 0 0}
[data-event-fix-page] .efp-actrow{display:grid;grid-template-columns:96px 70px 1fr;gap:10px;font-size:12px;color:var(--dsw-alias-label-secondary);padding:2px 0}
[data-event-fix-page] .efp-actlabel{color:var(--dsw-alias-label-primary)}
[data-event-fix-page] .efp-read{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:8px 0 2px}
[data-event-fix-page] .efp-actions{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
[data-event-fix-page] .efp-btn-ghost{height:26px;font-size:12px}
[data-event-fix-page] .efp-action-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}
[data-event-fix-page] .efp-muted{color:var(--dsw-alias-label-tertiary)}
[data-event-fix-panel] .efp-stack{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:1px;margin:4px 0 8px}
[data-event-fix-panel] .efp-stack-seg{display:block;height:100%;min-width:2px}
[data-event-fix-panel] .efp-legend{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--dsw-alias-label-secondary)}
[data-event-fix-panel] .efp-legend-item{display:inline-flex;align-items:center;gap:6px}
[data-event-fix-panel] .efp-legend-dot{width:6px;height:6px;border-radius:2px;flex:none}
[data-event-fix-panel] .efp-legend-pct{color:var(--dsw-alias-label-tertiary)}
[data-event-fix-panel] .efp-inline{display:flex;gap:12px;font-size:11px;color:var(--dsw-alias-label-tertiary);margin:6px 0 2px}
[data-event-fix-panel] .efp-actrows{margin:4px 0 0}
[data-event-fix-panel] .efp-actrow{display:grid;grid-template-columns:84px 58px 1fr;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary);padding:2px 0}
[data-event-fix-panel] .efp-actlabel{color:var(--dsw-alias-label-primary)}
[data-event-fix-panel] .efp-read{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-secondary);margin:6px 0 2px}
[data-event-fix-panel] .efp-actions{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
[data-event-fix-panel] .efp-btn{box-sizing:border-box;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
[data-event-fix-panel] .efp-btn:hover:enabled{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-event-fix-panel] .efp-btn-ghost{background:0 0}
[data-event-fix-panel] .efp-action-hint{font-size:10px;color:var(--dsw-alias-label-tertiary)}
[data-event-fix-panel] .efp-empty{font-size:11px;color:var(--dsw-alias-label-tertiary)}
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

    /** Clipboard with a fallback for browsers that block the async API. */
    async function copyText(text) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText !== undefined) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        // fall through to the textarea path
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch {
        return false
      }
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

    function EventFixPanel({ view, anchorRef, onClose, inputActions }) {
      const panelRef = React.useRef(null)
      const [position, setPosition] = React.useState(null)
      const [copied, setCopied] = React.useState(false)
      // A one-click handoff: the plugin never calls a model itself, it only
      // writes the question — with the numbers already in it — into the composer.
      const handoff = () => {
        const prompt = buildSessionPrompt(view)
        try {
          if (inputActions?.captureInsertion !== undefined && inputActions?.insertText !== undefined) {
            const span = inputActions.captureInsertion()
            if (inputActions.insertText(prompt, span)) {
              onClose()
              return
            }
          }
          if (inputActions?.setDraft !== undefined) {
            inputActions.setDraft(prompt)
            onClose()
            return
          }
        } catch {
          // older host: fall back to the clipboard
        }
        void copyText(prompt).then(ok => setCopied(ok))
      }
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
              h('div', { className: 'ef-section-title' }, '最近无效步'),              ...recent.map((item, index) => h('div', { className: 'ef-step', key: `recent-${index}` },
                h('span', { className: 'ef-step-pos' }, `T${item.turn}S${item.step}`),
                h('span', { className: 'ef-step-kind' }, (item.kinds ?? []).join('/')),
                h('span', { className: 'ef-step-detail' },
                  item.errors?.[0] === undefined
                    ? `${formatTokens(item.usage?.total ?? 0)} tok`
                    : `${item.errors[0].tool}: ${item.errors[0].message}`),
              )),
            )
          : h('div', { className: 'ef-empty' }, '本会话暂无无效步。'),

        h('div', { className: 'ef-section' },
          h('div', { className: 'ef-section-title' }, '失败之后'),
          h(FollowupCard, {
            followups: view.followups ?? {},
            onPrompt: handoff,
            promptLabel: copied ? '已复制到剪贴板' : '把这份复盘交给 agent',
            promptHint: '只写入输入框，不自动发送',
          }),
        ),

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
      // Hover is tracked by index; the tooltip is drawn inside the SVG so it
      // follows the viewBox and needs no DOM measurement.
      const [hover, setHover] = React.useState(-1)
      if (!Array.isArray(days) || days.length === 0) return null
      const width = 640
      const height = 184
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
      const active = hover >= 0 && hover < days.length ? days[hover] : null

      return h('svg', {
        viewBox: `0 0 ${width} ${height}`,
        width: '100%',
        height,
        role: 'img',
        'aria-label': '每日无效步占比与浪费 token，悬停可查看当天明细',
        style: { display: 'block' },
        onMouseLeave: () => setHover(-1),
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
      active === null ? null : h('rect', {
        x: Math.max(pad.left, x(hover) - step / 2),
        y: pad.top,
        width: Math.max(2, Math.min(step, width - pad.right - Math.max(pad.left, x(hover) - step / 2))),
        height: innerH,
        fill: 'rgba(192,57,43,0.06)',
        pointerEvents: 'none',
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
          fill: index === hover ? '#9aa0a6' : 'var(--dsw-alias-border-l2)',
        })
      }),
      h('path', { d: area, fill: 'rgba(192,57,43,0.10)' }),
      h('path', { d: line, fill: 'none', stroke: '#c0392b', strokeWidth: 1.6, strokeLinejoin: 'round' }),
      ...days.map((day, index) => (day.ratio ?? 0) > 0
        ? h('circle', {
            key: `dot-${day.day}`,
            cx: x(index),
            cy: y(day.ratio),
            r: index === hover ? 3.2 : 1.8,
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
      active === null ? null : readout(active, x(hover), y(active.ratio ?? 0)),
      // Transparent hit bands sit on top so the whole column is hoverable.
      ...days.map((day, index) => h('rect', {
        key: `hit-${day.day}`,
        x: Math.max(pad.left, x(index) - step / 2),
        y: pad.top,
        width: Math.min(step, width - pad.right - Math.max(pad.left, x(index) - step / 2)),
        height: innerH,
        fill: 'transparent',
        style: { cursor: 'crosshair' },
        onMouseEnter: () => setHover(index),
      })),
      )

      function readout(day, pointX, pointY) {
        const boxW = 214
        const boxH = 48
        const left = Math.min(width - pad.right - boxW, Math.max(pad.left, pointX - boxW / 2))
        const top = pointY - boxH - 10 < pad.top ? pointY + 12 : pointY - boxH - 10
        const steps = day.steps ?? 0
        return h('g', { key: 'readout', pointerEvents: 'none' },
          h('rect', {
            x: left,
            y: top,
            width: boxW,
            height: boxH,
            rx: 6,
            fill: 'var(--dsw-alias-bg-base, #fff)',
            stroke: 'var(--dsw-alias-border-l2, #e3e5e8)',
          }),
          h('text', { x: left + 8, y: top + 15, fontSize: 10, fill: 'var(--dsw-alias-label-tertiary)' },
            String(day.day ?? '')),
          h('text', { x: left + 8, y: top + 29, fontSize: 11, fill: '#c0392b' },
            steps === 0
              ? '折线 · 当天无 step'
              : `折线 · 无效 ${exact(day.invalid)}/${exact(steps)} 步 ${Number(day.ratio ?? 0).toFixed(1)}%`),
          h('text', { x: left + 8, y: top + 42, fontSize: 11, fill: 'var(--dsw-alias-label-secondary, #4b5563)' },
            `柱形 · 浪费 ${formatTokens(day.wastedTokens ?? 0)} tok`),
        )
      }
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
          h('th', { className: 'efp-th-left' }, '主要错误'),
          h('th', null, '失败后下一步'),
        )),
        h('tbody', null, ...items.map(item => {
          const episodes = item.recoveryEpisodes ?? 0
          const recovered = item.recovered ?? 0
          const rate = episodes > 0 ? Math.round((recovered / episodes) * 100) : null
          return h('tr', { key: item.tool },
            h('td', { className: 'efp-mono' }, item.tool),
            h('td', { className: 'efp-num' }, exact(item.calls)),
            h('td', { className: 'efp-num' }, exact(item.errors)),
            h('td', { className: 'efp-num', style: { color: item.rate >= 20 ? '#c0392b' : undefined } }, `${Number(item.rate ?? 0).toFixed(1)}%`),
            h('td', { className: 'efp-th-left' },
              item.topClass === null || item.topClass === undefined
                ? h('span', { className: 'efp-muted' }, '—')
                : `${item.topClass.label} ${exact(item.topClass.count)}`),
            h('td', { className: 'efp-num' },
              rate === null
                ? h('span', { className: 'efp-muted' }, '—')
                : h('span', { style: { color: rate < 50 ? '#c0392b' : undefined } }, `${rate}% · ${exact(recovered)}/${exact(episodes)}`)),
          )
        })),
      )
    }

    // ── failure follow-up ───────────────────────────────────────────────────
    // The page answers "which tools fail" already. The decision needs the
    // conditional: given a failure, what did the agent do next, and did that
    // work? In the local corpus a literal retry is almost absent (2 of 708), so
    // the useful split is by outcome — recovered, failed again, or abandoned —
    // and the action mix (same call / other arguments / other tool) explains it.

    function followupBuckets(followups) {
      const f = followups ?? {}
      const ok = (f.sameOk ?? 0) + (f.changedArgsOk ?? 0) + (f.changedToolOk ?? 0)
      const failed = (f.sameFail ?? 0) + (f.changedArgsFail ?? 0) + (f.changedToolFail ?? 0)
      return {
        ok,
        failed,
        unknown: f.unknown ?? 0,
        abandoned: f.abandoned ?? 0,
      }
    }

    /** The three answers to a failure, each with its own success rate. */
    function followupActions(followups) {
      const f = followups ?? {}
      return [
        { id: 'same', label: '原样重试', count: f.same ?? 0, ok: f.sameOk ?? 0, failed: f.sameFail ?? 0 },
        { id: 'changedArgs', label: '改参数再试', count: f.changedArgs ?? 0, ok: f.changedArgsOk ?? 0, failed: f.changedArgsFail ?? 0 },
        { id: 'changedTool', label: '换工具', count: f.changedTool ?? 0, ok: f.changedToolOk ?? 0, failed: f.changedToolFail ?? 0 },
      ].filter(item => item.count > 0)
    }

    function actionRate(item) {
      const decided = item.ok + item.failed
      return decided > 0 ? item.ok / decided : null
    }

    function percent(value) {
      return Math.round(value * 100)
    }

    function followupSegments(followups) {
      const buckets = followupBuckets(followups)
      return [
        { id: 'ok', label: '下一步成功', count: buckets.ok, color: '#2e7d32' },
        { id: 'failed', label: '下一步仍失败', count: buckets.failed, color: '#c0392b' },
        { id: 'unknown', label: '结果未知', count: buckets.unknown, color: '#b6b6b6' },
        { id: 'abandoned', label: '放弃（无后续调用）', count: buckets.abandoned, color: '#7a7a7a' },
      ].filter(item => item.count > 0)
    }

    /** Recovery rate over the episodes whose outcome is known. */
    function recoveryRate(followups) {
      const buckets = followupBuckets(followups)
      const decided = buckets.ok + buckets.failed
      return decided > 0 ? buckets.ok / decided : null
    }

    /** One sentence a reader can act on, derived only from the counters. */
    function interpretFollowups(followups) {
      const f = followups ?? {}
      const episodes = f.episodes ?? 0
      if (episodes === 0) return '还没有可判定的失败 episode。'
      const buckets = followupBuckets(f)
      const rate = recoveryRate(f)
      const sameRate = (f.same ?? 0) / episodes
      const abandonedRate = buckets.abandoned / episodes
      if (sameRate >= 0.25 && rate !== null && rate < 0.5) {
        return `原样重试占 ${percent(sameRate)}%，且其中大部分仍然失败：这类失败对同一输入是确定的，`
          + '再试不会变好，该修的是工具/环境或调用参数，不是提示词。'
      }
      if (abandonedRate >= 0.25) {
        return `有 ${percent(abandonedRate)}% 的失败之后没有任何后续调用：agent 直接放弃了，`
          + '通常表现为把问题原样抛回给你。最该补的是失败后的兜底路径。'
      }
      const args = followupActions(f).find(item => item.id === 'changedArgs')
      const tool = followupActions(f).find(item => item.id === 'changedTool')
      const argsRate = args === undefined ? null : actionRate(args)
      const toolRate = tool === undefined ? null : actionRate(tool)
      if (argsRate !== null && toolRate !== null && args.count >= 30 && tool.count >= 30) {
        if (toolRate - argsRate >= 0.1) {
          return `换工具的成功率（${percent(toolRate)}%）明显高于改参数（${percent(argsRate)}%）：`
            + '失败时更该换路子，而不是在参数上反复调。'
        }
        if (argsRate - toolRate >= 0.1) {
          return `改参数的成功率（${percent(argsRate)}%）高于换工具（${percent(toolRate)}%）：`
            + '这类失败通常是输入/路径问题，把参数改对就能过。'
        }
      }
      if (rate !== null && rate < 0.6) {
        return `失败之后的下一步只有 ${percent(rate)}% 成功：这不是个别工具的偶发问题，`
          + '而是整体在试错。先修负载最重的那一类（下面表格的「主要错误」）。'
      }
      if (rate !== null && rate >= 0.7) {
        return `多数失败被接住了（下一步成功率 ${percent(rate)}%），但仍有 ${exact(buckets.failed)} 次`
          + '下一步继续失败——这些才是真正该消掉的浪费。'
      }
      return '恢复情况参差：先看下面失败率最高、恢复率最低的工具，再决定是修工具还是修用法。'
    }

    function buildFollowupPrompt(input) {
      const { followups = {}, tools = [], totals = {}, windowDays = 30 } = input ?? {}
      const buckets = followupBuckets(followups)
      const rate = recoveryRate(followups)
      const lines = []
      lines.push(`回顾最近 ${windowDays} 天的执行记录，帮我定位失败根因。`)
      lines.push('')
      lines.push(`总览：${exact(totals.steps)} 步里 ${exact(totals.invalidSteps)} 步无效（${Number(totals.ratio ?? 0).toFixed(1)}%），`
        + `浪费 ${formatTokens(totals.wastedTokens ?? 0)} token、${formatDuration(totals.wastedMs ?? 0)}。`)
      lines.push(`失败之后（共 ${exact(followups.episodes)} 个失败回合，仅统计同一轮内下一步的回应）：`)
      lines.push(`- 下一步成功 ${exact(buckets.ok)}（占全部 ${percent(buckets.ok / Math.max(1, followups.episodes ?? 1))}%）`)
      lines.push(`- 下一步仍失败 ${exact(buckets.failed)}`)
      lines.push(`- 放弃（本轮没有后续调用） ${exact(buckets.abandoned)}`)
      if (rate !== null) {
        lines.push(`- 在有后续调用的 ${exact(buckets.ok + buckets.failed)} 次里，恢复率 ${percent(rate)}%`)
      }
      const actions = followupActions(followups)
      if (actions.length > 0) {
        lines.push('做法与效果：')
        for (const item of actions) {
          const itemRate = actionRate(item)
          lines.push(`- ${item.label} ${exact(item.count)} 次${itemRate === null ? '' : `，其中 ${percent(itemRate)}% 的下一步成功`}`)
        }
      }
      if (Array.isArray(tools) && tools.length > 0) {
        lines.push('')
        lines.push('失败最多的工具：')
        for (const tool of tools.slice(0, 5)) {
          const parts = [`${tool.tool}：${exact(tool.errors)}/${exact(tool.calls)} 次失败（${Number(tool.rate ?? 0).toFixed(1)}%）`]
          if (tool.topClass) parts.push(`主要是「${tool.topClass.label}」`)
          if ((tool.recoveryEpisodes ?? 0) > 0) {
            const toolRate = Math.round(((tool.recovered ?? 0) / tool.recoveryEpisodes) * 100)
            parts.push(`失败后下一步成功 ${toolRate}%（${exact(tool.recovered)}/${exact(tool.recoveryEpisodes)}）`)
          }
          lines.push(`- ${parts.join('，')}`)
        }
      }
      lines.push('')
      lines.push('请只基于上面这些数据回答，不要泛泛而谈：')
      lines.push('1. 哪几类失败是确定性的（同一输入必然失败、再试无意义）？依据是哪些数字。')
      lines.push('2. 每一类给一个可执行改法：改工具参数 / 换工具 / 改环境配置 / 改我的用法。')
      lines.push('3. 如果根因在你的调用策略上，直接说下次应该怎么做。')
      return lines.join('\n')
    }

    function buildSessionPrompt(view) {
      const totals = view?.totals ?? {}
      const followups = view?.followups ?? {}
      const buckets = followupBuckets(followups)
      const recent = Array.isArray(view?.recent) ? view.recent.slice(0, 5) : []
      const lines = []
      lines.push('复盘刚才这一轮里的失败，定位根因。')
      lines.push('')
      lines.push(`本会话：${exact(totals.steps)} 步里 ${exact(totals.invalidSteps)} 步无效（${Number(totals.ratio ?? 0).toFixed(1)}%），`
        + `浪费 ${formatTokens(totals.wastedTokens ?? 0)} token、${formatDuration(totals.wastedMs ?? 0)}；`
        + `工具调用 ${exact(totals.toolCalls)} 次、失败 ${exact(totals.toolErrors)} 次、命令退出码非 0 ${exact(totals.commandFailures)} 次。`)
      if ((followups.episodes ?? 0) > 0) {
        lines.push(`失败之后：下一步成功 ${exact(buckets.ok)} 次、仍失败 ${exact(buckets.failed)} 次、放弃 ${exact(buckets.abandoned)} 次；`
          + `其中原样重试 ${exact(followups.same)} 次、改参数 ${exact(followups.changedArgs)} 次、换工具 ${exact(followups.changedTool)} 次。`)
      }
      const samples = []
      for (const step of recent) {
        for (const error of (step.errors ?? []).slice(0, 2)) {
          samples.push(`- T${step.turn}S${step.step} ${error.tool}（${error.class}）：${String(error.message ?? '').slice(0, 90)}`)
        }
      }
      if (samples.length > 0) {
        lines.push('')
        lines.push('最近的失败样本：')
        lines.push(...samples.slice(0, 6))
      }
      lines.push('')
      lines.push('请按顺序回答，不要泛泛而谈：')
      lines.push('1. 逐个判断这些失败是确定性的还是偶发的，依据是什么。')
      lines.push('2. 确定性失败给出：改参数 / 换工具 / 改环境配置 中选一个并说明怎么改。')
      lines.push('3. 如果根因在你的调用策略上，直接说下次具体怎么做。')
      return lines.join('\n')
    }

    function FollowupCard({ followups, onPrompt, promptLabel, promptHint }) {
      // `undefined` means the host response predates this field, which is a
      // different problem from "there were no episodes". Saying the latter when
      // the former is true sends people looking for failures that are right there.
      if (followups === undefined || followups === null) {
        return h('div', { className: 'efp-empty' },
          '宿主侧还是旧版本：响应里没有 followups 字段。重启一次 DSH 后本卡片与「失败后下一步」列才会出现。')
      }
      const segments = followupSegments(followups)
      const episodes = followups?.episodes ?? 0
      if (episodes === 0) {
        return h('div', { className: 'efp-empty' }, '还没有可判定的失败：需要有失败之后又继续调用工具的记录。')
      }
      const rate = recoveryRate(followups)
      const buckets = followupBuckets(followups)
      return h('div', null,
        h('div', { className: 'efp-stack' },
          ...segments.map(item => h('span', {
            key: item.id,
            className: 'efp-stack-seg',
            style: { width: `${(item.count / episodes) * 100}%`, background: item.color },
            title: `${item.label} ${item.count}（${Math.round((item.count / episodes) * 1000) / 10}%）`,
          })),
        ),
        h('div', { className: 'efp-legend' },
          ...segments.map(item => h('span', { className: 'efp-legend-item', key: item.id },
            h('span', { className: 'efp-legend-dot', style: { background: item.color } }),
            `${item.label} ${exact(item.count)}`,
            h('span', { className: 'efp-legend-pct' }, `${Math.round((item.count / episodes) * 1000) / 10}%`),
          )),
        ),
        h('div', { className: 'efp-inline' },
          h('span', null, `失败回合 ${exact(episodes)} 次`),
          h('span', null, `其中 ${exact(buckets.ok + buckets.failed)} 次有后续调用`),
          h('span', null, rate === null ? '恢复率 —' : `成功 ${Math.round(rate * 1000) / 10}%`),
        ),
        h('div', { className: 'efp-actrows' },
          ...followupActions(followups).map(item => {
            const itemRate = actionRate(item)
            return h('div', { className: 'efp-actrow', key: item.id },
              h('span', { className: 'efp-actlabel' }, item.label),
              h('span', { className: 'efp-num' }, `${exact(item.count)} 次`),
              h('span', { className: 'efp-num', style: { color: itemRate !== null && itemRate < 0.5 ? '#c0392b' : undefined } },
                itemRate === null ? '—' : `下一步成功 ${percent(itemRate)}%`),
            )
          }),
        ),
        h('div', { className: 'efp-read' }, interpretFollowups(followups)),
        onPrompt === undefined
          ? null
          : h('div', { className: 'efp-actions' },
              h('button', { type: 'button', className: 'efp-btn efp-btn-ghost', onClick: onPrompt }, promptLabel ?? '生成排查 prompt'),
              promptHint === undefined ? null : h('span', { className: 'efp-action-hint' }, promptHint),
            ),
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
      const [copied, setCopied] = React.useState(false)
      const alive = React.useRef(true)

      const copyPrompt = async text => {
        setCopied(await copyText(text))
        setTimeout(() => { if (alive.current) setCopied(false) }, 4000)
      }

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
      // A field we know the current host emits. Its absence means the running
      // host module predates it, so the numeric cards are stale rather than empty.
      const staleHost = !loading && data.followups === undefined && data.state !== 'error'
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

        staleHost
          ? h('div', { className: 'efp-stale' },
              '当前响应来自旧版宿主模块（没有 followups 字段）：插件源码改动不会热加载，'
              + '重启一次 DSH 后「失败之后」与「失败后下一步」两处才会有数据。')
          : null,

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
                h('div', { className: 'efp-card-sub' }, '折线 = 当日无效步占比 · 灰柱 = 当日浪费 token · 悬停看当天明细'),
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
                h('div', { className: 'efp-card-title' }, '失败之后 agent 做了什么'),
                h('div', { className: 'efp-card-sub' },
                  '以一次失败为起点，看同一轮里下一步的回应：原样重试、改参数、换工具，还是直接放弃'),
                h(FollowupCard, {
                  followups: data.followups,
                  onPrompt: () => { void copyPrompt(buildFollowupPrompt(data)) },
                  promptLabel: copied ? '已复制，粘到输入框即可' : '复制排查 prompt',
                  promptHint: '不调用模型：只是把这个问题的快照准备好',
                }),
              ),

              h('div', { className: 'efp-card' },
                h('div', { className: 'efp-card-title' }, '失败最多的工具'),
                h('div', { className: 'efp-card-sub' }, '「失败后下一步」= 这个工具失败后，同一轮里紧接着的那次调用有没有成功；低于 50% 说明它经常把 agent 带进死胡同'),
                h(ToolTable, { items: data.tools ?? [] }),
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
        open ? h(EventFixPanel, { view, anchorRef: rootRef, onClose: close, inputActions: props.inputActions }) : null,
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

    // Extra exports exist for tests: the prompt builders are pure functions and
    // the host ignores everything beyond name/inject/apply.
    Object.assign(exports, { name, inject, apply, buildFollowupPrompt, buildSessionPrompt, interpretFollowups })
    return module.exports
  },
})
