# H06三份指南与研究标准关键条款 · 本机技术交接

日期2026-10-31；用户“继续”承接补齐三份关键条款与原始页码的建议。当前目录串行实施＋独立只读源核验/总评审，范围仅 `wp01_test_full_baseline`、原两账号和原三份PDF v1；无模型调用/新增费用、云、远端配置、旧服务/临床库改动或生产发布。

## 四层状态

1. 代码：局部提取/审核存储、当前授权提交、单SQL同快照详情、G02受控预览和H06按需阅读已实现；前端不读清单/演示正文，条款来自真实DB。
2. 本机启用：3条不可覆盖提取、12条复核摘录已导入，重复执行均inserted=false；原admin通过真实G02逐份批准 `guidance_clauses/display`，新表决定版本5、6、7。序列空号来自回滚测试，不是覆盖历史。前序五份书目及两条注册批准、AI/全文用途保持不变；七个具名本机服务ready，前端19501/API19502常驻。
3. 实际执行：真实Cookie/DB/HTTP与浏览器27组通过；每份API正文/hash与已核验清单相等，44条记录到的来源请求均200、no-store；不是用Mock正文替代真实材料。五份来源22组、临床详情19组浏览器回归均通过。
4. 用户效果：已人工查看桌面/手机/200%截图，原文可读、两种页码/章节可核对、末项入口可达。科研专业使用满意度仍待用户确认；未确认最新临床推荐、来源方生产许可或整本/AI用途，不冒称生产/专业验收完成。

## 原件与摘录

| 原件 | 已核对摘录 | PDF物理页 / 印刷页 | 提取SHA-256 |
| --- | --- | --- | --- |
| T/CAAM 0010-2020，11页 | §5、§6.1、§7第一段、§8 | 8 / 2 | 245960ee0b7742b8bae879aa66562713294af5c38149dd21b608a69a2634350d |
| T/CAAM 0012-2020，51页 | §4.1、§4.2；§5.2、§6.3 | 7 / 1；8 / 2 | a33b129f514145fa442228b71f74920328857f6056f08b8ffd2ebe8041272d8f |
| ZJ/T E003-2014，61页 | 简介§3首段、§4；§2.3首段、§3.1第2–4段 | 9 / 2；17 / 10 | 5eed80e79eae53fdab181fd0336a46edfa832258f77183ae1c1d2f2f3e3f4428 |

原件SHA在 `server/hub-sources/initial-five.mjs` 固定并由 `verifiedInitialFiles()` 实际核对，导入再核对DB原件字节。三份中文文字层含 `/G…` 字形映射乱码，未将提取字符串默默当正文。使用已安装bundled Python `pypdfium2` 按2倍渲染指定页，`tesseract … stdout -l chi_sim+eng --psm 6` 产生本机OCR候选；页图与候选保存在 `/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-guidance-clauses/source-pages/`。未安装新依赖/访问外部OCR。

主实施与独立只读源核验逐字对照12条清单，仅合并排版换行/统一全半角标点，原引文上标转行内。易误词“接收日期”“系列号”“手抄数据”“试验记录人员”“论治”“治则”“方义”“选择性组合增减”“中重度”“惧怕”“总疗程长短”“依从性”均按原图确认。指南[12]保留，不代表平台已检索核验该文献。§7后续更正要求、表A.7、指南目标环境及其余安全要求不在本轮摘录中；页面明确“局部摘录”而不暗示不存在。2014版/版权提示保留。

## 审核与浏览器证据

- [具名范围及精确源/提取指纹依据](https://app.notion.com/p/40a56479ab58819e8eefc65d94e220d0?pvs=204)：记录本轮用户本机展示请求，不充当来源方生产许可。
- [三次真实POST回执与前后状态](/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-guidance-clauses/approve-dff92fb7/receipt.json)：3次201，当前admin、精确提取ID/hash；其他字段/用途/临床决定逐项对照不变，同目录WebM保留审核过程。
- [27组最终结果](/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-guidance-clauses/verify-df4a1076/result.json)：24个两账号×三份×四视口真实详情，2个G02真实预览，1个单独标记的UI-only恢复契约。50次computed/Range测量，44个来源HTTP记录，真实部分0 pageerror/console warning；同目录PNG/WebM。
- [五份来源22组回归](/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-initial-five-display/verify-4d93977f/result.json)。
- [临床注册详情19组回归](/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-registry-structured/verify-5010f4a2/result.json)。

新增真实浏览器检查原文16/28、48rem阅读上限、页码与操作14/22、44px summary、Enter展开/关闭、两类页码和原章节、长SHA/编号折行、最后一条原文定位命中、原书目搜索与真实身份。原生200%使用独立Chrome配置的zoom=2并核对devicePixelRatio=2；用CDP完整窗口面截图，避免headless裁切伪影。UI-only的503/待审响应采用拦截，分别验证旧值清空、共享Button重试及无静态回退；它不证明DB撤回，真实DB门禁另有下述回滚测试。

## 测试、独立评审与保全

- 限定本轮相关的16个来源测试文件：47/47，通过原检索/书目/临床、摘录固定源与指纹、真实HTTP、当前具名审核/CAS、错用途、坏hash、提取变化、源v2、撤回/到期、单投影交错及RLS/不可编辑反例。测试写入都在回滚夹具，无新增持久撤回或历史改写。
- `tests/clinical-registry-ui.test.mjs`、`hub-source-admin-ui.test.mjs`、`hub-source-evidence-ui.test.mjs`、`shared-button.test.mjs` 共19/19。构建通过、`git diff --check`通过；原有大chunk提示仍保留，未扩展成打包重构。
- 最初目录通配测试50/50中包含同时出现的4项独立采集schema测试，不以其证明本轮能力；之后改用精确16文件清单，新增到期/交错测试后最终47/47。不读取/恢复独立采集计划，不修改其代码。
- 独立源核验：12条全文逐图核对通过。独立总评审检查当前授权、CAS、源/提取同快照、白名单、RLS/复合约束与UI异步状态，未发现P0/P1/P2；独立只运行两个纯契约测试2/2，未改文件/DB/服务，不冒称它代跑真实浏览器。
- 只新增局部 `guidance_clause_extraction`/`guidance_clause_review` 及3提取/3批准，不改旧业务表、临床提取、旧服务或现有角色。工作簿、原PDF与MHTML不改，详情条款不增加H01来源数量，不自动进入AI检索。

重放命令：`node scripts/hub-guidance-clauses-import.mjs --apply`（应三条inserted=false）；`node scripts/guidance-clauses-browser.mjs verify`。`approve`是具名初次批准路径，当前已批准时仅核对既有依据，不重复写决定。测试只可在具名本机合成环境执行，不能接临床/生产库。

体验入口：[H06指南与教材](http://127.0.0.1:19501/pages/h06/)。G02可核对三份当前摘录批准。范围与接口见[规格](../product/guidance-clauses-spec-2026-10-31.md)。
