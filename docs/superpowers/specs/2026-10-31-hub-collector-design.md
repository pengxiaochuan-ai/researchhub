# ResearchHub 情志病领域来源定时采集项目设计（评审稿）

状态：**双路径与网页框架选型已获用户确认；平级本地项目骨架及首个 PMC 单条元数据离线适配器已实现，其余实施规格待确认。未创建真实采集任务、数据库权限或生产采集。** 2026-10-31。见[骨架实施计划](../plans/2026-10-31-collector-bootstrap.md)及[逐站核验与适配器边界](../../../../researchhub-collector/docs/source-review-2026-10-31.md)。

## 1. 意图与已知边界

为“针灸防治情志病”Hub持续发现临床注册、论文、指南与教材等可追溯的来源候选，减少人工搜集，同时让研究者最终在领域页和科研 AI 中使用**经授权且经具名审核**的资料。用户选择与 `researchhub`、`official-site`、旧 `app` 平级的**独立采集项目**，要求独立定时进程与部署；ResearchHub 或旧系统发布不得重启采集服务。采集是候选发现，不是医学结论或内容授权。

本设计与 [现有来源目录](../../product/hub-source-catalog-spec-2026-10-30.md)、[首批来源差异与顺序](../../planning/hub-initial-sources-reconciliation-2026-10-30.md)、[既有来源架构](2026-10-30-hub-source-catalog-design.md)及 ADR-0003 共同约束实施。现有两份工作簿的 **15,697 个原始行**已暂存、0 条真实审核/展示/AI；五份用户给定的外部文件已作为内部初始来源版本入库、0 条外部审核决定。新项目不能将上述“已入库”改写为“已公开”，也不能自动复签审核。旧知识库仍归私有 Study；外部资料不是自动生成的科研资产。

### 假设与待确认

- **已由用户选择**：路径 A，平级独立项目与独立部署；使用用户给定检索式为 v1 关键词库，按此前首批来源优先级推进。
- **本地骨架及离线适配器已建立，其余仍待确认**：`/Users/mac/aisciencesys/researchhub-collector/` 已为独立本地 Git/Python 项目，固定 Python 3.11+、Scrapy 2.19.0 与 APScheduler 3.11.3；Scrapling 0.5 为可选依赖。PMC OAI-PMH 仅有单条元数据 URL 构造和离线 XML 解析，无真实 HTTP 传输。尚无独立镜像/Compose、调度进程、Biopython `Bio.Entrez` 适配器或其他真实接口。选择 Python 是为后续复用成熟生物文献接口，不是另建科研 Agent。
- **用户已确认**：采集分“官网免费正式接口/许可数据集”和“获准站点网页采集”两条获取路径；网页路径采用 Scrapy 主引擎、Scrapling 按站点需要增强。两条路径共用候选、去重、版本、权利审核和 Hub 交付链。网页路径补覆盖，不代替逐站授权，也不保证仅凭框架即可取得目标数据量。见 [ADR-0005](../../decisions/0005-collector-web-framework.md)。
- **本稿建议、尚非用户确认**：采集自身只写隔离候选，不直接写 `rh_source.review_decision`、`external_review_decision`、旧知识库或 `research_artifact`；ResearchHub 服务端通过受控入库桥接候选并由管理员具名审核。其数据库角色与最小权限需要单独实施确认。
- 首轮仅专用合成环境；不接临床库、不调用付费 AI、不创建云资源、不读取远端配置、不执行真实发布。官方来源的小样本实时请求也须先完成逐站获取方式和用途核验；本设计获批并不等于批准所有站点的批量采集。

## 2. 目标、非目标与反目标

**第一技术切片（建议验收口径，待确认）**：一条可启停、可回放、可观察的定时流水线，保存 v1 检索式及编译版本；对许可明确的官方接口做少量合成/公开样本增量发现；保存来源、原始响应摘要/哈希、版本、匹配关键词、错误及游标；同一记录重复运行不重复建实体，内容更新生成新来源版本；管理员能看到待审核候选。此时若尚无实际具名审核决定，科研页面与 AI 的新内容验收仍**未通过**，不能把候选暂存称为完整交付。

**网页通道技术小步（同一双路径计划，逐站门禁）**：在首个网页来源具名获准后，以一个公开站点的小样本接入 Scrapy；有必要且经本地夹具对照后才增加 Scrapling 解析。验证网页/API 重复、页面改版误配、限速和断点恢复。若没有获准站点，网页通道保持 `blocked_rights`，首个 API 试点可单独验收，但**不能称双路径已落地**。

