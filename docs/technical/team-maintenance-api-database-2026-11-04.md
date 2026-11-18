# 团队维护兼容扩展

## 2026-11-12 · 获批P1唯一合成夹具与实体数量保护

`localDirectoryBudget`仅organization3/team3/researcher4→4/4/5，用于获批唯一新合成团队、机构和负责人。当前身份/来源/CAS/审核/审计、48KiB与250KB等其余保护不变；固定操作次数上限此前已移除，下方旧100次描述是历史，不恢复。无API、DDL或GRANT变化，不修改旧服务。

新增对象实际201/保存/联审/回执/409及T01/T02投影、31相关后端回滚、489前端、构建与五宽200%有证。R01/R02仍PENDING且无研究者列表/详情路由，不将底层researcher实体当作已接接口。完整P1依赖未闭合。[本轮证据与未决项](../testing/governance-p1-team-2026-11-12.md)。

## 2026-11-06 · 本机目录事实40条限制已移除（现行）

按用户批准，仅删除本机assertion:40配置及旧检查脚本对应断言，不清理历史，不换成更大数字。机构3/团队2/研究者4、草稿100次及大小、当前授权、租户隔离、来源、版本、审核和审计仍保留；页面布局、登录会话、旧服务和数据库权限不改。目标环境已重载，真实合成接口达到42条，审核决定仍33条；原事实、真实团队草稿及公开展示不变，未代批真实团队。下方36/40余量不足等为历史快照，不再是现行事实数量门禁。管理员继续在原页核对资料并明确审核，不因移除数量限制自动通过。[本机验证](../testing/directory-fact-limit-removal-2026-11-06.md)。

## 2026-11-06 · 人工核实与同页联合审核

无DDL/授权变化：复用team_draft.verifications保存服务器核实记录，完整hash锚定在append-only事实provenance。新增admin_verification来源仅支持profile/affiliation/team_member，按具体事实/修订核对；外部来源锁不变，人工记录锁原目录行。data新增可选verificationMethod=administrator/sources，省略仍sources；workspace只增私有verifications追踪、entities详情增profileReviewedBefore，preview只增jointInstitutions完整概况与publicExposure，原review写body不变。人工引用不回灌外部evidence；首次待审机构才可联合提交，全部记录/事实/决定/草稿/回执/审计同事务。前端对比已读机构完整profile，变更时阻断当次审核并刷新。已完成合成技术验证；本机事实余4不足真实团队计划6项，未扩额或代批。[规格](team-admin-joint-review-2026-11-06.md) · [证据](../testing/team-admin-review-2026-11-06.md)。

## 2026-11-05 · 本机审核固定20条门禁移除

控制器将同一localDirectoryBudget装配给db，移除decision项，不用Infinity/更大数字/清零代替；organization3/team2/researcher4/assertion40及草稿操作100仍在。通用budget函数、业务授权、来源锁、CAS、审计、事务、API和数据库结构均不改。检查脚本只去掉decision<=20，仍返回真实历史计数。[测试](../testing/directory-review-limit-removal-2026-11-05.md)。

## 2026-11-05 · 原位审核的只读范围

GET团队workspace只增`publishedAudience: 'public' | 'tenant' | null`，分别基于当前有效公开/租户投影；用来初始化范围，不作为写授权。公开确认由本次preview的audience/current决定。普通明确提交在必要保存→读回→预览后审核，正文使用preview.version/planHash、原页理由和唯一requestKey；缺项或零变更不发审核POST。公开新增曝光才有简短前端确认，服务端最终来源锁/CAS/权限/原子审核均不变。无DDL/授权扩充，原currentRevision/baseRevision语义保持。[规格](../product/team-review-inline-2026-11-05.md) · [验证](../testing/team-inline-review-2026-11-05.md)。

## 2026-11-05 · 已读编辑基准（409修补）

GET原字段不变：baseRevision表示历史已保存草稿的目录基准，currentRevision表示本次实际读取的目录快照。前端写入用已读currentRevision（旧响应fallback baseRevision），保留原expectedVersion。审核准备发现历史基准不同则先保存/重读/预览，不自动批准、不在冲突后抓新基准覆盖。后端CAS和来源检查未改，无API/DB扩展。[证据](../testing/team-edit-revision-2026-11-05.md)。

## 2026-11-05 · 本机浏览器端口丢失兼容

