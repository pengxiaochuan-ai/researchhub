# B08 独立总评审：Request changes

## 批准后的作者修补结果（原评审保留）

用户批准后四Important已完成一次最小作者修补与免费验证：[技术交接](../../testing/article-ai-b08-remediation-2026-11-04.md)。296契约组件＋20PG/build与真实两账号Chrome通过；下方原“接受，未修”为修补前评审快照，不冒称新的独立签认。旧两份回答／包未改，本轮0Provider，AC07仍未通过／未签认；不能由代码关闭反推原文字已合格。

日期：2026-11-04。用户当前请求：推进B08独立总评审，并核对两份解读的专业质量。本轮完成**一次独立只读代码总评审＋主审逐结论支持度核对**；未执行修补、模型重跑或发布。评审已完成不等于B08修补交接闭环完成。

## 1. 范围和结论

- 目录 `/Users/mac/aisciencesys/researchhub`，分支 `codex/ui-ue-validation`，HEAD `190f509d127b833a9380dfdf52916f20038b6f9c`。实际评审对象为当前工作树B02–B07文件（包括未跟踪新文件），不是只评HEAD。保留全部无关变更，不切worktree／commit／push。
- 独立评审者：原生子Agent `/root/b08_independent_review`，fresh context、单次整片只读，不再次派分文件评审；主审保留集成与专业判断。本机无Paseo编排偏好文件，使用原生编排，不安装／修改配置。
- **独立原结论：Request changes，0 Critical、4 Important、0格式类Minor。** 未发现确定的越权／跨篇混入／重复收费绕过；不是安全性穷尽证明。
- 主审复核四项均成立；其中正文映射缺陷已由主审独立匿名GET＋同SHA原件重放确认。未把候选建议当已修复，不把测试全绿当专业验收。
- [逐结论专业核对](../../testing/article-ai-b08-professional-review-2026-11-04.md)：病例报告不通过；综述仅能作初步导航，不能作为针刺推荐依据的合格解读。**AC07未通过／未签认，B08不得关闭。**

## 2. 独立发现及作者裁定

| 编号 | 等级 | 精确位置 | 复现／实际影响 | 作者裁定 |
| --- | --- | --- | --- | --- |
| I01 | Important / P1 | `server/hub-sources/article-evidence.mjs:38`（43–45） | JATS引文 `(5)` 对保存body `( 5 )`，精确匹配失败后丢段。病例33段仅20命中；综述72段仅6命中，针刺5段全漏 | 接受，未修。需要确定性展开／可验证offset映射及显式映射失败，不猜位置 |
| I02 | Important / P1 | `server/hub-sources/article-evidence.mjs:70`（72） | 摘要在 `depressive symptoms rem` 截断；原句仍有残余症状。表格也在行／单词中截断 | 接受，未修。限额内保完整句／表头与行，明确不完整片，禁止从残句推断 |
| I03 | Important / P2 | `server/hub-sources/article-evidence.mjs:58`（59–65） | 不识别Case/Clinical assessment、Intervention protocol、Clinical course and outcomes等；仅首Discussion，Highlights占位，关键局限缺失 | 接受，未修。受控文章类型／章节别名、父节角色及局限优先，不扩向量底座 |
| I04 | Important / P1 | `scripts/local-knowledge-ai.mjs:133`、`:154`；`scripts/knowledge-ai-contract.mjs:23` | 单篇只沿旧数值token／编号检查，owner实际由LLM重述PSQI数字，未落实批准的定性分工 | 接受，未修。单篇专用输出守门与免费反例，数值留确定性事实区；旧科研内核不改 |

修复兼容约束：`article-evidence.mjs:90`及`:123`起使用当前构建器重建完整包，直接替换算法会使两份已有回答失效。先设计policy版本及历史验证：保留v1原回答／原pack，不补造新历史，不因兼容而取消当前授权、审核撤回及原件换版重验。

## 3. 独立评审保留的可靠部分

QueryPlan概念AND／词形OR、禁用／否定／未知约束回退与精确标识；工作簿分页前SQL过滤、PMC原20候选边界及统一稳定分页／签名cursor；单篇四字段绑定、逐片重建、Provider前后／提交锁内／历史来源重验；只GET进入／恢复、原key与hash、不用旧回答冒充新终态；目的费用许可、原账本prefix与次数限制均有相应实现。

