// 轻量 RSS/Atom 解析 + 文本清洗 + 领域分类 + 摘要工具（零依赖）。
import { DOMAINS, DEFAULT_DOMAIN } from './sources.mjs'

/** 去掉 HTML 标签、解码常见实体、压缩空白。 */
export function stripHtml(input = '') {
  return String(input)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

function firstMatch(block, tags) {
  for (const tag of tags) {
    // 支持 <tag ...>...</tag>
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
    const m = block.match(re)
    if (m) return m[1]
    // 支持自闭合 <tag href="..."/>（如 Atom 的 <link href=.../>）
    const reSelf = new RegExp(`<${tag}(?:\\s[^>]*?)?/?>`, 'i')
    const ms = block.match(reSelf)
    if (ms && /href\s*=/.test(ms[0])) {
      const href = ms[0].match(/href\s*=\s*["']([^"']+)["']/i)
      if (href) return href[1]
    }
  }
  return ''
}

/** 解析一段 RSS 或 Atom XML，返回原始条目数组。 */
export function parseFeed(xml) {
  const items = []
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) || []
  for (const block of blocks) {
    const title = stripHtml(firstMatch(block, ['title']))
    let link = firstMatch(block, ['link'])
    if (/^<|href/i.test(link) || !/^https?:/i.test(link)) {
      const href = block.match(/<link[^>]*href\s*=\s*["']([^"']+)["']/i)
      if (href) link = href[1]
    }
    link = stripHtml(link)
    const rawDate = firstMatch(block, ['pubDate', 'published', 'updated', 'dc:date'])
    const summary = stripHtml(firstMatch(block, ['description', 'summary', 'content']))
    if (!title) continue
    items.push({ title, link, summary, rawDate: stripHtml(rawDate) })
  }
  return items
}

/** 依据标题+摘要做关键词打分分类；命中最多的领域胜出。 */
export function classify(text, hint) {
  const low = text.toLowerCase()
  let best = null
  let bestScore = 0
  for (const d of DOMAINS) {
    let score = 0
    for (const kw of d.keywords) {
      if (low.includes(kw.toLowerCase())) score += 1
    }
    if (hint === d.id) score += 1.5 // 源自带的领域倾向作为加权
    if (score > bestScore) {
      bestScore = score
      best = d.id
    }
  }
  return best || DEFAULT_DOMAIN
}

/** 抽取式摘要：优先取前 2 句，控制在 maxLen 字符内。 */
export function summarize(text, maxLen = 160) {
  const clean = stripHtml(text)
  if (!clean) return ''
  const sentences = clean.split(/(?<=[。.!?！？])\s+/).filter(Boolean)
  let out = ''
  for (const s of sentences) {
    if ((out + s).length > maxLen && out) break
    out += (out ? ' ' : '') + s
    if (out.length >= maxLen) break
  }
  if (out.length > maxLen) out = out.slice(0, maxLen).trimEnd() + '…'
  return out
}

export function parseDate(raw) {
  if (!raw) return null
  const t = Date.parse(raw)
  return Number.isNaN(t) ? null : new Date(t)
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
