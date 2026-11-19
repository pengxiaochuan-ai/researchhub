# 独立合成方法：描述统计执行身份最小增量

2026-11-18，用户已批准该最小身份增量。按以下准确范围实施；后文申请时的阻断保留为历史。承接已批准两开关、3受试者/CRF、1次免费确定性方法和真实来源报告验收；不新增方法次数、Study、账号、角色、成员或额度，不生成虚假方法结果或报告。

## 真实阻断

唯一原生方案已完成检查、提交、批准和启用。3份合成CRF已录入、复核并固定输入版本；1个分析计划已审核、1份数据快照及结构质控已通过。POST分析运行接口返回404 `AGENT_NOT_FOUND`，新库Agent、Skill、装备、AgentAccess、工作台会话、方法运行及模型运行均0。

旧`FormalDescriptiveRuns.prepareWorkbench`要求当前有效科研Agent，已发布且通过装备授权的`descriptive-statistics` Skill；当前账号/Study/来源/两功能开关仍逐项校验。其执行是Python确定性方法，LLM不参与。不能删除这道检查或伪造已成功运行。

## 请求准确增量

仅本轮`rh-deploy-20261118-0fbba918`独立合成库、现有单租户/Study、原admin：

| 记录 | 总上限及限制 |
| --- | --- |
| 方法用科研Agent | 1条；具名`deployment-descriptive-only`、type=research；仅作为原生确定性方法的真实父对象，不配置模型或普通问答工具 |
| 租户自定义Skill | 1条version=1；key=descriptive-statistics；复用已核定Worker契约、operatorVersion=descriptive-v1、runtime_state=ready、llm_forbidden=true；由原admin经原生创建/审核发布流程登记，不复制旧库Skill |
| SkillAssignment | 1条，只绑定原admin的accountId与scopeKey；不使用租户全体`*` |
| 原生工作台Session | 最多1条，由原方法服务创建，精确绑定admin、上述Agent、当前组/Study对应项目和descriptive-statistics上下文 |
| 审计 | 只为上述具名初始化、Skill审核/装备及后续原有方法操作追加原生/系统审计；不改写前序记录 |

AgentConfig、AgentAccess、ModelProfile均保持0：方法链不读取AgentConfig；管理员使用权沿现有正式管理员规则，不另加AgentAccess。其他科研账号无Skill装备，不开放其他Agent能力、会话聊天、工具或联网。后续完整AI能力仍须有各自真实配置和验收，不把这个方法身份说成科研问答已启用。

原`AgentsService.create`会默认创建租户全体`*`访问记录和通用模型/工具配置，因此不直接调用它扩大授权。建议在具名初始化事务中创建上述最小Agent父对象和明确审计；其余Skill创建/审核/装备复用原生方法。执行前复核实际schema、当前admin/Study、空初始数量、外层具名Docker及数据库marker；同事务保存准确对象manifest。重复或漂移拒绝，不改旧源码/服务，不加后台自动种子，不把该初始化放进生产启动。

原先批准1次方法运行、1份原生来源报告及资产数量不变。仍不调用模型、不接外部邮件、不读远端配置、不产生新增费用，不做云/生产DDL、停线或发布。拒绝或未知结果必须保留回执并停，不自动重试。

## 已完成、不能冒称完成的部分

Worker独立构建及令牌边界已实际验证：无令牌/错误令牌401，正确令牌handshake200且无数值/LLM，ready200；缺令牌ready函数503（子进程契约）。镜像非root、只读根文件系统、无公开端口，源5文件外部摘要和镜像ID/Python版本已留存。该结果不是描述统计算子实际执行成功，更不是专业用户报告签收。确认后继续原来唯一一次方法执行、人工确认、报告与资产正向链，沿原页布局真实浏览器复验。

## 获准执行结果（2026-11-19续行）

先在新库app角色事务回滚演练，再以同一事务登记1个方法Agent、1个原生创建并审核发布的Skill和1条admin个人装备，追加明确初始化审计；重复初始化拒绝。事务绑定同一原生服务，未调用会默认创建全租户访问和通用配置的Agent创建入口。完整before/after元数据及权限hash保留在私有证据，角色和成员未变。

原方法服务随后创建唯一工作台会话，并实际执行唯一一次描述统计：真实dispatch和publish审计各1，状态completed、reviewStatus=confirmed；输入1/2/3，均值2、样本标准差1、缺失0。数值与固定快照hash、descriptive-v1、实际Worker t19-1逐项核对，LLM不参与。1份来源报告经原生生成、内部审核和本Study私有启用，没有对外发布或导出。

该报告在原S10/G02区域完成资产登记、提交、退回、说明修订、再次提交与审核，最终1资产/2版/6事件，私有未发布。A01默认全部可访问Study显示1条，A02第2版正文与原报告完全相同；科研只读账号看不到私有资产，直接详情404、写入403。浏览器未改布局。报告入口/回执和审核上下文残留旧具名限制已改用真实数据；历史失败、原回执及免费恢复验证均保留，未重复登记。

当前AgentConfig、AgentAccess、ModelProfile、TokenQuotaGrant及模型运行均0；4账号、1角色、2组成员、3项目成员保持。上述是本机有限合成技术结果，用户专业验收、完整独立包/生产适用性及main提交仍未完成。文件/复用/AI等其余装配继续原计划，不因本切片通过宣称全功能交付。
