# 新独立合成租户：原生方法能力开关准确增量

2026-11-18，用户已批准这两个合成功能开关。按下列准确范围执行；后文申请时的前置及取舍保留为历史。承接已批准3名合成受试者/1次确定性方法/真实报告与资产正向验收，不扩大对象数量。

## 实际前置

新独立库tenant_feature_entitlement为空，原生研究配置强制study_operations=true，ResearchMethodsService强制research_methods_worker=true。既有TenantFeaturesService.platformUpdate只允许platform_admin；本轮4账号均非平台管理员。不能造平台身份、加第5账号、删检查或用直接写入approved报告替代原生链。

## 准确建议

仅在rh-deploy-20261118-0fbba918新实例、现有单一具名合成租户，使用已批准的数据库演练操作员事务，增加2条tenant_feature_entitlement：study_operations与research_methods_worker，enabled=true。只接受当前两条不存在、租户/Study/4账号及marker吻合时一次性提交；若已存在或数量/状态漂移则停，不覆盖或禁用旧记录。

不伪装业务平台管理员：updatedBy留空，追加2条系统审计，记录本轮runId、数据库session_user、精确feature key、用户本轮批准与前后状态，accountId为空；不把现有admin记成执行平台提权的人。具体字段/原生约束先检查后按准确DDL实施，GRANT不变。

不新增账号、角色、成员、Agent、Token、套餐/充值，不开放患者H5、诊断或其他feature，不接临床数据、外部模型、云或生产。只在已批准单个合成Study内完成前述原生业务。不是正式生产功能启用授权，生产仍逐项确认。

启用后使用原生授权/方案/CRF/方法/报告服务，保留审核、当前授权与所有科学算子及版本/来源规则。若不批准，方法正向验证保留FEATURE_NOT_ENABLED阻断，继续不依赖该开关的知识库及包验证；不宣称完整交付。

## 获准执行与复核

已在具名独立合成库先回滚演练，再以同一事务增加两条指定启用记录和两条系统审计；重复执行拒绝，未覆盖旧记录。账号4、角色1、课题组成员2、项目成员3、Token授额0及模型运行0保持不变。账号与角色全行hash在脚本内断言相等；成员只比较数量，不能据此宣称全库逐行保全。私有证据为`method-feature-enable-result.json`及原执行SQL，不上传凭据。

独立只读复核未发现本次执行阻断问题。记录一个后续脚本硬化点：SQL中可空marker比较应使用`IS DISTINCT FROM`；本次另有具名容器/runId/数据库外层守门，不重复执行或改写历史SQL冒充新证据。离线证据未保存完整before快照，保留此限制。

随后通过原生服务建立1份预置固定表单和1个合成结局定义；唯一方案依次创建、保存政策、检查、提交、批准和启用，实际状态为`executing`。脚本最初误断言为`active`，纠正验证断言后读取已保存回执，没有重复创建、审批或启用。方法Worker、CRF、方法运行及报告链仍待后续真实执行，开关启用不等于完整部署验收通过。
