# 指南条款与本人方案引用小步实施计划

> For agentic workers: 用户已批准规格与计划。使用superpowers:executing-plans串行实施；唯一独立只读总评审完成。T01–T03核心实现及T04页面验证完成；Important持久撤回竞态待最小授权，不称全部验收。[实际证据](../../testing/guidance-plan-citations-2026-10-31.md)。

**Goal:** 在本人已保存方案段落与当前获准条款间建立可回看的人工引用关系。

**Architecture:** 复用既有ResearchArtifactVersion封存block及当前本人授权事务，新增不含条款正文的独立引用字段。读取时在当前源/审核快照上解析，既有AI输入不增加新来源。

**Tech Stack:** 现有NestJS本机适配器、Prisma/PostgreSQL、React/Vite、共享Button及Reading Token，无新依赖。

**Spec:** `docs/product/guidance-plan-citation-spec-2026-10-31.md`，已批准。

## 全局约束

- 当前目录保留全部已有改动；不自动stage/commit，不改旧内核/服务、临床库、共享底座或其他并行模块。
- 仅`wp01_test_full_baseline`、原owner/admin、当前Study及本人草稿；不新增权限/审核决定、费用、云、远端配置访问或发布。
- 不写条款正文到方案Markdown、不加入AI；每草稿最多12条引用，复用64条operation限额。
- 参数只接受引用定位与hash；版本/CAS/幂等/审计和当前来源校验同事务，完整历史不改。
- UI局部卡片，操作14/22、Reading16/28及48rem，不改Frozen Shell。

## 评审重点

1. 客户端伪造quote/page/来源、非法或同名段落，必须拒绝而不是自动补齐。
2. 提交交错遇到源撤回/到期/换版，不能把预检批准带到失效后的提交。
3. 原文仅可展示，手工引用不能隐式进入AI证据或原文下载。
4. 丢响应重试、其他表单dirty、迟到结果和实际切账号，不重写/串入旧上下文。
5. 撤回来源仍能解除引用，旧版本不重写、当前不可交付原文不借历史重放。

## T01 引用契约及RED到GREEN

**Files:** 新增`scripts/guidance-plan-citation-contract.mjs`与同名`.test.mjs`，前端共用纯段落定位可置于`src/guidance-plan-citation.js`及其测试。

**Interfaces:** `planParagraphs(contentMd)`只接收`editablePlanContent(version.contentMd)`的返回值，返回该字符串原UTF-16区间和完整文本，不额外trim/转换换行/渲染/归一化；服务端给段落hash。`validateCitationInput(input)`严格区分add/remove；`citationTargetState(ref,contentMd)`只按同一字符串的原位置/hash核对。服务端生成ID/账号/时间，前端只选择服务端区间，不能决定原文或页码。

- [x] 先写并运行失败测试：中文/CRLF/重复段落/空白、越界与半段定位、追加provenance不可选、未知字段、伪造hash/quote、重复引用及12条上限。
- [x] 最小实现上述纯契约；运行精确测试清单，要求全部通过。

## T02 真实版本提交与当前来源门禁

**Files:** 新增`scripts/local-guidance-plan-citations.mjs`及真实PG/API测试；最小修改`scripts/local-knowledge-ai.mjs`、`scripts/local-knowledge.mjs`登记控制器。不改旧版本创建服务。

**Interfaces:** 规格中的GET/POST `/research-plan-drafts/:id/guidance-citations`，GET可选`versionNo`读取精确历史block；复用`plans.withDraft`、`plans.formatContent`、`ResearchArtifactsService.createVersion`及`getVisibleGuidanceDocument`。响应含精确version/currentVersion/readOnly、当前可用来源及解析后的引用，不含AI执行动作。

- [ ] 写RED真实事务测试：本人之外拒绝、准确父对象、当前角色/authVersion、状态/在途、非法source/extraction/clause/hash、源撤回/到期/换版和提交交错、CAS与幂等/解除失效引用。原方案资料restricted时GET无段落/引用正文且POST拒绝，stale时只读；历史head/自身资料分别守门，不能凭外部条款仍获批恢复原方案受限段落。
- [x] 实现独立引用block和局部控制器； source文档锁与既有审核同键，审核和引用同事务内重验；审计/版本原子。
- [ ] 真实PG回滚测试通过，验证未落部分版本、前序快照及历史不变；历史读取不替换head、当前来源失效历史也不交付原文。原方案/设计/执行准备与试跑绑定回归：版本增加沿用旧规则、下游不自动重绑/重算。未知DB权限或旧内核改动需要先停，不自行扩权。

## T03 S07人工引用面板

**Files:** 新增`pages/shared/ResearchDesignGuidanceCitations.jsx`及局部CSS；最小修改`ResearchDesignWorkspace.jsx`接入dirty/刷新/当前版本；复用`GuidanceClauseDetails.jsx`而不导入源清单。

**Interfaces:** 使用当前已授权scope的`createKnowledgeClient`；独立GET/POST，成功后父页读当前设计版本。不同表单dirty/任务在途互斥。方案正文不自动修改。

- [ ] 写RED前端契约/状态测试：真实来源读取、当前段落选择、unknown/empty/error区分、迟到忽略、切账号、失败重试/同键重发、dirty与冲突不覆盖。
- [x] 实现选段落/选条款/完整核对/明确确认/保存/当前列表/解除及原文位置，以及近30版本的引用只读选择。保存前说明新增版本可能使既有建议/执行准备/试跑处于旧基准；失效不显示旧正文，操作14/22与Reading16/28。
- [x] 相关前端测试及`pnpm run build`通过；本轮只重启具名本机服务。

## T04 真实浏览器与独立总评审

**Files:** 新增`scripts/guidance-plan-citation-browser.mjs`及本轮证据目录；补齐`docs/testing/guidance-plan-citations-2026-10-31.md`。

- [x] 只建本轮具名新合成草稿/版本，复用已存在有效PICO/合成来源；若无法免费合法建立本人新夹具，停下确认，不调用模型、不覆盖前序草稿。
- [x] 两账号分别完成真实保存/刷新/回看/解除，HTTP与PG版本一致；两账号跨读拒绝和响应丢失幂等，读取错误显式恢复。
- [x] 桌面1440、390、320与原生Chrome200%、键盘/末项触达/源码位置/两种页码/完整段落；截图、录屏、console/network/computed留证并人工查看。
- [ ] H06/G02只读回归，费用账本/旧服务/前序版本保全；独立只读总评审，问题先测试复现再最小修补。
- [ ] 更新living spec、产品基线/变更、版本记录、使用说明、API及前端/测试专项；同步Notion。只报告取得证据的四层状态，专业验收待用户。

## 时间与执行门槛

T01–T02约半天至1天，T03约半天，T04约半天，缓冲半天；合计1.5–2个工作日。当前核心实现/真实页面与回滚PG已测；尚未关闭的验收框不得以功能可体验代签。唯一总评审要求独立连接“审核撤回先持久提交→引用拒绝”，目前只补齐双顺序真实锁等待（全部回滚），未擅自增加来源决定。已请求最多2条本机具名撤回/恢复展示决定的最小授权；确认前不执行该项。新增权限/费用/云/远端配置/发布仍先停线确认。
