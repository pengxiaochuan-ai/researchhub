# H0 领域 Hub 本机 API 与数据契约

## 2026-11-11 · C01注册/来源日期最小扩展

原public/member GET /api/hub-sources/clinical-registries兼容新增sourceUpdatedOn:string|null，从同SQL当前获准源v1 source_updated_on取值；实际DB日值与已核验清单不等或为空则null，不从metadata/常量/MIME补值。studySummary仅当前详情批准时增加registeredOn SourceField（schema2），原定位/哈希/审核引用门禁保持。详情撤审不隐藏书目更新时间，书目失效则整条隐藏。

不改通用visible、H01/C03/AI返回/检索文本，不加表/权限/提取/审核。PG反例、三身份/两member/admin预览核对及80queued/源审核AI保全通过；354前端、13后端、2原HTTP/构建有据。[规则](../product/c01-source-dates-2026-11-11.md) · [证据/边界](../testing/c01-source-dates-2026-11-11.md)。

## 2026-11-11 · C01三筛选无后端变更

本轮无新端点/参数/DTO/DDL/审核或权限。仅在原完整clinical-registries公开投影上客户端精确过滤；疾病为获准书目原值，类型/干预须studySummaryStatus=approved，未引入分类/分词/模型推断。当前固定两条完整集不是分页截断，未来接口分页后不能直接沿用当前客户端全集选项口径。

三身份实际列表/选项一致、原源/版本/提取/审核/授权及AI片段/68queued保全；347前端/13相关后端和构建通过，无服务重启/费用/发布。[当前规则](../product/c01-reviewed-filters-2026-11-11.md) · [证据](../testing/c01-reviewed-filters-2026-11-11.md)。

## 2026-11-11 · C01列表studySummary向后兼容增量

既有clinical-registries列表同SQL读取当前registryProjection，新增studySummaryStatus；仅approved附studySummary={studyType SourceField,interventions[{id,intervention SourceField}],leadInstitution? SourceField,extractionId,extractionVersion,payloadSha256,reviewVersion}。schema1不补造负责单位；无设计/结局/全文或registrationSummary扩张。最新源/提取/哈希/当前书目display与详情审核/受控ref守门复用C03。AI及旧已有字段保持，无新端点/DDL/审核/角色。

三身份真实接口与C03逐字段/hash/审核版本一致；源/提取/审核/授权及原AI片段/68queued保全。341前端/29相关后端/PG/HTTP和构建通过；独立评审Important测试污染已逐保存点反例RED→GREEN。仅专用合成本机启用，无发布。[规格](../product/c01-reviewed-study-fields-2026-11-11.md) · [验证](../testing/c01-reviewed-study-fields-2026-11-11.md)。

## 2026-11-11 · 注册元数据B恢复契约已验证

既有POST object-reviews增加可选mode=display_only，仅external/public/初始两条clinical/source1/当前有效extraction2/schema2。既有当前管理员/租户/文档锁、指纹CAS保留；只追加bibliographic display和registry detail display同evidence://hub-display/operationId/fingerprint，不写AI。有效public/tenant AI批准只允许完整当前unified public无写入返回；否则409 HUB_SOURCE_DISPLAY_AI_REVIEW_REQUIRED。不回退历史授权。新前缀读侧同ref，旧分字段接口同样禁止绕过。

review-queue可附canUpdateDisplayOnly及state=public_display（公开展示；AI未获准），仅两具名临床应用。真实G02只恢复200293两条display，202558全部原审核/AI保持；overview/C03公开两条与指标2恢复。匿名/owner/admin字段一致，完整329前端、28相关后端/真实PG/HTTP及构建/独立评审有据。原源/v1/grants/审核及原52/B前60queued保全。没有新增端点、DDL、角色、AI检索改造、费用或发布。下方“未完成”是历史。[完整证据](../testing/h01-registry-metadata-2026-11-11.md)。

## 2026-11-11 · clinicalRegistries摘要契约及未完成停止点

overview新增clinicalRegistries，只投影当前public初始临床来源；每项含原书目白名单、registrationSummaryStatus。仅最新源/最新提取hash/当前书目display/当前提取display全部有效且schema2时附registrationSummary：registeredOn、leadInstitution、registrationStatus三SourceField，researchStatus=not_reported及来源文件/快照/hash/提取和审核版本。schema1为not_extracted，未审/撤回/过期/坏hash不交付新值，换源版本不继承；C01旧列表不增加字段。新增registration排除AI搜索JSON及片段，原设计/干预/结局生成规则保持。

