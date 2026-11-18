# 计算长尾测量与优化约束

## 最终本机结果（候选3）

2026-11-16最终新39项：首项7.705秒；12三项中位8.317秒（7.711–9.449），末两项8.938秒；全39项HTTP累计117.630秒，余38一次确认至全部ready112.081秒，最长可见推进9.633秒。本组所有完整请求/可见推进<10秒，不是整批10秒或生产SLA。510回归、构建、实际锁/失效8回滚、任务成员3回滚、独立2003数值/1578来源/1093绑定均通过。

真实xmin确认首组头/首claim/两回执同一提交，13批38项publish与父FINISHED同一提交；原生create/dispatch/publish仍各自独立，Worker均事务外。首建frame内仍有3次逻辑assert/1次真实根投影，不称删掉2次授权。文件锁补齐processing task的成员插入约束，所有原生检查照常执行；不是允许任意app DML。

测量PID24230；计算后另观察PID32233实际重启，25统计源摘要相同，恢复只读核对原末批2项和39结果。新39/117审计、旧277/48修订/39子快照/36原件/Word保持，Worker78行未增加。恢复标记来自原实发POST重建，本轮未做真实POST丢响应；重启不是本次恢复QA发起，发起方未确定。原测量与恢复装配证据分开，不重写历史。新39仍待人工审核，无新报告签收。

[最终测试与证据](../testing/full-study-compute-tail-2026-11-16.md)为结果入口；下文是当时的设计、失败候选及资格说明，历史“下一步/待验”不代表最终未完成，也不能作为新任务授权。schema/API公开合同/页面布局/旧系统源码没有变化；无正式部署或客户功能更新发布。

用户已选定目标；实现方案在真实分阶段测量后收敛，不重新要求策略审批。原Methods源码、数值算子、claim/dispatch/publish阶段隔离、逐项权限/版本/CAS/审计和批次固定成员证明不变。

## 诊断计划

先在专用合成库用原角色执行只读或强制回滚的分阶段探针。记录真实事务/锁等待、各类ORM调用时间（不得冒称物理SQL数）、根来源遍历、原生live/reviewRole、末尾capabilities及序列化。独立HTTP基线使用新运行，不写旧验收目录或旧private账本，不重复未确认请求。

当前候选仅是待测假设：事务内重复授权/来源读取、原生校验调用与尾部动作权限重复遍历；未测量前不按代码外观确定瓶颈。禁止跨事务复用root证明、猜测权限结果或改写原生写模型。必要的信任边界合并须先证明实际锁协议及当前版本，写RED负例后最小实施。

## 交接与回滚

固定19501，短装配或独占测量前仅协调原已授权会话的共享入口及端口；保留所有挂载和数据，owned身份核实后操作。先冻结前轮39及旧117共156运行、48修订、39子快照与原36科学文件/Word，新增独立统计运行。全程无外发/模型费用、schema或旧服务改动。

任何方案若改变原权限/来源变更检查语义、需要其他模块或架构选型，停止扩展并说明；不因旧计划自动恢复其下一步。

## 当前测量与首个实施切片

当前版本原角色、强制回滚的单根投影实测2031.172ms，首次租户锁1.434ms；studyEnrollment.findFirst 220次（202次相同参数重复，累计248.798ms），subjectVisit.findFirst 146次（74重复，累计336.801ms）。这些是ORM时间及参数相等计数，不是物理SQL数；不可把所有重复都当成可安全消除。完整请求各阶段边界和末批权限成本另用实际审计/请求记录核对。

首个切片只在原生lockCaptureBinding成功、当前subject/enrollment/visit/protocol绑定及同意校验均已取得后，给当前访视只读过程建立callback范围的标量读取view。仅精确匹配同scope、固定id、已知绑定条件、显式标量select的studyEnrollment/subjectVisit.findFirst能复用；include/JOIN、答卷、政策结论、任务、履行、访视完整性和来源证明均不缓存。首笔必须真实非空成功读取，结果深复制；错scope/其他id/未知条件原路执行；空/错误不缓存；写入或未知SQL前后清空并以epoch防在途旧读取回填；callback结束失效。所有原生授权、consent、引用与完整性函数照常执行，不删除重复检查，不跨访视、阶段、物理事务、请求或身份共享。

