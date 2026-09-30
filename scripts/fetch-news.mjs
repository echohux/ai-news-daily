// 云计算舆情每日抓取脚本
// 流程：拉取多个 RSS/Atom 源 -> 清洗/去重 -> 关键词分类 -> 摘要 -> 生成当日概览 -> 写 public/data/news.json
// 用法：node scripts/fetch-news.mjs   （可配合 cron 每天定时执行）
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DOMAINS, SOURCES, KNOWLEDGE_POINTS } from './sources.mjs'
import { parseFeed, classify, summarize, parseDate, hostOf } from './lib.mjs'
import { llmDailyOverview } from './llm.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'data')
const OUT_FILE = join(OUT_DIR, 'news.json')
const TIMEOUT_MS = 12000
const DAILY_LIMIT = 20
// 今日热点：从当日入选新闻中精选的最重磅条目（对齐舆情日报「今日热点🔥」板块）
const HOTSPOT_LIMIT = 4
// 深度聚焦：摘要最长的深度报道条数（对齐舆情日报「深度聚焦🔍」板块）
const DEEPDIVE_LIMIT = 4
// 对齐云计算舆情日报：只收中文标题且命中云计算舆情主题词的报道（AI大模型/云计算/宏观经贸/服务器部件），摘要无中文时不展示。
const TOPIC_TITLE = /云计算|云服务|公有云|私有云|混合云|云原生|云厂商|阿里云|腾讯云|华为云|百度智能云|天翼云|AWS|Azure|谷歌云|甲骨文|数据中心|算力|智算|IDC|SaaS|PaaS|IaaS|服务器|芯片|半导体|GPU|CPU|台积电|英伟达|NVIDIA|存储|内存|封装|晶圆|超节点|光模块|大模型|AI|人工智能|GPT|LLM|DeepSeek|Claude|Gemini|Qwen|OpenAI|文心|通义|豆包|智能体|机器人|关税|经贸|出口管制|制裁|美联储|反垄断|宏观/i
const HAS_CHINESE = /[\u4e00-\u9fff]/

