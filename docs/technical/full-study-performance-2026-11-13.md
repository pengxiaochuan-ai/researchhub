# 整课题性能 · 最小实施契约

当前主线仅为本轮统计/批量审核性能与原结果核对。旧整课题数据及验收报告不改；本文件随实测更新，不把结构估算当完成证据。

## 已定位的重复路径

原正常process包含7次完整core.project，create含首片共10次；39项review或全部已存在的reviewReceipt各有80次。原单根profile约3.55秒/3065次DB调用，因此长等待主要来自来源复核重复，不是descriptive-v1数值算子。以上次数为代码定位，须用本轮实际请求再测。

## 第一小步（已冻结，可实施）

仅v2本机私有Methods适配的review/getDescriptiveReviewReceipt去掉public mustFindRun默认的提前完整read，改为当前scope新鲜运行读取后调用原生FormalDescriptiveRuns.review/reviewReceipt。原生事务内live、当前权限、完整来源、行锁/CAS、角色、原key/命令hash、audit/review记录均保留；原旧系统源码、v1、普通Methods不改。

process完成事务已持当前来源，写finished后读取fresh rows形成返回metadata，能力查询仍在事务外；create复用其初始状态并返回首个process结果，去掉额外api.read。不得将Worker移入事务或跨事务复用proof。不得Promise.all并发39个原生审核，保留official→tenant授权锁顺序。

能力展示只做等价短路：group原canReview已false时无需继续累计child review的AND；canCancel的OR已true后不用重复读其余child取消能力。只有所有待求布尔量确定才短路，未知权限继续原生核对；命令本身仍完整重验。非原actor且组不能审核时只读能力全false，不额外查询Methods。不得据快路径授予新的动作。

group响应可加`sourceSnapshot`，原样携带本次group事务刚验证的`{basis,manifest,qualityGate}`，不额外投影。新v2界面若该字段的Study/plan/snapshot/manifestHash与group全部一致，可复用同次响应而省去紧接着的独立snapshot GET；缺字段兼容原读取，存在但绑定不符则停止。保持完整预览范围和原读取权限，不跨请求缓存来源，不省掉server当前来源验证。

进一步缩短v2工作台准备：私有facade可以用原生transaction/accountAuthority/workerFeature/agentAuthority/authority/会话锁等helper完成相同身份、功能、Agent/Skill、session和idempotency绑定，省掉仅preparation的完整来源投影。随后必须调用原生create，snapshot、dispatch和publish三个原事务仍各自完整重验；不向原生函数伪造CurrentAnalysis或跨事务传旧proof，不改公共prepareWorkbench或旧源。准备返回仅sessionId/agentId，不能作为来源已验证证明。

## 测量契约

扩展原只读profile工具的显式performance模式，固定当前corrected快照；写入新证据目录而不覆盖旧profile。全模型写被拒，所有原SQL/行锁仍执行，事务最终强制回滚。记录墙钟、每类查询次数/精确重复、原生调用与manifestHash，不能用单根改善替代实际HTTP。

本轮before已实测3876.626ms，首次授权锁等待1.567ms，18观测/54切片及当前corrected manifestHash一致，最终强制回滚。说明当前主要成本仍为重复读取，而非等待该次tenant锁；不能由此推断所有运行无锁竞争。

## 第三小步：投影内部的受限优化

仅在单次core.project内部去重已成功获取的完全相同ID锁：research_project/protocol/subject只返回id的原SQL，以及当前tenant的原授权advisory xact锁。首次原查询及锁模式、SQL形状、参数/scope均保留；空/失败不缓存，不对批量/标量作子集推断。enrollment/visit锁携带可变status/binding结果，绝不缓存。模型写、原始写或上下文改变清除内部memo；不同事务不共享。

另一候选是46份来源的current+fixed成对原生读取：首次完整current后，history.context重复调用同current。拟只在无外部callback的一次顺序成对调用内复用刚取得的当前见证，严格匹配physical tx、actor/authVersion、scope、assignment及完整ref；单次consume、finally失效/深拷贝，历史enrollment/policy/rawrevision/envelope验证继续原样执行。稳定性依赖tenant授权及父链锁与合法写路协议，不能声称首次current直接锁了assignment/response。该候选须先通过隔离/并发反例与新PG profile才可接入，不泛化为数据缓存。

## 分步恢复契约（第二小步，已冻结）

