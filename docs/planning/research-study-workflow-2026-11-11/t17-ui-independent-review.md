# T17 S10 前端独立审查

2026-11-12。本审查只覆盖T17前端合同、helper/hook/page/route及后续实际证据；不把审查者参与实现的T17后端签为“独立审查”。后端caps已有根独审，presentation已有T05独审，分别引用其专项结论。

**5095原冻结窄审通过，该冻结内无未关闭的前端代码阻断。** 已核该版helper/hook/page/route、独立纯测及作者真实独立合成案例/失败恢复/三视口证据；26源码、168产物与6日志的冻结SHA均一致。初版两项P2分类缺口已RED→GREEN闭合，末次下载quiet竞争已实际RED→GREEN。下文第2—8节保留过程检查点，第9节为该版结论。

**冻结后共享来源增量已按实际稳定窗口复审闭合。** 第9节对应5095原冻结；第10节保留两次漂移停线，第11节签署最终`f129`会话、`226e`资产静态依赖快照及`3e143d76`清单。原报告99542411、5095和6abb原字节均保留，不以旧证据覆盖新源。签署的是精确快照，后续业务写前仍须由根核源码摘要，变化即停止新写。

根保留主三人、主Run和主S10执行权；本审查没有API请求、数据库连接/写入、新fixture或产品代码修改。既有Shell窄屏/原生200%顶部重叠保留为明确限制；主同案/更正、根产品文档/Notion和临床/生产验收均不在本审结中提前销项。

## 1. 合同与边界

[t17-ui-contract.md](t17-ui-contract.md)的首版窄审范围为Shell、摘要、8页签及原单列Panel的最小差异；正式immutable报告、带理由审核/发布、受控DOCX和最近列表。artifactId与runId互斥，jobId仅在artifact下、须真实GET核父链；错误模式不能进入演示。

已确认合同区分真实caps、当前状态/来源与DOCX服务可用性；reader可读正文不等于可读job/下载。原回执与当前可用分开，原GET后任意current503应清正文/文件而保标记/允许保留输入；POST200未完成核对也适用15分钟输入TTL。下载前后fresh身份/报告/job/file核验与真实SHA，再创建短寿命Blob。合同范围没有未解决阻断，不能因此认为实现已经符合。

## 2. 首片helper与独立纯测

首读 `src/formal-reports-session.js` SHA为 `17d7a90158ce63dd61c9105806606a72ebf5f81f289b372bc48b3abc141b3ffb`；作者随后只调整header的context-nav/page-action接法，读到SHA `3bfd2568602842c80b516965935ba3d54438eeb26290665f9ecd33589e548a9b`。两版均是实现中检查点，不是最终冻结。

在该阶段已核：严格route参数白名单/唯一/互斥；最小actor/authVersion/Study/action/target/key标记；固定v1、精确原回执；报告正文SHA；list metadata白名单；run/artifact/job/version/docx父链；文件安全metadata、大小/MIME/响应SHA/实际SHA；权限与来源/状态/服务组合；正文附录按原字符串切片。

- 作者helper测试独立运行8/8，日志[.tmp/t17-ui-helper-independent.tap](../../../.tmp/t17-ui-helper-independent.tap)。这不是页面或真实请求验收。
- 另补[3项独立纯测试](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/historical-dto-independent.test.mjs)，日志[.tmp/t17-ui-historical-dto-independent.tap](../../../.tmp/t17-ui-historical-dto-independent.tap)，3/3。使用已保存D6历史HTTP产物：实际旧legacy admin/reader DTO的正文hash兼容但导出权限仍分开；新正文切片可逐字节重构；实际DOCX字节满足SHA校验且单字节改变拒绝。
- 历史样本仅证明validator/字节处理与已有证据兼容，不证明当前权限仍有效、当前runtime已部署或S10能够完成任务。DOCX纯测试的file ID明确是离线validator fixture，未用它伪造实际父链证据。

## 3. 首版hook发现（待作者修复/冻结后复核）

首版 `pages/shared/useFormalReports.js` SHA为 `de1303b5e26a6f4723eab1b3cd18b8c7dbf4087f5652fb067916f289ea2c2274`。已只读核原回执后readView失败的catch、POST200后的marker/TTL、既有报告不Methods GET、无canExport不读job、下载前后二次fresh与Blob撤销。下面两项只针对该冻结首片，不推断后续版本仍有相同问题。

