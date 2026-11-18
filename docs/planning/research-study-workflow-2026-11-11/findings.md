# 科研课题流程设计发现（2026-11-11）

## 当前实施补充（优先于下方设计阶段历史）

用户已批准调用方式补充和代码实施。首批采用源码/同一受限事务复用，不通过旧HTTP组合跨事务写入。实际PG证明audit INSERT RETURNING会触发项目级SELECT RLS，故采用预分配ID与无RETURNING写入，保留隔离与父链。Hubowner精确匹配领域及组；成员须当前有效父组，敏感回执重放重验执行授权。

创建已接通持久草稿、列表/编辑/继续、默认研究和真实准备概览；旧历史项目不自动变成新意图。代码与真实验证见创建living spec及本轮testing；其余采集、问卷和分析按后续依赖推进，不恢复无关旧任务。

并发工作区收尾观察：两份约定保留源码摘要相同；既有runtime PID46505→84821，七服务ready，重启原因未核实。本任务只启动/停止自己的19611/19612进程，不触碰旧runtime恢复；preservation.json保留原PID断言失败作为观察，不能将“本任务未重启”扩称为全工作区进程不变。

本记录仅服务本轮用户请求，不作为后续自动续跑指令。

## 后续复用清单核对

- 旧系统已有正式执行项目CRUD：StudyGroupsController的study-groups/:id/research-projects，Controller要求tenant_admin；不能把Hub缺正式创建写成旧系统无能力，也不能由普通研究者绕过该限制调用Service。
- StudyGroupsService.createResearchProject在事务创建ResearchProject、创建者project_manager成员和审计；Hub意图/Study绑定/幂等需要与其原子交接，不能外包事务后假定没有部分成功。
- Hub现有Auth适配createHubAuth复用AuthService，保留ResearchHub统一12小时会话政策；正式研究装配沿用此入口，不回退旧会话规则。
- 旧PrismaService.forTenant每次操作创建作用域事务；withTenantTransaction提供同一tx的tenant/group/project上下文，回调内不能嵌套forTenant。
- Hub目前研究任务/采集/方法装配主要见local-knowledge.mjs及local-*适配器，正式入口须与fixture-guard和具名合成限制分开；不能通过删校验将体验壳当正式后端。
- 已核对13模块清单与19任务；41源码符号、7现有package命令及新增文档/索引15个本地链接通过，机器报告为reuse-source-check.json。
- 新方法不仅需要Worker执行器：MethodsService的专业Skill注册、执行分派/结果映射、工作台入口映射和当前Agent/Skill授权配置也需同步；T16必须从正式服务实际抵达Worker验收。
- 正式研究/数据使用同意与Participant用途/渠道同意分开，Subject.consentScope文本或触达granted不能替代完整研究同意版本。

## 已核对
- 根 AGENTS.md 要求依据现有代码/文档、三端联动、子 Agent、Notion 同步与四层验收。
- docs/product 已有 11（访视/eCRF/H5、确定性量表、数据放行）、17（被试详情）、18（课题执行讲解流程）等相关方案，应先核对后复用。
- researchhub/AGENTS.md 要求 Project/Study 等现行模型以 product-baseline 为准，既有布局不能因接线自行重设计。
- Root app 与 researchhub 为不同产品实现，不能将两者能力混报。

## 证据口径
本轮为只读代码与文档核对，尚未运行目标环境真实业务验收。代码/测试存在不等于部署、生效或业务可用。

## 当前请求的关键结论
- Q01真实创建只在已有scope中创建protocol_draft产物，不创建正式Project/Study；须先解决产品Project→Study与物理ResearchProject执行容器的映射。
- S09正式真实模式未放行；S03–S05真实切片为合成记录包；S06为缺失/人工范围检查而非疗效分析。
- S08已有旧事务核心局部复用及历史本机证据，但controller仍allowFormal:false且限制合成夹具。
- 旧FormResponse缺正式修订/审阅锁定闭环；通用问卷未自动进入Feature/ScaleResult，不能以问卷提交计数代替分析输入。
- 旧H5发送为沙箱；必须区分创建链接、真实投递、打开、提交和访视完成。
- 用户确认目标ResearchHub。本稿建议复用服务/契约并沿现有页面补正式闭环，不改Shell、不迁移旧历史数据。
- 完整证据、对象/任务流程、批次与四层验收见researchhub/docs/product/research-study-workflow-design-2026-11-11.md。
