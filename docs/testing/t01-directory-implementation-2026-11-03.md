# T01团队目录本机实施与验证

日期：2026-11-03。仅`wp01_test_full_baseline`及原本机合成租户，非生产发布。**T01及必要T02／G02全约定技术链已接通；窄屏差异先获用户明确批准，再完成五视口及原生200%复验，限定独立代码总评审无剩余阻断。** 本轮不进入R01。真实项目团队仍需管理员补充正式名称／名单等资料，用户专业验收单列，技术合成验证不能代签。

## 当前可体验

- [T01团队目录](http://127.0.0.1:19501/pages/t01/)：真实搜索、四维动态筛选、排序、条件标签、10条分页／跳页、全匹配城市地图、空态／409／网络恢复。当前仅1个明确标注`[合成验收]`的团队获准显示，非演示数组。
- G02原数据治理新增`view=directory-review`叶子：原合成管理员可建机构／团队／研究者候选，维护概况、任职、团队成员、成果、合作和数量口径，逐版本批准／拒绝／撤回，查看历史及核对原始位置。普通科研人员403；不创建账号／成员／认证资格。
- T02必要只读详情：同ID、原七Tab／双栏／动作槽位，当前获准关联及来源版本／hash／原始位置；返回保留关键词、筛选、页码、视图和真实条目锚点。关注／合作不假成功，不称完整T02产品交付。

## 数据库与授权边界

原Account四列已在身份阶段实现；本轮沿已安装三张目录表，没有重建用户／身份／角色表。另按用户明确批准，仅增加有界`rh_directory.hold_source_for_commit(text,text,text,text,text)`执行能力，PUBLIC禁用，只给原应用角色EXECUTE。固定search_path／作用域／当前管理员／版本／hash，不改旧来源表UPDATE／DELETE授权。

函数迁移hash：`4c98f62c925dcee7bb07a29a71386816ef01ed5ea6c34f1eafeb5624f3db35e1`。三表V1 hash保持`38934525852028e84c7315a0d9cbf55694542bb09035c4bc70d6bf49abbe325b`，两个层分别核对目录指纹与回执；启动只检查，不自动迁移。

只新增本轮具名材料批次`rh-directory-t01-20261103-batch`的2条材料：明确虚构的技术事实清单、用户确认的机构与项目团队范围记录；不创建canonical_publication，不混作论文、全文或真实研究成果。经原管理员HTTP审核，旧来源记录／审核只读。真实机构与暂名项目团队仅候选，不批准公开；合成机构／人员不映射为账号。持久预算仍为3机构／2团队／4研究者、40事实版本／20审核决定，回滚测试不保留对象。

## 验证证据

- 目录专项＋客户端／展示规则首轮30项通过，后续新增空error回归；包含真实PG：当前授权、RLS、父链、三类来源锁／双事务、原权限42501、不可覆盖历史、同键回执、CAS、来源撤回、主机构冲突、收录0值与新待审关联使数量失效、审计故障全事务回滚、公开PMC在登录与匿名范围保持可读。
- 最终身份＋目录＋全前端**236/236串行通过**，命令`node --test --test-concurrency=1 server/research-identity/*.test.mjs server/directory/*.test.mjs tests/*.test.mjs src/*.test.mjs`，Hub与旧后端build通过。首次默认并行235项中5项因测试prepare先更新共用账号、再取租户锁造成40P01／55P03，失败日志保留在`.tmp/directory-final-tests.log`；按本轮同一合成夹具串行约束复验全绿，不改业务锁或增加超时掩盖。旧系统服务未操作；本机runtime仅在当前合成租户无活动导入／问答后正常重载。
- [真实HTTP8组](evidence/research-identity-directory-implementation-2026-11-03/t01-api/result.json)：原两账号＋匿名，非管理员拒绝、真实候选隔离、六种关联只读、非法范围／重复参数／页码／Origin／48KiB／CAS、来源选择器不漏正文或私人身份。
- [首轮创建与管理员审核](evidence/research-identity-directory-implementation-2026-11-03/t01-browser-08db0193-b2c5-43d1-ad4d-2315d6d52bdd/failure.json)：前段实际完成新建待审→选择来源与位置→公开审核。该轮随后因测试定位到两个同名Tab失败，**保留失败证据，不写成整轮通过**。
- [列表／地图／详情／错误恢复](evidence/research-identity-directory-implementation-2026-11-03/t01-browser-dce56ed0-3d4e-4289-a093-db08321bf477/result.json)：6组技术流程，四筛选／排序／清除、无结果地图不回退全部、七Tab、409及断网明确恢复。
- [真实Chrome边界7组](evidence/research-identity-directory-implementation-2026-11-03/t01-boundaries-f528f62c-87f8-4023-9b03-9c6da5a42a23/result.json)：未提交丢响应→404回执→显式同内容同编号重试、事实修订及拒绝、撤回机构关系使卡片与分面消失后显式恢复、迟到预览期间禁错对象审核、管理员真实Cookie换owner后的迟到200不得回填、同视口原母版对比、原生200%真实观察。
- [真实竞争及回执恢复2组](evidence/research-identity-directory-implementation-2026-11-03/t01-recovery-c0964226-dde3-46ca-911d-19f156ac7746/result.json)：404后另一窗口真实追加新版本，原编号重试409，保留本人输入、显示当前版本并显式恢复编辑；随后真实提交成功但响应丢失，原编号回执恢复且无重复写入。只更新本轮未批准项目团队候选，不放行。
- [独立总评审及修补](../planning/research-identity-directory-2026-11-03/t01-code-review.md)：同一只读评审席位，原5项Important及2项Minor修补复核关闭，无剩余代码阻断；不代替浏览器／用户专业验收。

## 视觉核验与纠错

1440×900真实模式与原显式母版首卡的四列、gap、padding、卡宽、搜索控件高度、标题字号／行高实际数值完全一致，[数值比较](evidence/research-identity-directory-implementation-2026-11-03/t01-boundaries-f528f62c-87f8-4023-9b03-9c6da5a42a23/mother-comparison.json)及同目录两张PNG保留。正文随真实数据自然增高，不换示例图、不用演示人数填0。

**纠错：** `t01-browser-dce56...`最初以`document.scrollWidth<=innerWidth`判断窄屏无溢出，该判据不充分：固定Shell和卡片内部发生裁切，即使根宽度没有增大，390px卡片宽仅91px、第三列0px，正文不可用。其`five-viewports-no-page-overflow...`条目仅证明根宽度，**不得作为手机通过**；原结果和截图原样保留，本段明确更正。后续已增加元素可读宽度／命中边界检查，并保留真实390／320／原生Chrome200%失败观察，不静默修图或声称全站适配。

用户后续已明确批准上述最小UI07方案，随后仅T01／T02消费者复用已有移动导航，窄屏筛选换行、卡片按原顺序纵向排列、详情Tab横向滚动；1440／1366／1920桌面Frozen尺寸和交互不变。不是依据通用规则自行扩大布局授权。

[最终布局真实Chrome4组](evidence/research-identity-directory-implementation-2026-11-03/t01-layout-4665a178-5658-44dc-87e9-9d3807bbf3e5/result.json)：五视口检查实际标题／卡片可读宽度和命中，不仅根宽；移动导航inert／Tab圈／Esc还焦点，详情七Tab、末项返回和地图真实DOM滚动锚点；实际Chrome设置200%（DPR=2、scale=1）仍可走详情／返回。主代理查看390／320／原生200%像素，评审也复核相关截图，无新阻断。首轮Tab发生flex shrink缩成8px，保留` t01-layout-379407ce.../failure.json`，局部flex:none＋min-height52后复验通过；不使用强制点击掩盖。

最后截图还发现“成功读到卡片却显示通用失败提示”，根因为`directoryMessage(null)`误用缺省文案；增加空error／Abort回归，成功页面必须`.team-empty=0`，最终Chrome已验证。桌面四列尺寸不因删除错误状态块而改变，未假称像素行高完全相同而忽略真实内容自然增高。

最终只读保全核对：[状态快照](evidence/research-identity-directory-implementation-2026-11-03/final-state/result.json)。2机构／2团队／1人物、16事实／14决定、2具名原始材料、0canonical论文；原两账号非秘密旧列hash`11fa3cbaf43107e510abf21daeb78c36`匹配身份阶段，R01原hash相同，三表及锁函数匹配。核对脚本初版别名未加引号导致PG折小写、及错把包含密码hash的摘要与原“非秘密列摘要”比较，均已定位修正；不将脚本判据错误当数据损坏，也不修改数据以凑hash。

## 四层交付结论

1. 代码：目录、服务、同源客户端、T01／必要T02及G02叶子已实现；独立代码评审关闭阻断项。
2. 目标环境：仅本机合成库配置启用，7个本机服务运行；生产／公开域名未发布。
3. 真实请求：原两账号及匿名真实HTTP、真实Chrome／PG执行已留痕，非Mock。
4. 业务效果：约定功能与获批局部布局技术验证通过，T01本机技术交接成立；真实团队资料和用户专业体验尚未签认，不称真实内容／专业／生产交付全部完成。

全程0模型调用、0外发邮件、0新增云／远端运行配置访问；未动旧服务、原权限、临床库或历史任务。不切R01，不扩共享底座。

## 文档与同步收据

最终日志：`final-state/tests-236.log`、`directory-31.log`、`hub-build.log`、`backend-build.log`位于本轮证据目录；236是唯一组合用例数，31目录专项有重叠，不相加冒充更多测试。

本地规格／接口／数据库／来源锁／计划进度、产品基线／变更／版本／使用说明及前端架构同步；保留其他会话B04／E01／S08内容。Notion沿原product／technical／planning／testing层级，更新原页面而非重建，新增[本轮验证](https://app.notion.com/p/40d56479ab5881f88722e1135875afbb)与[独立评审](https://app.notion.com/p/40d56479ab5881d9b0dfeffefbbbd43a)。工具均返回对应Page ID且无warnings；不整体replace／删除子页、不上传私有runtime、账号口令／Cookie、患者材料或视频。既有页面只同步本轮增量和当前状态，不称全部历史逐字镜像。
