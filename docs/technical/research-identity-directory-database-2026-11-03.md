## 2026-11-12 · R01读取增量（零DDL）

本轮研究者列表/详情直接复用已存在rh_directory.entity/assertion/decision、当前来源和审核，不建研究者档案表，不修改account/角色/成员表或授予新权限。研究者主要团队仅从当前获准team_member中选择唯一显式isPrimary:true，覆盖旧“唯一有效参与关系可作主要”的口径；不回填或改写旧事实，全部参与关系仍可读，机构解析不变。真实PG新增测试仅事务回滚，原4/4/5实体额度不变。[交接](../testing/governance-p1-researcher-2026-11-12.md)。

# 科研身份／团队／研究者数据库设计 V0.1

2026-11-04团队维护精简仅新增一张中性参考表rh_reference.administrative_division及原JSON可选代码字段；不新增用户/团队业务表，不重写旧事实。只读字典v1/v2不可覆盖收据、ACL和原件SHA见[共用省市字典](administrative-divisions-2026-11-04.md)。

## 2026-11-04兼容增量

用户批准entity.team_draft单列及仅该列UPDATE，容纳未审核的一页式草稿/版本/回执；原三表、来源约束、RLS/审计及旧收据保持。新增v2扩展指纹覆盖完整列/表ACL，旧v1收据保留。详见[团队维护兼容扩展](team-maintenance-api-database-2026-11-04.md)，下方16事实/14决定为11-03历史快照，不是本轮最终计数。

日期：2026-11-03。状态：原Account四个兼容可空列、三目录表及已批准的有界来源锁EXECUTE已在专用合成库启用；原来源表UPDATE／DELETE未授予。目录现2机构／2团队／1人物、16事实版本／14决定；仅显式合成对象获准展示，真实项目团队仍未批准。无新账号／成员／租户权限／L2／L3表。三表V1和锁函数独立指纹均匹配，[最终状态](../testing/evidence/research-identity-directory-implementation-2026-11-03/final-state/result.json)及[本轮验证](../testing/t01-directory-implementation-2026-11-03.md)。生产DDL／发布未执行。

## 1. 当前实库核对与复用清单

已通过fixture目标守门，仅连接专用合成库`wp01_test_full_baseline`，事务`transaction_read_only=on`；查询`information_schema`和`pg_policies`，未读临床库、用户口令或远端配置。

| 现有物理表 | 本轮用途／禁止误用 |
| --- | --- |
| public.account（13列） | 唯一登录账号、tenantId、displayName、role／isTenantAdmin、authVersion、邮箱验证；**直接新增科研资料列**，不另建researcher_profile |
| public.tenant | 原租户／席位；机构不是新租户，不通过建机构增加账号或租户配额 |
| public.study_group／study_group_membership | 原私有课题组及业务授权；不改结构、不公开、不当团队目录 |
| public.research_project_membership／permission_role | 原研究角色授权；L1和目录关系不写这两类表 |
| public.audit_log | 追加最小操作审计；当前SELECT要求Study上下文，不放宽为租户全读来回读个人幂等结果 |
| rh_hub.hub／scope_version／hub_follow | 原Hub作用域／关注；不把关注当目录管理／Study资格 |
| rh_source.* | 原来源、批次、文献／注册版本、审核及强标识，保存引用不复制正文；未经核验作者关系不自动使用 |

`subject_profile`／`model_profile`不是科研身份资料；实库没有可复用的机构、人物、任职、团队公开目录表。新目录表必要，但不能重建账户／鉴权体系。

## 2. 修改现有account：仅4个可空列

| 新列（沿Account camelCase） | 类型／缺省 | 用途 |
| --- | --- | --- |
| researchProfile | jsonb NULL | 本人自述科研档案、选填认证准备；受版本化白名单约束 |
| researchProfileVersion | integer NULL | 未初始化视作0；首次真实保存为1，之后CAS递增；DB约束NULL或>=1 |
| researchProfileEstablishedAt | timestamptz NULL | 本人明确建立L1的时间；不由role／邮箱推断，不客户端写 |
| researchProfileLastMutation | jsonb NULL | 最近一次资料操作的requestKey／requestHash／baseVersion／resultVersion／committedAt／安全回执摘要；不存口令、表单全文、token |