### P2 / Important：部分真实当前来源失效码未清内存输入/确认

首片line6的sensitive正则遗漏 `ANALYSIS_VISIT_CHANGED`、`ANALYSIS_PLAN_NOT_APPROVED`。两者是实际T15当前依据拒绝码。line27遇它们落safeView而非restrict：正文/job会清除，但memory及确认/输入对应revision未清，与合同“真实来源失效清输入/确认”不符。应显式识别真实source失效码，同时保留普通REPORT_STATE_CONFLICT及503的输入恢复；不能把所有409一概清空。

### P2 / Important：Study授权撤回的精确404保留旧scope metadata

首片同一分类没有处理 `404 RESEARCH_NOT_FOUND`。该码是实际未入Study的拒绝（已有D6真实HTTP反例）。当当前Study读取返回它时，line16的safeView继续保留旧list的标题/ID/caps，虽然正文已清、动作被sourceCurrent=false禁用，但已失去该Study读取权的scope metadata仍留在内存视图。应对该精确scope拒绝清受限view/输入、保原未知标记；普通REPORT_NOT_FOUND或job404不能因此一刀切丢掉仍合法的报告列表/正文。

证据目录为[ui-independent-review-first-hook](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/)，保存首版hook原样文本及[独立分类测试](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/source-errors-independent.test.mjs)。只隔离求值纯sensitive表达式，未导入/执行hook或其client。第一份RED日志为[1fail/1pass](../../../.tmp/t17-ui-source-errors-independent-red.tap)，补scope后为[2fail/1pass](../../../.tmp/t17-ui-source-scope-errors-independent-red.tap)。这证明分类与控制流漏检，不是声称本轮已在真实页面观察泄露。

## 4. 后续冻结复核要求

待最终helper/hook/page/route、测试与截图/录屏形成后继续：

- 上述两项RED对最终源码GREEN；任意current GET503（包含readView尚未返回）、原回执404、POST200待核对TTL、身份/用途撤回及当前源失效的页面恢复。
- 确认弹窗绑定artifact/version/contentHash/status及输入，quiet/current变化取消旧确认；普通409/503保允许保留理由，真实失效清敏，未知只原GET、无新键/POST重放。
- artifact/job的精确归属和刷新只读续读；无导出权完全不取job/文件；fresh前后二进制SHA与同job/file校验失败时不创建Blob，成功短期撤销及卸载/失权清理。
- 实际S10管理员完整任务链、reader/owner/未入账号、独立可失效来源和下载文件；主同案及更正仍由根串行，不能用本审查纯测试代替。
- 母版单列/Shell/8tabs、Markdown安全/无外部图片、原文/数值、14/22操作与16/28长文、1440/390/原生200%及失败页证据。旧模式旁路和合法登录返回也待最终路由差异核对。

产品living/基线/版本/手册/API/Notion由根统一同步。本记录不提前标记S10、T17或主更正链完成。

## 5. 首hook两项分类修复复核

作者将分类统一为helper导出的isReportAccessLoss，hook直接消费；加入精确RESEARCH_NOT_FOUND、ANALYSIS_VISIT_CHANGED、ANALYSIS_PLAN_NOT_APPROVED及当前来源失效兄弟码，保留普通状态409、503和报告/job/回执404的输入恢复。该检查点helper为 `b7d2c0fe2c4a29ce567c90efc729105b54dda2c71b41583d9091a6d164a87d4c`，hook为 `076be6a22279d62a1fa0b1c0c317e0afa1be81fc9a2f7567218c3a2bea912bb2`，仍是实现中版本。

作者helper9项与历史DTO/文件3项独立合跑12/12，[日志](../../../.tmp/t17-ui-helper-source-fix-independent.tap)；另将原RED预期直接用于当前导出函数，[独立3项](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/source-errors-current-independent.test.mjs)3/3，[GREEN日志](../../../.tmp/t17-ui-source-errors-current-independent-green.tap)。原首版文本与RED不覆盖。两项分类漏检在该版本代码层已闭合；还提醒作者同类ANALYSIS_PLAN_CHANGED应显式归为源完整性失效，最终source集合随freeze复核。

