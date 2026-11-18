# 本轮规划复核的源码证据

日期：2026-10-19。性质：只读静态复核；未改业务代码、未读密钥/患者行/原始媒体、未连DB/模型/生产。两个子任务分别核对AI页面和共享租户，主代理复查关键源码后集成。本文不是新功能验收记录。

## 1. 页面与旧科研基线

| 证据 | 当前代码事实与设计影响 |
| --- | --- |
| [页面登记](../../../platform-pages.json) | 50个注册页、入口存在；历史c02未注册，不额外算AI模块 |
| [统一演示边界](../../../src/platform-frontend.js#L28) | AI为固定示例；认证/协作/AI/统计未接入，不能在规划中写已上线 |
| [对象分支](../../../pages/shared/missing-main.jsx#L13)、[S01分支](../../../pages/s01/src/main.jsx#L285) | 带projectId时进入Workflow；真实对象路径与静态母版都需接入 |
| [通用AI面板](../../../pages/shared/Components.jsx#L76) | 只有展示和无业务handler按钮，不是可复用的真实AI实现 |
| [证据解读](../../../pages/e02/src/ai-panel.jsx#L90)、[抽屉](../../../pages/e03/src/main.jsx#L6) | 摘要/标签切换是本地状态，导出未接；六类解读须真实结果 |
| [注册报告](../../../pages/c03/src/main.jsx#L151) | 完整报告只是setReport；保留为明确待接动作 |
| [PICO](../../../pages/shared/Q01Page.jsx#L28)、[Hub建议](../../../pages/shared/HubCreate.jsx#L49) | 非空/问号规则、固定关键词/相似度不能冒充AI |
| [领域观察](../../../pages/h01/src/main.jsx#L288) | H01没有显式AI按钮，但“观察/依据”是内容能力，不能遗漏 |
| [机会详情](../../../pages/shared/BusinessPages.jsx#L47) | O02固定资助机会与O01研究缺口语义不同，列Q06，不伪装成统一真实对象 |
| [管理状态](../../../pages/shared/G02Page.jsx#L171)、[未接入说明](../../../pages/shared/WorkflowPages.jsx#L31) | 固定99.7%与未接入文案冲突；改为真实分层状态，不新增虚假可用率 |
| [机会结构](../../../../app/server/src/research-evidence/research-synthesis.ts#L56) | 已有问题/假设/设计/创新性/可行性/风险/nextActions，优先复用 |
| [研究纲要](../../../../app/server/src/research-evidence/research-study-plan.ts#L17) | candidate_outline、待定参数、methodRunRefs及numericAuthority；不是完整已批准Protocol |
| [证据追问类型](../../../../app/server/src/research-evidence/research-evidence.types.ts#L11)、[局部重组](../../../../app/server/src/research-evidence/research-follow-up.ts#L543) | 人工纳入/排除/背景/待核验及理由；同一evidenceRun局部重组不重新检索，基线不能丢 |
| [规范检查](../../../../app/server/src/research-methods/research-method-executors.ts#L240) | 关键词规范清单/needs_review，不能自动批准方案 |

## 2. 共用租户与四类后台风险

| 证据 | 静态观察与需要验证的事项 |
| --- | --- |
| [租户管理](../../../../app/server/src/tenants/tenants.controller.ts#L45)、[管理服务](../../../../app/server/src/tenants/tenants.service.ts#L43) | 已有平台超管列表/创建/详情/启停/配额，可共用；不是新造管理系统 |
| [账号创建](../../../../app/server/src/accounts/accounts.service.ts#L87) | 全部账号含disabled计席位；按slug取首个active组赋researcher组成员，未自动建项目成员；公开注册不能直接复用此副作用 |
| [登录](../../../../app/server/src/auth/auth.service.ts#L22)、[JWT](../../../../app/server/src/common/guards/jwt-auth.guard.ts#L38) | tenantSlug来自客户端；校验账号/租户状态，但未见部署允许租户绑定；独立Cookie/CORS不等于产品隔离 |
| [管理员重置](../../../../app/server/src/accounts/accounts.controller.ts#L81) | 不是公开自助找回；authVersion撤销机制可保留 |
| [租户初始化](../../../../app/server/src/tenants/tenants.service.ts#L67)、[功能状态](../../../../app/server/src/tenants/tenant-features.service.ts#L16) | 默认旧组/项目、三Agent及Skill依赖；功能默认关闭；需产品装配和真实执行验证 |
| [知识导入](../../../../app/server/src/knowledge/knowledge-import.service.ts#L241) | elevated全局恢复queued/processing；进程内active不是跨实例CAS；可能重复创建/索引 |
| [知识对话](../../../../app/server/src/sessions/knowledge-chat-queue.service.ts#L387) | 全局恢复/过期处理及queued读取；领取/心跳需归属，不仅按id/session |
| [原始处理](../../../../app/server/src/ingest/raw-processing.service.ts#L108) | 全局恢复及候选扫描；原子queued领取不保证正确部署执行 |
| [科研运行恢复](../../../../app/server/src/sessions/research-agent-runs.service.ts#L1177)、[领取](../../../../app/server/src/sessions/research-agent-runs.service.ts#L1276) | 全局run/stage attempt扫描，session/id领取/心跳；stale run更新未重核陈旧时间，存在恢复竞态候选 |
| [后台用户](../../../../app/server/src/sessions/research-agent-runs.service.ts#L2038)、[问答用户](../../../../app/server/src/sessions/knowledge-chat-queue.service.ts#L538) | 校验账号/成员不代表已经校验租户active，停用后任务继续执行需负例 |
| [存储](../../../../app/server/src/storage/storage.service.ts#L13)、[临时清理](../../../../app/server/src/sessions/chat-chunk-upload.ts#L498) | 存储安全依赖上层授权/key；独立bucket与串领会互相影响；共享临时目录清理需部署隔离 |
| [索引](../../../../app/server/src/knowledge/ingestion.service.ts#L54)、[授权检索](../../../../app/server/src/knowledge/retrieval.service.ts#L43) | elevated按doc操作及向量SQL必须连同授权集合链保留，不只复制SQL |
| [全局资源](../../../../app/server/prisma/rls.sql#L82)、[策略重建](../../../../app/server/prisma/rls.sql#L92) | tenantId=null官方只读共享是显式例外；全量RLS脚本影响共享库，不是新应用私有初始化 |
| [旧seed副作用](../../../../app/server/prisma/seed.ts#L320) | 更新已有账户密码hash/authVersion、删除旧关系等；禁止为新项目直接重跑通用seed |

当前没有在线权限/漏洞利用证据，以上不能写为“生产已泄露”，也不能用未验证的RLS承诺没有风险。G0/G1用合成双实例和catalog核查验证，计划见[准备清单](development-readiness.md)。

## 3. 本轮证据边界

没有执行共享库实验、迁移、模型/外部工具调用或正式业务测试。此前租户/权限相关21项离线测试和旧能力审计只作为历史契约参考，不继承为本轮或目标环境验收通过。此次实际文档链接/一致性及Notion同步结果另记progress。
