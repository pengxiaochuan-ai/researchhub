# 单篇AI v2：选片、定性输出及历史兼容

## 2026-11-06 · 单篇AI三档处理（现行）

按用户批准改为确定性修复、内容局部标注、控制面必须停止。新任务固定rh-article-response.v3，术语/年份/研究计数核对应原文；未核实测量或计算不作为结论交付，不再因一个数字令整篇失败。无有效段/不可解析协议仍明确未交付。任务字段绑定策略，提交/刷新重建回执，越权/来源撤回/版本不匹配/篡改仍阻断；旧v1/v2结果、失败、预留和账本不回写。原四段阅读区/16px字号、角色及业务Token链不改，无新计算服务。见[简短矩阵](../product/article-response-matrix-2026-11-06.md)与[技术交接及专业边界](../testing/article-response-matrix-2026-11-06.md)。本节覆盖下方历史整篇数字拒绝规则，不表示通用语义核验或生产发布。

## 2026-11-05 · 输出数值来源契约更新

本节覆盖下方旧“禁止全部科学数值”。输入proof改rh-article-model-input.v2并带numericPolicyVersion/numericFactsHash；四段对象新增可选numericFactIds，后端重建同包完整上下文、限制所属片段、渲染转义引用，并将articleNumericEvidence写入新回答provenance。提交与历史重验receipt，旧答案不重新解释。自由数值仍拒绝、表格语境未完整建模时不开放；[现行规格](../product/article-numeric-evidence-2026-11-05.md)与[本机验证](../testing/article-numeric-evidence-2026-11-05.md)。 首个有限随访语法仅支持完整肯定限制句并保守拒绝整段明确别文/否定语境，不是通用数值语义判断。最新本机304纯测/21真实PG/build及同次独立复核通过，新任务cmw3r2i130004lu1m730c225r真实交付2项原文依据、5224 Tokens按原业务结算；两次新失败与全部旧预留保留，专业验收仍由用户确认。

## 2026-11-04 · Provider二次裁切已在单篇局部修复

[完整输入／结果契约](article-ai-complete-input-2026-11-04.md)及[真实续行／专业限制](../testing/article-ai-input-repair-2026-11-04.md)：实际6片与封存包逐字一致，保存消息与片段hash；原内核4000字符策略不改。四段JSON由后端核来源／数值／推荐级别后渲染原阅读区，不改历史。最后补的缺推荐强度门禁仅免费回放，新真实综述专业仍不通过，病例无新成功产物；14次已用尽，不宣称当前最新门禁已取得两份合格模型回答。

## 2026-11-04 · 已授权继续修补的局部契约

用户明确同类问题无需重复确认，按[本轮清单](../planning/bilingual-article-ai-2026-11-02/b08-input-repair-2026-11-04.md)在Hub单篇适配器构建完整模型消息，原内核策略保持。模型输出为researchType／observations／limitations／relevance四个对象，每个仅text与fragmentIds；后端校验定性与真实片段选择，再渲染原阅读区Markdown和来源编号。无JSON自动修复／重试，不增加原14请求／20任务／5元。实际输入proof与包逐片一致性须在Provider参数层测试及真实trace举证，未完成前不称缺口已修。

## 2026-11-04 · 真实输入二次裁切缺口（未修）

[获批真实复验](../testing/article-ai-b08-rerun-2026-11-04.md)发现旧Orchestrator的compactKbEvidence对工具结果限4000字符，v2封存6片并不等于Provider实际收到6完整片。病例本次只有前三完整、第四前缀，末两片未输入；输出因科学数值拒绝，未交付。下文的“完整”只证明选择／封存／重建层，不据此声称模型消息层已完整。下一建议在Hub单篇适配器恢复严格有界完整消息并前置逐片验真，不修改旧内核全局策略；本轮未实施，付费已暂停。

2026-11-04，依据已批准B08最小修补。本机专用合成环境；不新增表、接口路径、权限、依赖、模型请求或旧内核修改。固定范围仍为当前获准同篇、原两账号／当前Study。不是全文阅读、指南原文独立核验或专业效果签认。