此处只证明纯函数及hook引用关系；实际页面清输入/确认、保marker、下载和所有current503恢复仍须后续真实浏览器证据，未提前签整页通过。

## 6. 首版页面/路由与已有真实证据窄读

后续首版页面、CSS、Shell窄header、real-mode/identity/login return、S01/S06回链已只读核对；helper补齐ANALYSIS_PLAN_CHANGED。独立运行report helper、real-mode与session-lifecycle纯测共18/18，[日志](../../../.tmp/t17-ui-route-session-independent.tap)。未修改Shell或产品，也未用测试计数替代浏览器。

页面按后端caps/来源/状态收敛动作；确认封存artifact/contentHash/status、signature及输入，quiet状态变化取消原确认；既有artifact只formal报告GET，无export权跳job；下载前后fresh与受控字节核验后才Blob。首版源码范围暂未发现新增阻断，最终源码冻结仍待作者提供。

已经只读查看作者以下实际结果与脚本：

- [reports-ui-a27f2b52](../../testing/evidence/research-t17-2026-11-12/reports-ui-a27f2b52/result.json)：新独立三人合成来源，真实S06至S10 create/review/release/export/ready/download；4个浏览器报告POST，文件SHA为 `f2c85f17e052a4597ee24d981e839611e59202e77c9c73dc14be3d2298331970`。首版文件检查覆盖真实ZIP/table/标签/一个原小数，尚不能写成此文件每个主表格均已与同轮Run逐格核对；已交作者补证。
- [reports-readonly-27ba664a](../../testing/evidence/research-t17-2026-11-12/reports-readonly-27ba664a/result.json)：reader在残留demo偏好下仍为真实身份，可读新/旧报告，未发Methods/job读取或写入；owner列表metadata可读、详情403无正文；互斥错路由受限。
- [reports-recovery-c7ff5f61](../../testing/evidence/research-t17-2026-11-12/reports-recovery-c7ff5f61/result.json)：真实4动作已保存但浏览器响应丢失，各动作POST计数1；原回执200后逐次注入list/detail/job503，清正文/文件而保原marker与允许保留理由；刷新及原回执404不重发；不存在job404不伪造文件。503/丢响应是受控故障注入，不伪称后台实际服务故障。现有missing job不能代替另一个真实artifact的job错父链，已交作者补证。

已通过view_image实际看R1母版及正常created/released-ready、reader-current/legacy四张PNG；观察到单列、8tabs、中文、状态、原值表格与旧版按需展开可读，所示位置未见裁切重叠。图片SHA及边界记录在[initial-visual-review.json](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/initial-visual-review.json)。母版1440×900、当前首片1440×1000，未冒称同视口像素比对通过，已请作者补同视口及390/原生200%。

仍待实际补证/最终冻结：同轮Run每格原值、真实错父job、POST200待核对TTL、文件二进制返回后fresh失败/失权无Blob、真实独立来源失效、窄屏/原生缩放及最终可读性。主三例和主报告/更正不在这些独立样例中销项。

## 7. 后续负向、文件与下载并发增量

已只读核[reports-negative-08522b50](../../testing/evidence/research-t17-2026-11-12/reports-negative-08522b50/result.json)及其harness：同实际模板的“不可估计”、真实另一审核造成的状态409保理由、changes_requested无假v2；实际cookie换人清敏；POST200后回执503允许保留理由，模拟十五分钟后只清输入而保marker；独立来源实际用途撤回后详情409及quiet清正文。source/Study404分类页面反例是受控注入，时钟十五分钟为模拟，未称真实等待十五分钟或真实服务故障。

文件安全初版[5dc9d4ac](../../testing/evidence/research-t17-2026-11-12/reports-file-safety-5dc9d4ac/result.json)已覆盖同轮持久Run全部主表原值、真实另一artifact的job200错父链、真实文件后单字节篡改/最终GET503/实际cookie身份切换无Blob、成功Blob撤销。它使用当时验收器；T18随后独审发现通用验收器尚未绑定每表前标题与完整来源，已由T05收紧，不能把该旧证据扩称新版完整来源逐项通过。已通知UI作者为新验收器从实际Run/snapshot/固定schema补齐expected并重新验收，产品不因此修改。

