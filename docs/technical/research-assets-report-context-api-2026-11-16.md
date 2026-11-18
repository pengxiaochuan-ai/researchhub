# 方法报告资产上下文接口

2026-11-16｜对应[已批准规格RC01～RC05](../product/research-assets-report-context-2026-11-16.md)。本机专用合成环境实际整链已执行，限定具名对象；不表示正式部署或所有Study已开放。

## 范围与请求

沿用当前Cookie会话、同源写请求、`asset-catalog-v1`请求标识、真实actor/authVersion头及Study上下文头。后端重建身份与权限，不信任浏览器的管理员声明。

仅原合成admin、租户/组与具名来源project `cmwczp5hk0003lud9lsla5b75`；唯一源报告 `rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe` v1。owner不新增成员或来源/资产授权。三条新路由不接受任意reportId或查询参数。

| 方法/路径（均在/api下） | 输入与结果 |
| --- | --- |
| GET `/research-assets/report-context-source` | 返回固定Study/报告/版本/摘要、当前作者及已有登记结果。实际运行T17当前来源链校验，不单凭数据库released状态放行 |
| POST `/research-assets/report-context-registrations` | 仅`purpose`、`limitations`、`rightsEvidence`、`requestKey`；后端取得固定正文、来源绑定与作者，不收客户端统计正文。首次原子登记；同键同内容返回原回执，同键异输入409，异键同来源返回原资产，不重复登记 |
| POST `/research-assets/report-context-revisions` | 上述四字段加`baseVersion`、`expectedRevision`；仅修订说明，固定报告正文/hash不变；最多v2 |

成功回执沿既有`assetId/version/revision/operation/status`语义；已登记回查另带当前版和工作态。未知提交先用既有GET `/research-assets/operations/:requestKey`核对，不自动重复POST。浏览器仅保存身份/原键标记，不持久保存正文或权利说明输入。

目录沿用GET `/research-assets/catalog`；固定详情沿用GET `/research-assets/catalog/:id/versions/:v`。提交、退回、批准沿既有`/:id/submissions`、`/:id/reviews`和治理options，不建第二份审核状态。审批通过保持private/unreleased，不自动授予共享、AI、下载、派生或应用用途。

## 同事务来源桥

`ResearchStudiesService.resolveResearchStudyInTransaction`仅内部组合使用，调用方持有当前授权锁和事务。`T17Reports.readForAssetInTransaction`在同一事务运行原Study解析与固定报告current逻辑：真实父对象、方法人工确认、快照当前投影、报告与来源完整性、原报告审核全部保留。桥不创建报告、不运行方法、不处理文件或模型任务。

`local-research-analysis`在装配原T17服务时绑定本机来源读桥；尚未装配时503，不提供伪造成功或外部请求兜底。`createLocalResearchAssetCatalog`只为上述具名project分流当前授权；旧project仍用原分支。

已知原报告来源/授权失效保留401/403/404/409，在Controller边界转为受控资产错误；未知异常不伪装成无权限或暂无数据。版本冲突保留输入并重新读取；401/403清私有区，身份变化后的迟到响应丢弃。

## 数据与自有约束

内容仍在原ResearchArtifact/Version；登记/版本用途/审核事件复用rh_asset及原Review/Audit。固定源绑定保存在version_policy与内容封印，创建事件保存真实reportVersionId/Study/runId；不新增正文库，不使用未定义的旧Source类型。

- 唯一新assetId：`rh-report-asset-20261116-admin`；独立context幂等键，原26目录对象及4份B草稿不变。
- 仅新project＋原admin＋publication单槽位，最多2内容版、12成功事件；新族事件只允许created/revised/submitted/reviewed。
- D03：精确project CHECK与父对象/来源policy/事件守门；D03 scope补充：自有scope_matches只增“具名project＋当前原admin”分支。没有更改public定义、旧系统、角色/GRANT或RLS策略表达式。
- 两项应用前均SAVEPOINT预测/回滚，未知指纹拒绝；新回执用fullNames稳定读取，保留原NAME截断指纹及全部旧回执。失败事务不以重置基线处理。

## 验证落点

`research-assets-report-context-preflight.mjs --readonly`只证明元信息/hash与范围；`research-assets-report-context-source-pg.mjs --no-write`运行实际原服务来源读链。三组`research-assets-report-context-pg.mjs --rollback-only [--case revise|approve]`证明真实app角色登记防重、退回修订及批准私有，全部回滚，不构造统计运行成功。

真实页面分create/return/revise/approve四个受控阶段，每阶段先核对实际数据库状态，再执行既定操作，状态已变则拒绝重复。独立readonly阶段检查A01/A02与来源回链；现场截图/录屏、丢响应、权限与布局证据另入测试报告，不用以上回滚脚本替代真实页面验收。

## 实际装配与只读恢复

新project精确facade使用既有prisma.app事务并设置tenant/group/project本地上下文，不修改共享启动入口的旧project守门。S10与G02安全登录返回路径已纳入现有return校验，拒绝重复/额外/错域参数。G02读既有catalog端点，批准后返回当前v2；不建立独立审批状态。

A02既有activity投影仅对report_context审核事件增加reason/conclusion，二者成对且结论approved/changes_requested；缺失则409，不补造理由。旧family的DTO不加字段。A02仍原七Tab/侧栏，正文有原报告v1回链；不开放的AI解读不调用状态接口，避免403误清已授权正文。

登记状态由页面稳定钩子持有；暂时5xx/网络错误只隐藏来源、禁用操作，不当身份退出。同一actor/authVersion/role/Study/路由输入和pending原body/key保留；真正401/403、身份或范围变化清除私有状态与迟到响应。sessionStorage仅身份和原键，不存正文或说明。

成功事件共6（created/submitted/reviewed/revised/submitted/reviewed），当前v2/revision6/approved/unreleased；测试脚本不会在已有状态重新执行create/return/revise/approve。sealed迁移源文件是回执hash的一部分，不可在应用后改写；后续必要修补应另建精确迁移。

[四层验证/失败原件/当前边界](../testing/research-assets-report-context-2026-11-16.md)。