沿现有limit1执行方式实现持久分步审核，不新建通用后台队列或守护进程。用户一次确认后页面串行推进；每次请求只处理一项。刷新/断线后先只读核对，未决时不自动POST；原结果已证明后显示进度，由用户明确继续。页面关闭时不会承诺后续自动执行，当前一项可以沿原生请求完成。

保留原同步review/reviewReceipt以兼容旧调用；新v2界面固定使用新分步契约，不让用户选择内部模式，不静默回退长连接。新增路由均在`/api/research-studies/:id/analysis/runs/:runId`下：

| 路由 | 输入 | 输出/副作用 |
| --- | --- | --- |
| POST `/review-operations` | requestKey、conclusion、comment | 当前源/权限核对，固化审核意图，返回operation；不执行39次审核 |
| GET `/review-operations/:operationId` | 无 | 只读进度，不派发 |
| GET `/review-operation-receipts/:requestKey` | 无 | 精确原请求的operation；未找到404，不自动新建 |
| GET `/review-operations/:operationId/step-receipts/:requestKey` | 无 | 精确该step key的原claim/原生终态证明；不以别的step进度替代 |
| POST `/review-operations/:operationId/process` | requestKey、expectedStateHash、limit=1 | 当前权限/来源/状态CAS与持久claim后，最多一个原生审核；返回operation |
| GET `/process-receipts/:requestKey` | 无 | 精确原process claim及原生运行完成证明；只读，不派发 |

operation固定返回`studyId,runGroupId,operationId,requestKey,kind='full-study-review-v1',snapshotId,manifestHash,status,progress:{total,completed,remaining},stateHash,canContinue,receipt`，status为`ready/processing/completed/blocked`；可增加`retryAfterMs/errorCode`，不暴露审核意见到浏览器存储。受理正常HTTP200，显式status区分受理与完成，不能收到任意200便清pending。元数据受理与只读查询均以5秒内为初始工程目标。

step应答及step-receipt应答额外返回`stepReceipt:{requestKey,status,executionConfirmed,runId}`。operation顶层requestKey和receipt始终对应parent意图；不得凭parent回执或别的step进度清掉当前未知step。普通GET operation可带lastStep作展示，但精确恢复使用专用step-receipts路由。

parent意图和step记录复用原Audit/operation receipt，绑定当前tenant/group/project/Study、actor/authVersion、原group与snapshot/manifest、完整命令摘要。相同key异输入409。child沿用`full-review-`加`hash({requestKey:parentKey,runId})`和原生commandHash，保留原审核/版本/审计，不重造审核。确认操作跳过在受理前已经completed/confirmed的child；被冻结的目标集合必须明确，不能以group整体confirmed冒认本key完成。

进度批量读取原生review audit/review，并逐项校验原派生key、commandHash、reviewId/version、reviewer、结论/理由及scope/binding；全部本请求凭证证明后才completed。当前权限与完整来源仍重验；来源变更/撤权停止后续，不以历史成功掩盖。GET没有写副作用。

原生调用在事务外；claim用操作级互斥和服务端有限租期。未到期claim不并发派发；已过期/服务重启后只能明确继续同一个尚未证明完成的child，沿同一native key，不跳下一项。原生receipt已证明完成但finished响应丢失时，可以读出进度，后续显式POST在事务内补记恢复事实；不得通过GET补写。不能证明原生终态的计算claim仍显示处理中/待处理，禁止重算冒认成功。

process回执输出`studyId,runGroupId,requestKey,status,executionConfirmed,group,receipt`，status为processing/completed/failed；只有本key绑定的native run实际终态及来源证明才能executionConfirmed。回执中的group操作能力可以保守全false，恢复后单独正常加载能力。原create receipt仍按原键读取；当前客户端对run create/process未知结果都先GET回执，不直接重POST。

前端仅在原S05卡片显示“正在审核，已完成N/M”“核对审核进度/继续审核”；浏览器只存actor/authVersion、scope、原key、operationId及必要最小标记，不存审核意见。身份变化立即清私有展示与终止客户端请求，保留仅原身份可找回的最小未决标记，不把未知写当未执行。正常成功依旧一次用户确认，源/权限/失败恢复不增重复确认。

新审核operation事务使用内部固定`withResearchStudyTransaction(...,{includeOfficial:true})`扩展：先official、再tenant授权锁，再原Study解析和scope。仅新operation选择该内部参数，HTTP不接收，其他Study事务默认不变。私有facade的`authorizeReviewInTransaction`在此事务内调用原生live(snapshot,basisRequired=false)+reviewRole；当前完整来源已由group重验，真正child写仍由原生review独立完整publish重验。不得在已持tenant的默认事务里再申请official，避免反序死锁。