根随后批准下载从双次全目录readView窄化为双次精确readDelivery，并允许显式下载取消旧quiet读取。当前增量源码检查点：hook `186c35b8aa5be4c979b9f5b33c1adbeb63ed3cb062de9ca1c644baab0c06300f`、scoped CSS `4d634f0592107cb56ec47f7e82562c644e25e95c907f844d8de6f4615c244f7b`。下载仅在无pending、无writer且已有ready job时中止reader；invalidate旧client、清reader并递增epoch，旧load的guard/catch/finally受token及reader Symbol约束，不会覆盖新delivery或清writer busy。未触业务POST/marker，前后fresh身份、当前报告全文SHA、精确job/file、实际二进制SHA与交付前再次相等核验仍完整；无export权不取job。未见该增量新增权限或来源旁路。

独立补[late-reader-current-independent.test.mjs](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/late-reader-current-independent.test.mjs)直接使用真实createCaptureClient但注入纯离线fetch：旧fetch即使忽略abort迟到成功也必须stale，abort错误不得成为unknown写，新report/job GET仍可完成。2/2通过，未发网络；它证明client代际，hook最终状态另需真实页面证据。当前helper/route/session/历史DTO/source分类及此两项合跑26/26，[日志](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/final-targeted-independent.tap)。

已读实际hold-quiet [e78717e2](../../testing/evidence/research-t17-2026-11-12/reports-download-race-e78717e2/result.json)：旧quiet被hold时，新精确身份/报告/job/file/最终复核成功下载，0业务POST。当前harness在release后立即收尾，故仅支持“hold期间能交付”，尚不声称实际迟到释放后页面稳定已独立观察；已请作者补释放后的收敛断言。旧7bee7f16的RED保留。

## 8. 同视口与窄屏图像复核

实际通过view_image查看[reports-visual-9fbc7173](../../testing/evidence/research-t17-2026-11-12/reports-visual-9fbc7173/result.json)中9张桌面、390及原生200%截图；[独立图像记录](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/final-visual-review-9fbc7173.json)保存精确PNG SHA及尺寸。桌面1440×900与母版同尺寸，保公共Shell/8tabs/单列；390中8tabs现分隔并横滚，主统计小数完整单行、正文/附录/下载及确认控件可读；原生200%实际inner720/outer1440/DPR2/scale1的数值和确认可读。metrics显示操作14/22、长文16/28，页面无水平溢出。

真实既有Shell搜索与身份区在390/原生200%仍拥挤重叠，是明确兼容限制，不签“全页无问题”，也不在本页任务扩改Shell。图像对应独立合成报告，不能替代主三例、主报告或更正链验收。最终文件安全重跑、quiet释放后状态及源码/证据统一freeze尚待作者提交；本记录仍不签整功能文档闭环。

## 9. 最终同版冻结审结

最终[ui-freeze/manifest.json](../../testing/evidence/research-t17-2026-11-12/ui-freeze/manifest.json) SHA为 `5095cc450106d03e8d17bdb112c059f43a440e858abe62b383d845cb5dae2e06`。独立逐个读取并核长度/SHA：26源码、168成功及失败产物、6日志全部一致；[核验记录](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/final-freeze-independent.json)。主要产品源码为：

| 文件 | SHA256 |
| --- | --- |
| `src/formal-reports-session.js` | `66e16ff2ebeff2253d0fdd451d74a0181613776d02796299b59a84987ee6ea35` |
| `pages/shared/useFormalReports.js` | `186c35b8aa5be4c979b9f5b33c1adbeb63ed3cb062de9ca1c644baab0c06300f` |
| `pages/shared/FormalReportsWorkspace.jsx` | `c40eee4a8241e06a86056b247743fd5845ccb91bf4cc135f8f10e25d979db298` |
| `pages/shared/formal-reports.css` | `4d634f0592107cb56ec47f7e82562c644e25e95c907f844d8de6f4615c244f7b` |

最终补证已关闭第6—8节待项：

