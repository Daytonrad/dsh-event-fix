/**
 * Error taxonomy for DSH session events.
 *
 * The taxonomy is intentionally small: it only covers the error forms that are
 * visible, unambiguous and attributable to a single step. Anything subtle
 * (model quality, prompt regressions, "the agent went the wrong direction")
 * is out of scope — this plugin is a side branch of the event log, not a judge
 * of intent.
 */

/** Step-level invalid kinds. */
export const STEP_KINDS = [
  { id: 'tool-error', label: '工具报错', hint: '工具结果 isError=true（message 级或 part 级都算）' },
  { id: 'llm-retry', label: '模型重试', hint: '同一 step 内发生 llm/retry' },
  { id: 'repeated-call', label: '重复调用', hint: '与本会话早前调用同名同参' },
  { id: 'empty-step', label: '空步', hint: '一步既无文本也无工具调用' },
  { id: 'approval-rejected', label: '审批被拒', hint: 'approval/decided 结果为 rejected/cancelled' },
  { id: 'command-error', label: '命令失败', hint: 'shell 结果出现 [exit code: 非0]，或 command/done kind=error' },
  { id: 'turn-aborted', label: '轮次中断', hint: 'turn/end 非 completed，归因到该轮最后一步' },
]

export const STEP_KIND_IDS = STEP_KINDS.map(item => item.id)
export const STEP_KIND_LABELS = Object.fromEntries(STEP_KINDS.map(item => [item.id, item.label]))

/** Tool-error classes, matched in order; first match wins. */
export const ERROR_CLASSES = [
  {
    id: 'path-missing',
    label: '路径/文件不存在',
    patterns: [
      /IO error for operation/i,
      /系统找不到指定的文件/,
      /no such file or directory/i,
      /os error 2\b/i,
      /\bENOENT\b/,
      /cannot find (the )?path/i,
      /does not exist/i,
      /\bENOTDIR\b/,
    ],
  },
  {
    id: 'permission-denied',
    label: '权限 / 沙箱拒绝',
    patterns: [
      /SetNamedSecurityInfoW/i,
      /Win32 \(\d+\)/,
      /permission denied/i,
      /\bEACCES\b/,
      /\bEPERM\b/,
      /rejected escalating/i,
      /denied by (policy|permission)/i,
      /sandbox (denied|blocked|violation)/i,
    ],
  },
  {
    id: 'auth',
    label: '鉴权 / 密钥失效',
    patterns: [
      /HTTP 40[13]\b/,
      /invalid_api_key/i,
      /authentication fails/i,
      /unauthorized/i,
      /api key[^\n]{0,40}invalid/i,
    ],
  },
  {
    id: 'rate-limit',
    label: '限流 / 配额',
    patterns: [/HTTP 429\b/, /rate[ _-]?limit/i, /too many requests/i, /quota exceeded/i],
  },
  {
    id: 'timeout',
    label: '超时',
    patterns: [/timed out/i, /\btimeout\b/i, /\bETIMEDOUT\b/, /DEADLINE_EXCEEDED/],
  },
  {
    id: 'network',
    label: '网络 / 连接失败',
    patterns: [
      /fetch failed/i,
      /connection error/i,
      /socket hang up/i,
      /\bECONNRESET\b/,
      /\bECONNREFUSED\b/,
      /\bENOTFOUND\b/,
      /\bEAI_AGAIN\b/,
      /network error/i,
    ],
  },
  {
    id: 'redirect',
    label: '跨域重定向',
    patterns: [/cross-origin redirect/i, /redirect[^\n]{0,30}not followed/i],
  },
  {
    id: 'unsupported-content',
    label: '内容类型不支持',
    patterns: [/unsupported content type/i, /unsupported (file|media) type/i, /application\/pdf/i],
  },
  {
    id: 'limit',
    label: '限制触发（深度/预算/上下文）',
    patterns: [/exceeds maxDepth/i, /max(imum)? ?depth/i, /budget (exceeded|limit)/i, /context (window|length)[^\n]{0,20}(exceed|full)/i],
  },
  {
    id: 'tool-usage',
    label: '调用方式错误',
    patterns: [
      /has not been read/i,
      /cannot modify/i,
      /must read (the )?file/i,
      /invalid argument/i,
      /invalid_argument/i,
      /missing required/i,
      /unexpected token/i,
      /is not valid JSON/i,
      /unknown (tool|parameter|field)/i,
    ],
  },
  {
    id: 'interrupted',
    label: '执行被中断',
    patterns: [/tool call was interrupted/i, /interrupted after it was recorded/i, /aborted/i],
  },
  {
    id: 'not-found',
    label: '未找到 / 无匹配',
    patterns: [/no matches found/i, /not found/i, /0 results/i],
  },
  {
    id: 'exit-code',
    label: '退出码非 0',
    patterns: [/\[exit code: [1-9]\d*\]/i],
  },
]

const OTHER_CLASS = { id: 'other', label: '其他' }
const CLASS_BY_ID = new Map([...ERROR_CLASSES, OTHER_CLASS].map(item => [item.id, item]))

export function classLabel(id) {
  return CLASS_BY_ID.get(id)?.label ?? id
}

/**
 * Classify one tool error message.
 * @param {string} text
 * @returns {string} class id
 */
export function classifyToolError(text) {
  const value = String(text ?? '')
  if (value.trim() === '') return 'other'
  const head = value.slice(0, 4000)
  for (const item of ERROR_CLASSES) {
    for (const pattern of item.patterns) {
      if (pattern.test(head)) return item.id
    }
  }
  return 'other'
}

/**
 * Stable identity for one tool call, used to detect repeated work.
 * Argument key order and whitespace are normalised; volatile ids are dropped.
 */
export function callSignature(name, args) {
  return `${name}#${normalizeArgs(args)}`
}

export function normalizeArgs(args) {
  if (args === undefined || args === null) return ''
  let parsed = args
  if (typeof args === 'string') {
    const text = args.trim()
    if (text === '') return ''
    try {
      parsed = JSON.parse(text)
    } catch {
      return text.replace(/\s+/gu, ' ')
    }
  }
  try {
    return JSON.stringify(sortJson(parsed))
  } catch {
    return String(args)
  }
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(item => sortJson(item))
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      if (key === 'id' || key === 'callId') continue
      out[key] = sortJson(value[key])
    }
    return out
  }
  return value
}

/** First line of an error message, clipped for display and storage. */
export function errorSnippet(text, limit = 160) {
  const first = String(text ?? '')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .find(line => line !== '') ?? ''
  return first.length > limit ? `${first.slice(0, limit)}…` : first
}