真实统一审核发现200293原仅display、无AI，现有public会同时新增两种用途；已追加withheld后原AI恢复但公开暂隐藏。202558新摘要正常。当前真实公开注册数1与来源状态一致，撤回前2/2 HTTP不是最终验收。只增2提取/6书目决定/3详情决定，原记录和52queued保全。待用户确认仅展示更新路径，不能用旧分字段接口绕过统一门禁，无新DDL/权限/模型/旧服务/发布。[完整契约与停止点](../product/h01-registry-metadata-2026-11-11.md) · [证据](../testing/h01-registry-metadata-2026-11-11.md)。

## 2026-11-11 · H01论文预览局部滚动（批准后本机验证）

用户已批准仅来源预览内部滚动。原6条完整题名/作者/来源与详情、目录入口均保留，来源13条、领域纳入11篇不变；不缩字。实际1421×1419下原五KPI及六内容卡片位置/尺寸全部恢复，首行359.48px；仅论文列表滚动，Tab/Home/End可用，无焦点陷阱。1045/389/358px有效视口验证末项可达、无主内容横向溢出；正文14/22、元数据13/20保持。真实200%缩放及320px未验证，不以替代尺寸冒称。

前端314、相关后端/PG11、真实HTTP5项及构建通过，独立只读总评无阻断；两账号/访客目录与论文详情导航有实际证据。仅本机专用合成环境，无新增费用/权限/后端改动或发布；加载/失败/空态由组件测试验证，本轮未做浏览器故障注入。下方“布局待确认”是批准前历史，不代表当前停止状态。

[本轮完整实测与限制](../testing/h01-source-scroll-2026-11-11.md)。

## 2026-11-11 · H01论文来源补漏（数据通过，布局待确认）

总览原仅查表格来源，已复用PMC公开投影补齐13条来源记录、最多6条预览，顶部仍11篇领域纳入；来源/审核/AI许可与权限不变。313前端、40后端、5项真实HTTP及独立代码评审通过，原28排队任务/源审核指纹保全。真实浏览器发现长题名/作者撑高三栏359→1612px、拉长地图并下推后续内容；未改CSS，拟仅论文列表卡片内滚动以保留原高度，待用户批准。当前不标页面完成、不自动切下一页。[规格与停止点](../product/h01-source-catalog-2026-11-11.md) · [实测](../testing/h01-source-catalog-2026-11-11.md)。

既有overview.reviewedSources/RecordCount组合原public表格及PMC投影，按无查询E01相同ID序最多6条，总数不按DOI/论文纳入去重；新PMC仅书目/来源版本白名单，无正文/表格/附件。未修改原E01或表格专属投影，无新端点/DDL/权限。

## 2026-11-10 · publications规则V2

用户确认两项明确情绪/睡眠次要结局研究纳入，当前value=11、pendingVisibleCount=0、excludedVisibleCount=2、case_report=2、protocol=1；ruleVersion=RH-PAPER-BROAD-2026-11-10-V2。只更改具名两项及规则版本/依据，原public投影、版本/hash/证据、强标识去重/容量守门不变，E01仍13条来源。未新增端点/DDL/权限，不修改全局scope_version草稿。下方V1的9/2/2是历史。[补充](../product/h01-publication-secondary-outcomes-2026-11-10.md) · [验证](../testing/h01-publication-secondary-outcomes-2026-11-10.md)。

## 2026-11-10 · publications广义领域纳入指标

既有overview.metrics.publications现接通9篇，不再固定null；附ruleVersion、assessmentMethod、policyAuthority、pendingVisibleCount=2（身份组）、excludedVisibleCount=2、byType及当前公开included身份/来源/版本/证据定位。DOI/PMCID严格去重，标识/题名/年份冲突待核验；当前来源许可、版本/hash/证据字段缺一不支持纳入。全局scope_version仍草稿，工程规则初筛不伪造管理员签认。PMC候选完整集≤20且无重复PMCID、工作表公开集合≤50且无游标；超界返回null/INCOMPLETE_PILOT_INDEX，不返回截断数量。无新端点/DDL/授权或旧系统更改，E01获准目录仍13条。[完整契约](../product/h01-publication-count-2026-11-10.md) · [逐篇证据](../product/h01-publication-intake-2026-11-10.md) · [验证](../testing/h01-publication-count-2026-11-10.md)。