- [roles683e65a2](../../testing/evidence/research-t17-2026-11-12/reports-readonly-683e65a2/result.json)：reader真实新旧正文可读，无Methods/job/业务写；owner真实详情403无正文；uninvited当前Study目录404后无正文或目录。S01同Study科研产出入口、S10 header及breadcrumb均精确返回原Study；错误互斥模式不回demo。
- [file55442043](../../testing/evidence/research-t17-2026-11-12/reports-file-safety-55442043/result.json)：新版expected来自实际Run/snapshot/固定字段，交付目录GET计数0，真实错父job200拒绝、实际字节后单字节损坏/最终详情503/实际cookie换人均无Blob或新导出，成功Blob撤销。旧expected缺rowCount的失败88d22dd1保留，不改产品掩盖。
- 独立离线重跑该真实DOCX的加强验收器通过：[Word结果](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/current-actual-word-independent.json)。另独立将其预期21格逐项与已存actual-run原字符串比较，并核rowCount/Run/Study/snapshot/manifest身份：[结果](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/current-actual-word-run-strings-independent.json)。文件SHA为 `f2c85f17e052a4597ee24d981e839611e59202e77c9c73dc14be3d2298331970`。这是独立合成Run，不是主同案；本地读取无网络，不以LLM重新计算值。
- [quiet e9310420](../../testing/evidence/research-t17-2026-11-12/reports-download-race-e9310420/result.json)：实际GET原目录200后hold，显式下载完成后再fulfill原200；当前正文、同job、下载可用及无错误仍保持，0业务POST。原7bee7f16 RED与中间事件等待失败保留。该结果与第7节client迟到纯反例共同覆盖取消/迟到边界。
- [visual9fbc7173](../../testing/evidence/research-t17-2026-11-12/reports-visual-9fbc7173/result.json)对应当前CSS，9张PNG已实际view_image核图。单列、8tabs、14/22与16/28、完整数值和确认/交付可读；Shell既有限制如上明确保留。

作者全量前端489/489和隔离构建8.56秒日志已读并纳入SHA核验；独立实际运行26/26相关纯测，不将二者混称为独立重跑全量。既有chunk大小提示未扩大为本轮改造。实际四动作、未知原GET、503/404恢复、TTL、状态竞争、身份/来源撤回均对应本报告引用的真实请求/受控注入证据；不以单测代替真实路径。

最终结论限于**S10当前前端技术集成及独立合成软件任务验收**。后端caps/presentation独审另见根/T05专项，不由本审查自签；当前无新增前端权限/来源/旧模式旁路发现。根后续仍须统一living/baseline/版本/手册/API/测试与Notion，并沿原主三例完成主S10和更正链，不把本报告作为19项全部完成或临床/生产验收证明。

## 10. 冻结后共享静态依赖漂移与两次停线（历史记录）

根最终SHA检查发现共享`src/session-lifecycle.js`不再匹配5095记录。独立只读精确定位：冻结原`c03415606953bd31f4f5282acfb5dcf4b62d75fc7c653e5dbe91f58255087a6d`（5065B）至观察版`6e75e9ce3ffe9638d20eb6200d6c0809aa13d9a76407e593985e465aa8ce9cf2`（5400B）仅增加A02资产登录返回分支及静态import；删除这两段所得字节精确匹配原SHA。随后`f1290f9e5f7afc53ed959c4563cdf008d1b4748e5543c9c2f4657fd47a58d6f5`仅将同import从末尾移至第二行，其余字节相同。未推断操作者、提交或重启来源。

当时新`research-assets-session.js`为`236453cee88e3f5d90ebbb2402a63ec36b38eb4638fc666231d67396158963ce`：模块纯声明，无顶层网络/storage，路由严格仅a02；S10不进入新返回分支。session活动续期、认证失效、S10未知marker/不重放及fresh下载业务代码均未修改；S10六个主要源码/身份路由仍精确匹配原冻结。相关纯测36/36（原26加静态资产helper10）通过，随后f129亦独立复跑36/36；此处不将纯测作为新运行部署验收。