**第二业务切片（最终价值，非自动包含在第一切片）**：管理员对真实来源按字段、用途和受众具名审核；获准资料进入相应真实领域页面及 Hub AI 检索，并用全新样例完成来源回查、撤回和专业使用验收。所需领域页接线、来源权利与付费模型调用分别守门。若首优先站点获取权利未确认，该适配器标记 `blocked_rights`，不能以网页爬虫绕过。第一切片和第二切片是否合并为本次“完成”口径，由用户在批准本稿时确认。

**非目标**：本切片不覆盖所有网站、不承诺全网教材全文、不做机器人登录/验证码/反爬绕过、不默认抓取或再发布摘要/全文、不自动推断“临床有效”、不推断研究者身份或机构关系、不把外部文献塞入旧 Study KB、不自动转为正式科研资产、不建立第二套账号/租户系统、不改旧服务任务扫描。

**反目标**：定时任务跑了但页面/AI仍是演示数据；把“可公开访问”误认为“可再展示/供 AI 使用”；因 Hub 部署而停止采集；重复采集导致伪增长；来源撤回后缓存/向量/历史回答继续交付；宽检索命中被当成专业纳入事实。

## 3. 方案取舍与开源基础

| 路径 | 优点 | 代价/风险 | 决定 |
| --- | --- | --- | --- |
| A：平级独立采集项目 | 部署、调度、限流、故障域独立；Hub/官网发布不重启它 | 需要受控候选入库桥、独立运维与权限 | **用户已选择** |
| B：ResearchHub 内置后台定时任务 | 代码仓库和认证较少 | Hub 发布/扩容牵动任务生命周期，违背独立运行要求 | 不采用 |
| C：复用旧系统扫描任务 | 可能少写调度代码 | 干扰旧服务与共享表扫描，跨租户风险较高 | 不采用 |

