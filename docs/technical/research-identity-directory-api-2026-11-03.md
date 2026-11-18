## 2026-11-12 · R01／必要R02研究者GET已装配（本机）

已启用原§3约定的public/member researchers、researchers/facets、researchers/:id及/:id/relations。支持原q/direction/region/organizationId/researchRole/rank、sort、page、pageSize=10；relations白名单teams/directions/publications/clinicalTrials/guidance/collaborations，每页20，page≤10000。全部复用当前租户/账号/authVersion/来源门禁与no-store，未增业务写入口/DB权限。

研究者DTO增currentAffiliation、teams、primaryTeam、teamProjectionStatus；主要团队仅唯一显式isPrimary:true，覆盖旧唯一参与关系推断，机构resolver不变。详情affiliationHistory/collaborations及统一provenance.label覆盖当前人物全部可读事实，含团队/历史任职/合作；不暴露private account字段。缺coverage保持null；当前任职起始月份展示Minor保留。

R01允许固定hubId=lingshu-xinyu；R02只接受id/returnTo/固定Hub，T02返回R02再到R01保留合法筛选/锚点。URL先严格白名单解析后规范编码，合法中文空格%20/+不误拒；外链/未知/重复Hub仍拒绝。无目录AI用途扩展。下方“R01未装配”仅历史状态。[验证](../testing/governance-p1-researcher-2026-11-12.md)。

# 科研身份／T01／R01后端接口契约 V0.1

## 2026-11-10 · 三城市只读参考点增量

`cities[].coordinateKind`新增仅呈现用`CITY_REFERENCE`，附`cityCode,region,regionCode,reference{datasetVersion,sourceUrl,entityId,revision,statementId,sourceSha256,coordinateSystem,precision,referenceCount,usage}`。仅北京/上海/大连具名固定JSON匹配；字段全null且division版本/父级/名称有效时城市参考优先于省级，显式来源点仍优先。同城不同位置依据分组，不能把其他团队归到某一来源地址；前端键为类型＋代码/名称。最多100城市组门禁包含新组，不改变过滤全集/dataRevision/来源可见性。数据集坏源/哈希或固定声明不符明确`CITY_REFERENCE_INVALID`/503，初始化校验缓存且无运行时外网；此类型不能写入profile。无新表、权限或业务写入。[完整契约](../product/team-city-reference-2026-11-10.md) · [来源](../reference/city-map-2026-11-10/README.md) · [本机验证](../testing/team-city-reference-2026-11-10.md)。

## 2026-11-10 · T01缺坐标团队的地区聚合

地图GET增量`regions[{region,regionCode,longitude,latitude,coordinateKind:'REGION_ANCHOR',teamCount}]`、`regionMappedTeamCount`及`mapReference{kind:'BUNDLED_BASEMAP',sha256}`。仅当前可见、已审核省市代码/版本/名称均匹配且双坐标及coordinateKind均null的团队采用本地底图省级参考点；不回填档案，不调用外部地图/定位。已有`cities`坐标聚合保留；`mappedTeamCount`为城市与省级展示团队总数，未知位置仍计unmapped。公共/tenant门禁、同一筛选全集及dataRevision不变，列表分页不限制地图。此增量覆盖下方“缺坐标一律不进入地图”的旧约定，不冒充城市坐标或机构地址。[详细规则](../product/team-map-location-fix-2026-11-10.md) · [本机证据](../testing/team-map-2026-11-10.md)。

2026-11-04团队维护精简增量：列表只增savedAt，草稿data可选location、profile.city可选division，经共用PG字典校验；原路径、权限、版本/审核/来源门禁不变。省市GET为独立只读参考接口，见[共用省市契约](administrative-divisions-2026-11-04.md)。

## 2026-11-04管理员团队工作台增量

新增team-workspaces列表/创建/保存/预览/集中审核/私有回执及分页choices；原公开读取、本人身份和逐条审核接口保留，当前admin/tenant/authVersion/来源校验不变，R01未扩展。[完整路径和原子语义](team-maintenance-api-database-2026-11-04.md)。