先以RED验证隔离、失效、写/未知SQL、null/error、克隆及实际native query形状，再最小接入core；独立审读及真实PG锁/修改反例通过后才用于39项能力验收。现阶段不触及阶段合并或原生写模型。

### 首切片的保守测量与精确 SQL 透传边界

保守“所有 raw 均失效”版本的 after2 根投影为2523ms，enrollment 220、visit 146、assignment 138次，未观察到 ORM 次数下降；没有独立命中计数器，因此不能称测得零命中，也不把此版本标记为性能完成。

下一小步仅审核11条既有原生 tagged-template：`protocol-migration-lock.ts` 的 project/protocol FOR SHARE 与固定 subject/enrollment/visit FOR UPDATE五条；`participation-capture.ts` 的当前参与事件读取；`worker-publication.ts` 的本租户 advisory lock；`formal-response-query.ts` 的当前答卷关联读取、复核事件读取；`formal-response-history.ts` 的批准政策关联校验、精确 revision 读取。方法、完整静态字符串分段及逐位置参数必须匹配；scope与固定S/E/V/P严格相等，protocol锁仅原`::text[]`及`[当前P]`，来源ID/正整数revision/64位摘要只做参数形状检查，真正绑定、同意、版本、hash与完整性仍由原生函数核验。仅这11条 SQL 照常真实执行且不清E1…V2，不缓存其结果或授权结论。

任意其他 SQL（含新SELECT、额外函数、CTE、注释、多语句、自定义cast、Prisma.Sql/对象片段、unsafe方法、错scope/固定ID/伪分段），以及模型写入和未知方法仍在前后清空并推进epoch，防在途旧读取回填。不采用SELECT前缀或自由SQL解析器放行。先用原源码模板漂移与反例纯测、独立审读，再由真实PG锁/修改证明及另标签after-profile判断实际收益；不沿用202/74重复数宣称已消除。

## 第二切片：末批权限呈现

前轮真实请求与审计时间包络已独立提取：12个普通三项批次finish记录至完整响应的中位136.5ms，末两项为4153ms；它包含权限呈现/序列化等尾部，并非纯函数CPU计时。源码确认末批依次调用39次原生getDescriptiveCapabilities；每次forTenant读取及actionCapabilities各开启事务。先把该段限定为优化候选，最终仍以新环境完整HTTP结果定收益。

只对v2 limit3 POST的已证明终态、聚合canReview起始true且最多39个目标启用。finish/proof先真实提交，随后在一个全新原生official→tenant事务/RLS中按原顺序及AND/OR短路调用原未绑定getDescriptiveCapabilities。私有Object.create(methods)只把scopedDb接入同一物理tx、descriptiveRuns接入独立子实例的事务join；原mustFindRun作用域/404、skill检查、authority/feature/session/grant、逐项FOR UPDATE/CAS/reviewRole全部照常执行，无全局实例修改、预读尾项或权限缓存。

可信内部withDescriptiveCapabilities(actor,allowedIds,callback)只暴露到期失效的get函数，固定同actor和唯一允许ID；拒绝错scope/额外id/并发或回调外调用，不暴露rawtx。原GET、limit1、普通running和超过39目标保持原路。现有窄403/409回退在新事务回滚后执行，不能返回部分flags；原10秒事务超时不变。已核原生写链同official→tenant→run锁，不重新排序改变短路/首错误，也不宣称任意外部写路径无死锁。

