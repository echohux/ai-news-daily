// 云计算舆情日报 · 领域定义 + RSS 源 + 关键词分类词典
// 栏目结构对齐内网「云计算舆情日报」（PublicOpinions）的舆情快讯四大栏目：
// AI大模型 / 云计算行业 / 宏观经济与国际关系 / 服务器和核心部件。
// 前后端共享的领域元信息也从这里派生（构建时写入 news.json）。

/** 领域定义：id / 中文名 / 主题色 / 关键词（用于自动分类，命中即加分） */
export const DOMAINS = [
  {
    id: 'ai',
    name: 'AI大模型',
    color: '#1677ff',
    keywords: [
      'llm', 'gpt', 'chatgpt', 'claude', 'gemini', 'qwen', 'deepseek', 'ernie',
      '文心', '通义', '豆包', 'openai', 'anthropic', 'minimax', 'kimi', 'copilot',
      '大模型', '语言模型', '智能体', 'agent', '多模态', '生成式', 'ai', '人工智能',
    ],
  },
  {
    id: 'cloud',
    name: '云计算行业',
    color: '#13c2c2',
    keywords: [
      '云计算', '云服务', '公有云', '私有云', '混合云', '云原生', '云厂商',
      '阿里云', '腾讯云', '华为云', '百度智能云', '天翼云', '移动云', '金山云',
      'aws', 'azure', '谷歌云', '甲骨文', 'oracle', '云区域', '上云',
      'saas', 'paas', 'iaas', '数据中心', 'idc', '智算中心', '云安全',
    ],
  },
  {
    id: 'macro',
    name: '宏观经济与国际关系',
    color: '#f5222d',
    keywords: [
      '宏观经济', '国际关系', '关税', '经贸', '出口管制', '制裁', '实体清单',
      '美联储', '加息', '降息', '通胀', '汇率', '反垄断', '地缘', '商务部', '工信部',
      '中美', '资本开支', 'ipo', '招股书',
    ],
  },
  {
    id: 'hardware',
    name: '服务器和核心部件',
    color: '#fa8c16',
    keywords: [
      '服务器', '芯片', '半导体', 'gpu', 'cpu', 'npu', 'tpu', '台积电', '英伟达',
      'nvidia', 'amd', '英特尔', 'intel', '存储', '内存', 'ddr', 'hbm', '封装',
      '晶圆', '算力', '超节点', '交换机', '光模块', '整机柜',
    ],
  },
]

export const DEFAULT_DOMAIN = 'cloud'

/**
 * 「每天一个知识点💡」术语库：按当天新闻标题/摘要中关键词命中次数选出当日术语，
 * 展示官方解释与类比（对齐舆情日报的每日知识点板块）。无命中时返回 null。
 */