日期：2026-11-03。状态：本人身份、团队公开／成员读取及目录管理接口已在本机19502装配，T01／必要T02／G02前端已接。R01列表／R02页面及其研究者读取接口未在本轮装配；L2／L3不开放。真实HTTP／PG／Chrome及独立评审见[验证报告](../testing/t01-directory-implementation-2026-11-03.md)，不是生产发布或真实资料专业签认。

## 1. 复用与通用契约

- 沿既有NestJS＋原Auth/JWT/HttpOnly Cookie、可信部署租户、当前状态／authVersion核验及共同授权锁；新功能在ResearchHub模块装配，不开放旧管理员建账号接口，不改原Accounts／Auth业务语义。
- 原`/api/account-access/registrations`、`registration-confirmations`、密码找回、`profile`展示名称接口不改body／成功响应；原`/api/auth/me`不塞私人档案或新等级进JWT。`profile`继续原displayName／邮箱／baseVersion。
- 写入只接同源JSON、可信Origin／Host／CSRF契约、body≤48KiB、严格字段白名单、文本长度／集合上限。tenantId、accountId、role、isTenantAdmin、level、verified、reviewer均不允许客户端指定。
- 401会话失效；403当前身份无动作权限；404不存在或不在当前可见集合的对象；400格式／未知字段；422字段语义或L1最低条件不满足；409CAS／幂等冲突／来源变化；429频率限制；503保存结果未确认。错误沿现有`{code,message,fieldErrors?}`，不返回内部SQL／私有对象名。
- 个人／管理／目录结果均`Cache-Control:no-store`，首期不做共享HTTP缓存；账号切换、撤权、对象切换使未完成请求代次失效。写失败不自动重试、不自动换requestKey。

## 2. 本人科研身份（P006）

| 方法／路径 | 请求 | 成功响应／权限 |
| --- | --- | --- |
| GET `/api/account-access/research-profile` | 无accountId | 200当前账号researchProfile、version、establishedAt、level、missingFields、verificationStage=`NOT_OPEN`；仅本人 |
| PATCH 同上 | expectedVersion、requestKey、changes（档案白名单部分更新） | 200 `{saved:true,version,level,establishedAt}`；原子CAS，未建立仍L0 |
| POST `/api/account-access/research-profile/establishments` | expectedVersion、requestKey | 200明确建立L1后的安全回执；姓名＋至少1方向；重复操作不重复建立 |
| GET `/api/account-access/research-profile/receipts/:requestKey?baseVersion=N` | UUID键＋安全整数版本 | 200最近操作回执／404无最近匹配；仅本人，不将404解释成从未提交 |
| GET `/api/account-access/research-identity` | 无 | 200 `{level:'L0'|'L1',profileEstablished,profileVersion,verificationStage:'NOT_OPEN',qualifications:[]}`；不决定Study权限 |

`version`是独立科研档案版本，无数据为0；`changes`只更新显式字段，集合字段提供即整体替换，null明确清空可空字段，未知嵌套字段拒绝。不能通过PATCH写establishedAt或证书状态。GET回读完整本人资料，PATCH回执不重复返回整份私有JSON。

### 2.1 CAS、最近回执和审计

按共同授权锁→当前有效Account→资料行锁→最近回执→原version／字段／L1不变量→原子保存四列和最小audit。当前Account／tenant／authVersion任何失效均先拒绝，包括原key重放；不因曾成功而跳过当前授权。

最近一次写的身份为`account＋requestKey＋baseVersion`，requestHash覆盖动作、规范化changes及baseVersion；同元组同body返回原安全回执、不同body409。**只承诺最近一次回执**：经过后续有效写后，旧baseVersion永远409，不再从受Study限制的audit表猜结果。回执404是“当前无可核对的最近回执”，不是“必未保存”；先读当前资料核对，禁止自动重新建立或自动换key重写。

没有后续写且结果未知，可用原key／原body／原baseVersion显式重试，不增版。并发一胜一409；已建立L1再次明确建立且版本相同可返回`alreadyEstablished:true`，不改时间／版本。不同版本旧请求仍409。

不修改Account.updatedAt、authVersion、displayName、role、成员或grant；审计只含动作、实际actor、profile版本、字段名称集合和内容hash，无私人正文／链接列表／密码。应用不放宽AuditLog SELECT策略。私有字段API不是管理员跨人查询入口。

### 2.2 注册局部入口

