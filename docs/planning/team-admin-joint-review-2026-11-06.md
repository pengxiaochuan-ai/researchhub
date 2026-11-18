# 团队人工核实与同页联合审核实施计划

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> 执行方式：2026-11-06用户已确认计划，当前目录串行实施，完成后一次独立总评审。使用superpowers:executing-plans逐项执行。不提交其他历史脏改动，不建worktree。

**目标：** 让管理员在原团队页一次核实并审核团队、成员及所选待审机构，保持布局、授权、版本与审计。

**架构：** 复用entity.team_draft受控JSON、append-only assertion/decision、既有事务与回执。人工核实为独立provenance类型，不冒充外部资料，不新增表/授权/旧系统服务。

**技术栈：** 既有React/Vite、Node目录服务、PostgreSQL、node:test、真实Chrome/Playwright。

**规格：** [技术规格](../technical/team-admin-joint-review-2026-11-06.md) · [已确认业务规则](../product/team-admin-verification-2026-11-06.md)。

## 全局约束与评审重点

- 仅专用合成环境，原两个账号及具名合成测试对象；真实团队只读。不调用付费模型、云、远端配置或发布；新增权限/突破剩余对象与草稿额度则停下确认。
- 原列表、三个资料分区、Shell、字号14/22、44px及已批准公开确认规则保留。布局差异只限规格写明的原资料依据区与阻断反馈。
- 不复活已拒绝/撤回机构、不扩大共用已审机构范围；去重只处理本团队直接引用项。
- 审计记录由服务器生成；核实完整哈希锚定在append-only来源引用中；普通账号、跨租户、伪造、借用/篡改记录不放行。
- 预检与实际新对象ID/版本绑定、最后保存保留新核实记录、来源缓存不可掩盖claim变化、未知提交不得重复核实、公共投影不得泄露私有理由。

## J01 · 人工核实存取与来源契约

文件：新增server/directory/admin-verification.mjs及测试；修改contract.mjs、sources.mjs、repository.mjs。

接口：`claimDigest(fact): string`绑定规格中的规范事实及新revision；`buildAdminVerification({tenantId,hubKey,teamId,draftVersion,actor,reason,audience,facts,id,verifiedAt}): {record,reference}`仅供已授权提交使用；`readAdminVerification(tx,scope,reference): {record,available,fingerprint}`读取/核对记录而不直接作为事实授权；`resolveDirectorySource(tx,scope,ref,{fact}={}): resolvedSource`对人工来源要求匹配fact，保留旧调用兼容。公开白名单不输出record或claims。

- [x] RED：原规范拒绝人工类型；记录哈希/租户/Hub/audience错误、缺记录、payload或revision借用均不可用。
- [x] 最小实现：规范化admin_verification引用、构造/读取核实记录、claim摘要/匹配；原三种来源和字段/锁行为不变。行锁使用已授权目录表，不增加来源函数权限。
- [x] 测试真实PG回滚及引用契约，确认公开结果只输出经过白名单的核实展示信息。
- [x] 人工记录只读追踪，不由teamSeed回灌data.evidence；预检提案与实际fact/revision校验分离。

## J02 · 联合计划与原子提交

文件：team-contract.mjs、team-workspace.mjs、commands.mjs；新增team-admin-review.test.mjs。

接口：`normalizeTeamData(data)`兼容可选verificationMethod；`planTeamChanges(g,id,data,audience,{verificationProposal}={})`只产生待核实计划；原`previewTeamWorkspace`/`reviewTeamWorkspace`路由和审核body字段保持，返回预检可增联合机构及publicExposure。commands通用append/decide和repository传入规范事实用于J01的claim校验。

- [x] RED：无外部依据的明确本人核实应能联合待审机构/新成员；目前缺依据会阻断。另覆盖已审机构、拒绝/撤回、tenant→public及重复机构。
- [x] 新增可选verificationMethod，缺省sources保持旧接口；人工模式预检只构造提案，不创建核实或审核。planHash纳入身份及全部依赖。
- [x] 分配新对象ID→生成完整核实记录及真实claim→暂存同一事务→通过原append/decide提交→保留新记录并保存草稿/回执；失败全部回滚。通用写/读核实claim，不允许换payload借用。
- [x] 测试当前管理员/403、真实父对象、版本并发/伪造/审计原子性/原键重放；确认原外部来源链测试继续通过。
- [x] 验证无业务变化且旧依据有效时零新记录/决定；核实只覆盖变更，不把全部旧事实机械换成新人工来源。
- [x] 区分incoming/outgoing/retained来源；被替代旧依据纳入CAS但不误拦新独立人工核实，继续使用的父对象仍锁定重验。机构概况检查完整历史审核，曾有决定但新head待审不自动联合批准。

## J03 · 原页最小接线与误拦修补

文件：TeamWorkspaceFields.jsx、TeamDirectoryWorkbench.jsx、TeamReviewDialog.jsx、team-review-flow.js及相应UI/flow测试；必要时仅对已有team-workspace.css局部新增样式。

接口：`TeamFields`保留现有data/onChange；审核方式作为data.verificationMethod，前端默认建议administrator但后端省略字段仍sources。`prepareTeamReview`继续只准备，实际保存所选方式后再预检；`requiresPublicConfirmation`兼容服务端新增publicExposure及原current判定，不据前端名称猜测可见范围。

- [x] RED：本人核实不要求搜索/勾外部资料，原页理由不重复填写；待审机构核对与公开新增曝光可见；空名/拒绝状态仍阻断。
- [x] 资料依据区显示当前核实方式及去重机构范围，外部资料按需保留。既有保存/主审核按钮/三段表单不重排；不追加常规确认步骤。
- [x] 离页保护与高级入口保护分开：仅填理由不再误拦，真实dirty/pending/busy仍保护；明确显示“本次未提交审核”，保留输入与原键恢复。
- [x] 核实证据在T01/T02原来源详情区域诚实展示；不增加目录成员账号或Study权限。

## J04 · 本机联合验收、独立总评审与交接

文件：新增scripts/team-admin-review-browser.mjs及docs/testing/team-admin-review-2026-11-06.md；更新相关living spec/版本/使用/API/索引并同步Notion。

- [x] 先核对剩余机构/人物/事实/草稿保护，原真实团队数据/版本/审核留只读快照；合成新增对象具名，测试有界。
- [x] 全部前端、目录/字典及真实PG回滚测试和build；已有同源HTTP回归。环境空闲时仅重载具名本机服务。
- [x] 真实浏览器完成无外部依据→联合待审机构→人工审核→真实目录/详情/核实证据→刷新，及角色/失败/原键恢复。五宽度、原生200%PNG/WebM留痕。
- [x] 串行实现结束后独立只读总评审；修补必需问题并重验。不把Mock/测试注入或PG回滚假称永久真实公开验收。
- [x] 四层交接：代码、环境、真实执行、用户结果分开；明确仍需用户本人核实的真实资料。推荐下一项但不自动扩展其他页面。

## 计划提交状态

2026-11-06计划已批准，J01–J04合成技术交接完成；清单执行结果以[交接](../testing/team-admin-review-2026-11-06.md)为准。236前端/62后端PG/22HTTP、构建、真实Chrome五宽度/原生200%和一次独立总评审完成；1项Important经作者RED→GREEN修补复验，不伪称第二次独立评审。真实团队仍未代批准，本机事实余4而只读计划需6，新增保护调整待确认。
