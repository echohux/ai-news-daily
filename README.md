# AI News Daily

> 让分散资讯成为可追溯的每日简报。

![Node.js](https://img.shields.io/badge/Node.js-0F766E?style=flat-square) ![RSS / Atom](https://img.shields.io/badge/RSS_/_Atom-0F766E?style=flat-square) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-0F766E?style=flat-square)

**在线体验：** [打开产品](https://echohux.github.io/ai-news-daily/) · [验收与迭代记录](./docs/EVALUATION.md)

![AI News Daily 项目封面](./docs/assets/readme-cover.svg)

## 项目简介

面向持续关注 AI 与云计算的读者，把多来源资讯整理为每日概览、今日热点、深度聚焦与领域快讯。项目通过规则完成清洗、去重和分类，并提供可选的模型概览生成。

项目重点解决以下问题：

- 信息分散：统一采集多个 RSS / Atom 源，保留原文入口。
- 内容重复：按链接及归一化标题相似度去重，减少重复阅读。
- 更新成本：通过定时任务串联采集、渲染、发布和访问检查。

## 核心能力

- 按中文标题与主题关键词筛选资讯，每期最多选取 20 条。
- 按来源权重与时间选取热点，从其他条目中按摘要长度选择深度聚焦，并非模型判断报道深度。
- 保留来源链接，生成领域分类与每日知识点。
- 可选兼容接口生成每日概览，未配置或调用失败时回退规则概览。
- 单个源失败时跳过；所有源失败时尝试使用历史数据。

## 产品流程 · Pipeline

```text
RSS / Atom 来源
    ↓
并发采集与超时处理
    ↓
链接 / 标题去重 → 中文及主题筛选
    ↓
关键词分类 → 热点 / 深度聚焦 / 知识点
    ↓
可选模型概览 → 失败时回退规则
    ↓
写入 news.json → 渲染单文件 HTML
    ↓
推送 main → GitHub Pages → 公网检查
```

这是规则驱动的信息工作流。模型仅作为可选概览能力；当前没有多 Agent 协作或自动质量修复系统。

## 评测闭环

将核心任务、状态反馈与稳定性分开验收，再保留失败样例进行回归：

| 项目验收项 | 对应实际实现 |
| --- | --- |
| 资讯筛选 | 中文、主题命中、每期上限、跨栏目重复 |
| 概览与降级 | 可选 LLM 失败时回退规则，历史内容日期不冒充当天 |
| 发布 | 生成 HTML、推送结果及公网检查 |

```text
体验核心流程 → 记录实际结果 → 标注 Good / Bad / Boundary Case
      ↑                                      ↓
回归同一组用例 ← 修复并对比结果 ← 定位规则 / 数据 / 交互 / 依赖原因
```

这是本次补充的验收与迭代规范，尚未代表已经完成评测、建立自动化平台或取得量化成绩。项目专属用例与待填写记录见 [EVALUATION.md](./docs/EVALUATION.md)。

## 技术架构

- 采集与内容规则：`scripts/fetch-news.mjs`、`scripts/lib.mjs`、`scripts/sources.mjs`。
- 模型适配：`scripts/llm.mjs`，读取 `LLM_BASE_URL`、`LLM_API_KEY` 和可选 `LLM_MODEL`。
- 内容存储：`public/data/news.json`；展示模板：`template/`。
- 发布：`publish-github.mjs` 与 `.github/workflows/daily.yml`。

**技术栈：** Node.js · RSS / Atom · GitHub Actions · GitHub Pages。

## 本地运行

环境：Node.js 20+。采集脚本使用 Node 内置能力，无需安装第三方依赖。

```bash
node scripts/fetch-news.mjs
python3 -m http.server 8080
```

打开 `http://localhost:8080/` 可预览已提交的 `index.html`。仅采集会更新 JSON，不会重新渲染首页；完整发布由发布脚本完成。

## 部署

现有 Actions 计划每天北京时间 09:12 执行，也支持手动触发。定时执行可能延迟。发布脚本会写入并推送 `main`，需要有效的 `GITHUB_TOKEN` 和 Pages 权限；本地执行前应确认目标仓库 `GITHUB_REPO`。模型配置未由现有 workflow 显式传入，启用前需自行配置 Secrets 和环境变量。

## 项目结构

```text
scripts/                  # 采集、解析、分类和可选模型
template/                 # 展示模板与静态资源
public/data/news.json     # 当前简报数据
publish-github.mjs        # 渲染、推送与访问检查
.github/workflows/        # 每日发布任务
index.html                # 已生成的公开页面
```

## 产品取舍与边界

历史数据兜底不代表当天抓取成功，应结合数据日期与 Actions 日志核验。规则分类、标题相似度与模型概览都可能出错，原文是核验依据。

## 功能依据

具体代码位置、归档内路径及无法核实的范围见 [实现核查](./docs/IMPLEMENTATION.md)。

## 项目背景

项目通过 Vibe Coding 构建，产品关注点包括需求定义、任务流程、交互优先级与快速验证。本次说明文档参考 [FlowCraft AI](https://github.com/FILPPED-jin/FlowCraft-AI-Product) 的项目展示结构，按本仓库实际内容重新组织。