旧13列及其默认值／唯一性不变；不新增researchLevel、isVerified等可自相矛盾的授权标记。未建立显示L0，建立显示L1；未来更高资格来自有效认证关系，不能把一个全局数字当机构权限。

旧行全NULL，不批量回填、不因现有显示名自动建立L1。profile写仅更新以上4列，**不动旧updatedAt和authVersion**，避免旧WP02展示名baseVersion和登录权限版本被无关影响；新写使用参数化SQL和当前账号条件。Prisma逻辑模型以后可加可空映射，本轮不执行generate／迁移。

### 2.1 researchProfile V1白名单

```json
{
  "schemaVersion": 1,
  "researchName": "本人填写的科研展示姓名",
  "researchDirections": ["针灸", "情志病"],
  "biography": "本人自述经历",
  "orcid": null,
  "publicHomepages": [],
  "affiliationClaims": [],
  "educationClaims": [],
  "verificationPreparation": {"professionalStatement": "", "publicEvidenceLinks": []}
}
```

所有填写内容为`SELF_DECLARED`，来源类型由服务端表达，不接受客户端verified。姓名1–80字符；方向最多10项、各1–40；介绍≤2000；经历各≤10条、每条≤1000；公开主页≤3、公开证明链接≤5且各≤2048；机构自述每条含claimId、organizationName≤200、department／positionTitle≤120、可空起止年月，最多10条，年月前后合法。ORCID只验格式／校验位，不代表已核实。

JSON整体≤32KiB、请求≤48KiB（UTF-8字节），schemaVersion必为1、未知字段拒绝；不存附件字节、上传路径、外部抓取结果、身份证、患者数据、reviewStatus／reviewer或角色。草稿可缺researchName／方向，明确建立L1时才要求最低字段。未设置字段用null／空集合的规范形态，不在客户端偷偷补值。

个人JSON目前无需跨用户全文检索，故不添加宽GIN索引；未来公开搜索从经审核的目录事实读取，不能直接检索account JSON。字段多机构自述与正式机构认证关系分开，不因JSON中的organizationId授资源权。

### 2.2 私人资料访问与旧接口兼容

account现有RLS仅按tenantId，不是本人级。**RLS租户隔离不能代替个人字段授权**：本人API在当前有效账号锁／事务下固定accountId=principal.accountId，白名单DTO；没有GET任意用户科研档案，也不让管理员账号列表顺带返回private JSON。

已查AccountsService.list/create使用显式select，AuthService.userProfile有受控输出；实施前仍扫描所有Account序列化／Object spread／SQL SELECT *消费者并做负向回归。发现额外泄漏路径先列影响及最小修正；不假称加列天然安全。不改全局Guard或account RLS，DB应用角色信任边界保持原模型。

## 3. 一期只新增3张目录业务表

建议schema=`rh_directory`；以下名称为待批物理设计。是固定类型、有界JSON的关系目录，**不开放任意节点类型、任意谓词、任意SQL／规则或图推理**。

### 3.1 entity：稳定目录主体

| 列 | 约束／含义 |
| --- | --- |
| tenant_id、id | 联合主键；id不使用邮箱或姓名 |
| kind | CHECK organization／team／researcher，不允许account／Study混入 |
| stable_key | 同租户同kind唯一；管理员确认的稳定键，不按姓名唯一 |
| account_id | 可空，仅researcher允许；绑定须单独核实，不自动同名／同邮箱匹配，本期候选默认NULL |
| created_by、created_at | 当前服务端操作者／时间 |
| creation_hub_key、request_key、request_hash | 仅记录主体创建时的Hub／幂等键／规范输入hash；同tenant＋创建actor＋requestKey唯一，创建Hub同租户FK到原hub |
| archived_at、version | 软归档及CAS；实体身份不覆写成另一个人 |