## 策略与历史

`buildArticleEvidencePack(item,reading,{policyVersion})`新任务默认`rh-article-evidence-v2`；v1原算法原样保留为历史验证分支，未知policy拒绝。四字段ArticleBinding、`hub-article:v1:`会话键保持：会话键版本不等于证据策略版本，无旧Session迁移。`loadArticleEvidence`与`assertCurrentArticleEvidence`按封存policy重建，再完整比较数组／内容／定位／哈希／审核；当前授权、撤回、换版和提交锁均保留。

原两份v1回答／Job payload／provenance不改；历史右栏读取该条当前验真回答的封存pack，而非最新v2预览。没有回答时仍读当前article-context预览；原三栏和操作不变，不另加事实卡或新控件。

## 精确映射与有界选择

`article-selection-v2.mjs`支持阅读投影原拼接，以及保存正文所用的XML文本节点边界空白投影，均须在当前规范化body中精确命中。仅确切匹配才发JATS锚点；不删除所有空白作模糊匹配，不猜offset。记录`coverage.mapping={total,matched,failedAnchors}`，失败最多列50个锚点，登记`body-mapping-incomplete`，不把它误报成章节绝对不存在。

新片段保持≤6片／每片≤1200／总≤6000字符。按完整句窗口截取（`Intl.Segmenter`），摘要优先保留连续结论窗口；表格选取原JSON字段中连续完整表头／行，保留原offset，不拼造新表。未选行登记`table-rows-not-selected`；单句大于上限且无法选完整窗口时标`complete:false`，不可进入Provider。

病例支持Clinical assessment／Case presentation、Intervention protocol、Clinical course and outcomes／Summary of outcomes等受控别名，并继承父章节角色。优先对象／方法、结果、真正局限、针刺主题和结局表，而非用Highlights填满；综述选入针刺弱推荐段，结构上无独立Results则登记`results-role-not-applicable-review`。`coverage.articleType`只是受控结构提示，不是证据评级或自动临床诊断。

新增片段字段`complete`、`role`和覆盖诊断进入packHash及完整重验；实际`text`始终等于对应规范化字段的offset窗口。表格只字段定位，不假造页码／单元格。图像和附件仍不送模。

## 单篇输出守门

`scripts/article-ai-output.mjs`仅用于新单篇执行。Provider前要求v2且所有片段完整；追加定性解释契约，要求保留测量／因果／推荐强度／人群／阶段／残余症状限定。最终接收在旧`assertAnswer`后额外检查科学数量文本：Unicode数字、中文带单位数词、英文数词和倍数／减半等表达；只有核准引用、实际片段标识、文章标识等元数据可豁免。拒绝后不自动重试或修改模型正文。

错误：`ARTICLE_AI_POLICY_REJECTED`、`ARTICLE_AI_EVIDENCE_INCOMPLETE`、`ARTICLE_AI_OUTPUT_INVALID`、`ARTICLE_AI_NUMERIC_REJECTED`，状态422。模型前阻断不发Provider；模型后拒绝仍保留真实用量与费用，不当作免费失败。旧数值／来源守门和生产Billing不改；不追溯拒绝已存v1回答，旧回答的专业问题另有报告。

数量文本检查是保守词法门禁，可能拒绝合法的带数字量表名／表达；拒绝优于悄悄改写。它不证明自由文本语义、疗效或专业支持度全部正确，仍须真实新模型和研究者验收。原文数值保留在既有片段／表格区供人工核对，不新建可编辑数值产物。

费用任务统计同时识别v1、v2，仍共用原目的收据、历史账本及12次实际请求／20任务／5元上限；不能靠换policy绕限。当前12次已尽，v2仅免费验证与只读预览启用，不续价／续额／充值。

证据：[本轮修补与验证](../testing/article-ai-b08-remediation-2026-11-04.md)。
