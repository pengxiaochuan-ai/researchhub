# F01 · 普通成员知识库与课题能力配置清单

2026-11-17。依据[F01 V0.3的P5](f01-registration-admission-review-spec-2026-11-17.md)：准入批准与业务配置分开，现有个人课题草稿保留；知识库复用K01，执行Study所需组等新增能力另列精确配置和验收。本表不是追加授权或自动配置脚本。

## 已核实的边界

| 能力 | 服务端当前条件／准确配置键 | 新获准账号的本轮实测 | 增量及验收要求 |
| --- | --- | --- | --- |
| 新建个人课题草稿 | 当前有效账号／租户＋当前Hub approved；`createResearchStudiesService.create`创建本人`project_intent`，无需creationGroups | 真实POST创建草稿成功，未创建Study／成员 | 无需新增组或角色；继续验证只属于本人、原键回执和后续编辑 |
| 个人知识库入口 | P01直达`/pages/k01/`；K01仍要求合法知识菜单上下文及原资料权限，`src/knowledge-session.js`核查`knowledge`菜单 | 入口可达；新账号无合法组／库上下文时保留原受限空态 | 不新建第二套库、不复制资料、不以准入替代资料权限。需要默认可用时，先指定可复用的个人资料上下文及最小授权，验本人导入／新建／检索和跨用户拒绝 |
| 建立执行Study | 当前有效准入＋本人可管理的草稿＋选中的active组属于`creationGroups`。普通组成员分支要求active membership／role，`menuPermissions`含`workbench`且`buttonPermissions`含`study.configure`；或已有同Hub、同组的有效`rh_research.hub_role` owner关系。管理员按原双标志规则 | 新账号`creationGroups=[]`，尝试用原组ID建Study被拒；不影响本人草稿 | 优先复用业务上确属该用户的已有组和合法现有角色；需要增量时只在下表填定的组／账号范围办理，不能给所有注册账号补租户管理员或全平台创建权 |
| Study创建后的执行项目／成员 | 真实`createStudy`在同事务复用原项目创建核心，写绑定及原创建者成员；前提是创建组权限已满足 | 本轮未为新获准账号创建Study或成员 | 单独用全新合成草稿完成建立Study→查看／配置→无权用户拒绝；审计须保留真实操作者及组／Study。不得以“能建草稿”代替此项通过 |
| AI与默认Skill | 默认装备仍为原九Skill的`scopeKey='*'`；实际运行还需原AgentAccess、资料用途、模型／工具及Token额度 | 新账号零AgentAccess／TokenGrant，批准不追加组／额度或模型调用 | 如要新开AI，精确列原Agent、使用者、来源范围、工具、额度和测试样例；不借F01审批静默增配 |

源码依据：`server/research-studies/commands.mjs`的`contextIn/create/createStudy`、`repository.mjs`的有效Hub角色读取；`src/knowledge-session.js`及`pages/k01/frame.jsx`；`server/ai-agent/default-skills.mjs`。真实请求与回滚证据见[F01验收记录](../testing/f01-admission-2026-11-17.md)。

## 每次新增业务配置必须填定的记录

| 项 | 必须明确的值 | 当前本轮决定 |
| --- | --- | --- |
| 目标 | 精确tenantId、HubKey、accountId，当前authVersion和账号状态 | 本轮不为普通成员新增业务授权；新样例仅合成验收 |
| 组范围 | 精确active studyGroupId、用户与该组的业务归属依据 | 不自动新建组；不得由用户抄组ID来恢复流程 |
| 现有角色或关系 | 精确roleId及其菜单／按钮集合，或已有Hub owner同组关系；只选满足目标的最小路径 | 待有具体开通对象时列出，不默认双重授予或创建独立审批资格 |
| 增量 | 哪一条membership／Hub角色需写，操作者、原因、幂等键、当前版本及失效／撤销方式 | 尚未执行，不更改任何既有角色或成员 |
| 结果 | GET context中目标组真实出现；新草稿实际创建Study成功；跨组／跨租户／未授权用户拒绝 | 目前仅草稿创建通过、无创建组时Study拒绝；正式开通未验 |

本表明确保留后续配置工作，不把该留项包装成已开通。F01人工准入基础闭环可以独立验收；需要向普通用户承诺默认创建执行Study或默认可用个人库时，必须先完成相应精确配置及真实请求验收。