## 2026-11-10 · H01当前公开规模

沿既有overview新增metricsCalculatedAt完成时间；五个metrics保留value/status/reason，已接数量附scope=`CURRENT_HUB_APPROVED_PUBLIC_INDEXED`、unit及basis。注册/指南复用初始5份完整公开来源投影按稳定键去重；机构/研究者复用目录public最新有效profile按主体ID，不读患者/账号数。仅返回当前公开收录子集，论文仍null/unverified_scope_or_entity。公开三身份一致，不泄露隐藏主体ID。固定租户/Hub上下文，目录共享租户读锁、2s锁超时，Hub/租户停用404，查询失败不转0，no-store。完成时间非源更新日期/全卡一致快照。无schema、权限或旧系统改动。[完整口径](../product/h01-metrics-2026-11-10.md) · [实测/历史测试边界](../testing/h01-metrics-2026-11-10.md)。

## 2026-11-10 · H01团队地图消费者

本轮未新增/修改后端API或数据库。H01原地图仅作为既有`/api/hubs/lingshu-xinyu/teams/map`及`member/teams/map`消费者，通过DirectoryClient同源GET/禁缓存/取消复用当前public/tenant门禁；未知Hub不调灵枢。新增前端DTO数量等式、坐标及位置类型校验，失败不当0结果。团队/机构口径不混，cities同名合计TOP5、regions不当城市；原数据版本/来源语义保留。核验中/不可用、身份键或Hub变化清旧结果、作废迟到响应；无写路径。[规格](../product/h01-team-map-2026-11-10.md) · [证据及未验证项](../testing/h01-team-map-2026-11-10.md)。

状态：仅 `wp01_test_full_baseline` 专用合成库启用；独立 `rh_hub` schema。不迁移或修改旧项目代码、共享公共表与旧服务。

## 数据表

- `rh_hub.hub(tenant_id, hub_key)`：主体名称、简介、启用状态和范围确认状态；部署租户固定，API 不信 URL 推导授权。
- `rh_hub.scope_version(tenant_id, hub_key, version)`：初始第 1 版为草稿，纳排条件留空且明确待专家确认；应用角色只读，不覆盖旧版。后续治理变更须新版本与单独授权。
- `rh_hub.hub_follow(tenant_id, hub_key, account_id)`：关注布尔状态及时间；与 Study 成员、治理角色完全分开。同租户账号触发器在数据库层拒绝跨租户外键组合，应用角色仅可 SELECT、INSERT 及更新关注状态和时间；关注写入同旧账号服务采用 official→tenant 授权锁后再验账号。三表均强制 RLS，以事务 `app.tenant_id` 隔离。

`server/hub/schema.sql` 不是独立可部署迁移：单独运行不会安装同租户账号触发器。仅受控执行 `node scripts/hub-schema.mjs --apply`，脚本核验专用合成库、三表与触发器后才提交；生产迁移尚未设计或授权。

## HTTP

| 方法/路径 | 响应/限制 |
| --- | --- |
| `GET /api/hubs` | 公开已启用 Hub 简表，当前仅一个。 |
| `GET /api/hubs/:hubKey` | 公开单 Hub 信息；未知/归档 404。 |
| `GET /api/hubs/:hubKey/overview` | 读取启用Hub与当前公开书目候选前6条/记录数，`sourceScopeStatus=candidate_not_screened`保留。metrics为当前公开收录注册、指南标准、机构/研究者档案数量；论文null。详见上方现行口径，不公开原始暂存或隐藏主体数量。 |
| `GET /api/hubs/:hubKey/follow` | 当前登录账号的关注布尔值；匿名 401，失效/未知 403。 |
| `PUT /api/hubs/:hubKey/follow` | `{ "followed": true|false }`，幂等；当前账号/租户/authVersion 重验，不授予 Study 成员身份。 |

来源投影复用 `rh_source` 已有 display 审核服务；`reviewedSourceRecordCount` 按当前获准行计，不等于去重论文数。不能从书目行推断临床注册、指南、机构、研究者、趋势或地理分布。H02–H04 的治理写接口、临床/指南实体、AI 范围建议均未启用，需要具名授权与权利核验。