async function fetchSource(src) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(src.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ai-news-daily/0.1 (+rss aggregator)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const items = parseFeed(xml).map((it) => ({ ...it, source: src.name, weight: src.weight, hint: src.hint }))
    console.log(`[ok] ${src.name}: ${items.length} 条`)
    return items
  } catch (err) {
    console.warn(`[skip] ${src.name}: ${err.message}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** 标题归一化：去空白/标点/Google 来源后缀，用于相似度比对。 */
function normTitle(t) {
  return t
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[|｜].*$/, '')
    .replace(/[-–_—·,，。.！!?？:：()（）【】\[\]"'']/g, '')
}

/** bigram Jaccard 相似度，用于识别不同源抓到的同一条新闻。 */
function titleSimilarity(a, b) {
  if (!a || !b) return 0
  const A = new Set()
  const B = new Set()
  for (let i = 0; i < a.length - 1; i++) A.add(a.slice(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) B.add(b.slice(i, i + 2))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return (2 * inter) / (A.size + B.size)
}

function dedupe(items) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    const key = (it.link || it.title).toLowerCase().replace(/[#?].*$/, '')
    const nt = normTitle(it.title)
    const similar = out.some((o) => {
      const on = normTitle(o.title)
      return (
        on === nt ||
        (nt.length >= 12 && on.length >= 12 && titleSimilarity(on, nt) >= 0.75)
      )
    })
    if (seen.has(key) || similar) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

/** 从文章页提取描述性简介：优先 og:description / description，其次正文首段。 */
function pickPageDescription(html) {
  const re = /<meta[^>]+>/gi
  let m
  while ((m = re.exec(html))) {
    const tag = m[0]
    if (!/(?:name|property)\s*=\s*["'](?:og:description|description)["']/i.test(tag)) continue
    const c = tag.match(/content\s*=\s*["']([^"']+)["']/i)
    if (c && c[1].trim().length >= 30) return c[1]
  }
  const p = html.match(/<p[^>]*>([^<]{40,300})<\/p>/i)
  return p && p[1] && !/版权|copyright|©/i.test(p[1]) ? p[1] : ''
}

/** 抓取文章正文页，返回可概括内容的中文简介（约 140 字）；失败返回空串。 */
async function fetchArticleSummary(url) {
  if (!url || !/^https?:\/\//.test(url)) return ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    if (!html || html.length > 800000) return ''
    const text = pickPageDescription(html)
    return text && HAS_CHINESE.test(text) ? summarize(text, 140) : ''
  } catch {
    return ''
  }
}

function buildArticles(rawItems) {
  const now = Date.now()
  const cutoff = now - 1000 * 60 * 60 * 72 // 保留近 72 小时
  return dedupe(rawItems)
    .filter((it) => HAS_CHINESE.test(it.title) && TOPIC_TITLE.test(it.title))
    .map((it) => {
      const date = parseDate(it.rawDate)
      const text = `${it.title} ${it.summary}`
      const domain = classify(text, it.hint)
      return {
        title: it.title,
        link: it.link,
        source: it.source,
        host: hostOf(it.link),
        domain,
        summary: HAS_CHINESE.test(it.summary) ? summarize(it.summary) : '',
        publishedAt: date ? date.toISOString() : null,
        ts: date ? date.getTime() : now,
        weight: it.weight || 1,
      }
    })
    .filter((a) => a.ts >= cutoff || a.publishedAt === null)
    .sort((a, b) => b.ts - a.ts || b.weight - a.weight)
}

/** 每个有新闻的栏目先取一条，再按发布时间补足到每日上限。 */
function selectDailyArticles(articles) {
  const selected = []
  const picked = new Set()
  for (const domain of DOMAINS) {
    const article = articles.find((item) => item.domain === domain.id)
    if (article && selected.length < DAILY_LIMIT) {
      selected.push(article)
      picked.add(article)
    }
  }
  for (const article of articles) {
    if (selected.length >= DAILY_LIMIT) break
    if (!picked.has(article)) selected.push(article)
  }
  return selected.sort((a, b) => b.ts - a.ts || b.weight - a.weight)
}

/** 今日热点：按来源权重 + 发布时间精选，对齐舆情日报的「今日热点🔥」。 */
function selectHotspots(articles) {
  return [...articles]
    .sort((a, b) => b.weight - a.weight || b.ts - a.ts)
    .slice(0, HOTSPOT_LIMIT)
}

/** 深度聚焦：从其余新闻里挑摘要信息量最大的深度报道，对齐「深度聚焦🔍」。 */
function selectDeepdives(articles, hotspots) {
  const exclude = new Set(hotspots)
  return articles
    .filter((a) => !exclude.has(a) && a.summary.length >= 60)
    .sort((a, b) => b.summary.length - a.summary.length || b.ts - a.ts)
    .slice(0, DEEPDIVE_LIMIT)
}

/** 每天一个知识点：从当日入选新闻中统计术语关键词命中数，选命中最多的术语。 */
function selectKnowledgePoint(articles) {
  let best = null
  let bestHits = 0
  for (const kp of KNOWLEDGE_POINTS) {
    let hits = 0
    for (const a of articles) {
      const text = `${a.title} ${a.summary}`.toLowerCase()
      if (kp.keywords.some((kw) => text.includes(kw))) hits += 1
    }
    if (hits > bestHits) {
      bestHits = hits
      best = kp
    }
  }
  if (best) return { term: best.term, explanation: best.explanation, analogy: best.analogy }
  // 兜底：当日无术语命中时，按文章领域分布选一个最相关术语，保证「每天一个知识点」常驻
  const domCount = {}
  for (const a of articles) domCount[a.domain] = (domCount[a.domain] || 0) + 1
  const topDomain = Object.entries(domCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  const DOMAIN_TERM = { hardware: 'HBM（高带宽内存）', ai: 'RAG（检索增强生成）', cloud: '智算中心（AIDC）' }
  const fallback = KNOWLEDGE_POINTS.find((kp) => kp.term === DOMAIN_TERM[topDomain]) || KNOWLEDGE_POINTS[0]
  return { term: fallback.term, explanation: fallback.explanation, analogy: fallback.analogy }
}

/** 根据最终选中的新闻分组（exclude：已在热点/深度聚焦展示的文章，避免跨版块重复）。 */
function groupByDomain(articles, exclude = new Set()) {
  return DOMAINS.map((d) => {
    const list = articles.filter((a) => a.domain === d.id && !exclude.has(a))
    return { id: d.id, name: d.name, color: d.color, count: list.length, articles: list }
  }).filter((g) => g.count > 0)
}

async function loadPreviousSeed() {
  try {
    const prev = JSON.parse(await readFile(OUT_FILE, 'utf-8'))
    if (prev?.groups?.length) return prev
  } catch {
    /* 首次运行无历史文件 */
  }
  return null
}

async function main() {
  console.log('开始抓取云计算舆情新闻源…')
  const results = await Promise.allSettled(SOURCES.map(fetchSource))
  const raw = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

  if (raw.length === 0) {
    console.warn('所有源均抓取失败（可能是网络限制）。保留已有 news.json 作为兜底。')
    const prev = await loadPreviousSeed()
    if (prev) {
      const articles = selectDailyArticles(
        prev.groups.flatMap((group) => group.articles)
          // 旧版数据的 domain 可能已不在新 DOMAINS 中，重新按当前领域词典分类
          .map((article) => ({ ...article, domain: classify(`${article.title} ${article.summary}`) }))
          .filter((article) => HAS_CHINESE.test(article.title) && TOPIC_TITLE.test(article.title))
          .sort((a, b) => b.ts - a.ts || b.weight - a.weight),
      )
      if (!articles.length) {
        console.warn('历史内容非中文报道，保留旧文件并退出失败，避免覆盖成空日报。')
        process.exitCode = 1
        return
      }
      const hotspots = selectHotspots(articles)
      const deepdives = selectDeepdives(articles, hotspots)
      const knowledgePoint = selectKnowledgePoint(articles)
      const groups = groupByDomain(articles, new Set([...hotspots, ...deepdives]))
      await writeFile(OUT_FILE, JSON.stringify({
        ...prev,
        total: articles.length,
        overview: buildRuleOverview(groups, articles),
        hotspots,
        deepdives,
        knowledgePoint,
        groups,
      }, null, 2), 'utf-8')
      console.log(`已保留上次成功抓取的数据，按每日上限保留 ${articles.length} 条。`)
      return
    }
    console.warn('无历史数据，写入空壳，前端将展示空状态。')
  }

  const articles = selectDailyArticles(buildArticles(raw))
  if (!articles.length && raw.length > 0) {
    console.warn('本次没有符合条件的中文舆情报道，保留旧文件并退出失败。')
    process.exitCode = 1
    return
  }
  const hotspots = selectHotspots(articles)
  // 热点简介增强：RSS 摘要过短时，尝试抓取文章页的描述作为简介
  for (const hot of hotspots) {
    if ((hot.summary || '').length < 40) {
      const s = await fetchArticleSummary(hot.link)
      if (s) hot.summary = s
    }
  }
  const deepdives = selectDeepdives(articles, hotspots)
  const knowledgePoint = selectKnowledgePoint(articles)
  // 快讯栏目排除已在「热点」「深度聚焦」展示的文章，避免跨版块重复
  const groups = groupByDomain(articles, new Set([...hotspots, ...deepdives]))
  const headlines = articles.map((a) => ({
    title: a.title,
    domainName: DOMAINS.find((d) => d.id === a.domain)?.name || a.domain,
  }))

  const overview =
    (await llmDailyOverview(headlines)) ||
    buildRuleOverview(groups, articles)

  const payload = {
    generatedAt: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    total: articles.length,
    sources: SOURCES.map((s) => s.name),
    overview,
    hotspots,
    deepdives,
    knowledgePoint,
    domains: DOMAINS.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    groups,
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`完成：${articles.length} 条，${groups.length} 个栏目，热点 ${hotspots.length} 条，深度 ${deepdives.length} 条 -> ${OUT_FILE}`)
}

function buildRuleOverview(groups, articles) {
  if (!articles.length) return '今日暂未抓取到新的云计算舆情要闻，请稍后刷新或检查数据源。'
  const top = groups
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((g) => `${g.name}（${g.count} 条）`)
    .join('、')
  return `本期共收录 ${articles.length} 条 AI 领域舆情要闻，覆盖 ${groups.length} 个栏目，主要集中在 ${top}。`
}

main().catch((err) => {
  console.error('抓取失败：', err)
  process.exitCode = 1
})
