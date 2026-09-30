// 可插拔的 LLM 摘要钩子。
// 默认关闭：不设置环境变量时返回 null，主流程回退到规则式摘要。
// 启用方式（兼容 OpenAI 风格 /chat/completions 接口，如文心一言兼容网关、OpenAI 等）：
//   export LLM_BASE_URL="https://your-gateway/v1"
//   export LLM_API_KEY="sk-..."
//   export LLM_MODEL="gpt-4o-mini"   # 可选
export function llmEnabled() {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL)
}

/**
 * 用 LLM 为「当日概览」生成一段中文总结。
 * @param {Array<{title:string, domainName:string}>} headlines
 * @returns {Promise<string|null>}
 */
export async function llmDailyOverview(headlines) {
  if (!llmEnabled()) return null
  const base = process.env.LLM_BASE_URL.replace(/\/$/, '')
  const model = process.env.LLM_MODEL || 'gpt-4o-mini'
  const list = headlines
    .slice(0, 30)
    .map((h, i) => `${i + 1}. [${h.domainName}] ${h.title}`)
    .join('\n')
  const prompt =
    '你是一名云计算行业舆情分析师。根据下面今天的云计算与AI要闻标题，用中文写一段 3-4 句话的「今日概览」总结，' +
    '突出最重要的趋势与事件，不要逐条罗列，不要编造标题中没有的信息。\n\n' + list

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    const data = await res.json()
    return data?.choices?.[0]?.message?.content?.trim() || null
  } catch (err) {
    console.warn(`[llm] 概览生成失败，回退规则式摘要：${err.message}`)
    return null
  }
}