开源选型核对：[`APScheduler`](https://github.com/agronholm/apscheduler) 提供成熟定时能力，3.x 官方说明**多进程不能共享 job store**，故首期只运行一个调度进程，业务幂等另由 PostgreSQL 保障；4.x 当前仍标为预发布，不作为首期生产依赖。[`Biopython Bio.Entrez`](https://github.com/biopython/biopython/blob/master/Doc/Tutorial/chapter_entrez.rst) 可复用 NCBI E-utilities 查询、XML 解析与无 Key 速率约束；需配置可联系邮箱并遵守 NCBI 使用要求。许可在引入前固定版本与 NOTICE。网页路径的**已确认选型**为 [`Scrapy`](https://github.com/scrapy/scrapy) 主爬虫，按站点需要引入 [`Scrapling`](https://github.com/D4Vinci/Scrapling) 解析增强；不直接复制第三方 spider 仓库，不引入 Airflow 等重型编排，不以绕过网站访问规则获取数据。

### 双路径与网页框架取舍（框架已确认，逐站条件待核）

1. **路径一：官方免费正式接口/许可数据集优先。** 每个来源先核对官方接口、数据集与允许用途，保存请求、响应版本、许可和限额；Scrapy 不取代 `Bio.Entrez`、PMC OAI 等来源专用适配器。网页加载时发现的内部 XHR 不自动等于官方开放 API，仍须单独核对授权与稳定性。
2. **路径二：获准网站网页采集补覆盖。** 仅在该来源没有足够的正式接口，且网站条款、`robots.txt`、字段/用途、频率及身份/访问方式均经具名审核后启用。若正式接口与网页同时覆盖同一记录，按来源稳定 ID/DOI/注册号与内容哈希生成去重候选，记录两个原始证据及冲突，不把两次抓取计作两条研究。网页路径不自动抓取付费、登录后、验证码或受限全文。
3. **网页主引擎已定为 Scrapy。** 本项目更依赖可观察的批量队列、字段管道、去重、限速、断点恢复与可复现提取，而不是“抓到页面”本身。Scrapy 的 `JOBDIR` 保存队列/重复过滤/状态；但它与业务库游标不是一回事，仍须用本项目运行账本做跨任务幂等。Scrapling 也有异步 Spider、限速和 checkpoint，因此不能说其不支持大规模爬取；其优势是内置浏览器获取和自适应解析，适合少数确实需要的页面。[Scrapy JOBDIR](https://docs.scrapy.org/en/latest/topics/jobs.html) · [Scrapling Spider 控制](https://scrapling.readthedocs.io/en/latest/spiders/advanced.html)。
4. **按需组合，而非两套全量爬虫。** Scrapling 官方提供在 Scrapy 回调中转换 `Response` 的集成方式；先用确定性 CSS/XPath 与页面结构版本解析，对改版频繁的获准页面才试用自适应定位。自适应仅作候选提取，必须用字段标签、稳定编号、日期/DOI 格式、跨字段一致性及抽样人工复核防止“错元素被成功解析”；低置信或冲突进隔离队列，不自动公开或供 AI 检索。[官方集成](https://scrapling.readthedocs.io/en/latest/integrations/scrapy.html) · [自适应定位已知误配](https://scrapling.readthedocs.io/en/latest/parsing/adaptive.html)。
5. **不把反爬能力当采集许可。** Scrapling 的 Turnstile 处理、代理轮换和 MCP 是存在的能力，但本项目首期不启用绕过、IP 轮换或 Agent 自主采集。遇到访问控制/验证码/拒绝访问即记阻断并联系来源方或改走正式接口；站点允许的公开页面也要限制请求频率。Scrapling 文档所列 `robots_txt_obey=False`、每域并发无上限、`download_delay=0` 等默认值不能直接用于本项目，需显式保守配置；Scrapy 也需在项目配置里显式核对 robots/限速开关。[Scrapling 默认值](https://scrapling.readthedocs.io/en/latest/spiders/advanced.html) · [Scrapy robots 设置](https://docs.scrapy.org/en/latest/topics/settings.html)。

选型实施效果与来源规模化须先做**一个已获准的普通静态网页站点**小样本验证：同样 20 条公开记录，记录完整率、强键准确率、误配率、请求数/429、运行与修复时间；再对一个确有动态加载且获准的站点评估是否启用 Scrapling。没有具名允许的目标站点时只做本地保存 HTML 夹具测试，不用反爬能力凑出“实跑成功”。GitHub 星数不是适用性或权限证据；两项目均为 BSD-3-Clause，具体版本与依赖在实施时固定并复核。

## 4. 关键词库与检索语义

将用户提供的原文**逐字保存**为 `v1`，并同时保存两组有序词；改词须新版本、审核、保留旧任务查询与命中结果。第一组 39 个，第二组 8 个：

```text
SU=(情志病 OR 郁证 OR 脏躁 OR 百合病 OR 梅核气 OR 惊悸 OR 怔忡 OR 不寐 OR 嗜睡 OR 癫 OR 狂 OR 癫狂 OR 卑惵 OR 怵惕 OR 烦躁 OR 怫郁 OR 狂越 OR 惊伤 OR 不得卧 OR 抑郁 OR 抑郁障碍 OR 双相情感障碍 OR 焦虑障碍 OR 强迫症 OR 恐惧症 OR 神经衰弱 OR 创伤后应激障碍 OR 躯体形式障碍 OR 睡眠障碍 OR 失眠症 OR 嗜睡症 OR 进食障碍 OR 神经性厌食 OR 神经性贪食 OR 性功能障碍 OR 进食异常 OR 入睡困难 OR 早醒 OR 暴食) AND SU=(针灸 OR 针刺 OR 电针 OR 耳针 OR 艾灸 OR 头针 OR 穴位埋线 OR 毫针)
```

`SU=` 是原检索式的字段语法，**不是各来源通用 API 语法**。每个适配器记录 `keyword_version`、`query_template_version`、发送给官方端点的精确查询、字段映射、时间窗、返回记录数与命中词。无等价主题字段的来源不得静默改成“全文任意词匹配”；需明确降级映射、抽样复核与召回局限。对“癫”“狂”“烦躁”等宽词只产**候选命中**，疾病原文与 Hub 纳入标签分开；不能因关键词命中而改写原注册疾病或认定其为抑郁症研究。指南/教材的题名、目录与全文可用范围不同，查询策略分来源显式版本化，不能强行使用同一个 `SU` 查询。

## 5. 来源顺序、获取与权利关口

| 次序 | 首期动作 | 自动化门禁 |
| --- | --- | --- |
| 0 现有两份工作簿、五份具名文件 | 只复用已有来源目录与人工审核结果，避免重导入或覆盖 | 原始快照保留；无真实审核仍不公开、不进 AI |
| 1 ChiCTR / ITMCTR 临床注册 | 优先核对官方允许的导出/API/合作获取方式、字段、频率及再展示/AI 用途；若官网正式接口不足，再单独核对网页采集条件并试点 | 未确认前 `blocked_rights`，**不以通用网页爬虫或反爬绕过批量抓**；保留注册原始疾病与 Hub 纳入依据 |
| 2 针灸指南/共识/标准 | 核对发布机构/官方目录与版本；先做元数据和官网链接候选 | WFAS/CAAM 或出版社 PDF 可见≠全文再利用许可；正文/表格/推荐意见另审 |
| 3 PMC 开放许可论文 | 官方 OAI-PMH/允许接口抓少量 DOI/PMCID 对齐样本；Crossref/PubMed 用于书目补全与标识匹配 | PMC 只对逐篇可重用许可取全文；Crossref 摘要可能受版权限制；逐字段、逐用途审核 |
| 4 教材/专著 | 书目、ISBN、版次、目录与官方链接候选 | 章节、插图、全文须逐册/权利人授权；首期不承诺自动全文 |
| 5 ClinicalTrials.gov 等补充 | 仅在前面试点稳定后单独评估 | WHO ICTRP 数据的商业用途限制先核实本产品适用性，不自动启用 |

上述顺序是**业务优先级**，非“等所有高优先源获许可后才可研究后续源”。可并行完成免费只读适配器/字段调研，但真正的自动获取逐站有独立许可开关和上限。ChiCTR/ITMCTR 自动化与 WFAS/出版社全文若无明确依据，持续为阻断状态而非伪成功。PMC 官方说明自动获取只应经其列出的服务、全文仅限有重用权的文章并要求逐篇核查许可证；Crossref 官方明确书目元数据大多可重用，但摘要版权仍归发布者/作者。[来源文档：PMC OAI](https://pmc.ncbi.nlm.nih.gov/tools/oai/) · [Crossref REST](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) · [ChiCTR 指南](https://www.chictr.org.cn/guide.html) · [WHO ICTRP 条款](https://www.who.int/tools/clinical-trials-registry-platform/network/who-data-set/downloading-records-from-the-ictrp-database)。

## 6. 独立系统边界与数据流

```text
官方 API/许可数据集 ─┐
获准站点网页（Scrapy；必要时 Scrapling 解析）─┴→ researchhub-collector: 规则版本 → 来源适配器 → 限流/校验 → 隔离候选与运行账本
  → ResearchHub 受控入库桥: 来源目录/版本/去重候选（默认不可见）
  → Hub 管理员具名权利与内容审核（字段 × 展示/AI × 受众）
  → H01/C01/E01/H06 等真实获准投影 + Hub 来源检索
  → 旧科研 Agent 的 Hub 独立会话（只读当前获准片段）
```

采集项目部署独立，不引用 ResearchHub 进程内模块、旧系统运行时、旧科研 Agent 或旧后台队列。共享 PostgreSQL 实例/数据库与 ADR-0003 相容，但采集只用**新隔离 schema 与最小角色**；不把现有 `rh_source.import_batch` 当通用网络批次（其 `file_name/sheet_name/row_number>=2` 明确为工作簿契约），也不把当前只支持三类文件和 PDF/MHTML 的 `external_document_version` 直接塞入网页/API 响应。ResearchHub 只从桥接后的当前获准投影向用户/AI交付。桥接故障时采集可继续在自有候选区落账并重试；**不能**在 Hub 服务不可用时绕过审核直写公开表。若共库长期不可用，则采集明确失败/暂停，不能声称完全无故障耦合。

### 建议的最小物理模型（待后续 DDL 评审）

新 `rh_harvest` schema：

- `keyword_set`：`version`、原检索式、两组词 JSON、hash、状态/启用时间；v1 不覆盖。
- `source_policy`：来源键、官方端点/网页域名与条款快照 URL/版本、逐路径 `api|web` 允许范围、字段/用途范围、审批人、robots 核验、频率/速率/日上限、`enabled`；无审批不可网络执行。
- `harvest_rule`：租户、Hub、来源、关键词版本、查询模板版本、时区/cron、回溯窗口、单次上限、状态。
- `harvest_run`：规则/窗口/任务幂等键、认领者/租约、开始结束、请求与返回计数、cursor 前后、状态、错误摘要、运行配置 hash；保留失败及手动重试记录。
- `source_candidate` + `candidate_version`：来源稳定键、获取路径 `api|web`、原始 URL、抓取时间、HTTP ETag/Last-Modified（如有）、原响应受控快照哈希/存储引用、解析器/规则版本、规范字段、匹配词、校验错误、内容 hash、版本。原始响应与导出不可由应用普通角色直读。跨路径/跨源同 DOI/PMID/PMCID/注册号/标准号/ISBN 只生成**去重候选关系**，不静默覆盖或合并。
- `hub_delivery`：候选版本→ResearchHub 入库对象/版本的幂等映射与回执，记录接口/桥接版本；无审核决定字段。

所有业务行带 `tenant_id`、`hub_key`；无 `BYPASSRLS`，用当前事务设置租户上下文并以真实父对象约束。唯一键至少覆盖 `(tenant_id, hub_key, source_key, external_key, content_hash)` 和 `(rule_id, window_start, window_end, query_version)`；具体键、RLS、索引、只增迁移与既有 15,697 行保全由下一阶段 DDL 评审确定。任何新 DB 角色/GRANT、Hub API 写入口或现有表扩展均属于**新增权限/范围关口**，须单独取得用户确认后实施。

### 权限与状态

`due → claimed → running → staged`；失败分 `retryable_failed / permanent_failed / blocked_rights / paused`。同一时窗只一个有效认领，租约超时可重新认领；外部响应未知是否成功时先查幂等键/版本，不自动重复投递。游标仅在整页/整窗口成功入库后推进；回溯窗口用于捕捉变更而非增加公开计数。源端撤稿、条款变更或管理员撤回时，候选证据保留审计，当前公开/AI 读取即时阻断并使索引失效；不删除历史审计，不交付已撤回正文。

网络侧只访问逐站白名单 HTTPS 正式端点或已批准网页域名/路径，明确 `User-Agent`/联系邮箱、robots 与条款核验、超时、最大响应体、分页与每域速率；429/5xx 有界退避及熔断，4xx/条款/验证码转人工阻断，不代理、不绕过、不连续重试。个人电话/邮箱、非公开 Protocol/知情同意书及敏感患者数据不进入公开候选字段。采集项目不持有模型密钥；解析与关键词匹配确定性执行，LLM 不计算临床/统计数值，也不补造缺失内容。

## 7. 目标工程结构、命令与风格（当前仅骨架）

```text
researchhub-collector/             # 与 researchhub 平级，独立仓库/镜像/Compose
  collector/config/                 # 只读来源政策、关键词版本、运行配置
  collector/sources/                # 每来源正式接口或获准网页适配器，不重复建业务模型
  collector/normalize/              # 确定性字段规范、强键与候选匹配
  collector/storage/                # RLS 事务、运行账本、版本与幂等
  collector/delivery/               # 受控 Hub 候选桥接，不写审核决定
  migrations/                       # 仅本项目追加式 DDL，先评审
  tests/unit/  tests/integration/  tests/contract/
  docs/  ops/                       # 来源矩阵、运维、独立部署与回滚
```

当前本地骨架只有 `uv run hub-collector validate-config config/sources.json`、`uv run python -m unittest discover -s tests -v` 和 `uv run scrapy list` 可执行；默认 0 来源、0 spider、0 调度任务。`dry-run`、`run-once`、真实适配器、候选数据库与 Hub 桥均为**未来实施**，不能因骨架存在而宣称已可采集。上图是后续目标结构，当前包位于 `src/hub_collector/`，并预留 `sources/api/` 与 `sources/web/` 空目录。独立 Compose 名称、镜像/存储前缀与运行目录须和 `researchhub`、`official-site`、`aisci` 均不同；新云资源、真实云部署和远端 `.env` 访问另批。生产容器不公开业务端口，私有健康/状态可由本机/内网探测；Hub发布脚本不能操作本项目镜像或 Compose。

编码风格示例（展示契约，不是实现）：

```python
def stable_candidate_key(tenant_id: str, hub_key: str, source_key: str, external_id: str) -> tuple[str, str, str, str]:
    if not all((tenant_id, hub_key, source_key, external_id.strip())):
        raise ValueError("missing source identity")
    return tenant_id, hub_key, source_key, external_id.strip()
```

类型标注、具名错误、纯规范化函数；网络获取、库事务、投递分层。外部字段不可信，拒绝异常大小/格式，不静默填空；日志脱敏，不含密钥、患者资料或受版权保护正文。

## 8. 验收、证据与首期最小切片

1. **代码契约**：v1 原文及 39+8 词可复算；每来源 query 编译有固定 golden；无等价字段时显式降级/阻断；来源解析、强键去重、更新新版本、错误行、游标与停线反例有单元/契约测试。网页路径另有本地 HTML 改版、错元素、自适应误配、API/网页重复与字段冲突夹具；误配不得进入可审核的规范字段。
2. **目标环境配置**：仅专用合成 PG、独立进程与配置；新 schema/角色权限核对，跨租户 RLS、无权候选/原文不可读；无历史行/旧任务变动。定时任务确实启用时才称“已配置”，`dry-run` 不算启用。
3. **真实请求执行**：选一个已确认允许的官方接口，用全新非患者公开样例保存实际查询、URL、响应时间/状态、来源版本、内容/哈希、运行账本、重跑/变更/429/崩溃恢复；若来源站点未授权，明确记 `blocked_rights`，不伪称真实采集通过。验证 Hub/官网本机服务重启不停止采集进程，采集自身重启不重复入库。
4. **业务可用性**：管理员看候选、权利证据与审核状态；研究者只在真实 E01/C01/H06 等已接通页看到获准字段，可回原站及版本；Hub AI 只引用当前允许的片段，撤审/失权后不再交付。若相应领域页或真实获准源尚未具备，逐项标“未验”，不能以测试全绿宣称完整验收。需要新增页面、审核授权或付费模型时另批。

最小先做 **单调度器＋一个合规官方 API 小样本适配器＋隔离候选/版本/运行账本＋Hub 管理候选桥接**，然后接 **一个获准网页站点的小样本**，两者共用候选链。**建议**在 ChiCTR/ITMCTR 自动获取条件待核实期间，以 PMC 官方接口的一篇逐篇核准可重用许可论文验证书目＋许可元数据与全文版本链；它只是技术试点，不改变临床注册和指南的业务优先级。所有来源默认关闭；管理员按来源/字段/用途审核后才进入现有公开投影和 AI。粗估 API 第一技术切片 **4–6 个工作日**；获准的普通静态网页小样本 **再约 2–3 个工作日**，动态站点须另估；第二业务切片再约 **3–5 个工作日**（以前者接口可用、具名权利依据和页面范围已确认、模型调用另获授权为前提）。上述均为设计估算，来源许可等待与专业验收不计入纯实施时长；11 月中旬目标下不应承诺“所有首批站点全自动全文”。

## 9. 实施前必须明确的关口

1. 用户确认本稿的隔离候选区＋ResearchHub 审核桥、Python 3.x 单实例调度，并明确第一技术切片或两切片合并才算本轮完成；建议先以一篇逐篇核准可重用许可的 PMC 开放全文做真实流水线试点。项目目录/独立仓库名称若有偏好一并定稿。
2. Hub 管理员具名确认每个首批来源的正式接口或网页路径、条款/robots 版本、可采字段、展示/AI 权利、日量与联系邮箱；需指定一个已获准的网页试点站点。没有确认的路径保留阻断状态。
3. 新 schema/最小 DB 角色与 ResearchHub 候选入库接口的权限、只增迁移及 RLS 测试计划单独评审；不复用高权限旧连接串。
4. 若首批要证明 AI 基于**新抓取**内容回答，需有真实获准来源、当前模型报价/费用授权及专业验收；既有 5 元额度或历史技术接线不自动授权新调用。
5. 真实云发布、云资源/OSS 前缀、远端密钥访问和生产停线/回滚单独确认；本稿不授权执行。

## 10. 记录与依据

本稿只选择系统边界和可验收最小切片，不代替后续逐步实施计划、DDL、来源法务/专业判断。官方依据：[ITMCTR 公告](https://itmctr.ccebtcm.org.cn/zh/news-09.html)、[ChiCTR 指南](https://www.chictr.org.cn/guide.html)、[PMC OAI-PMH](https://pmc.ncbi.nlm.nih.gov/tools/oai/)、[Crossref REST](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)、[WHO ICTRP 条款](https://www.who.int/tools/clinical-trials-registry-platform/network/who-data-set/downloading-records-from-the-ictrp-database)、[APScheduler 3.x FAQ](https://apscheduler.readthedocs.io/en/3.x/faq.html)、[Biopython Entrez 文档](https://github.com/biopython/biopython/blob/master/Doc/Tutorial/chapter_entrez.rst)。这些页面/许可实施时须重新核对有效版本；“官网可访问”与“授权本平台自动获取/再展示/AI 使用”分别判断。
