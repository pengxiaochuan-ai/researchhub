# P05最小新增授权清单（已批准，本机技术交接）

M01–M05已在下述边界实施并验证：2新表、owner唯一限定许可、原生最小适配、4具名Subject及独立4入组/访视和4CRF。4新文件、6P05计划均低于上限；没有模型调用或角色/Token扩大。一次独审2Important已集中修补，许可恢复保持原到期与对象集合；用户专业签收/正式环境未执行。[完整验证与当前状态](../../testing/ai-data-import-p05-2026-11-13.md)。下方批准依据和界限保持。

2026-11-13用户明确回复“批准”，M01–M05全部生效；仅下述范围，实际结果按实施证据登记。依据当前用户“先明确具体Study关联和最小导入授权，再接通一次确认”的要求，以及已批执行计划的新增DDL/权限/旧源码差异门槛。先前批准的P04两表和原file.read不再申请；本页仅新增项。

## 推荐目标

复用真实Study `rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090`（科研流程合成贯通 · T05 rh-t05-http-f75b3165），真实执行项目`cmwcc7ft60002lua6zkvh0mxj`；当前执行v2/BASELINE与已发布value/completed表单，来源AI01项目不变。无需新课题/Study/绑定/执行项目，无需伪造admin成员。

## 一次确认的最小范围

| 编号 | 新增授权 | 限定与不包含 |
| --- | --- | --- |
| M01 | 上述Study用于P05实际验证 | 仅wp01_test_full_baseline、原owner/admin本人本轮新对象；前序被试、答卷、报告/文件只读 |
| M02 | 两张rh_ai增量表：research_data_import_access、research_data_imports，必要索引/约束/触发器/FORCE RLS及最小SELECT/INSERT/UPDATE | 第一张保存精确Study/账号导入许可、授予/撤回审计和CAS；第二张保存固定确认计划及原子提交回执。不改P04旧定义，不改public表结构，无DELETE/TRUNCATE/CREATE |
| M03 | 给owner新增单Study、self且仅本轮scopeKey/来源会话＋具名对象集合的profile.create/visit.import/result.read许可1条，批准后7天、不自动续授 | 本轮对象由建档receipt/合成准备登记的实际Subject/Visit ID固定，与self/当前Study取交集，前序本人记录也不写。不向组角色添加subjects/data/data.upload/form.fill/subject.create；不改账号/Agent/Token额度。admin已有原生最高权限，无需补权；两个账号仍不能读彼此私有上传 |
| M04 | 旧formal-response-assignment.ts和formal-response-commands.ts的授权调用提取为默认仍走原鉴权的服务端依赖；P05专用资源预检投影同步使用限定许可，不全局改旧canAssign/canSubmit | assign传visitId/formVersionId；write传assignmentId/command.kind，只开放submit。保留当前账号/authVersion、study_operations与活跃group/project；回查本轮集合/self/完整父链及逐行executing v2/BASELINE/Form/答卷版本。原同意/排期/模式/更正/锁定/审计/评分与默认HTTP权限不变。不接请求中的函数/authorized标志、不冒充admin。若需更多旧文件改动，另列差异 |
| M05 | 本轮具名合成夹具/真实写入 | 最多4新Subject（两账号各2）、4新Enrollment/4基线Visit、4新表单Assignment/Response及必要追加修订/原生审计；本轮新CSV/XLSX最多8份、导入计划最多8个。真实在途撤权只变本轮新许可行，不动账号/角色/历史对象 |

M05的筛选/同意/入组/访视是独立具名合成准备，沿旧规范并单列审计，**不是文件导入自动入组或自动完访**。档案导入先验证仅建档；访视批次只绑定已合法入组/存在的基线访视，不创造计划外访视、伪造IRB或填补缺数据。用同一Study的原生v2与已发布表单，不改Protocol/CRF配置。

## 两表约束摘要

- access：tenant/account/Study/group/project必须真实一致；能力仅上述三项子集，scope=self＋本轮scopeKey/来源会话/真实对象集合，7天有效；current真实管理员才可创建/启停；许可version递增，身份/父链不可换。普通账号只读本人许可。授予/撤回、提交/回执共用tenant授权锁：撤权先提交则后续拒绝，导入先持锁则撤权等待；撤权后读取重验当前交付范围，不承诺中断已持锁事务。首批owner一条，不建通用授权平台。
- imports：tenant/actor/session和来源P04预检ID/version/hash、1–20固定upload ID/version/SHA；目标Study真实父链/执行Protocol/政策/Form固定版；映射、确认hash、许可引用及source版本；request key唯一、精确CAS。变更源/目标/映射新计划，提交结果不可覆盖，保留真实Subject/Visit/Response修订引用；无自动重试/物理清理。
- 应用角色只新两表必要DML，普通用户没有写许可表的能力；无新schema CREATE/旧表GRANT，无新云/外部配置/模型请求/账单。

## 仍须保持

仅本机、专用合成库、当前目录串行＋一次独立总评审；旧服务/前序数据不变，不开放正式研究采集启用、审批、锁库、共享、发布或导出。CSV/Excel输入不是临床事实核验或统计计算；原型/科学值由原生契约处理。用户专业验收与生产发布独立。

完整流程、复用点、API/两条父链、UI/UE与I01–I08计划见[p05-minimal-implementation.md](p05-minimal-implementation.md)。本页已批准，按序实施两表DDL/GRANT、许可行、两处旧源码适配及具名新对象；不重复申请相同范围。