export const KNOWLEDGE_POINTS = [
  {
    term: '智算中心（AIDC）',
    keywords: ['智算中心', 'aidc', 'ai数据中心', '人工智能计算中心'],
    explanation: '智算中心是以 AI 算力为核心的基础设施，采用 GPU/NPU 等加速芯片组成大规模计算集群，面向大模型训练、推理等高算力场景提供算力服务。',
    analogy: '像"AI 专属发电厂"：普通数据中心像家用电网，通吃所有负载；智算中心则是专为 AI 高压电器（大模型）设计的高压专线电厂，电流更猛、负荷更聚焦。',
  },
  {
    term: 'HBM（高带宽内存）',
    keywords: ['hbm', '高带宽内存'],
    explanation: 'HBM（High Bandwidth Memory）通过 TSV 硅通孔将多层 DRAM 芯片垂直堆叠并与 GPU 封装在一起，大幅提升带宽、降低功耗，是 AI 加速卡的标配内存。',
    analogy: '像给 GPU 配了"立式共享储物柜"：普通内存像隔墙分家的宿舍，取东西要绕路；HBM 把柜子立起来紧贴 GPU，取用距离短、吞吐量大增。',
  },
  {
    term: 'CoWoS（2.5D 先进封装）',
    keywords: ['cowos', '先进封装', 'chiplet', 'chiplet互连', '2.5d'],
    explanation: 'CoWoS 是台积电的 2.5D 封装工艺，将多颗芯片（如 GPU 与 HBM）通过中介层（Interposer）实现高密度互连，是 AI 芯片产能的关键瓶颈之一。',
    analogy: '像把多栋独立楼房（芯片）重新设计成"共享裙楼+连廊"（中介层），既保持各自独立，又让人员（数据）在楼间便捷穿梭。',
  },
  {
    term: '超节点（SuperPod）',
    keywords: ['超节点', 'superpod', 'supernode'],
    explanation: '超节点指以高速互连将大量加速卡（如数千张 GPU）组成单一计算池的集群形态，提供远超单机柜的算力密度，是当前大模型训推的主流基础设施。',
    analogy: '把单台服务器比作"小卖部"，超节点就是"超级市场"：把数千个柜台用高速传送带连成一体，规模效应带来压倒性的吞吐能力。',
  },
  {
    term: '光模块（Optical Module）',
    keywords: ['光模块', '光互联', '光互连', '光引擎', '光模块市场'],
    explanation: '光模块负责电-光信号转换，是数据中心内部与集群间高速互连的核心器件；大模型训练对互连带宽的需求推动 800G/1.6T 光模块放量。',
    analogy: '像数据中心的"快递干线"：电信号只能在"市内跑"（板卡内），出城就要换成光信号"走高速"，光模块就是那个搭车转运的快递分拨中心。',
  },
  {
    term: '玻璃基板（Glass Substrate）',
    keywords: ['玻璃基板', '玻璃载板'],
    explanation: '玻璃基板用玻璃替代传统有机基板，平面度好、热膨胀系数低、可承载更细线宽，被视作后摩尔时代先进封装与芯片互连的下一代基材。',
    analogy: '把芯片封装从"纸板拼装"升级为"钢化玻璃拼接"：更平整、更耐磨、更不容易受热变形，承载的线路可以更密更深。',
  },
  {
    term: '液冷（Liquid Cooling）',
    keywords: ['液冷', '冷板', '浸没式', '液冷服务器'],
    explanation: '液冷利用液体比热容高的特性，通过冷板或浸没方式带走芯片热量，比风冷散热效率更高、更安静，成为高功耗 AI 服务器的标配散热方案。',
    analogy: '风冷像给电脑"扇扇子"，液冷像给芯片"泡冰水澡"：水温不烫手，热量被水流持续带走，机器可以更稳定地满负荷奔跑。',
  },
  {
    term: 'RAG（检索增强生成）',
    keywords: ['rag', '检索增强'],
    explanation: 'RAG 先检索外部知识库再交由大模型生成答案，让模型在推理时"查资料再作答"，可在不重训模型的情况下注入私有知识、降低幻觉。',
    analogy: '像开卷考试的"资料夹"：模型不再死记硬背，而是考试时先翻指定资料再下笔，答得准、还能随时更新资料内容。',
  },
  {
    term: 'ASIC（专用芯片）',
    keywords: ['asic', '自研芯片', '推理芯片'],
    explanation: 'ASIC 是针对特定任务定制的专用集成电路，相比通用 GPU 在特定算法上能效比更高，云厂商自研 AI 芯片（如 TPU、自研 NPU）多属此类。',
    analogy: 'GPU 像"多功能厨师"，什么菜都能炒；ASIC 像"拉面专营店"，只做拉面但速度和口感都拉满。',
  },
  {
    term: '模型蒸馏（Distillation）',
    keywords: ['蒸馏', '知识蒸馏'],
    explanation: '模型蒸馏让一个小模型（学生）学习大模型（老师）的输出分布，用更小体积保留大部分能力，是降低推理成本、实现模型轻量化的常用手段。',
    analogy: '大模型像"满汉全席"，蒸馏就是"浓缩高汤"：去掉大厨的架子，只取精华汤汁，冲水就能复刻八九成的味道。',
  },
]

/**
 * RSS / Atom 源列表，对齐云计算舆情日报的常用信源（华尔街见闻、IT之家、36氪、虎嗅等），
 * 并补充 Google 新闻中文关键词检索源，按栏目定向供稿。
 * hint：该源自带领域倾向，参与分类加权；weight 越高，同日内排序越靠前。
 * 抓取失败的源会被跳过（Promise.allSettled），不影响整体产出。
 */
export const SOURCES = [
  { name: '华尔街见闻', url: 'https://dedicated.wallstreetcn.com/rss.xml', weight: 4, hint: 'macro' },
  { name: '界面新闻', url: 'https://a.jiemian.com/index.php?m=article&a=rss', weight: 4 },
  { name: '量子位', url: 'https://www.qbitai.com/feed', weight: 4, hint: 'ai' },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/', weight: 3 },
  { name: '36氪', url: 'https://www.36kr.com/feed', weight: 3 },
  { name: '虎嗅', url: 'https://www.huxiu.com/rss/0.xml', weight: 3 },
  { name: '观察者网', url: 'https://www.guancha.cn/rss/default.xml', weight: 2, hint: 'macro' },
  { name: 'Google 新闻·云计算（中文）', url: 'https://news.google.com/rss/search?q=云计算+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', weight: 3, hint: 'cloud' },
  { name: 'Google 新闻·云厂商（中文）', url: 'https://news.google.com/rss/search?q=阿里云+OR+腾讯云+OR+华为云+OR+百度智能云+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', weight: 3, hint: 'cloud' },
  { name: 'Google 新闻·数据中心与算力（中文）', url: 'https://news.google.com/rss/search?q=数据中心+OR+算力+OR+服务器+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', weight: 3, hint: 'hardware' },
  { name: 'Google 新闻·芯片半导体（中文）', url: 'https://news.google.com/rss/search?q=芯片+OR+半导体+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', weight: 2, hint: 'hardware' },
  { name: 'Google 新闻·AI大模型（中文）', url: 'https://news.google.com/rss/search?q=大模型+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', weight: 2, hint: 'ai' },
  { name: 'Google 新闻·国际经贸（中文）', url: 'https://news.google.com/rss/search?q=关税+OR+经贸+OR+出口管制+when:2d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', weight: 2, hint: 'macro' },
]
