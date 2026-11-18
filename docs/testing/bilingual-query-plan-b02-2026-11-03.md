# B02词表快照与确定性QueryPlan · 技术记录

## 实际交付

S08[本机技术交接](study-tasks-s08-2026-11-03.md)后，按用户已批准“进入B02、不改页面、不扩大共享底座”实施。新增仅三个运行/测试文件：`server/hub-sources/search-dictionary-v1.json`、`search-query-plan.mjs`、`search-query-plan.test.mjs`；不改collector/旧内核/页面/运行装配/权限，无新表、服务、依赖或模型调用。

产品living spec/基线/变更/版本/倒排与台账及[Notion技术记录](https://app.notion.com/p/40d56479ab5881118b69e6949ac880ca)已同步；仅描述内部纯编译阶段，不宣称前端检索启用。

快照版本`hub-search-v1-pmc-tiabs-v2-20261031`：Hub第1版快照引用collector已定稿PMC英文v2，不把两个版本体系混用。47行均保留、42启用、13/14/17/19/35禁用。上游定稿SHA256=`82c9e452c4faadd4f2e76f293f447f8c693bef774ef9e5b79c06d428c196fb5a`，原中文keywords.py SHA256=`0a36660f3fe8f18df9f32cf2770281c0b4efb501a2e56c85b2d87aca8aac34b9`；逐行测试中文/英文词形/组/启停一致。运行时只传入Hub快照，**不读取兄弟采集项目**；测试才核对上游来源。

## 稳定契约

`compileHubQuery(q,dictionary)`返回`originalQuery,mode,dictionaryVersion,conceptGroups,appliedTerms,warning`。不执行SQL/网络/数据库/模型；下游必须**AND概念组、OR同组词形**，不各自重新翻译。

- 输入trim后2–100字符，原输入保留；纯PMCID、DOI或标准HTTPS doi.org链接走identifier，分别统一大小写，不扩词。
- 最长已知中/英文词组优先、英文词边界/忽略大小写、不词干化；癫狂不拆癫/狂，抑郁障碍不拆抑郁。停用项也参与最长识别，防止狂越被部分扩成狂。
- 只移除显式有限的礼貌/连接词。未知病种、年份、否定、比较、OR/AND等约束残留则整体literal并警告，不静默丢约束。停用词只保留原文匹配，不英文扩展。
- 针灸唯一已批宽类含41针刺/44艾灸的检索词形，标记broader_retrieval并警告非医学等价；郁证、不寐等不偷换现代诊断。
- 最多8组、按各组实际词形合计最多64，超限400 `HUB_QUERY_LIMIT`，不截断；同概念重复输入合并，实际词形去重。
- 原2字符下限保持，因此单字“癫”“狂”单独输入仍400，可使用定稿英文词组；不是词表禁用、也不私自放宽入口。

## 验证与失败留痕

先缺实现RED；加入literal占位后8项行为测试6失败，证明概念/标识/界限规则缺失而非仅import错误；最小实现后8/8通过。逐行包含所有启用词英文大小写映射、全部47行与源SHA、禁用/未知/否定/长短词/8组64词/标识精确/确定性与不修改输入快照。首版逐行测试忽略原2字符下限，改为单字明确断言400，其英文映射仍逐项检查，未为转绿改产品约束。

命令：

```sh
node --test --test-concurrency=1 server/hub-sources/search-query-plan.test.mjs server/hub-sources/article-preflight.test.mjs
node scripts/approved-source-chain-browser.mjs --mode local-synthetic
node scripts/study-tasks-final-gates.mjs --mode local-synthetic
```

实际8项QueryPlan＋3项原复用PG探针通过；PG探针新行全回滚，不把旧能力复验当新检索接线。现有资料链6组Chrome通过：13篇已审核文章、页面/片段hash、匿名/未审隔离、原图与回链，queueChanged=false；仍观察英文6篇PMC/中文2份标准，**新词表尚未接API或页面**。Hub235/旧StudyOperations138/旧事务12及两端构建通过，原chunk/WebSocket告警保留。

证据：`evidence/bilingual-query-plan-b02-fd0466fa-eaee-4f65-8e54-bc1485b90d7e/result.json`及tests.log（源码SHA、实际QueryPlan样例、0模型/数据库写/页面变化）；`evidence/approved-source-chain-7e79022a/result.json`（6组Chrome PNG/WebM）；`evidence/study-tasks-s08-2026-11-02/free-gates-93c56860-2b7c-49c5-86de-ef35208bf8e5/result.json`。B01探针按已有驱动保留前次证据并更新其preflight.json，新行全回滚。

## 四层状态与下一边界

代码纯编译阶段已实现并测试；不需要环境开关，**未在实际HTTP/用户检索中执行新QueryPlan，未做新的AI回答或专业验收**。B03需在获准投影中把同一计划条件放到分页前，绑定cursor并保留当前授权；本轮不提前接线或改页面。B08唯一独立总评审仍留整片，不新增局部独立评审。用户已允许必要付费，不等于续额/跳过原门禁；本步无需核价/Provider，原累计费用不变。