P004原右卡选填链接→若未登录提示先完成邮箱验证／登录，再进入`/pages/p006/?section=research-identity`。注册成功原“登录并进入我的科研”保留，增加“登录并完善资料”次要入口，经P003安全returnTo到上述P006。已登录账号直接进入本人资料；不在匿名阶段上传／暂存资料。

returnTo仅允许本站固定P006科研资料叶子及原有效研究／邀请返回路径，拒外域、协议相对、重复／混合参数和任意嵌套回跳。邀请码原有敏感token不混入returnTo、日志、截图或资料；完善后可跳过回P01，原受邀流程仍按原链接确认，不因资料建立自动接受邀请。

## 3. T01／R01公共与租户可见读取

基础路径沿原Hub：`/api/hubs/:hubKey`，本机首期仅现有`lingshu-xinyu`。公开路径可匿名读当前public事实；member路径须当前有效同租户账号，可读取public＋tenant事实；任何路径都不返回account私有JSON、原Study成员、邮箱／电话、准备资料或目录内部account绑定。

| 方法／后缀（接基础路径） | 用途 |
| --- | --- |
| GET `/teams`、`/member/teams` | T01列表、总数、分页和当前条件 |
| GET `/teams/facets`、`/member/teams/facets` | 当前可见集合的方向／地区／机构类型／团队类型和匹配数 |
| GET `/teams/map`、`/member/teams/map` | 全部匹配团队按城市聚合；不受列表page参数影响 |
| GET `/teams/:teamId`、`/member/teams/:teamId` | 同ID当前获准团队详情与可追溯关系，不读取私有Study |
| GET `/researchers`、`/member/researchers` | R01列表及真分页 |
| GET `/researchers/facets`、`/member/researchers/facets` | 方向／地区／当前机构／研究角色／职称 |
| GET `/researchers/:researcherId`、`/member/researchers/:researcherId` | 同ID当前获准人物详情 |
| GET `/teams/:id/relations`、`/researchers/:id/relations`（member有对应路径） | 必要详情Tab的有界关系／成果分页；type白名单，拒任意图查询 |

固定`facets/map`注册在`:id`之前，避免被误当ID。引用已核验目录ID，不把源人物名字拼进详情路由。公共／member来源交付由同一visibility resolver处理；member失败不保留旧私有数据，可在明确说明后重新请求public集合，而不是默默套用原tenant计数。

### 3.1 搜索、筛选与分页

T01参数：`q`≤120、`direction`、`region`、`organizationType`、`teamType`、`sort=relevance|publications|clinicalTrials|members`、`page`、`pageSize=10`。

R01参数：`q`≤120、`direction`、`region`、`organizationId`、`researchRole`、`rank`、`sort=relevance|publications|clinicalTrials|teams`、`page`、`pageSize=10`。

同参数重复、未知参数／值、page非整数／越界400；参数值长度≤200且全部参数化查询。无结果page1合法、totalPages=0，UI前往仍显示1且禁用翻页。过滤选项来自可见集合，不写死北京／五单位；facets按“除自身维度外的其他已生效条件”计数，多值条件本期不加。

页码最大10000（本切片有界操作预算），真实总量不截断；超过可跳范围返回`pageLimit`并提示收窄筛选，不假装所有数据仅有100000条。同sort以稳定entityId收尾；首期offset分页，后续规模门槛另评，不为保留页码另造游标跳转系统。

列表／总数／facets／map均先当前授权和来源重验再聚合，列表与count同事务快照。响应`dataRevision`摘要当前目录／审核／来源状态，客户端刷新时不得把不同条件／版本结果拼接。来源变化后重新计算，page超出最后一页返回409 `DIRECTORY_RESULT_CHANGED`并提供当前totalPages，显式回第1页，不填示例。

### 3.2 受控DTO

```ts
type Metric = {
  value: number | null;
  coverage: 'INDEXED_CURRENT' | 'UNVERIFIED';
  scope: 'CURRENT_HUB_REVIEWED_RELATIONS';
};
type DirectoryList<T> = {
  items: T[];
  pagination: {page: number; pageSize: 10; totalItems: number; totalPages: number; pageLimit: 10000};
  appliedFilters: Record<string, string>;
  dataRevision: string;
};
```