RED覆盖真实原生方法绑定、仅一个物理事务和零forTenant嵌套、逐项live/CAS/role、前缀短路、跨scope/id、撤权/冲突/技能与到期；真实PG及端到端再核角色/修改并发、持锁耗时与39结果。原Methods源码不修改。

## 候选1完整请求未达标与下一诊断

同日旧版39请求累计181.926秒，普通三项中位12.603秒。候选1已441项回归、构建、真实锁/失效三事务回滚、195历史/48来源/39子快照保护、39正常Chrome及科学pre-oracle通过，但首建17.669秒、三项中位12.646秒、末两项13.964秒，完整等待未达10秒。前端response→DOM约11ms，不能用单根1.638秒或cap39 0.644秒替代完整HTTP。候选1保持39needs_review，不审核、不覆盖样本，不销项。

下一步仅私有注册合成环境的临时metadata observer：通过既有core注入点包装authorize/project，观察同一真实tx上的实际delegate读次数和时间、阶段、主体字段名/安全角色标志与scope、产出manifest hash/rows/slices。绝不记录SQL参数/答案/评分/凭证，不缓存/省略或改写请求；每个project独立Map，保留原结果及原错误，禁止跨事务模型delegate复用或累计嵌套native时间。只有本task固定私有enable文件、注册Study/租户与原source hash匹配才启用，输出固定私有metadata JSONL，不接受用户给出的路径。未启用时保持原装配；请求诊断但无实际日志时不能宣称profile成功。诊断采样不作为SLA样本，最终冻结39项测量关闭observer。

不据“冷启动”或角色形状猜测归因，先测真实服务core.project与其余校验边界，决定下一项小改动。后续candidate使用after-2等新stage、独立源hash和路径，原after/baseline及成功失败证据均保留；旧234（195+候选1 39）亦需保护。

### 实际GET诊断的有效边界与下一次阶段采样

PID78880两次真实GET HTTP为1951.144/2923.396ms，root project为1814.527/2736.343ms，每次1181次委托调用，与此前1375减194一致；E/V/Assignment为90/90/138，未发现不同读取graph。原native Methods阶段审计间隔还含子快照、权限、事务和CAS，不能把间隔减孤立project后当某个函数耗时。

发现observer对Prisma fluent Proxy的descriptor不能识别动态then，findFirst/findUnique等过早记settled；4.5/5.7ms不是其138次真实数据库耗时，pendingCalls=0亦不能为其完成举证。这些method duration/settled与总和均不使用，仅保留counts、真实async core wall及完整HTTP；原Promise和业务结果未变。原诊断JSON保留，另附qualification，不改写失败或无效测量。

下一次只为阶段定位，独立diagnostic stage创建一个新合成group，执行首项与一批3项（共4个新确定性Worker结果），不审核、不改旧234及来源。observer仍仅counts/core wall；结合真实claim/create/dispatch/publish/finish审计与请求窗口定位五根投影及剩余包络。诊断样本不作为SLA。原baseline/after全部保持，额外4项另冻结供后续保护。只读旧234回查、结束释放窗口；再据实选择最小优化，不跳过任何阶段。

### 候选2：投影内已锁元数据读取

真实diagnostic的create为14709.752ms，六次project累计13750.686ms；三项POST为13738.690ms，五次project累计12159.365ms，每次1181调用。4个新Worker/12native审计、0review、remaining35，旧234回查仍保持；不是完整验收组。下一实现只降低每次project内部往返，不合并领取、snapshot、dispatch、publish和finish物理边界。

新增project callback范围的元数据view，沿原validateCase的protocol FOR SHARE之后安装，并实际观察原六subject FOR UPDATE、各E/V完整原生FOR UPDATE取得的锁和绑定。只对成功取得锁的精确同scope查询复用：E/V原生锁返回的完整标量行；既有五种E/V显式scalar-select；固定P的id-only executing/superseded查询；固定P/approvedPolicyId/hash的原生policy关联单行id；原参与事件SELECT。首次读取真实执行、非空成功且严格shape/绑定匹配才存，clone返回，无pending共享；E可跨本project访视，V严格自身。原所有binding、参与同意规则、协议状态、hash和完整性函数仍执行，末尾六人事件聚合及所有答案、答卷、revision、review、模态、quality和permission读取不缓存。

