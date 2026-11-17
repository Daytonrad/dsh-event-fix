import assert from 'node:assert/strict'
import test from 'node:test'
import { sessionView, summarizeRecords } from '../src/analyzer.js'
import { buildReport, dayKey, lineChart, renderHtmlReport, renderTextReport } from '../src/report.js'
import { buildFixtureRecords } from './fixtures.js'

function fixtureView() {
  return sessionView(summarizeRecords(buildFixtureRecords(), { id: 'fixture-session', cwd: 'E:\\fixture' }))
}

test('buildReport folds sessions into totals and a day series', () => {
  const view = fixtureView()
  const report = buildReport([{ sessionId: 'fixture-session', cwd: 'E:\\fixture', view }], { root: 'x', now: Date.parse('2026-11-17T00:00:00Z') })
  assert.equal(report.totals.sessions, 1)
  assert.equal(report.totals.steps, 7)
  assert.equal(report.totals.invalidSteps, 6)
  assert.equal(report.totals.ratio, 85.7)
  assert.equal(report.totals.wastedTokens, 660)
  assert.equal(report.daySeries.length, 1)
  assert.equal(report.daySeries[0].day, dayKey(Date.parse('2026-11-10T02:00:00Z')))
  assert.equal(report.byTool.find(item => item.tool === 'read').errors, 1)
  assert.equal(report.recent.length, 6)
  assert.equal(report.byTurnReason.find(item => item.reason === 'aborted').count, 1)
})

test('empty input renders without throwing', () => {
  const report = buildReport([], { root: 'x' })
  assert.equal(report.totals.steps, 0)
  const html = renderHtmlReport(report)
  assert.match(html, /暂无数据/)
})

test('html report is self-contained and carries the key sections', () => {
  const view = fixtureView()
  const report = buildReport([{ sessionId: 'fixture-session', cwd: 'E:\\fixture', view }], { root: 'E:\\program\\DeepSeek\\.dsh\\sessions' })
  const html = renderHtmlReport(report)
  assert.match(html, /^<!doctype html>/)
  assert.match(html, /无效动作占比时序/)
  assert.match(html, /每日浪费 token/)
  assert.match(html, /路径\/文件不存在/)
  assert.match(html, /工具错误率/)
  assert.match(html, /口径/)
  assert.doesNotMatch(html, /<script/)
  assert.doesNotMatch(html, /https?:\/\//)
})

test('text report summarizes totals', () => {
  const view = fixtureView()
  const report = buildReport([{ sessionId: 'fixture-session', cwd: 'E:\\fixture', view }], { root: 'x' })
  const text = renderTextReport(report)
  assert.match(text, /1 会话 \/ 7 步/)
  assert.match(text, /无效步 6（85.7%）/)
})

test('lineChart emits an svg with tooltips', () => {
  const svg = lineChart([{ label: '11-10', value: 20 }, { label: '11-11', value: 40 }])
  assert.match(svg, /^<svg/)
  assert.match(svg, /<title>11-11 · 40<\/title>/)
})