TeamCard：id、name、organization（可空）、city（可空）、lead（有依据才有）、summary、directions、teamType、relevance（label可空／reason）、photo（获准引用或null）、metrics(publications／clinicalTrials／members)、representativeWorks（≤2）、detailUrl。

ResearcherCard：id、name、currentAffiliation（可空）、rank／researchRole（来源明确才有）、summary、directions、relevance、photo、metrics(publications／clinicalTrials／teams)、primaryTeam（可空）、detailUrl。

照片只返回已有经核验的受控本地资源，不服务端代理任意URL、不抓公开主页照片。未知为null并在原图槽显示中性缺图状态，不借用演示头像。原卡“负责人／主要团队”缺失时不把未知字符串变可点击对象。

每项详情包含`provenance`：事实revision／hash、来源类型／文档及固定版本／原始位置、当前目录决定版本／审核时间和scope。public不返回审核人内部账号ID、私人材料／联系人；源返回字段依原来源门禁。

单值投影不得取“第一条”：每卡附`projectionStatus=RESOLVED|NEEDS_SELECTION|CONFLICT`及当前可读matchedAffiliations（有机构筛选时明确命中项）。默认机构／主要团队须有唯一明确主项或唯一有效关系；多个当前任职无主项显示“多机构任职，查看详情”，单值为null；多负责人以受控leads数组保留共同负责人，lead单值只有唯一时存在。来源冲突显示“关系待核对”，不把冲突一方作为确定岗位或城市。详情可读事实不因单值冲突全部丢弃，未审／无权事实仍不返回。

Metric的数值须有当前audienceScope对应的已批准coverage事实且实时relationSetHash一致；无核验或关系／源改变返回null，不能COUNT(*)=0直接推为已核验0。公开与member各算自己的可见集合。管理员核对的是当前领域已收录关联集合，不声称此人／团队一生的全部成果。

相关性只读取获准profile.hubMatch的CONFIRMED档位／理由，HIGH_RELEVANCE→RELATED→未核验，每档按ID；公共DTO仅映射原“高相关／相关／未核验”位置，不返回虚构分数。

map响应：`matchedTeamCount,mappedTeamCount,unmappedTeamCount,cities[{city,longitude,latitude,coordinateKind:'CITY_CENTROID'|'SOURCE_LOCATION',teamCount}],dataRevision`；城市列表最多100组，超过时显式报需收窄范围，不静默截断。地图旁团队列表用相同筛选的原分页，聚合计数不取当前10条；缺坐标不进入地图但仍在列表和unmapped中。

详情Tab结果按type返回受控items／pagination／sourceStatus；没有已核验记录时明确“暂无已收录关系”，不是“该专家无研究成果”。工作回链只到现有真实E02／C03／H06固定对象，来源不可见时返回受限状态，不暴露题名或跳演示。

## 4. 管理员目录治理（G02叶子）

基础`/api/hubs/:hubKey/directory-admin`；全部需当前有效同租户管理员＋精确Hub；非管理员403，L1不是治理授权。当前source.review grant不会隐式变成目录治理。新能力实际启用须待用户批准。

| 方法／后缀 | 契约 |
| --- | --- |
| GET `/entities?kind=&q=&page=&pageSize=20` | 受控候选列表／待审状态，不含绑定账号私人资料 |
| GET `/sources?q=` | 已获准精确来源选择器，每类最多20条；当前metadata／abstract／body可用字段、定位引用，不返回正文或原始私有字段；tenant范围包含public来源 |
| POST `/entities` | kind／stableKey／requestKey；201稳定主体；不建Account／Tenant／StudyGroup |
| GET `/entities/:id` | 主体、当前事实槽位／版本／决定、来源可用性 |
| POST `/entities/:id/assertions` | assertionKey／kind／relatedEntityId／expectedRevision／payload／provenance／requestKey；201追加事实版本 |
| GET `/assertions/:id` | 该固定事实版本、来源定位及当前状态，管理员阅读预览 |
| POST `/assertions/:id/decisions` | expectedDecisionVersion／assertionHash／decision／audience／reason／requestKey；200追加决定，不修改原来源 |
| GET `/assertions/:id/decisions?page=&pageSize=20` | 本目录事实的审核历史；非认证申请历史 |
| GET `/operations/:requestKey?operation=entity_create\|assertion_create\|decision_create` | 当前actor在本Hub、指定动作类型的受控回执；operation必填单值，404不可证明无提交 |

