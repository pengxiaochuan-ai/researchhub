# K01 生产接通准备 · 免费验证记录

## 2026-11-20 K01 生产修补复验（真实问答未验收）

已按批准创建2个本人私有库、4份未审核MD/草稿和2条PDF导入任务；两任务因存储启动竞态失败，原记录保留，未手工重排。存储修补已发布，44678685955在生产只读核对两份原PDF的SHA、中文标题/正文和真实第1页，写入/导入执行/模型调用均0。

当前库AI状态遗漏研究上下文导致的400已随6e6ffba配对发布，工作流44679992177成功。两账号真实Chrome状态专项复验通过：可访问旧库的问答状态显示尚未开放，新获准库状态200且可开始问答；缺头400、伪造项目403及无scope Hub状态已在真实Nest HTTP＋合成PG验证，原生当前账号/成员/研究/KB与用途检查保留。相关精确源72项回归通过，布局、交互、角色、写路由和core不变。

最终只读44680156763确认模型、限定knowledge-chat/knowledge-import继续开启；原623任务和原累计账本完全一致，仍2会话/2问答任务/2实际请求、费用上界0.05454元。本轮新增Provider0。两条PDF仍failed/docId=null；一次性原任务重排提案已经免费原子回滚验证及独立复核，仍待用户单独确认，不自动重试或对账。K01真实问答、固定版引用/撤回恢复和专业验收未完成，不切E02。

独立总评另记录owner一份历史文档原件接口500；这是未完成项，不能宣称K01全页无HTTP错误。该历史原件不在本轮两份新PDF修复范围，不改旧资料；准确两份原件的独立预检已通过。


## 已批准后的免费验证与生产只读核对

- runtime-regression-current.log：104通过、0失败/跳过；最新前端构建成功，最终精确发布集合须再构建验证。
- native-sessions-worker-bounded.log：两角色原生Sessions/Queue/claim/Billing/publication、空库无Provider、正向假Provider、撤审隐藏；全部回滚，真实调用0。
- native-pdf.log：两份已封存中文原创PDF本地抽取，页码真实，非OCR、网络0；附加原生Ingestion验证保留第1页。
- 生产只读工作流44668104770：HeadBucket available=true，对象读写0；原模型ON、knowledge-chat ON；历史623任务hash未变。仅探针脚本以c83246f发布，不是业务版本发布。
- 独立评审已补齐image/core摘要联动与V2 checkpoint真实回滚基线两处守门。生产阶段、模型答案、原页截图与用户验收尚未通过；不可用免费测试替代。

## 批准前的历史准备结论（保留，以顶部后续进展为准）

用户已确认先审计、再从K01逐页实际接通。本轮完成生产只读资料盘点、KB证据与受限问答候选代码及免费验证；**没有接通生产K01问答**。Controller/Worker私有父对象适配、core/admission/ledger兼容迁移、生产资料写入/导入与真实模型验收仍未完成。原模型/knowledge-chat开启状态不变，原2次上限不变。

## 已执行及证据

证据目录：`researchhub/.tmp/k01-production-20261120/`。没有密码、JWT或数据库连接串写入本报告/Notion。

| 层次 | 实际操作与结果 | 限制 |
|---|---|---|
| 生产只读与浏览器 | admin6库/15文档（11已审核）、owner37库/48文档（34已审核）；原Study的实际HTTP列表/树；2角色Chrome1440×1000截图/视频；脚本异常0、业务写0、Provider0 | 可见集有重叠，不算总体去重数量；审计拦截自动POST会话，不能据此称实际503或实际创建成功 |
| 候选单元与原Hub回归 | `knowledge-evidence`、`knowledge-turn`、原Hub turn/controller/budget/execution共54项通过，0失败/跳过 | 替身边界只证明契约，不是真实模型或生产Worker执行 |
| 真实原生检索 | 本机独立`rh_deploy_`合成库、sealed core `85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135`；原生KnowledgeService.search、accessibleKbIds、withCurrentKnowledgeRead；实际1份current来源 | app/direct连接都验证default_transaction_read_only=on；数据库写0、模型0；没有验证原生Sessions/Worker提交 |
| 真实原生编排 | 同一sealed Orchestrator，假Provider＋Sessions/提交替身：成功一次；越界引用先被NUMERIC_BOUNDARY拒绝；Provider失败虽被内核捕获仍向外传播，assistant0 | 3次仅是假Provider调用，不是3次真实模型请求；没有DB或网络副作用 |
| 构建 | `npm run build`成功，5.41s | 保留已有chunk大小/外置导入提示；无前端源代码/布局修改，构建不代替真实UI验收 |
| PDF准备 | 原创两份中文MD及嵌字PDF（每份1页，约61KB）；pdfminer实际中文可抽取，渲染页面可见 | 仅本机文件；未上传、未经过生产解析/审核；不能替PDF导入销项 |

实际文件：`source-inventory.json`、`admin-before.png`/`owner-before.png`、`video/`、`regression.log`、`native-evidence.log`、`native-turn.log`、`build.log`、`materials/manifest.json`。业务写统计不包含实际登录签发认证会话；生产未创建科研对象或模型任务。

## 先失败再修补与独立评审

1. 新测试先因模块不存在失败（`k2-red.log`、`k3-red.log`），再实现；快照定位篡改反例初次失败后补canonical quote/page/section/title/kbName/via核对。原旧sourceState及旧系统不变。
2. 独立评审发现测试人为添加原生字段。修正后用真实Prisma形状再现失败：KnowledgeDoc、KnowledgeChunk均无researchProjectId，项目归属经KB验证。真实PG原生检索随后通过，未改schema。
3. 独立评审发现预算函数可漏注入。补缺省依赖反例，构造即拒绝，移除直调Provider分支。复用原静态分项交付诊断，不写被拒正文/科学数值。
4. sealed原生编排的越界`[2]`首先触发原数值门禁，而非替身预期的引用门禁。保留首次失败证据，修正验证预期为真实`NUMERIC_BOUNDARY`，没有放宽任何输出检查。Provider失败路径外层仍拒绝内核确定性兜底。
5. 初次PDF使用非嵌入CID字体，文字可抽取但渲染空白；换嵌入中文TTF后实际页面可见。准入文档只列最终文件SHA，不使用旧空白文件。

独立只读复评已通过当前候选阶段，未发现新增必修代码项；不能据此批准生产接线或代签真实业务验收。

## 历史准备阶段待办（以顶部后续进展为准）

新原生KB会话/任务父对象、管理员规则、Controller入队、预算继承及原生Sessions/Worker免费事务验证；精准导入认领和解析服务核对；获得[具名生产清单](../technical/k01-production-execution-admission-2026-11-20.md)确认后同版上线及两角色真实模型/引用/恢复整页验证。保持当前串行，不进入E02，不为通过验收自动扩权限或费用。
