# B04固定单篇证据包：本机后端技术交接

实际日期：2026-11-03。仅执行用户本轮B04，不恢复其他页面、采集或共享底座任务。依据[已批规格](../product/bilingual-article-ai-spec-2026-11-02.md)、[八步计划](../planning/bilingual-article-ai-2026-11-02/implementation-plan.md)及[接口](../technical/article-evidence-b04-2026-11-03.md)。

## 交付与四层状态

| 层次 | 实际结果 |
| --- | --- |
| 代码 | 独立article-evidence/local-article-ai模块、规范context/同篇包、ensure/恢复/队列/工具/Provider前后/原锁内提交/历史与来源分支已实现；没有改旧app内核/Schema/权限或前端布局 |
| 本机启用 | 独立19501/19502服务已重载，七服务ready；新article-context由原Agent/Study守门，读接口no-store；新增单篇付费显式403/ARTICLE_PAID_NOT_APPROVED，待B07费用门禁，不靠过期价偶然挡费 |
| 实际执行 | 原两账号对PMC13672493/PMC13678665真实GET核对版本/SHA/审核/coverage/packHash及精确原key未找到；真实PG回滚执行原Session、Queue primitive和旧Orchestrator，Provider为免费依赖替身；实际Provider请求0 |
| 用户效果 | 固定单篇证据准备后端阶段完成；B05解读入口/回链、B06完整UI、B07真实中文回答及专业支持度和B08唯一独立总评审均未完成，不宣称已可单篇AI体验/整片或生产验收 |

包限定同篇摘要/正文/表格文字≤6片、每片≤1200字符、合计≤6000；包含实际位置/长度/文本hash、原始链接/DOI、版本、审核、覆盖/缺件、packHash，非首片/顺序/定位/来源元数据篡改同样拒绝。能精确匹配原JATS的段落才记章节/锚点，否则字段offset明确降级；未定位的方法/结果/讨论章节登记not-located，不说原文绝对不存在。覆盖/缺件实际进入工具结果，不只藏在provenance。图片像素/附件不作为本片AI输入；始终注明非全文逐字审阅。

## 免费与真实PG验证

命令：`node scripts/article-evidence-gates.mjs`，最终[机器结果](evidence/article-evidence-gates-7f6184d5-74ab-4fe8-bb59-0fffcafba713/result.json)。

- 245项纯契约/组件通过：本机全部前端测试、明确列出的来源纯契约、单篇包及Hub/旧Agent适配、知识问答费用/原环境配置；不是所有历史后端套件。
- 19项真实PG通过：本片4项＋B01回滚预检3项＋当前获准源3项＋中英投影5项＋论文筛选4项。
- `pnpm run build`、`git diff --check`通过。保留原大chunk等构建提示，不升级依赖/打包。
- 原7张来源/审核表完整行摘要/计数、当前租户角色摘要、Session/Job计数、原费用账本、3个旧内核及4个页面/组件文件前后相同。没有持久新业务行、原来源撤回/改版或费用记录。

本片真实PG覆盖：两账号动态authVersion（不硬编码0）；短片实际length/hash与JSONB键序往返；旧Session幂等和GET定位；原key换输入冲突；同篇固定来源工具→旧科研Orchestrator→免费Provider替身→原来源锁/包重验→新助手JSON→本人历史/来源读取。修改非首片或历史hubSources，与包/真实completed job不一致即遮蔽。

撤回/换版/正文变化仅操作新具名PMC99001001事务夹具，全部回滚。已prepare后撤回，最终validate拒绝；既有夹具回答随后历史/来源也受限。第二真实PG连接用FOR UPDATE NOWAIT争抢原文章锁被55P03拒绝，仅争锁不改原文。双调用同时越过预检后，真实旧入队primitive在受控调度下由create-hook拦第二项，savepoint模拟其事务完整回滚，1job/1用户消息/1次费用准入；这是免费竞争验证，**不是两页真实付费POST或真实Provider在途撤销，也不是1笔真实Token费用预留验收**。后者仍留B06/B07。

## 真实浏览器与API

- [改前记录](evidence/article-evidence-browser-before-fb861666-3f2d-42f7-9d07-2ea2550e3b7b/result.json)：原两账号E01→预览→E02，1440/390截图和WebM。
- [最终改后记录](evidence/article-evidence-browser-after-ceaf6857-7535-4e14-a027-c46bb6d52210/result.json)：5组检查，原两账号真实文章上下文GET/精确requestKey未找到/未知文章404/伪参数400/缺Study作用域400，匿名401无内容；原页面路径/按钮保持，1440/390 PNG/WebM，pageerror0。所有业务API只GET，登录为真实认证POST。
- 两次浏览器前后Session/Job计数与预算账本相同；不创建会话/模型任务。E02“岐研AI解读（未接通）”仍disabled；截图已打开核对，未将后端就绪冒充页面完成。

截图样例：[原页](evidence/article-evidence-browser-before-fb861666-3f2d-42f7-9d07-2ea2550e3b7b/owner-e02-1440.png)、[最终页](evidence/article-evidence-browser-after-ceaf6857-7535-4e14-a027-c46bb6d52210/owner-e02-1440.png)。本轮不改JSX/CSS；未为B04重复声称原生200%/所有视口/全站UI专业验收，相关新交互留B05/B06。console警告未在本片脚本单独统计，不冒称console全零。

## 失败与限制

TDD实际RED：缺实现模块；旧Hub识别未包含article context；篡改历史来源清单仍返回current；缺失章节信息未进入coverage/工具输入。以上均最小修补后GREEN。一次新增回滚夹具漏userMessageId导致Prisma拒绝，补齐测试而不放宽旧数据契约；原行未落库。回滚可能消耗审核identity序列号码，不重排/删除历史决定。

既有历史来源集成夹具authVersion=0/假设全库未审的问题见[筛选交接](publication-filters-2026-11-03.md)，本轮没有放宽授权、撤回库存或声称其全绿。没有实际付费/核价/续价、临床库、云、远端配置或真实发布；未做原Agent工具循环/联网/图片理解等扩展。旧源码与已有账本/原来源保持。

下一推荐B05：沿原E02按钮接AI01固定文章上下文、片段核对/返回与只GET恢复，不重排页面；原估4h。实际付费与专业结论仍需B07，唯一独立代码总评审留B08，不因本次自查冒称已独立复签。
