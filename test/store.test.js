import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { decompressAll, listSessionFiles, parseSince, readSessionRecords } from '../src/session-store.js'
import { buildFixtureRecords } from './fixtures.js'

function writeSession(root, workspace, sessionId, frames) {
  const dir = join(root, workspace, sessionId)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'session.v4.jsonl.zstd')
  const chunks = frames.map(frame => zlib.zstdCompressSync(Buffer.from(frame, 'utf8')))
  writeFileSync(file, Buffer.concat(chunks))
  return file
}

test('reads concatenated zstd frames and skips truncated lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-event-fix-'))
  try {
    const records = buildFixtureRecords()
    const lines = records.map(record => JSON.stringify(record))
    const half = Math.floor(lines.length / 2)
    const frameA = `${lines.slice(0, half).join('\n')}\n`
    const frameB = `${lines.slice(half).join('\n')}\n{"type":"tool/c`
    writeSession(root, '--E-fixture--', 'session-1', [frameA, frameB])

    const files = listSessionFiles(root)
    assert.equal(files.length, 1)
    assert.equal(files[0].sessionId, 'session-1')
    assert.equal(files[0].workspace, 'E-fixture')

    const decoded = readSessionRecords(files[0].file)
    assert.equal(decoded.length, records.length)
    assert.equal(decoded[0].type, 'session')
    assert.equal(decoded.at(-1).type, 'turn/end')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('decompressAll keeps every frame', () => {
  const buffer = Buffer.concat([
    zlib.zstdCompressSync(Buffer.from('a\n')),
    zlib.zstdCompressSync(Buffer.from('b\n')),
  ])
  assert.deepEqual(decompressAll(buffer), ['a\n', 'b\n'])
})

test('parseSince understands relative and absolute dates', () => {
  const now = Date.parse('2026-11-17T00:00:00.000Z')
  assert.equal(parseSince('7d', now), now - 7 * 86400000)
  assert.equal(parseSince('2h', now), now - 2 * 3600000)
  assert.equal(parseSince('2026-11-01', now), Date.parse('2026-11-01'))
  assert.equal(parseSince(undefined, now), null)
  assert.throws(() => parseSince('nope', now))
})
