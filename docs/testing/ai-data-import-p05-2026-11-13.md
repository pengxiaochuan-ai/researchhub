# P05 一次确认到被试／访视入库 · 本机验证

2026-11-13。用户已批准[M01–M05](../planning/qiyan-ai-file-data-2026-11-12/authorization-p05.md)。**本机P05技术交接已通过；唯一独立总评审2项Important已集中修补并复验**。不是生产发布、医学专业签收或完整数据Agent交付。[技术契约](../technical/ai-research-data-import-2026-11-13.md)。

## 目标与限定

- 仅wp01_test_full_baseline、原owner/admin、Study `rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090`；源会话仍属原知识资料项目，目标执行项目`cmwcc7ft60002lua6zkvh0mxj`。
- 固定executing v2、BASELINE、已发布`cmwcc7fux0002lux0dxq7ukdx`；科学数值走原生schema/校验/确定性评分，没有模型调用。
- 档案导入只建Subject。M05独立准备使用真实原生参与事实/入组函数，沿已批准合成政策的not_applicable决定，不伪造IRB或同意，不自动完访。
- 不改旧角色、Token额度、旧public表结构、P04定义或旧服务；没有正式采集启用、审批、锁库、共享、发布、导出、外部邮件或云资源操作。

## 代码与配置

1. 新`research_data_import_access`、`research_data_imports`两表：FORCE RLS、真实两条父链、当前actor、审核审计、不可变确认快照/行manifest、精确CAS、原子回执。app仅必要SELECT/INSERT/UPDATE，没有DELETE/TRUNCATE/schema CREATE。
2. SQL base hash `4419fd2f80b300ca68cb11d1369d019d464b940fd2ce58de5c35668310a66b1f`。本轮新guard v2 hash `6d89c1e650ceaa0fc8a6b1d2e5b950f59a8cb82b4dcbc591208404c319e393c4`：真实admin可显式恢复同一未到期许可，身份/能力/父链/原到期时间不变，状态/CAS与审计递增；不是自动续期。升级先校验已存catalog，不盲目覆盖。
3. 旧材料legacy hash `912f7d1ea2d41f247d8273ef7f576382284bf380aca24d3a082f972817b37bef`；P04 staging hash `8f12e5502af3e50692afa26c2bc1aac4bcbbaf2dafd5f1249295ed621c126c87`保持。
4. owner唯一许可`rh-p05-import-20261113-owner`仅该Study/本人/本轮scope与真实新对象；有效至`2026-11-20T07:36:52.684Z`。admin用原生权限，未伪造Study成员。临时撤权只操作这一行，已恢复active，未延长到期时间。
5. 旧源码只适配`formal-response-assignment.ts`、`formal-response-commands.ts`两处可选服务端授权依赖。默认仍走原权限；P05回调接收真visit/form/assignment/action，仅submit，不接受客户端许可标志，不开放draft/correct/review/lock。
6. 预检复用Hub capture内部typed-row规划，XLSX保留0/false及sheet/物理行；CSV沿原严格类型转换。`subject_code`旧模板别名经原生解析15项回归，双编号列仍拒绝歧义；原score/flag不猜value/completed。
7. S03不足原菜单权时，只允许当前限定许可和本轮receipt对象的只读投影，普通create仍403。S09沿原固定修订路由；不全局打开canAssign/canSubmit。
8. 原AI01预检区一个“确认导入”，匹配唯一Study自动展示；确认后真实结果与S03/S09回链，刷新不重复写。不把数据送文献模型；输入区只保留一处真实AI分析暂不可用说明。

## 真实执行证据