创建／修订／决定都严格白名单，服务端固定tenant／actor／时钟；关系对象和来源kind矩阵必须匹配。单条操作无批量全选，无自动批准／定时任务／新后台扫描。对same entity槽位加有序锁、共同授权锁、当前源版本共享锁，保证校验与提交原子；有权者在途被撤销时拒绝提交。

entity_create的请求键／hash直接存entity（creation_hub_key固定），无assertion／decision也能回读创建回执；另外两类分别存自己的追加行，查询按operation目的绑定，不跨表混配。相同动作／actor／Hub／key同规范输入返回原回执，异体同键409，先核对当前权限再返回；不同键stableKey冲突409。

coverage预览由`GET /entities/:id`返回`relationSetHashes[audience][metric]`；提交coverage版本带该hash，批准时再次重算，变化则409。批准主任职／主要团队关系前检查主体当前有效主项，已有主项须显式修订／撤回，不自动顶掉；并发两主项只能一个通过。

提交结果未知先查相同operation／原键回执；404不证明未提交，可由用户显式用原body／key重试，不自动重试或换键。若原键重试明确400／409／422失败，保留输入、读当前版本并展示比较，用户确认后才恢复编辑；下一次新操作仍手动提交并做当前CAS，不静默覆盖。

公共可见性由目录决定与当前源共同决定；不因管理员看见预览就公开。未核对来源、无明确团队主体／人物消歧依据、hash错／过期／跨Hub403或409，无半个可见关系。任意URL不由API自动WebFetch。

## 5. 代码结构与验证命令（身份与T01已实施，R01保留后续）

建议新模块`server/research-identity/`（policy／repository／controller／tests）和`server/directory/`（contract／read-model／commands／controller／tests），沿现有装配方式；个人profile扩展最小复用WP02当前账号核验，不复制整份AuthService。前端复用AccountProfile、T01／R01原组件及已有同源客户端／身份事件。

代码风格沿项目ES modules、参数化SQL、受控DTO、共享Button；纯校验与事务服务分开。示例：`readOwnResearchProfile({tx, principal})`不接受body中的accountId；禁止`return {...account}`。

实际现有命令：`pnpm run build`；`node --test tests/*.test.mjs`（前端现有测试）；`pnpm --dir ../app/server build`与`pnpm --dir ../app/server test`（旧后端兼容，运行前核对其测试目标，不能连接临床环境）。

新测试建议`node --test server/research-identity/*.test.mjs server/directory/*.test.mjs`；真实PG／HTTP／Chrome脚本名和精确fixture预算在规格批准后的小步计划锁定。没有这些新测试文件前不运行通配命令假报成功。

必须覆盖：L0不填注册／L0保存／L1明确建立、旧接口兼容、两个账号私有隔离、CAS／幂等／丢回执、目录入审放行／撤回、来源换版与字段权限、同名不同人、团队不能由机构推断、全部筛选分页地图及真实详情返回、迟到响应／切身份、五视口与真实200%、单元／集成／功能截图录屏及唯一独立代码总评审。资料／AI／原数据库保全与专业验收独立。
## 2026-11-16 · 当前任职月份投影增量

公开／member团队与研究者DTO的`affiliations[]`在原审核／来源门禁之后增加`startMonth:string|null`、`endMonth:string|null`、`current:boolean`，月份沿原YYYY-MM字段原样传递，无新表、权限或写入口。R01原机构行与R02现有日期位置使用明确显示的任职；同机构多个任职按唯一`isPrimaryForDisplay`选择，不以机构ID取第一条。歧义／无月份留空，不从其他机构借日期，不从审核时间推断任职起点。

专用库当前已提交档案无当前任职起始月份；旧“未展示已核验月份”对应回滚用例的投影缺口，并非真实数据已补。19相关／748前端、PG日期回滚、7.42秒构建通过；已在PID94703实际加载新DTO，管理员两页五宽及原科研人员原生200%通过；日期正向为明确浏览器控制响应，实际PG仍无月份，不称真实补录。[当前交接](../testing/governance-directory-closeout-2026-11-16.md)。

