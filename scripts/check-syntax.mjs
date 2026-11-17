/**
 * Syntax check every shipped module without executing it.
 *
 * `node --check` parses ESM according to the package "type" field, which is
 * exactly what we want: it catches typos and unclosed braces without needing a
 * browser (src/client.js) or a DSH host (src/index.js).
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['src', 'bin', 'test', 'scripts']

function walk(dir, out = []) {
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(full, out)
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      out.push(full)
    }
  }
  return out
}

const files = ROOTS.flatMap(root => walk(root)).filter(file => statSync(file).isFile()).sort()
let failed = 0
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed += 1
    process.stdout.write(`FAIL ${relative(process.cwd(), file)}\n${result.stderr}\n`)
  }
}
process.stdout.write(`${files.length - failed}/${files.length} files parsed\n`)
if (failed > 0) process.exitCode = 1