| 阶段 | 证据（仓库.tmp内） | 观察 |
| --- | --- | --- |
| 准入只读 | p05-preflight-1794551812438 | 原owner403/admin通过；真实v2/BASELINE/Form/父链；写0 |
| 前序基准 | p05-baseline-1794552186743 | 两账号原页面Chrome、截图/WebM、业务POST0 |
| 新表/限定许可 | p05-schema-green.log、p05-restore-green.log；p05-authorized-scope.json | 旧表指纹不变、创建/重入/受控guard升级；只一条新许可 |
| 核心写回滚 | p05-visit-core.log、p05-fixture-green.log | 创建2Subject、独立合法准备、2CRF；重放、SHA/visit版本变化、提交后失败整批回滚 |
| 受控组件Chrome | p05-ui-1794556669465 | 正常、丢成功响应、切身份迟到、断网四场景；不自动重复提交 |
| 真实档案流程 | p05-browser-profiles-1794557432477 | 两账号各1新CSV、各2Subject；一次确认、刷新不重写、owner S03仅本人且普通create403；admin模拟成功响应503后刷新GET恢复 |
| 独立合成准备 | .tmp/p05-named-owner.json、p05-named-admin.json | 各2本轮Subject原生参与事实/入组/BASELINE；明确separateFromImport=true |
| 真实CRF流程 | p05-browser-visits-1794557573418 | 两账号各1新XLSX、各2提交；原0/false、固定修订hash吻合；S03/S09相同对象；0页面异常/拦截 |
| HTTP负例 | p05-http-negative-1794557824424 | 22项：跨账号/源会话/Study、伪权限、旧hash/版本、无export、原key重放、旧档案回执、数据问题入队前409 |
| 真并发顺序 | p05-races-1794557938532 | 撤权先完成→confirm/get拒绝；import先持锁→revoke等待200ms后仍未完成，提交后生效；撤权后结果拒绝；显式恢复原scope/expiry，结果可读 |
| 当前批次修补 | p05-http-admission-1794558031960 RED；p05-current-batch-green-final.log；p05-http-admission-1794558316083 GREEN | 旧批次较新操作遮住当前访视结果；改current按当前P04批次选，而非全会话最后操作。强READ ONLY真实PG＋真实HTTP复验，不造新记录 |
| 最终页面视觉 | p05-visual-1794558319007 | 两账号六宽1440/1280/1024/768/390/320＋owner Chrome原生200%（dpr2、scale1），共13；14/22、按钮36/44、回链/键盘/无页面溢出；业务写0、页异常0 |

上述证据目录均为`.tmp/ai-file-data-2026-11-12/`，短日志为`.tmp/`。图片和WebM位于各浏览器目录。P04材料、历史原件、任务和账本保留；正式审核/锁库/完成访视未执行。

## 验证命令及实际结果

- `node --test tests/*.test.mjs`：622/622，`.tmp/p05-frontend-suite-final.log`。纯前端目录已核无PG fixture/临床连接。
- 核心纯/边界/旧capture/subjects定向：28/28，`.tmp/p05-core-suite-final.log`；新增旧模板别名及原生预检另15/15，`.tmp/p05-template-alias-green.log`。
- 创建夹具前的真实PG写回滚完整通过，见`.tmp/p05-visit-core.log`。持久验收4记录已存在后，不再用同名编号重建/覆盖，创建回滚测试明确保护跳过，不称再次通过。
- 当前真实PG套件：14通过、0失败、1上述保护跳过，`.tmp/p05-post-fixture-pg-suite.log`；含12表约束/恢复、1原生权限、1当前批次只读。
- 旧server `pnpm exec tsc --noEmit --incremental false --project tsconfig.json`退出0，`.tmp/p05-native-typecheck.log`；无编译产物/tsbuildinfo覆盖。
- 隔离Vite构建4.97秒、退出0，`.tmp/ai-file-data-2026-11-12/p05-build-implementation.log`；既有大包告警保留。后续最终修补后还须按变更重验。
- 独评前owned重载95083→98184→4192，七服务ready，数据/凭证保留；当时模板别名尚待最终装载。此项已在下方13672最终复验关闭，不把此前单元绿色冒称装载证据。

## 独立总评审与收尾

唯一只读总评审`/root/p05_final_review`已完成，无Critical，2项Important，无额外Minor。独审自行复跑21项纯契约并复现；作者一次集中修补，不再启动第二轮总评审。

1. **显式Study列被当成未映射列忽略。** 新增`study_id`/`研究编号`、档案/访视、匹配/冲突用例。RED `p05-review-study-red.log`，GREEN `p05-review-study-green.log`5/5；prepare和confirm均由真目标传入，不改P04原件/hash。
2. **提交后状态GET失败还能取消源预检，导致真实入库结果不可读。** UI已知/未知状态分离；未知先原key GET、禁止源取消/重新预检，错误不再声称没入库。后端P04取消在原事务锁定检查依赖P05计划，planned/committed拒绝，启动必装配。PG RED `p05-review-cancel-red.log`、GREEN `p05-review-cancel-green.log`，实际来源state/version/hash不变；Chrome有效RED `p05-ui-1794559795572`，GREEN `p05-ui-1794559973758`，五场景含未知读取恢复，无重复确认。