三个团队POST（create/save/reviews）显式接受完整的浏览器同源证明；只有Origin为`http://127.0.0.1`且site/mode均same-origin、dest empty、Referer精确19501来源和专用X-ResearchHub-Request=team-workspace-v1时才进入该分支。原完整Origin路径、JSON/Host/loopback/转发头/48KiB、当前DB身份与CAS/审核/审计不变；其他接口默认不启用。前端明确mode=same-origin，仅团队写入携带专用头。无CORS、表、角色或旧代码变更。[本轮证据与适用限制](../testing/team-origin-rejection-2026-11-05.md)。

## 2026-11-05兼容说明

页面精简无新增/放宽API、表、字段或权限。审核入口必要时调用原保存→GET同对象→GET精确audience预览，明确确认后才POST原reviews；原CAS/来源锁/审计/回执保持。DIRECTORY_ORIGIN_REJECTED单独解释且保输入，真正401/权限403清私有区。冲突不自动改基准。[新规格](../product/team-maintenance-usability-2026-11-05.md)。

## 数据库与授权

只在rh_directory.entity新增team_draft jsonb NULL，仅team可非空、object、256KiB。仅增aisci_app UPDATE(team_draft)；沿原SELECT/INSERT，无表级UPDATE/DELETE、旧来源写或业务角色新增。现有三表RLS、来源必填、逐版本决定/审计保留。

封装hubKey/version/data/baseRevision/savedAt/reviewedVersion/operations；data只允许表单字段，名称必填，最多20人/10依据/40KiB，HTTP仍48KiB。最多100次带actor/用途/key/hash/结果的回执，达限明确拒绝，不丢历史。选已有主体只读共享档案，不按同名绑定；新人员只是目录候选，不是账号。

迁移命令：`node scripts/team-draft-schema.mjs --mode local-synthetic --approved-team-draft`，仅wp01_test_full_baseline。原三表和来源锁收据不变，team-draft独立v1收据保留，v2追加完整列/表ACL指纹；升级须旧指纹一致且仅aisci_app列UPDATE、无grant option。v2没有新增DDL/授权。旧inspector只排除entity.team_draft与该表具名check，其他漂移继续拒绝，新inspector完整接管扩展。

## API

前缀/api/hubs/lingshu-xinyu/directory-admin/，所有读取/写入/回执都检查当前active账号/authVersion/admin/tenant/Hub及RLS；原同源JSON/loopback/Host/48KiB与重复/未知参数拒绝保持。

| 方法路径 | 契约 |
| --- | --- |
| GET team-workspaces?q=&page= | 20条分页，名称/草稿版本/已有展示及审核状态 |
| POST team-workspaces | data/requestKey，自动稳定标识并原子保存首版 |
| GET team-workspaces/:id | 草稿/版本/基准/当前目录/保存时间/历史 |
| POST team-workspaces/:id | expectedVersion/baseRevision/data/requestKey，CAS保存不改公开事实 |
| GET team-workspaces/:id/preview?audience=tenant或public | 完整拟展示/变更/缺项/来源/planHash/canApprove |
| POST team-workspaces/:id/reviews | expectedVersion/planHash/audience/reason/requestKey，同一事务逐条事实/决定/审计/回执 |
| GET team-workspaces/:id/receipts?key= | 当前操作者精确回执，404不证明未提交 |
| GET team-workspace-choices?kind=organization或researcher&q=&page= | 分页候选/必要共用档案 |

无新上传或网页获取端点，待补说明/链接不能跳过来源审核。

## 提交及恢复

当前授权/租户排他锁→草稿版本/目录基准→编译计划及必要父依赖→稳定顺序锁本次来源→再预览/hash核对→创建必要候选→先profile、结束旧关系、再新关系→逐项审核→草稿/回执/审计→提交；任一步失败全回滚。无关来源不锁入本次提交。新机构标识绑定显式审核编号，后续再换机构不撞旧对象。

“仅租户成员”精确收窄当前团队，旧public事实需追加范围决定；共用人物/机构的原范围不随团队降级。内容不变且旧依据仍明确保留时沿用原事实，避免同份材料复用制造无意义版本；内容/依据替换/受众变化仍需审核。成果数不由表单手填，原coverage失效规则保持。

401/403清私有表单；checking遮蔽/使迟到读取失效。409保留输入→对照当前草稿与目录→明确选基准→手动保存。未知POST保留原payload/key，先查回执或同键重试，不自动重发。新建未知ID先查entity_create原回执再核草稿回执。停用时保留数据/列/历史及兼容检查，不自动删列/撤权/停旧服务，本轮无真实发布。