参与事件属于含签署信息的敏感原始事实，仅同tx内供原规则重评，绝不日志/诊断/跨请求；其安全依据为subject的实际FOR UPDATE、非空FK、数据库append-only权限及触发器，阻止并发撤回或直接app INSERT，协议/已批准政策另有行锁/数据库不可变约束。不能仅靠开发约定。锁和数据witness在模型写/unknown SQL/unsafe/context/SAVEPOINT/ROLLBACK前后同时清空；对初始P保护，失效后保持禁用直至再次成功原锁，绝不自动重填。仅明确固定原生只读模板允许透传保持metadata，不采用任意SELECT放行；其他SQL仍真实执行且失效。

RED覆盖精确shape、首次真实锁、状态/绑定、deep clone、null/error/多行、跨scope/project/tx/访视、写/保存点/上下文、在途epoch与到期；真实PG核E/V并发写等待、合法撤回及绕服务app FK INSERT等待、同tx写后规则重评、源manifest相等及旧238(234+diagnostic4)完整行保护。新helper由独评后profile验证收益；先前五类全部调用自身仅约281ms，不能据此预言降1/3或10秒。另以独立受控Prisma query-event probe仅记录物理statement数量/表名/耗时及CPU元数据，不留SQL/参数，用于检验ORM往返假设；探针也不代替完整HTTP。

明确额外允许原formal-visit-evidence.ts实际执行的三条精确只读模板透传维持元数据：modality_file按tenant/id的SELECT id FOR SHARE（38次）；current response/revision/assignment JOIN与review子查询的SELECT r.id（46次）；validateFormalVisitRequirements的SELECT r.version及最近review子查询（46次，formal-response-visits.ts:25真实调用）。必须完整静态分段、scope/S/E/V/P及原始ref参数形状匹配，SQL每次真实执行、结果不缓存、不替代source-current判断。变分SQL/对象参数/其他模板仍失效。这是显式小范围白名单，不是任意SELECT放行。

两模板初版已8个PG强制回滚反例PASS，原238及来源保持；但遗漏第三条真实原生只读查询导致仍每visit清P/S/E/V。原/新query-event探针分别为1679.107/1615.578ms、1181/964逻辑调用、1568/1351 core SQL events，原始engine duration为143/246ms且进程CPU747575/712437微秒，不宣称可相加分解或稳定收益。保留此不足样本。第三模板后须另测，不复用旧hash称最终PG已验。

## 候选3设计：在同一受保护事务内共用来源核验

候选2最终helper6ae563c3/core7b8b144b：488回归/构建、8实际强制回滚、809逻辑调用/1196 core SQL/1248.424ms探针均通过，已正常装配PID99373且临时observer已移除。新组2094ca4c完整39项Chrome功能、117native审计、2003数值/1578原始/1093绑定无差异；旧238保持。实际首项11584.195ms，三项中位10475.122ms（9094.689–12665.440），末两项11176.573ms，确认至38项续算完成139887.600ms，性能目标未满足，不审核或销项。下一基线保护277条完整行。

本段修订前述“所有逻辑阶段必须独立物理事务”的实施约束，仅把可由同一来源保护框架保障的相邻元数据操作合并；所有原生权限、来源/version/hash、CAS、逐项审计检查仍执行，仍禁止跨事务/请求复用可变来源，所有Worker保持事务外。原HTTP/DTO/页面布局、单项显式process、只读GET/未知结果恢复及不自动重试规则不变。

