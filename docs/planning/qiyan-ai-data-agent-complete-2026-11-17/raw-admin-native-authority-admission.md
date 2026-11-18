## 2026-11-17 已批准并实施

用户已明确批准本文新增共享源码范围。raw管理员委托原生上传授权已应用；普通科研人员及其他Worker仍沿原权限。真实app合成PG通过A实际处理/B不变与零残留，未改角色/成员或运行服务。下方“尚未应用/待确认”为原申请历史，当前证据见 `exact-rollback-result.json`。

# 旧raw Worker管理员原生授权一致性 · 新增最小差异

2026-11-17。不是重新确认管理员产品权限：用户已明确租户管理员长期拥有本租户全部Study业务权限。本次仅申请在旧Worker中落实已确认规则所必需的准确源码范围。

## 实际发现

专用合成库严格READ ONLY核对：原admin active、tenant_admin/isTenantAdmin=true/authVersion=5；其现有三个active组角色均无data/data.upload。原先固定导入Study的执行项目当前也未查到admin active项目成员。本轮没有补任何角色或成员。

旧原生`authorizeIngestInTransaction`对真实tenant_admin校验当前账号/租户、authVersion、真实active项目及组后允许，无需普通成员角色；旧`assertWorkerAuthorized`的raw分支却仍统一要求data菜单、data.upload及项目成员。因此上传入口允许的管理员，真实处理时会拒绝。不能用假角色、临时修改旧成员、跳过withWorkerPublication、只更新queued/running或Mock通过来掩盖这一阻断。

## 推荐准确差异（尚未应用）

- 仅新增旧源码`app/server/src/common/worker-authorization.ts`一处raw管理员分支：当且仅当kind=raw-processing且当前DB账号role=tenant_admin时，调用既有`authorizeIngestInTransaction`，由其检查isTenantAdmin、active账号/租户、authVersion、真实active项目及组；只补目标scope，不合成成员/角色。
- 普通科研人员与其data/data.upload/active成员规则、其他五类Worker、Skill/工具/Feature要求全部沿原逻辑。任务真实父对象、文件/被试、当前授权锁、claim/token/owner/租约、原子提交及失效中断继续生效。
- 对应原worker-authorization测试增加：管理员无普通成员时的合法raw请求、错误管理员标识/跨租户/停用父对象、科研人员无权限、其他Worker仍需原权限；不得给所有Worker增加管理员总旁路。
- [拟议patch](raw-admin-native-authority.proposed.patch)与[source checkpoint](raw-admin-native-authority-checkpoint.json)可逐行评审。只生成方案，未改此源码、角色、配置或数据库。

## 与已批准范围的关系

已批准RawProcessingService单任务执行入口与失败传播照常实施，单元/原确定性处理测试已通过；不撤销或重复申请该批准。此次只增加上述1个共享源码文件及其原测试，随后继续**原已批准**原admin/1新被试/2file/2task单事务全回滚验证。没有新增账号/角色/GRANT/Study、夹具数量、模型、费用、轮询/恢复、旧服务切换或发布。

准入前仅做免费代码/测试与严格只读核查；A真实成功处理、B完整不动的PG正向验收保持未通过，不把上述授权缺口当成测试成功。原账号/成员撤销竞态仍未纳入，不动旧身份行。

状态：待确认这一新增共享源码范围。批准后先失败测试，再最小修补、真实PG回滚及独立总评，不改页面布局。
