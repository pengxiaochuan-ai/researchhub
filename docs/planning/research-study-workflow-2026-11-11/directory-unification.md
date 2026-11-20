## 2026-11-19 · 当前用户要求覆盖原顶部入口规则

用户明确要求工作台在不改整体布局的前提下补齐“创建研究课题”入口。现在原“我的课题”标题行保留名称/数量并加入唯一“新建课题”按钮，空态不再重复；仍保留列表后“查看更多课题”，不恢复顶部“全部”或新增侧栏。此节覆盖下方2026-11-11“顶部新建撤除、仅空态新建”的旧要求，原目录范围、前5条、权限、API和主/右栏保持。本机验收见`docs/testing/p01-create-entry-2026-11-19.md`，操作统一见用户手册“P01工作台直接新建课题”。

# P01课题预览与完整列表统一 · 当前实施契约

日期2026-11-11。依据用户“按这个方案收敛入口，并统一首页预览与完整列表的内容范围”。范围仅入口、统一只读目录及必要详情衔接，不恢复其他旧计划或实现正式采集/分析。

## 用户路径与获批布局

移除新增侧栏二级“课题与草稿”；五个一级导航、原“我的研究设计”入口保留。P01原“我的课题”卡片展示同一目录前5项，卡片顶部新建/全部双入口撤除；列表后、本人研究草稿折叠前增加次级“查看更多课题 →”。空态可直接新建，完整列表保留新建主动作。标题/总数、首页课题统计使用新目录total；旧API的summary.projectCount/studyGroups和方案草稿/任务不重定义。主区、Shell尺寸及其他卡片保持，卡片随最多5行和footer自然增高。14/22、不缩字、键盘焦点/窄屏可达。

## 同源目录与授权

新增只读GET `/api/research-directory?limit=5|20&q=&cursor=`；同一服务供P01 limit5和完整列表limit20。默认20、上限100，q最多200字符，服务端全范围搜索，按updatedAt DESC/key DESC稳定排序；total为当前身份/授权及搜索后、去重后的精确总数，不采用1001条扫描上限或前端拉全库。游标绑定当前actor/tenant/authVersion/q/order，每页重验权限，游标不是授权凭证。 分页不承诺跨HTTP数据库快照；目录变化需按提示重新读取。

先逐来源授权，再按实际执行项目绑定去重。未绑定意图key为intent:id；已绑定或旧项目key为execution:id。保留历史/受邀项目；旧源按有效组+项目成员、同租户父链/有效role读取，不擅自加workbench要求。有效tenant_admin按本租户active项目/组独立读取，platform_admin拒绝业务数据。意图沿当前owner/admin/明确Hub角色/成员规则；能读旧项目但不能读意图时，不透出隐藏意图ID/题名/问题/owner。原意图owner失去执行权、或绑定组/项目停用时，可保留仍有权的意图入口，不生成无权概览链接。

响应`{items,total,nextCursor,capabilities:{canCreateProject}}`；条目为`{key,kind,id,title,summary,status,updatedAt,studyGroupId?,studyGroupName?,executionProjectId?,intentId?,studyId?,links:{primary,overview?,edit?},capabilities:{canEdit,canOpenStudy}}`。summary仅列表摘要，全文从既有详情读取；链接由服务端按实际可打开权限产生。客户端验证同源允许路径，搜索换条件重置分页，换账号/撤权清旧内容；后台刷新覆盖已展开范围，不合并已失权旧行。失败明确显示与重试，不回退单源/演示或把失败算0。

旧S01 URL继续使用精确group/project参数。新增只读GET `/api/research-directory/execution/:id?studyGroupId=...`，沿同一旧源权限返回`{profile,group,project,capabilities}`最小元数据，解决管理员目录可见但详情打不开。design hint由装配层注入复用scripts/my-research-overview.mjs的canOpenDesignWorkspace纯判定函数，用本次受限事务当前user/group/project/membership/member按同scope计算，不再调用旧overview/API；正式默认hint=false，不授新下游权限。新绑定Study继续原researchStudy入口，意图编辑继续Q01。旧overview、原创建API、固定scope、DDL及历史数据不变，无角色种子或迁移。

## 顺序与验收

1. 当前代码/权限核对、API契约与本轮边界；侧栏精确撤除。
2. 后端反例先RED后实现；覆盖旧双成员/父链、隐藏意图、失权owner、管理员、搜索、排序/分页/total、停用组等；只读受限PG验证。
3. 共享客户端/身份恢复、P01展示与完整列表接入；原S01定点详情兼容。重点防迟到请求/分页越过换账号，后台刷新移除失权项，长摘要可恢复查看全文。
4. 当前19501受控重载前确认所属进程/无执行中任务，保留原账号、会话和队列；真实PG/HTTP/Chrome测试首页前5=列表第一页前5、总数/去重/搜索、原/新/受邀详情、管理员与普通/受限角色、窄屏/键盘/失败恢复/撤权；截图及录屏。不调用模型/渠道，不改旧记录来制造验收。
5. 独立复核，更新living spec/使用说明/版本与专项测试、技术文档及Notion；四层分别报告，不把本机技术测试当生产/专业签收。

工作区存在其他并发改动；仅本任务文件精确修改，不reset/stash/全量提交。子Agent负责后端与P01/侧栏，主循环保留客户端/列表/详情、集成/目标环境与文档，独立Reviewer守门。
