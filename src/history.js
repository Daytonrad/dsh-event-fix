/**
 * Historical baseline for the settings page.
 *
 * Replays the newest session logs once at startup, then yields to the event
 * loop between batches so a first page request is never blocked behind a
 * multi-second scan. Live sessions keep updating their own state from
 * `session/event`, so the baseline is only a floor, never the final word.
 */
import { applyRecord, createSessionState } from './analyzer.js'
import { listSessionFiles, readSessionRecords, resolveSessionsRoot } from './session-store.js'

/**
 * @param {{root?: string, limit?: number, onProgress?: (done: number, total: number) => void}} options
 * @returns {Promise<{states: Array<{sessionId: string, cwd: string, state: object, mtime: number}>, root: string, total: number, skipped: number}>}
 */
export async function loadHistoricalStates(options = {}) {
  const root = resolveSessionsRoot(options.root)
  const limit = Number.isSafeInteger(options.limit) && options.limit > 0 ? options.limit : 150
  const files = listSessionFiles(root).slice(0, limit)
  const states = []
  let skipped = 0
  let done = 0

  for (const file of files) {
    try {
      const records = readSessionRecords(file.file)
      const header = records.find(record => record.type === 'session') ?? {}
      let state = createSessionState({
        id: header.id ?? file.sessionId,
        cwd: header.cwd,
        origin: header.origin,
        createdAt: header.createdAt,
      })
      for (const record of records) state = applyRecord(state, record)
      states.push({ sessionId: file.sessionId, cwd: header.cwd ?? '', state, mtime: file.mtime })
    } catch {
      skipped += 1
    }
    done += 1
    if (done % 12 === 0) {
      options.onProgress?.(done, files.length)
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  return { states, root, total: files.length, skipped }
}
