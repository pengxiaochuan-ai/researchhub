# 科研身份／T01／R01设计核对记录

日期：2026-11-03（北京时间）。**仅设计证据，不是新功能测试报告或上线验收。**

## 1. 范围与目标

当前任务是形成[业务规格](../product/research-identity-team-researcher-spec-2026-11-03.md)、[接口](../technical/research-identity-directory-api-2026-11-03.md)、[数据库设计](../technical/research-identity-directory-database-2026-11-03.md)，优先原用户表扩展，设计后提交评审。没有实施新接口、页面或迁移，也没有恢复其他工作包。

## 2. 真实PG只读元数据核对

通过旧fixture-guard的validateFixtureConfig／assertFixtureTarget，再withFixtureTransaction(...,{readOnly:true})；仅`wp01_test_full_baseline`，实际`SHOW transaction_read_only=on`。查询information_schema.tables／columns及pg_policies；没有连接临床库、读取密码值、患者记录或远端配置，没有DDL／INSERT／UPDATE／DELETE。

现有Account13列：id、tenantId、username、passwordHash、displayName、role、isTenantAdmin、status、createdAt、updatedAt、authVersion、emailNormalized、emailVerifiedAt。初稿计数误写14，实施准入用information_schema count(*)及逐列集合确认13后纠正；这里只核对列名／类型，不取口令等字段值。

- Account的RLS `tenant_rows`按tenantId隔离，不是本人列级隐私政策。
- AuditLog SELECT `audit_project_select`要求非空当前Study并匹配researchProjectId；无Study审计允许INSERT，不代表可回读个人幂等记录。
- 原Tenant／StudyGroup／两层Membership／PermissionRole／Hub／来源版本表已存在；未发现researcher、identity、verification、organization、institution、team、affiliation、person业务表。
- 私有StudyGroup不是公开团队、Tenant不是公开机构，subject_profile不是科研档案；此为复用边界结论。

首轮元数据输出过大被工具截断，随后改为每表一行聚合、限定表名和列，重新只读核对；未因此写库或将截断内容当完整结构。

## 3. 真实Chrome现状观察

使用现有Playwright1.63.0和已安装Google Chrome，无新增依赖／浏览器。1440×900新独立浏览器上下文；先观察真实P004／T01守门，再通过P003实际“进入演示”入口观察已确认业务母版，没有注入登录身份、读取Cookie／凭证或提交业务表单。

| 页面 | 实际观察 |
| --- | --- |
| P004真实注册 | 原左右构图、右侧邮箱和“发送验证邮件”；尚无科研资料入口，不产生邮件 |
| T01默认真实 | 仍为pending真实门禁，不是已接API的团队页 |
| T01显式演示母版 | main=`platform-main team-board`、5张示例卡、5个select；搜索按钮、四筛选／排序、列表／地图、指标／详情和分页槽位存在 |
| R01显式演示母版 | main=`platform-main scholar-board`、5张示例卡、6个select；搜索、五筛选／排序、主要团队、指标／详情及分页存在 |

截图目录：[本轮设计证据](evidence/research-identity-directory-design-2026-11-03/)。文件：p004-existing-1440.png、t01-real-gate-1440.png、t01-mother-1440.png、r01-mother-1440.png。主代理已查看实际像素，不只读DOM。

这是设计观察，未录新功能视频、未做手机／200%／新接口功能测试，没有声称它们通过。T02／R02原关注／合作按钮仅本地useState的事实由源码核实，不能作为真实业务复用。

## 4. 未修改源文件指纹

设计前核对的SHA-256如下，收尾再次比对；仅本轮新增文档／截图，不将共享目录原有脏改动归入本轮。

| 文件（相对aisciencesys） | SHA-256 |
| --- | --- |
| app/server/prisma/schema.prisma | 890e07a26a890f82554ffca6b27ebb5a2675aadcc5530bb869f690a5440529db |
| researchhub/pages/t01/src/main.jsx | 5ce2fc0de5ca25db4b35ba14fe40c0f402ef6b276a6273e614d5b5ac2fedef04 |
| researchhub/pages/r01/src/main.jsx | c9b323d6434d2f36293dce70611ad069fc0ec8ad21488a5be364d8e3e4b21f18 |
| researchhub/pages/shared/AccountAccess.jsx | f6c9452fe610775d142215dad3f4a4bbcd83f7bfa083defe2e10d641f7942e3a |
| researchhub/pages/shared/AccountProfile.jsx | 1d56a445b0c1ec1d534b30453a8f6cf60aac9069d5c34ef68120266719aee46f |
| researchhub/server/wp02/account-service.mjs | 2669c95d07d4250d90c4fe5495ba40676a27d2e1640e75dff49c4ffefa813cc8 |

## 5. 四层交付与评审

- 设计：本轮三稿形成，独立只读评审及作者处理见[评审记录](../planning/research-identity-directory-2026-11-03/design-review.md)，待用户批准。
- 代码实现：未实施，不引用旧阶段测试数量来证明本功能。
- 目标配置启用：未实施，新列／表／接口／权限不存在。
- 真实请求与专业结果：没有新功能请求；当前浏览器只证明现状和母版，用户可用性／非空真实团队与人物仍待验。

0新模型调用、0新增费用、0业务行／权限变更；不重启旧服务、不使用云／远端运行配置、不发布、不提交Git。

## 6. 文档收尾检查

三稿＋核对记录＋独立评审＋同步收据共6份新文档的本地链接14处全部可达；6个既有Schema／页面／账号服务文件SHA与第4节相同。五份既有产品文档的限定`git diff --check`通过，新增稿也检查无行尾空格。初次自检使用`\s`把正常换行误当行尾空白，修正为仅空格／Tab后再执行通过；不把自检脚本问题算成产品缺陷或删去失败事实。

本次无应用代码变更，故新功能单元／PG写入集成／构建／功能浏览器／录屏为不适用（未实施），不是“全绿”。真实浏览器只做第3节现状观察，后续完整验收按规格执行。Notion同步收据见[同步记录](../planning/research-identity-directory-2026-11-03/notion-sync.md)。