1. 首次新建：提取既有claimOne事务内逻辑与提交后执行逻辑。共用已审root source guard（原protocol/subject锁+对来源全部processingTasks先FOR SHARE、投影后验证覆盖），在一个真实事务完成当前来源核验、组头、首claim及两类receipt/audit。root guard只给同tx/actor+authVersion/scope/Study/root/dispatch绑定、到期失效的根核验；claim仍走原权限、取消、幂等、CAS、pending/failed/zero-ready与固定成员选择，第二次逻辑assertCurrent可共用该受保护frame的root Map，不能裸传历史manifest或任意current。不得放宽现有batch resolver的通用SQL写入面；receipt等仅原作用域内元数据repository写。提交成功后才原生create/dispatch/Worker，首项预计6→5根，实测另证。错误语义须明确：首claim写入/提交失败会同时回滚组头/创建回执，旧代码可能留下组头；提交成功但native前退出仅能GET证明受理/processing，create重放不得启动第二次native或宣称可自动续算。

2. 三项成功发布：新增可信内部“发布并核对”入口，在现有原生publish事务的完整batch source guard内，所有成员原publish回调执行后、提交前，用同一固定成员resolver/当前root完成原逐项inputHash/basis/authority/CAS证明与父FINISHED审计。每项原校验仍执行，当前修订/review/quality等原语义保留；只共用同一物理tx持锁保护的root投影，phase绑定publish（公共GET仍snapshot独立fresh）。不向外泄露原tx或缓存，不在请求JSON接受hook；原保护view只执行其既有允许的SELECT/audit写，不能新增任意源写。父proof及native发布一起提交，回调/提交失败一起回滚，只有实际commit后可返回executionConfirmed。原dispatch提交后才Worker，之后重新publish source guard不变；批次5→4根。原单项调用/GET/replay/failure和混合已存在成员由明确原路径核对，不重复Worker，不用旧完成证明跳过新请求核验。

RED与真实验收必须覆盖同账号/异身份/跨scope/过期frame、原权限及任务翻转阻塞或STALE、source/input/CAS变化、claim写/commit失败原子性、publish/proof任一步失败全回滚、Worker严格在事务外、unknown commit/lost ack/restart精确GET与无二次执行、旧单项/limit3/空ready/幂等合同。正常批次独立读取native publish与父FINISHED记录的Postgres xmin证明同一真实事务（首项原单项finish另列）；不靠时间相等推断。保护旧277/原48/39snap/36科学与Word，新39完整HTTP/Chrome正常样本及科学oracle再证收益，不从根数推算宣称低于10秒。

### 任务集合与权限的额外边界

原父finish还通过ResearchHub Study的当前账户/租户/authVersion/role及Study/group/project/menu权限。新发布入口必须在同一原生official→tenant物理事务、进入原受限source view前，调用原studies.resolveResearchStudyInTransaction并核对scope/Study/actor，再设置原已绑定RLS值；不能只保留Methods权限。受限view及其SQL写白名单不放宽。

来源任务集合按file关联而无task.subjectId过滤。正式四条task.create及六条DQ/deviation writer都取得tenant锁；同主体合法app INSERT也被六subject FOR UPDATE/FK阻止，不把file SHARE兼容FK孤立称正常写可穿透。但两者是分开FK，需对同一file的任务membership提供保护：原task行锁之后、core.project之前，以同scope/六S非deleted且bound files安全superset ORDER BY f.id FOR UPDATE OF f；投影后校验root中每个file id已实际覆盖，原taskID覆盖仍保留。顺序task→file与原Worker已核一致，禁止全项目或全表锁扩张。此保证针对来源file/task及受支持writer协议，不声称可防任意裸app独立DQ修改。

新增回滚反例在Task/File锁后、core六S锁前暂停，app同scope合法同subject新task INSERT必须被holder的file锁阻塞（实际blocker PID、INSERT语句前缀、55P03），holder退出后同等insert可readback1再强制回滚，以分清FK锁、主体锁或RLS失败。前后277全行、来源48/39/36及file/task行hash保持，0Worker/HTTP。
