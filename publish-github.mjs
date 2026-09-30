// AI信息日报 · GitHub Pages 发布器（零第三方依赖）
// 流程：抓取 -> 渲染单文件 HTML -> 推送到 GitHub 仓库 -> 开启/确认 Pages -> 校验公网可访问
// 用法：node publish-github.mjs
// 鉴权：优先读环境变量 GITHUB_TOKEN，否则读同目录 github-token.txt
// 仓库：环境变量 GITHUB_REPO（默认 echohux/ai-news-daily），发布到 main 分支根目录
import { readFileSync, writeFileSync, existsSync, rmSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(ROOT, 'template')
const DATA_FILE = join(ROOT, 'public', 'data', 'news.json')
const WORK_DIR = join(ROOT, 'gitrepo')
const REPO = process.env.GITHUB_REPO || 'echohux/ai-news-daily'
const BRANCH = 'main'
const PAGE_URL = `https://${REPO.split('/')[0]}.github.io/${REPO.split('/')[1]}/`

function readToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  const f = join(ROOT, 'github-token.txt')
  if (existsSync(f)) return readFileSync(f, 'utf8').trim()
  throw new Error('未找到 GITHUB_TOKEN 环境变量或 github-token.txt')
}

const TOKEN = readToken()
const TOKEN_FILE = join(ROOT, 'github-token.txt')
const ASKPASS = join(ROOT, 'git-askpass.sh')
writeFileSync(
  ASKPASS,
  `#!/bin/sh\ncase "$1" in\n  *Username*) echo "x-access-token" ;;\n  *) { [ -n "$GITHUB_TOKEN" ] && echo "$GITHUB_TOKEN" || cat ${TOKEN_FILE} ; } 2>/dev/null ;;\nesac\n`
)
chmodSync(ASKPASS, 0o700)

function runFetch() {
  console.log('[1/6] 抓取舆情新闻…')
  execFileSync('node', [join(ROOT, 'scripts', 'fetch-news.mjs')], { cwd: ROOT, stdio: 'inherit' })
}

function renderSingleFile(dataJson) {
  console.log('[2/6] 渲染单文件 HTML…')
  const indexHtml = readFileSync(join(TEMPLATE_DIR, 'index.html'), 'utf8')
  const jsName = indexHtml.match(/src="\/assets\/([^"]+\.js)"/)[1]
  const cssName = indexHtml.match(/href="\/assets\/([^"]+\.css)"/)[1]
  const jsFile = readFileSync(join(TEMPLATE_DIR, 'assets', jsName), 'utf8')
  const cssFile = readFileSync(join(TEMPLATE_DIR, 'assets', cssName), 'utf8')
  const favicon = readFileSync(join(TEMPLATE_DIR, 'favicon.svg'), 'utf8')

  let html = indexHtml
  html = html.replace(
    /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/,
    (m) => `<style>\n${cssFile.replace(/<\//g, '<\\/')}\n</style>`
  )
  html = html.replace(
    /<script type="module"[^>]*src="\/assets\/[^"]+\.js"[^>]*><\/script>/,
    (m) => `<script type="module">\n${jsFile.replace(/<\//g, '<\\/')}\n</script>`
  )
  const dataInline = `<script>window.__NEWS_DATA__ = ${dataJson.replace(/<\//g, '<\\/')};</script>`
  html = html.replace('</head>', `${dataInline}\n  </head>`)
  const faviconData = `data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}`
  html = html.replace(/href="\/favicon\.svg"/, `href="${faviconData}"`)
  return html
}

function git(args, cwd = WORK_DIR) {
  // 通过 GIT_ASKPASS 提供凭证，token 不进入命令行参数与 URL
  execFileSync('git', args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, GIT_ASKPASS: ASKPASS, GIT_TERMINAL_PROMPT: '0' },
  })
}

async function api(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  })
  return res
}

async function ensurePages() {
  console.log('[4/6] 检查 GitHub Pages…')
  const res = await api(`/repos/${REPO}/pages`)
  if (res.status === 404) {
    console.log('      未开启，正在创建（source: main/root）…')
    const created = await api(`/repos/${REPO}/pages`, {
      method: 'POST',
      body: JSON.stringify({ source: { branch: BRANCH, path: '/' } }),
    })
    if (!created.ok) throw new Error(`开启 Pages 失败: ${await created.text()}`)
  } else if (!res.ok) {
    throw new Error(`查询 Pages 失败: ${await res.text()}`)
  } else {
    console.log('      已开启，保持不变')
  }
}

async function verifyPublic() {
  console.log('[5/6] 校验公网可访问性…')
  for (let i = 0; i < 12; i++) {
    try {
      const res = await fetch(PAGE_URL, { redirect: 'follow' })
      if (res.ok) {
        console.log(`      可访问：${PAGE_URL} (HTTP ${res.status})`)
        return
      }
    } catch {
      /* 重试 */
    }
    await new Promise((r) => setTimeout(r, 10000))
  }
  console.warn(`      警告：10 分钟内未检测到可访问，请稍后手动打开 ${PAGE_URL}`)
}

async function main() {
  runFetch()
  const dataRaw = readFileSync(DATA_FILE, 'utf8')
  const data = JSON.parse(dataRaw)
  const html = renderSingleFile(dataRaw)

  console.log('[3/6] 同步到 GitHub 仓库…')
  if (existsSync(WORK_DIR)) rmSync(WORK_DIR, { recursive: true, force: true })
  git(['clone', '--depth', '1', `https://github.com/${REPO}.git`, WORK_DIR], ROOT)
  writeFileSync(join(WORK_DIR, 'index.html'), html, 'utf8')

  // 提交
  git(['config', 'user.name', 'ai-news-daily'])
  git(['config', 'user.email', 'ai-news-daily@users.noreply.github.com'])
  git(['add', '-A'])
  const changed = execFileSync('git', ['status', '--porcelain'], { cwd: WORK_DIR, encoding: 'utf8' }).trim()
  if (changed) {
    git(['commit', '-m', `AI信息日报 ${data.date}（${data.total} 条）`])
    // 推送失败（如网络抖动 HTTP 408）时自动重试，最多 3 次
    let pushed = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        git(['push', 'origin', BRANCH])
        pushed = true
        break
      } catch (e) {
        console.warn(`      第 ${attempt} 次推送失败：${String(e.message || e).split('\n')[0]}，稍后重试…`)
        await new Promise((r) => setTimeout(r, 10000))
      }
    }
    if (!pushed) throw new Error('推送失败：重试 3 次仍未成功')
    console.log(`      已推送 ${data.date} 版本`)
  } else {
    console.log('      无变化，跳过推送')
  }

  await ensurePages()
  await verifyPublic()

  const md = join(ROOT, 'daily-' + data.date + '.md')
  writeFileSync(md, `# AI信息日报 ${data.date}\n\n页面地址：${PAGE_URL}\n`, 'utf8')
  console.log(`[6/6] 发布完成：${PAGE_URL}（数据 ${data.total} 条 / ${data.groups.length} 个栏目 / 热点 ${data.hotspots.length}）`)
}

main().catch((err) => {
  console.error('发布失败：', err.message || err)
  process.exit(1)
})