# 邀请异常汇总与原记录定位

## 复用与权限

没有新增后端接口、表、迁移、GRANT、角色或旧系统代码。总览先GET `/api/governance-users/studies`取得当前合法可管理Study，再按明确scope头调用原GET `/api/member-invitations`读取全部分页。旧服务继续核对账号／租户／authVersion、真实Study及原成员管理或租户管理员权限。

新`invitation-exceptions.js`只做受权响应的投影，不自行查邮箱、不猜Study或扩大可见范围。整类读取未完成时不返回局部零；畸形行、重复scope／邀请、循环cursor、取消或API失败均拒绝。原总览区分ready／denied／error及partial，身份变化继续清空旧集合。

## 异常规则

| 服务端status | 总览 | 原页动作 |
| --- | --- | --- |
| failed | 需关注：投递失败 | 查看原邀请，原显式重发／撤销 |
| unknown | 需关注：投递结果未确认 | 核对后按原规则处理，不自动重发 |
| expired | 需关注：已过期 | 原重发／撤销，不自动续期 |
| pending／captured | 正常待处理投递或待接受，不生成异常事项 | 留在原S11列表 |
| accepted／revoked | 不再作为异常 | 原状态可回查，不据此新造异常处理事件 |

以服务端status优先，不由前端时钟根据期限推断；已接受／撤销优先级仍由原服务决定。键为group＋project＋invitation ID；createdAt标“邀请时间”，不冒充故障时间或完成时间。原GET没有完整异常处理事件／处理时间，本轮不新增处理结果汇总。

## 安全定位与恢复

S11新增严格URL字段：`members=1`、`studyGroupId`、`researchProjectId`、`invitationId`；治理来源可附`overviewModule`、`overviewPage`与独立的`overviewAttentionPage`。所有字段单值、ID／模块／正整数白名单；不接任意return URL／hash。原无目标S11、接受邀请的P010及其他登录返回保持原规则。

`invitation-location.js`作为唯一解析／构造处；Cookie过期或未登录时只保留合法站内字段，真实登录后回读目标，不重放写动作。需关注页与主待办页分开；返回G02时恢复原需关注页并展开原区域，不改变布局。

S11只在当前实际可用Study内精确匹配ID；目标不在首页时按原cursor继续读取，保留原顺序与后续cursor。无target沿原首页20条／加载更多，不自动全量扫描。找不到／当前Study不可见时明确告知，不按同邮箱替代、不自动换研究。

目标行仅添加定位框、scroll及键盘focus；原Study选择、表单、列表、重发与站内撤销确认保留。仅从治理进入时增加返回原位置链接。readScope和总览read增加父AbortSignal，写方法不变。DirectoryIdentity渲染门禁＋seq／取消阻断旧身份／旧scope迟到；同身份读取失败保留输入，真实账号变化清空旧邮箱与确认。

## 2026-11-14 · 已批准真实合成闭环及边界

原P2 Study4条具名邀请已获用户批准并完成：四次创建实际进入本机SMTP；只对这些新记录准备明确合成failed／unknown／expired／captured状态并留专用审计，保留原捕获回执，不冒充供应商故障。原S11两次重发／一次撤销实际HTTP200；总览3→0消除，正常待接受不计异常。原5条邀请全字段摘要、原两个账号授权／authVersion、全部角色及当前Study两层成员摘要未变。没有新账号／成员／角色或外部邮件。

测试脚本`scripts/invitation-exceptions-acceptance.mjs`固定原租户／Study／4个requestKey，具名私有台账先登记每次尝试，不自动重复建记录或重发／撤销；实际写仅准许已登记的3次目标ID／scope操作，其他业务写／模型拒绝。准备阶段通过原创建接口，受控合成状态只写新4条，PG连接逐事务核对专用合成库；原TTL、60秒冷却、限流、权限和审计不改。台账及收件箱正文均不上传，证据只留ID、摘要、状态与审计时间。

9份产品代码哈希与唯一总评阶段一致，原只读12组及本轮6组真实处理分别举证；前者的受控分页不称真实DB第二页。本机技术交接完成，用户专业签收和正式环境／真实邮件独立待验。[当前报告](../testing/invitation-exceptions-2026-11-13.md)。