entity不直接保存可公开的姓名、简介或任职；展示字段来自当前获准事实，避免先查实体再漏出未审名称。organization也是目录实体，不是tenant；team也不是study_group。

account_id若启用须核对同租户account真实父对象，且同租户同一account至多绑定一条有效researcher；本期没有认领接口，不设置绑定、不授登录／成员能力。实体表中的潜在绑定字段不进入公共响应。

主体创建即在同一INSERT保存创建键／hash，不等待assertion或decision出现；安全回执由不可修改的id／创建Hub／创建键／创建时间投影`{id,created:true,version:0}`，不把归档后的当前version当创建version。相同键不同输入409；不同键碰stable_key409，不能悄悄新建第二个主体。创建请求hash覆盖action＋Hub＋kind＋stableKey。操作查询显式指定operation种类，避免三表恰好同键时串回执；创建键不随后续修改／归档覆写。

### 3.2 assertion：不可覆盖的目录事实版本

公共列：`tenant_id, hub_key, id, entity_id, assertion_key, revision, kind, related_entity_id NULL, payload jsonb, provenance jsonb, content_sha256 char(64), request_key, request_hash, created_by, created_at`。

- 联合FK `(tenant_id,hub_key)`→原hub；`(tenant_id,entity_id)`／related→entity；同tenant不同Hub的事实不得混计。
- 唯一`(tenant_id,hub_key,entity_id,assertion_key,revision)`；同槽位修订新增revision，不覆盖旧版。普通查询只考虑**最高revision**，新待审版本不沿用旧批准偷偷展示。
- 内容hash覆盖kind、主体／关系、payload、provenance、slot和revision；来源定位纳入hash。创建请求键在tenant＋actor＋本接口内唯一，同键不同hash409。
- 每事实payload≤16KiB，provenance≤10项，每项固定kind／sourceId／versionId或rowId／sourceHash／locator／fieldNames；整体请求≤48KiB。禁止嵌入正文、任意联系人表或任意SQL。

| kind | 主体→关系对象 | 受控payload／说明 |
| --- | --- | --- |
| profile | entity→NULL | 按主体kind白名单：名称、别名≤5、简介、方向≤10、类型、城市及已核验图片引用；可含hubMatch={status, tier, reason}；researcher可含来源明确职称与角色，不含private邮箱／电话 |
| affiliation | researcher或team→organization | 科室／岗位、起止时间、current证据、isPrimaryForDisplay、city／organizationType；不从论文署名自动推出当前任职 |
| team_member | researcher→team | 来源明确的成员类别／负责人、有效起止、isPrimary（仅有依据时）；不是StudyGroupMembership |
| work | researcher或team→NULL | 引用原sourceKind＋sourceId＋固定version／hash、canonicalKey、来源明确角色／关系；不复制论文或注册内容 |
| collaboration | entity→entity | 来源明确合作类型及时间，用于必要详情配套；共著仅说明共著，不能自动当机构合作协议 |
| coverage | entity→NULL | audienceScope(public／tenant)、metric(publications／clinicalTrials／members／teams)、status(VERIFIED_INDEXED_SET／UNVERIFIED)、relationSetHash、核对说明；只确认当前索引关系集，不宣称职业生涯成果完整 |

profile中的地理是可追溯城市聚合位置；没有经核对来源就null。payload不接受累计papers／hindex／trialCount；统计由当前可见work关系重算，不以管理员手填职业生涯总数冒充关系计数。

