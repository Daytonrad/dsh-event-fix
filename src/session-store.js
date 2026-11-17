/**
 * Read DSH session logs from disk.
 *
 * A session file is a concatenation of zstd frames, each frame holding JSONL
 * records. We decode frames by scanning for the zstd magic, which tolerates
 * partially written files (the last frame may be truncated while a session is
 * still running).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import zlib from 'node:zlib'

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

export function resolveSessionsRoot(explicit) {
  if (typeof explicit === 'string' && explicit.trim() !== '') return explicit
  const fromEnv = process.env.DSH_HOME
  const candidates = []
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') candidates.push(join(fromEnv, 'sessions'))
  candidates.push(join(homedir(), '.dsh', 'sessions'))
  candidates.push('E:\\program\\DeepSeek\\.dsh\\sessions')
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) return candidate
    } catch {
      // keep looking
    }
  }
  return candidates[0]
}

function pickLatest(files) {
  let best = null
  for (const file of files) {
    if (!file.endsWith('.jsonl.zstd')) continue
    const version = Number(/v(\d+)/u.exec(basename(file))?.[1] ?? 0)
    let mtime = 0
    try {
      mtime = statSync(file).mtimeMs
    } catch {
      continue
    }
    if (best === null || version > best.version) best = { file, version, mtime }
  }
  return best
}

/**
 * List every session log under a sessions root.
 * Layout: <root>/<workspace-slug>/<session-id>/session.vN.jsonl.zstd
 */
export function listSessionFiles(root) {
  const out = []
  let workspaces = []
  try {
    workspaces = readdirSync(root, { withFileTypes: true })
  } catch (error) {
    throw new Error(`dsh-event-fix: cannot read sessions root ${root}: ${error.message}`)
  }
  for (const workspace of workspaces) {
    if (!workspace.isDirectory()) continue
    const workspaceDir = join(root, workspace.name)
    let sessions = []
    try {
      sessions = readdirSync(workspaceDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue
      const sessionDir = join(workspaceDir, session.name)
      let files = []
      try {
        files = readdirSync(sessionDir).map(name => join(sessionDir, name))
      } catch {
        continue
      }
      const best = pickLatest(files)
      if (best === null) continue
      out.push({
        workspace: workspace.name.replace(/^-+|-+$/gu, ''),
        sessionId: session.name,
        file: best.file,
        mtime: best.mtime,
        bytes: statSync(best.file).size,
        version: best.version,
      })
    }
  }
  out.sort((a, b) => b.mtime - a.mtime)
  return out
}

/** Decode one session log into its record list. */
export function readSessionRecords(file) {
  const buffer = readFileSync(file)
  const texts = decompressAll(buffer)
  const records = []
  for (const text of texts) {
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      try {
        records.push(JSON.parse(line))
      } catch {
        // A truncated trailing line is expected while a session is live.
      }
    }
  }
  return records
}

/** Decode every zstd frame in a buffer into UTF-8 strings. */
export function decompressAll(buffer) {
  if (typeof zlib.zstdDecompressSync !== 'function') {
    throw new Error('dsh-event-fix: this Node.js build has no zstd support (need ^22.19 or >=24)')
  }
  const texts = []
  let offset = 0
  for (;;) {
    const at = buffer.indexOf(ZSTD_MAGIC, offset)
    if (at < 0) break
    offset = at + 4
    try {
      texts.push(zlib.zstdDecompressSync(buffer.subarray(at)).toString('utf8'))
    } catch {
      // Truncated or corrupt frame: skip it and keep scanning.
    }
  }
  if (texts.length === 0) {
    try {
      texts.push(zlib.zstdDecompressSync(buffer).toString('utf8'))
    } catch (error) {
      throw new Error(`dsh-event-fix: session log is not readable zstd: ${error.message}`)
    }
  }
  return texts
}

/** Optional ISO cutoff parser: `7d`, `24h`, `2026-11-01`. */
export function parseSince(value, now = Date.now()) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const text = String(value).trim()
  const relative = /^(\d+)\s*([dhw])$/u.exec(text)
  if (relative !== null) {
    const amount = Number(relative[1])
    const unitMs = relative[2] === 'd' ? 86400000 : relative[2] === 'h' ? 3600000 : 604800000
    return now - amount * unitMs
  }
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) throw new Error(`dsh-event-fix: cannot parse --since ${text}`)
  return parsed
}