恢复补充：step404时先核对原parent operation，不能让刷新后的step因没有意见正文而死路。仅在用户明确继续时，可把未证明的旧attempt最小标记归档保留，再按当前parent/stateHash发新attempt；不得宣称旧attempt已成功。source已明确失效时，“核对最新来源”可以显式归档旧未决标记后只读预览，不能让旧marker永久锁住来源修复；原审核服务端历史不删。归档不含意见/body，保存失败不清原标记，不自动POST，不借parent进度伪造stepReceipt。

## 固定方案与已批准政策读取复用（2026-11-14）

本轮HTTP仍出现10.15秒与19.58秒，尚未稳定达到10秒目标；独审从after2读取计数识别protocol/policy重复读取，但不能把静态可省次数当实际改善。该项只在一次`core.project`中、`validateCase`成功之后安装；不改变当前运行构建，后续重载和真实测量由主任务统一管理。

锁与不可变性证据：原生`protocol-migration-lock.ts:9–16`先对当前project/protocol取得`FOR SHARE`；原生`study-operations.service.ts:921,953,1185–1186`的方案流转、审批、启用先取对应`FOR UPDATE`。`20261111230000_study_execution_policy/migration.sql:29–40`拒绝已approved policy的UPDATE/DELETE，47–58拒绝已批准方案改变approvedPolicyId/hash。安装前仍完整验证方案（含visitPlans/requirements）和已批准policy/hash；安装后仍执行原生policy内容、状态、参与同意等检查，仅复用已锁定对象的行值。

缓存只接受固定scope和case protocolId的`findFirst({where:{scope,id,acceptanceFixture:false}})`完整标量行，以及固定policyId/protocolId的`findFirst`完整行（可显式附带相同approved/status及contentHash），无select/include/relations；返回的scope/id/approved绑定或policy status/hash不符则不缓存。协议状态筛选的id-only读取、任意其他ID/查询形状、enrollment、visit、状态投影及raw来源全部透传。每种精确参数首次必须真实读取，成功完整结果深拷贝后复用；null/错误不缓存，不跨project/事务。

所有模型写、raw写、unsafe、set_config及未识别SQL在前后清缓存；仅保守识别的普通SELECT和当前tenant精确授权锁SQL不会清缓存，仍实际调用下层。epoch与进行中的写计数阻止延迟旧读在清理后回填。调用者在此project内必须使用返回的事务view，不能绕过它写底层client。须通过隔离、形状、写清理、延迟回填反例和独审后，再做新profile与HTTP分层测量；本段不表示已达性能目标。

## 已测时点与兼容性

最终46个唯一测试文件338/338通过；独审2个P2关闭。精确process/step claim持久记录独立requestDigest，GET必须同时匹配receipt.request_hash与audit_id，旧无摘要claim明确409，绝不回填或脑补历史。原生旧批量接口/旧报告路径仍保留。审核上下文按完整reviewer、原owner、scope、skill、session、Agent和skillVersion身份去重核权；不完整时逐行验证，异构授权不由firstRow代表。

附带sourceSnapshot仅缺字段undefined时兼容独立GET；present null/partial/绑定或内容hash冲突均拒绝，不能fallback掩盖。当前root读取只执行一次完整投影。

2026-11-14已受控加载stage2 PID99689（19501–19507健康），完整微基准1.955秒/1375逻辑DB调用；同一rootHash保持。新13次完整process实测8.954–18.231秒、中位16.089秒、P95 18.023秒，只有3次低于10秒，初始稳定10秒目标未达到。不得把微基准或最快样本写成HTTP稳定达标；剩余Chrome2和审核/重启恢复继续分层举证。

以上是stage2测量时点。最终owned中断后以相同18份源码哈希重启PID5072，39计算/39原生审核已完成；40 claim/40 finished中包含1个expired后同native key显式恢复，原未到服务端attempt没有receipt。四组GET前后claim/events hash保持，实际manager越权POST/他人operation读取403且0意图/receipt。最终GET与PG只读对账、独立oracle均通过，原旧39 run全字段与原Word保持；本机验收时七服务健康，随后已解除三会话共享入口/端口协调。

元数据6次GET为2.869–4.422秒（中位3.676），审核意图2.080秒受理，正常余37项单项HTTP中位9.429秒、累计327.552秒。批量仍需数分钟；性能业务体验待用户，临床/生产未验。数据库无新表或迁移，部署仅本机受控装配；恢复工具及证据见本轮testing记录。