**数量核验载体：** coverage独立固定槽位`coverage:<audienceScope>:<metric>`，和其他事实一样追加版本并审核。relationSetHash由服务端对当前Hub、主体、该指标的全部最高关系事实版本／当前决定／源版本与状态排序规范化生成，排除coverage自身，覆盖待审／拒绝／撤回关系的状态，防止漏掉新候选；普通人不读取该指纹中的内部明细。管理员预览时获取hash，确认当前已收录集合后才能批准VERIFIED_INDEXED_SET。读取只有当前可见coverage批准＋实时relationSetHash一致才返回实际去重计数（可为0）；无coverage／未审／hash变化一律value=null、UNVERIFIED。任一关联新增／换版／撤回／到期或源变更使旧coverage失效，不能继续显示旧数字或把空集当已核验0；重新确认只增coverage版本／决定。公开和tenant读取分别核对自己的scope，不能用public的0当tenant集合的0。

**多关系投影：** 同人多当前任职可合法并存，isPrimaryForDisplay最多1个当前获准项；同人主要团队isPrimary也最多1个；团队可有多个真实负责人，不能删掉联合负责人凑单值。批准时在主体锁下校验当前有效关系的显示主项互斥；不可变历史表不创建依赖“最新版本”的伪唯一索引。来源冲突／旧异常导致多主项时，单值字段为null、projectionStatus=CONFLICT，详情保留当前可读候选及依据；不得取第1行。没有主项且恰有1条有效关系时可明确投影唯一关系，多条无主项则NEEDS_SELECTION。机构筛选匹配实际当前任职／隶属关系，响应matchedAffiliations明确命中项；有机构筛选时卡片机构优先显示该已命中机构，仍有岗位冲突则不猜岗位。默认卡片使用明确主项／唯一项，同一resolver供筛选、DTO及地图，无法确定城市的团队计入unmapped，不能按第一机构定位。

**Hub相关性载体：** profile.hubMatch固定白名单：status=CONFIRMED／UNVERIFIED；CONFIRMED时tier=HIGH_RELEVANCE／RELATED、reason为1–500字具名核对说明，provenance含对应方向和依据；未确认tier／reason为null。它是管理员对此Hub的显式目录判断，不是AI分数或资质；只有当前profile版本和决定获准时参与排序，HIGH_RELEVANCE→RELATED→未核验，各档entityId稳定收尾，无百分比、无隐式默认高相关。

provenance仅允许已有固定版本来源（external_document_version／pmc_candidate_version／source_record＋批次rowHash）和管理员提供的具名受控材料定位。后一类必须登记到现有来源目录并完成适用审核后才可公开，不能只放一个URL就绕过入库／权利核验。本次不抓网页。引用来源父对象用同事务校验／共享锁，禁止跨租户、换版或无权来源。

### 3.3 decision：追加式目录审核与撤回

列：`tenant_id, hub_key, id, assertion_id, decision_version, decision, audience, reason, evidence_refs jsonb, assertion_sha256, reviewer_account_id, request_key, request_hash, created_at, expires_at NULL`。

- decision=`approve|reject|revoke`；audience=`public|tenant|none`；reject／revoke要求none；批准必须有理由／证据定位及精确assertionHash。审核是目录事实核验，不是科研资质审核。
- 同事实递增decision_version，唯一`(tenant_id,hub_key,assertion_id,decision_version)`及同tenant＋actor＋requestKey；提交带expectedDecisionVersion，串行锁／CAS后追加。
- reviewer是当前服务端身份，不接受body传审核人；只有有效同租户管理员有目录治理权限，当前状态／authVersion与角色标记一致；不靠邮箱白名单。
- 表仅追加，不给应用UPDATE／DELETE。无决定＝不可见；使用最高决定，无过期旧批准回退。来源和事实最新版本、当前Hub状态、主体／关联对象有效、审核期限均一致才公开。
- entity／assertion／decision写审计与回执同事务；无Study时audit_log仅INSERT最小字段／hash，历史回读从本目录决定表，不放宽原审计策略。

### 3.4 关系约束、索引与RLS