作者补490/490、隔离构建8.12秒及[新源只读S10角色/入口896f1b50](../../testing/evidence/research-t17-2026-11-12/reports-readonly-896f1b50/result.json)六项、0业务POST，另以保留5095原字节的[post-drift/manifest.json](../../testing/evidence/research-t17-2026-11-12/ui-freeze/post-drift/manifest.json)（`6abb56f028adf1ce09326b186517d63b8d3aa003d1df6b767df8b5d402741933`）追加27源/175产物/8日志/6witness。独立逐SHA核验时再次停线：资产静态依赖已成为`226e2bf7d2b955fb335be67dd67425d9ecd8c8428ea094c3b0029918c745bccb`（5420B），与6abb期望236453ce不一致；尚未吸纳该新manifest，也未将旧运行证据改署新源。

独有[session-drift-6e75e9ce](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/session-drift-6e75e9ce/)保存9954原审报告、精确重建原/观察session、两次差异、纯测日志、当前资产源码及[第二次漂移RED](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/session-drift-6e75e9ce/post-6abb-drift-red.json)。现象是共享来源持续变化导致验收依据不能固定，不据此认定S10产品回归；已通知根和作者停止自动追SHA，等待共享来源稳定后再窄核新静态依赖/当前相关测试与最终附录。没有回退、覆盖产品、请求API、连接数据库或重启。

## 11. 最终稳定快照增量复审闭合

根随后明确以一次真实、精确、前后守门相等的已验窗口为依据，不要求共享目录永久不变化，也不追逐其后未知新源。最终[post-drift/final-manifest.json](../../testing/evidence/research-t17-2026-11-12/ui-freeze/post-drift/final-manifest.json) SHA为 `3e143d76d9da05a8a254a65cb49fd3e2482c2cc60377cba8be4cf06448aab936`。独立逐项读取并核长度/SHA，**28来源、182证据、10日志、10差异/文档/runtime witness全部一致**；5095及6abb原字节仍相等。[最终独立核验记录](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/session-drift-6e75e9ce/final-snapshot-independent.json)。

| 共享依赖快照 | SHA256 |
| --- | --- |
| `src/session-lifecycle.js` | `f1290f9e5f7afc53ed959c4563cdf008d1b4748e5543c9c2f4657fd47a58d6f5` |
| `src/research-assets-session.js` | `226e2bf7d2b955fb335be67dd67425d9ecd8c8428ea094c3b0029918c745bccb` |
| `src/synthetic-asset-route.js`（纯传递依赖见证） | `2061767a1736868a6f74844388b074d1e0b9de5b7c553f11b1938e69dd156f47` |

226e增量只有新增`isAssetDraftRoute`静态import，以及A02含assetVersion时排除既有assetDraft路线。独立删除新增import并还原旧表达式后，字节精确还原236453ce原SHA；[差异](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/session-drift-6e75e9ce/research-assets-session.236-to-226.diff)。新传递依赖仅常量/函数声明，无顶层网络、storage或其他副作用，未增加S10作用域。`pageId==='a02'`仍先行短路，S10不进入新资产返回分支；原会话续期/authVersion、S10原marker/不重放和下载前后fresh业务逻辑不变。此处只签对S10的兼容影响，不签A02功能验收。

独立在f129/226当前快照运行相关纯测**37/37**，对9个相关来源在测试前后逐SHA比较均相等：[源守门](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/session-drift-6e75e9ce/226-current-related-independent-source-guard.json)、[日志](../../testing/evidence/research-t17-2026-11-12/ui-independent-review-first-hook/session-drift-6e75e9ce/226-current-related-independent.tap)。作者实际[5a8134b7只读角色/入口](../../testing/evidence/research-t17-2026-11-12/reports-readonly-5a8134b7/result.json)六项、0业务POST，前后sourceWitness均为f129/226、PID91477；该窗口没有追溯伪造早期测试PID或第三依赖的历史见证。作者491/491及隔离构建7.66秒日志已读并核SHA，未混称独立重跑全量。

最终增量无S10身份、未知恢复、不重放、当前权限/来源和fresh下载的新阻断。第9节完整独立业务/失败恢复证据与本节当前共享依赖兼容证据分别保留，不重放原报告写链。后续主执行器按根约定在每个业务POST前核已验源码摘要/runtime；再次变化停止新写、保原journal，只核原GET回执，不能将本附录无限延伸为未来源码授权。主同案/更正、产品文档/Notion及临床/生产边界仍如第9节。
