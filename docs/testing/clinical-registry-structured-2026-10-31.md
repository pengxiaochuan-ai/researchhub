# 两条临床注册结构化详情 · 本机交接与证据

日期2026-10-31；范围为用户本轮要求的两份既有MHTML研究设计/干预/结局及原始位置。仅本机 `wp01_test_full_baseline`、原admin/owner账号、已导入的两条注册v1；无新模型请求或费用，不访问来源站点，不接临床库、不改旧服务、不发布。

## 四层状态

1. 代码：确定性MIME/HTML离线解析、受控提取、两张局部表、既有admin审核增量、单SQL双批准详情投影及C03/G02界面已实现。
2. 本机启用：导入2条不可覆盖提取，重复执行inserted=false；原admin经G02真实提交两条registry_details/display批准，新表决定版本7、8（回滚测试会消耗identity空号）。前序五份bibliographic/display决定不变，AI/全文用途未动。服务19501/19502已重启加载最终代码并常驻。
3. 实际执行：两账号真实Cookie、HTTP200/no-store、响应全部字段与本地原件确定性提取逐项相等，真实浏览器19组及五份回归22组通过；非Mock代替。
4. 业务结果：页面已显示来源原文、可展开定位、空值和同名英文差异，实施者截图复核及独立技术评审完成；科研使用满意度仍由用户确认，不冒称专业验收或生产发布。

## 提取与精确批准

| 来源 | 设计字段 | 分组 | 登记结局 | 源SHA-256 | 提取JSON SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ChiCTR2300073486 / 200293.mhtml | 7 | 4 | 9 | da7543e86b589dff40234b47441639d3332231c386e3db4855c4ae62de05d8c4 | 3683479ea22899573aff01c1bfcb3adc2a23b5f8ad880af1ab419845bc6f393d |
| ChiCTR2300077209 / 202558.mhtml | 7 | 2 | 11 | 91d7745dd42f31832dd074cd7c2b243f8ab95562207e565eb932437cd7387b8d | edd46e15d8a4ecb892ae2fcc6b9a369539d4dd3df5be6388975b09c55b5cb09c |

200293原各组样本量字符串112，202558为64，不求和。200293主要与次要各一条中文同名17项汉密尔顿抑郁量表，英文分别评分变化与response rate/remission rate，不去重。20条结局的时间点/方法及两份治疗方案详述为空，共42个明确未填写字段；不能从标题、英文或常识推填。202558疾病仍为轻度认知障碍。每项定位属于解码HTML；例如研究设计T4/R16/C2、第777行第33列（列从1开始）。

批准依据：[本轮用户指令与精确提取](https://app.notion.com/p/40a56479ab5881108043f4bb0150897a?pvs=204)。真实两次POST回执、前后预览及WebM：

- [receipt.json](/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-registry-structured/approve-f67ed4ef/receipt.json)
- [最终19组结果](/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-registry-structured/verify-bcf093f4/result.json)；同目录PNG及video/保留全部证据。前一完整通过轮verify-e4f04b58仍留存；最终轮额外等候真实身份完成后截图。
- [五份来源22组回归](/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-initial-five-display/verify-d6a663f1/result.json)。

## 自动测试与复核

- `node --test server/hub-sources/*.test.mjs`：39/39，包含原来源/Agent检索、真实HTTP及PG、回滚审核/撤回/CAS、源换版/新提取/坏哈希、RLS和不可编辑权限、单快照交错回归；现有AI命中仍0。
- `node --test tests/clinical-registry-ui.test.mjs tests/hub-source-admin-ui.test.mjs tests/hub-source-evidence-ui.test.mjs tests/platform-auth.test.mjs`：11/11。
- `npm run build`通过，仍有原先大chunk提示，未借此扩大打包改造。
- `node scripts/hub-registry-details-import.mjs --apply`复跑两条均inserted=false，精确RLS策略/复合FK/唯一约束准入通过。
- `node scripts/registry-structured-browser.mjs verify`：19组=16个两账号四视口真实详情、2个G02真实预览、1个明确UI-only故障契约。50次溢出/字号测量，40个记录到的来源请求，无pageerror。字段16/28，来源操作14/22、min-height44；键盘Enter、原文空单元格、末项命中、列表往返通过。原生200%采用Chrome设置并验devicePixelRatio=2，截图用CDP原窗口面，不误判普通headless截图裁切。

独立源核验与总评审为只读子Agent。总评审最初P1跨查询混合快照、P2幂等表策略/约束漂移门禁不足；已局部修补，新增受控回滚交错及六类schema漂移反例。独立二次复核关闭两项，解析/漂移纯测试4/4，无新增问题。交错测试是同一回滚事务中在scope读后注入撤回并验证只有一条投影，不冒称两连接并发屏障测试。

## 保留的失败与边界

早轮浏览器失败保留failure.json：ESM导入默认导出兼容、select嵌套label精确匹配、native summary选择器适配等属于测试脚本修正；G02英文Range异常定位为pre-wrap行末空格挂出，已正常折行而不删文字/缩字号。重启中误并发启动HTTP测试曾ECONNREFUSED，待独立服务明确ready后39/39重跑通过，不把该轮失败隐藏为通过。503及焦点待审是拦截式UI契约；真正数据库撤回、换版和隔离由回滚PG测试证明，未新增持久撤回决定。前序数据和三PDF未改，未授权正文/AI检索不会因本轮展示自动可用。

用户可从 [临床注册列表](http://127.0.0.1:19501/pages/c01/) 进入两条详情，或在G02核对当前提取审核；科研字段正确性及可用性请继续验收。

Notion已同步：[规格与精确审核依据](https://app.notion.com/p/40a56479ab5881108043f4bb0150897a?pvs=204)、[本机交接证据](https://app.notion.com/p/40a56479ab5881a7a976e2253888a4dc?pvs=204)，以及产品基线/变更/版本/使用说明/API/前端架构/UI验收和原C01/C03规格的同轮增量；原历史记录保留。