三个表均ENABLE＋FORCE RLS，租户USING与WITH CHECK；assertion／decision另对可信`app.hub_key`固定当前Hub，entity允许同租户共享稳定主体但不独立提供公开行读取。服务端每事务设置目标scope，客户端不能自选tenant／DB role；公开接口只返回经审核投影，不直出表。

应用角色只获得必要列更新：entity归档/version，assertion／decision仅SELECT／INSERT。归属／kind触发器保证person→team等合法矩阵与同租户父对象；多态provenance不能伪装一个普通FK，须按固定sourceKind验证真实父链／hash，未知kind拒绝。

索引：entity(tenant,kind,stable_key)唯一、有效account部分唯一、创建请求键唯一；assertion(tenant,hub,entity,assertion_key,revision DESC)、(tenant,hub,kind,related_entity_id)、请求键唯一；decision(tenant,hub,assertion,decision_version DESC)、请求键唯一。先数据规模与查询计划核对，不加搜索服务、pg_trgm依赖或任意JSON大索引。

**公开投影顺序**：当前主体／当前Hub→各槽位最高事实版本→各事实最高决定→当前来源及用途／hash／期限→可见字段／关系→去重指标／筛选项／地图→排序与分页。不能先分页再滤权限，也不能把旧版获准事实与新版未审字段拼成一张“已审核”卡。

## 4. L2／L3仅逻辑结构（本期不建表）

| 二期表 | 关键字段／约束 |
| --- | --- |
| research_identity_verification | tenantId、id、accountId、kind(RESEARCHER／INSTITUTIONAL)、organizationEntityId（机构认证必填）、status、submittedProfileVersion、submittedMaterialVersion、reviewer／reason、validFrom／expiresAt／revokedAt、version。机构FK同租户且kind=organization；不拿Hub成员当机构资格 |
| research_identity_material_version | tenantId、verificationId、version、私有材料引用／hash／用途／提交者／时间、最小自述快照；仅认证流程授权读取、不可覆盖，不进入人物目录或AI |

状态NOT_SUBMITTED／PENDING／VERIFIED／REJECTED／EXPIRED／REVOKED。当前只有account里的`verificationPreparation`，不得制造PENDING记录或显示已提交；以后本人显式核对／提交才冻结材料版本。

L3按具体机构及有效期读取，不把机构A的认证传给机构B。展示最高有效等级可以，但资格判定读取当前认证关系，拒绝过期／撤回；正式审核人、材料清单、期限与敏感存储方案二期再确认。此处不是新角色或权限实施授权。

## 5. 兼容迁移与保全门槛（实施后才执行）

1. 唯一迁移入口沿现有受控迁移链，读取专用fixture标记、实际PG版本／原13列和RLS／约束指纹；缺失／部分执行／意外同名结构即停，禁止IF NOT EXISTS掩盖冲突。
2. 只增4个NULL列及3张目录表；不重建account、不ALTER旧字段类型／role枚举、不全库migrate reset／db push，不迁旧用户／患者／成员，不自动生成Prisma Client或启动旧服务。
3. 对原表DDL明确lock_timeout／statement_timeout，锁不可用即退出；在专用库证明旧Client读写兼容和新增私有字段不漏，正式窗口另批。新增列不是“无锁迁移”的承诺。
4. profile原行旧列hash、原角色／成员／Account.updatedAt／authVersion、前序成果／原来源／AI账本和旧服务前后保全；只允许本期新字段及具名新夹具增量。
5. 代码回退停新功能但保留可空列／新增表与资料，不删数据回滚；正式删除或恢复旧值另批准。新旧应用版本混用的字段白名单及旧密码／角色行为必须实测。

数据库语义参考：[PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)、[ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)。文档当前指向18，不据此认定专用库版本；实施先读取实际server_version，使用目标版本已验证的DDL。

## 6. 本稿未发生的动作

未添加上述任何列／表／索引／权限；没有迁移SQL文件或可执行DDL脚本，没有写用户／来源行。新建表数量是设计提案，不是已经落库的事实。