### 集中修补后的最终装载与复验

- `p05-review-frontend-green.log`622/622；`p05-review-core-green.log`42/42；`p05-review-pg-green.log`3真实PG通过/1具名持久记录保护跳过。前序schema/创建回滚证据仍保留，不累加重复组数。
- `p05-review-build.log`隔离Vite构建7.11秒/退出0，旧大包告警保留；旧两处TS未再改，原typecheck证据继续适用。
- processing0、仅owned本机4192→13672重载，7服务ready；新源取消guard、模板别名及恢复UI实际装载。`p05-http-admission-1794560190333`两账号targets/current200且匹配当前P04。
- `p05-http-negative-1794560190333`28项真实HTTP通过：增加两账号已提交来源取消409 `DATA_ALREADY_IMPORTED`，随后原receipt可读/原P04版本保持。所有原22项仍通过，没有新对象/模型任务。
- `p05-visual-1794560190334`最终两账号六宽＋原生200%，13视图，字体/链接/键盘/0横向页面溢出、0页面错误、0业务写。窄屏长文沿原消息区滚动，不能以整页截图未显示全部正文推断数据丢失；额外可达性截图见后续补充。
- 强READ ONLY数据库核对`p05-facts-1794560158954`：4Subject/4Enrollment/4Visit/4CRF、4新文件/6P05计划、owner许可active v6且原到期未延长、原角色/authVersion与材料/P04/账本不变；模型任务0、原Token预留152。最后一次HTTP/视觉后还以只读脚本复核，结果登记下方。
- 最终追加`p05-visual-1794560261099`13视图：窄屏及原生200%逐个聚焦/滚动三个结果链接，以`elementFromPoint`核验真实可点击，不仅检查存在或无overflow；截图/WebM保留。320/390沿原独立消息区滚动，可视空间较紧，不据此扩成布局改造。浏览器后`p05-facts-1794560331134`再次严格只读核对通过，数量/许可/旧材料/账本全保持；无新增模型调用。

- `server/ai-agent/research-data-import-{contract,access,mapping,schema.sql}`、`research-data-imports.mjs`、新import相关测试。
- `scripts/ai-research-data-import-{schema,native}.mjs`、`local-research-data{,-imports}.mjs`、`ai-research-data-p05-{setup,fixture,prepare-named,races}.mjs`。
- `pages/shared/ResearchDataImport.jsx`、`ResearchDataPreview.jsx/.css`、`AgentMaterials.jsx`、`src/research-data-import-session.js`与transport。
- Hub `research-capture/imports.mjs`、`research-execution/subjects.mjs`及shared controller/factory/main的限定读取依赖接线。
- 旧app两处已批准可选授权依赖；其余旧源码、peer表单适配/H5逻辑不属于P05改动，不恢复/重审其他任务。

## 文档交接与操作入口

产品基线/变更/版本、使用说明、主规格/串行计划/授权、前端与新增API/数据契约均同步；保留其他模块与前序历史。Notion新[技术契约](https://app.notion.com/p/41756479ab588138aa39c821cc46c4b5)、[本机验收](https://app.notion.com/p/41756479ab5881d19b84f278d9fb400e)各一页，11个已有对应页更新P05局部，不新建重复版本；实施台账当前结论并入原串行计划同步。凭证/DSN/环境文件不上传。

本机入口[岐研AI](http://127.0.0.1:19501/pages/ai01/)。使用原体验账号，在本人上传P05文件的原会话查看“研究数据导入”，经“查看本次被试”及BASELINE链接回真实S03/S09；owner只见本人获准对象，admin沿原权限。体验密码沿原本机私有文件，不写入本文。需要新导入时先核对显示的Study与实际写入摘要，一次确认即可；目前P06数据AI不可用。

## 四层当前结论

1. 代码：确认、原生建档/访视提交、当前授权、固定source/target/行版本、原子回执和UI恢复已实现。
2. 配置：两表/限定DML、owner一条精确许可、独立本机13672已装配。未改变原角色/Token规则。
3. 实际执行：原两账号真实HTTP/Chrome已生成4被试/4独立入组访视/4提交CRF，22拒绝和两种并发顺序有证。
4. 业务效果：本机一次确认/真实回执/源值与来源回链达到本片技术用例，独审及修补后真实环境复验已完成；用户专业体验签收单独保留。不是生产、P06数据AI或旧数据Agent全部能力验收。