排除的初步疑点：Hub工具轨迹未显式列queryPlan，但旧Orchestrator确将工具 `res.meta` 收入 `provenance.knowledgeActions`，因此查询词／词表版本有持久落点，不列缺陷。没有为凑数加入风格重构或扩大共享底座建议。

## 4. 本轮验证与未判定范围

### 独立评审者实际运行

纯测试 `search-query-plan`、`article-evidence`、`hub-agent-contract`、`article-ai-session` 共31/31通过；只读重放两份JATS到当前公开body的匹配；复核B07门禁封存15个代码hash与当前全部一致。未写文件／创建任务／调用Provider。独立评审者未重跑PG／浏览器／构建，不冒称执行了主审的命令。

### 主审本轮新执行

- `node scripts/article-ai-gates.mjs`：282契约／组件＋19真实PG、build／diff及原来源／角色／会话任务计数／账本／旧核心源码保全通过。[结果](../../testing/evidence/article-ai-gates-bcab08f8-9555-4624-946a-c7f8b322bda6/result.json)。历史authVersion=0／初始未审夹具不在本门禁内，原披露保持。
- `node scripts/article-ai-b07-readback.mjs docs/testing/evidence/article-ai-real-b07-8264b496-4382-4391-bf5f-b00db15c7924`：两账号1440／390真实Chrome，16/28、安全Markdown、未发草稿、刷新及同版原文回链、原key201／新key429通过，PNG／WebM留证，账本hash不变。[结果](../../testing/evidence/article-ai-b07-readback-23bcb6da-7f38-41c4-89c1-ca8a72168b67/result.json)。本脚本API明确重放旧key／验证cap拒绝，不是新Provider。
- 原始回答／原件SHA及12片textHash复验一致；匿名GET当前两篇，复现33/20和72/6及针刺五段均漏。只复核本机保存版本，不查询网站最新版本。
- 本机owned PID46562，七服务ready；未重启服务。0新Provider／新费用／权限／DDL／云／远端配置／生产发布，原请求12/12、累计保守2.012004元不变。

Declined to judge：外部指南原文、医学疗效、全站／生产环境、穷尽安全性与性能、完整无障碍／用户舒适度；不代签研究者AC07。构建、引用编号合法、工具真实执行均不能替代这些判断。

执行限制留痕：Paseo偏好文件不存在，原生编排继续；部分较宽输出命令被工具截断，后续采用限定文件／段落，截断输出不作“全部源码已读”的依据。没有因此重置或清理工作树。

最终[免费保全收据](b08-free-audit-2026-11-04.json)：门禁封存15个代码hash与最终全部一致，91笔账本保持／全部known，保守累计2.012004元、预留0。[Notion同步回读](b08-notion-sync.json)覆盖两份新报告与9份既有产品／计划文档，旧内容和子页未被替换。

## 5. 建议的最小修补边界（待确认，不是本轮实施）

本轮是评审请求，且修补涉及证据策略／输出契约及历史兼容，按范围规则停在最小方案，不直接修改代码或历史。

1. 确认证据policy版本和v1历史读取保持；原绑定／授权／撤回／换版检查不变。
2. 用两份同SHA原件先建免费失败例：xref／内联映射、病例章节／父节、完整句／表行、真正局限、针刺专节覆盖。保持6片／每片1200／总6000及字节／费用上限，不新增服务／表／权限。
3. 最小修正构建器／单篇定性输出守门，RED→GREEN；不得依靠修改来源、缩减反例或改写历史回答求绿。科学数值只在确定性原文事实区展示；若需新增可见UI内容，须先列差异并确认，不能默认为布局变更授权。
4. 重跑相关契约、真实PG和两账号浏览器／历史兼容；不再用付费自动重试证明修复。代码修补仅可宣称免费技术验证。
5. 原12次调用额度已尽。免费技术通过后如需两份新真实解读，另行确认请求次数／有效价格／原5元余量，再做专业验收，不把旧输出回放当新模型实际效果。

建议免费修补评估4–6有效工时，先核原8h缓冲已消耗量；若超过原32h总范围停下复估。等待用户／价格／模型验收单列，不折算成Agent墙钟节省或保证11月中旬全部交付。11/06全一期复估保留，不自动转入其他页面／底座工作。
