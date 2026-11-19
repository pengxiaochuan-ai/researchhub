# 生产AI与资产空态排查 · 2026-11-20

## 当前状态（取代下方历史阶段状态）

用户批准最小恢复，并再次要求保持模型／Worker开启。启用44585843506及同版发布44591439969均成功，后续只读44592783480确认模型开启、唯一knowledge-chat、原623条历史任务未变、旧服务及官网未变。账本跨发布保留；原边界仍为两账号、2个新会话／任务、2次实际Provider请求及1元累计费用，不充值、不续额。

资产两角色真实Chrome复验通过：admin31份、owner14份，固定版正文、合成标识可见，只读详情无错误提示或附件／复用／推荐的越界自动请求，管理GET与带完整上下文POST均403。两账号首次真实请求均已执行，账本2会话/2任务/2已知调用，累计保守费用上限0.05454元；管理员回答未通过交付总门禁，科研人员回答未通过引用编号校验，均未交付，仍不能称真实问答验收通过。免费分项诊断已随1546ac1／44593900870部署，保持ON与原账本；原两次额度已用完，不重试或续额。实际最终综合提示的引用要求缺口已最小补齐、免费验证并随d83f3ae／44595862177发布成功；最终只读44596295236确认原2次账本完整、持续ON，新的有限真实复验仍待确认。下方OFF／待确认文字均为历史阶段记录。

## 用户原反馈与真实复现

admin登录岐研AI显示“当前账号没有此会话的使用权限”，科研资产无数据。生产源码为97c8973，main文档头0e0f969。本轮在真实域名使用原admin/owner原生登录复现，两账号相同，未发送问题、运行模型或修改科研数据。

- `/api/agents` 200返回空数组；`/api/knowledge/ai-status` 200返回enabled=false、HUB_CHAT_NOT_CONFIGURED，原因MODEL_NOT_CONFIGURED、MODEL_DISABLED、CONSUMER_DISABLED。没有返回ACCESS_NOT_GRANTED或AGENT_NOT_CONFIGURED：不是本次证据中的管理员缺少Agent授权。
- 历史会话读取503，因为生产chat.history同样要求运行就绪。HubAgentPanel忽略status.enabled及原因，只把agents空数组当作restricted，造成权限误报；初始化还在状态核验结束前读历史，产生额外503。
- 资产总览200真实空态，无脚本异常。生产assets.mjs仅加载business家族，SQL只读rhab-%，且只遍历study_binding中的执行项目。旧具名合成资产不进入该正式目录；不能据此说数据库没有资产或数据丢失。当前生产rhab/non-rhab数量及绑定覆盖尚未取得直接数据库统计，需只读核验。

本机19612的ssh监听经核实属于Colima转发，不是生产数据库/服务器连接，不能将它的结果当生产统计。没有尝试读取旧aisci库。

## 当前免费最小修补

区分unavailable与restricted：全局模型/服务未就绪显示“科研AI暂未启用”，真正ACCESS_NOT_GRANTED仍保持受限；旧本机status契约兼容。未ready前不读取历史，不建立新会话、不发送或解锁输入。原版面/导航/权限不变。当前工作区未发布的采集改动保留，仅从main构造本次准确补丁。

## 实际业务恢复所需的独立确认范围

生产AI不能靠取消权限检查修复。推荐仅原两个体验账号、独立researchhub合成租户、最多2个具名新会话/任务及2次真实请求，新增费用累计最多1元、不充值、不自动重试；核对公开价格、现有模型路由/密钥可用性后启用，仅knowledge-chat。沿用已有Agent与Access，不新增角色/成员/Token或云资源，不启用其他Worker。必须先取得生产历史队列计数并证明仅认领本轮新任务；达不到此条件先停，不让历史任务消耗费用。旧服务和官网不切换、不改配置；若必须读取旧服务配置复用密钥，只读并仅在受控进程内传递，不输出秘密。

资产推荐先只读统计原registry家族、原项目绑定、审核/来源有效性，再为原admin/owner兼容展示当前租户已获准旧合成样例，保持原ID、版本、来源、用途、审核和合成标记；正式rhab目录保留。不能简单取消前缀，不能照搬本机硬编码actor/预算适配，不能改ID、补造审核事件或自动迁移正式资产。首批只读，不新增共享、AI用途或导出授权；不开放给新账号。若需要新表、GRANT、改写历史数据或额外权限，另行停下确认。

当前只有误报修补及方案准备，不宣称AI已启用或资产展示已恢复。生产启用与付费调用须确认上述范围；验证时分别记录代码、目标启用、实际请求和业务产物，不以测试全绿代签。

## 用户批准与保持启用（2026-11-20）

用户已明确批准上述最小恢复范围，并追加“保持模型/Worker开启”。因此科研问答与knowledge-chat在安全准入完成后持续开启，预算/次数门禁保持；额度耗尽不自动关闭配置，也不再调模型、不自动续额，其他Worker仍关闭。2次上限计算实际Provider请求，含内部多轮；1元是新增累计费用。

先用既有Cloud Assistant在Hub自身容器内执行固定只读统计（事务READ ONLY、researchhub/租户/角色/marker身份重验），仅输出资产ID/状态/绑定、队列计数与摘要、两账号当前授权及模型路由/密钥存在布尔，不输出正文/凭据，不启动应用或Worker。旧配置仅只读匹配DeepSeek字段是否存在。诊断与发布共用锁；不对aisci查询或写入，不改旧服务配置。

独立评审确认原生knowledge-chat的resumePending会恢复同租户历史任务；现有enqueue围栏不足。后续必须在生命周期前绑定精确获准job ID/账号/会话的认领范围，并对真实Provider dispatch持久预占次数/费用，任何绕过上下文的模型或Opencode调用默认拒绝。不能只按时间/账号筛选，也不能以两个前台请求代替实际调用上限。

## 已取得生产元数据与第一项资产修正

真实只读inspection 44569366507：researchhub内42登记（15 business、27 legacy）；历史knowledge-chat 623条，其中175 queued，当前模型/Worker关闭；两账号Access启用，配置v2路由DeepSeek V4 Pro存在，Hub密钥缺失，旧服务密钥存在。数据未丢失。

实际原生scoped catalog：admin在原Project可读10、Study B可读4，owner各可读2；默认overview却只枚举Study binding，遗漏这些已可读业务资产。因此先把登记真实Group/Project范围并入只读overview，仍逐范围app角色授权；新增读取范围不进入creationScopes，不创建绑定/Study或权限。旧legacy家族兼容仍单独保留原分类/来源校验，不用取消过滤替代。

## 持续启用的小步实施（历史OFF阶段）

资产范围修复bf2c8e2已部署，真实浏览器：admin14份、owner4份，统计与列表一致，原创建范围不扩大。

先手动prepare：只读核对researchhub、两账号、当前路由和623条历史队列摘要；使用真实已审核检索与原生Orchestrator的禁网Provider捕获两条问题的提示长度，不创建会话/任务、不调用模型、不持有假答案。通过后仅在Hub ops新建一次性admission和持久ledger（O_EXCL，不重建），封存路径进入原.env.prod，模型/Worker仍OFF。prepare不读取旧密钥。

之后发布具备bounded-hub-chat-v1守门能力的OFF基线；核对实际镜像/Compose/挂载后，复制既有DeepSeek密钥到Hub原.env.prod并仅启用knowledge-chat。账本跨版本/日期/重启保留；同requestKey走原生幂等。跨文件/事务提交失败保持槽位待核对，不退款、不假装完成。原生吞掉Provider异常时，不得发布回退为AI回答；已知用量进入原生核账。

普通发布/回滚必须支持相同协议、core和ledger；无守门能力旧镜像不得在ON状态回滚。历史六表仍逐行校验，仅经账本准入的新chat任务可变化，仍核对行存在与tenant/account/session/requestKey/createdAt不可变归属。额度耗尽不关闭模型/Worker，也不续额或再次发起调用。

## 原页接线与旧样例的最终收敛

OFF守门基线ad12d2f的生产44580528496已通过，未开启模型。再核对确认岐研AI工作台原组件使用commands而独立API只接knowledge-messages；补GET/POST commands为同一原生消息队列的读投影与严格提交别名，不新增指令队列或权限。关闭联网开关的原格式归一后复用send的全部门禁，终态保留在items/recent供刷新与原key核对。前端仅发送禁用条件补quota.blocked，不带入未发布的采集/离开保护改动。

旧27样例先恢复能严格核验的原创只读子集，非作者来源不静默通过：原loader对author且空bindings已有校验，KB/copy/旧报告保持排除。独立legacy-assets.json精确封存原ID、父范围、owner、原key、revision/版本及contentHash/policyHash，不改变chat admission SHA/账本。每次实际读取仍执行当前app主体授权、原family、父对象与固定版hash检查。只允许详情/固定版/预览/活动/比较，管理GET、全部POST/其他方法、模型、复用、下载和导出拒绝。实际可见数量与原合成标识须由部署后浏览器证明，不把42登记总数当可见数。

## 服务器Compose输出差异

ed68bdf的生产44582141051成功，独立legacy准入44582263824封存17份原创候选，数据库无写入。两次启用在复制密钥前被挂载门禁拦住，原生只读inspect44584673629确认旧Compose将显式false序列化为bind:{}；模型/Worker仍OFF，账本0/0/0。

不能把遗漏字段直接当false：[Docker规范](https://docs.docker.com/reference/compose-file/services/#long-syntax-5)的create_host_path默认true。兼容仅在同一已封存模板的对应长语法source/target块明确写false时接受序列化遗漏，显式true、路径/只读位变化仍拒绝。正向及旧版回滚模板均传入本次封存正文，门禁不依赖猜测默认值。先对当前镜像只更新并验证封存控制文件，不重建/切容器、不开启消费者，再执行原启用步骤。

## 已开启；原页真实请求发现的提交问题

控制验证44585280420通过；启用44585843506通过：canonical模型true、唯一knowledge-chat、原623任务不变、旧服务/官网身份不变，0模型调用。此后保持ON，不再将关闭作为验证结束动作。Git发布策略绑定原bounded profile及原admission SHA，下一次普通发布不得覆盖OFF或重建账本。

浏览器原新会话按钮经身份初始化后可用，管理员已建立1个获准新会话；科研人员新会话尚未建立。前两次脚本分别因初始化点击时机、直接请求缺Study头停止，未发送模型问题；原失败记录保留。原页实际commands提交503，定位为Hub队列围栏在原enqueue内部SET LOCAL之前先执行当前授权，导致tenant上下文为空；拒绝发生在原生写入前，不应取消校验。

最小修正只在Hub围栏同一app事务最先校验并参数化绑定JWT主体tenant/group/project/account/authVersion，然后保留原lock→authorize→native fn→after顺序。真实隔离PG只读验证已确认：授权前五项正确、撤权与缺字段不执行native操作、commit/rollback不串值，0业务写/0模型。另将旧样例只读拒绝改用既有catalogError契约，让真实Controller返回403，避免普通Error被Nest映射成500；红→绿Controller回归已留存。修后仍须先只读核对原requestKey无任务和账本0调用，再以原会话/原编号继续，不自动重试Provider、不扩大2任务/2调用/1元。

免费两角色浏览器现已确认：admin31＝14业务＋17旧原创，owner14＝4业务＋10原有权限可见旧原创；固定正文、原合成标识正常。A02原hooks会自动请求files/reuse-options/recommendations，这些只读兼容未开放的能力导致错误提示。详情仅对封存旧ID新增compatibilityReadOnly，原操作hooks/关联与推荐暂停请求，正文/版本/活动沿原读取状态；七标签、正文结构、500px侧栏、按钮/导航及业务资产行为不改。SSR四项通过，修后仍需真实网络与两角色复验。

## 首次真实执行与免费分项诊断

发布44591439969成功；其后只读44592505628确认持续ON、原账本1会话/0任务/0调用未重置、旧623及全部legacy摘要未变。沿原管理员会话/原requestKey提交成功201，新任务cmwnwt3ao0006r107l7h5yqqu被实际认领，唯一Provider请求已知用量1023输入＋667输出＝1690 tokens，保守峰价费用27216微元（0.027216元）。任务在assertAnswer处QA_MODEL_NOT_DELIVERABLE，未保存助手正文。只读44592783480再次确认旧623摘要与旧服务不变、模型和唯一knowledge-chat仍ON，owner未创建新会话或调用。

该统一错误合并多个门禁，现存元数据不能精确恢复首次答复。免费后续仅在Hub内部错误中记录分项枚举（原生降级、数据边界、数值边界等），不保存正文、被拒数值或凭证，不放宽既有assertAnswer、不重跑管理员、不重置账本。用本机假Provider反例验证原生校验仍拒绝、无助手交付。管理员已用完其本轮1任务槽位，重新付费重试需另行确认；owner剩余首次请求不自动当失败重试。

## 科研人员首次执行与引用提示缺口

诊断发布1546ac1／44593900870成功，只读44594585254确认同一ledger及1次已知调用完整保留、持续ON。原已批准的owner首次任务cmwnxbjhc0007n507qvln60gv入队201并执行，终态QA_CITATION_INVALID，无assistant交付；这意味着原交付总门禁已通过、后续引用编号检查拒绝，不能猜为科学数值拒绝。两次原额度已全部用完，不继续调用。

免费代码核对发现：ctx.kbGrounding虽要求[n]，原生最终无工具Reporter综合会重新构建system消息，仅说“保留可识别的文档来源”，未携带该编号要求；Hub的bindHubSynthesisQuestion只替换问题，未把Hub强制引用契约加入实际送出的最终system。最小修正仅在Hub该绑定处保留原system并补充：实质结论引用工具证据已有[n]，禁止编造/越界编号、把注册信息当疗效结果或补造缺失科学数值。原来源、当前授权、assertAnswer和数值门禁不改，不修改旧内核；先用真实sealed NativeCore捕获提示及假响应验证，0额外付费。此修补可解决提示缺口，但两次真实失败的原正文未留存，不宣称它已证明可消除全部质量拒绝；需新的有限真实复验授权。

## 最终回执与停点

d83f3ae／44595862177同版发布及只读浏览器smoke成功；44596295236最终只读确认researchhub模型true、唯一knowledge-chat，2会话/2任务/2known请求；ledger与发布前post-owner-inspection完全一致，原623/hash和legacy六类摘要不变，旧服务/官网身份不变。未执行数据库迁移，未清账或扩额。保守费用累计54540微元，供应商实扣账单不是本次回执内容。

两账号原真实回答均无assistant交付，引用提示已部署但尚无修后付费真实回答，AI业务质量及用户签收未通过。累计4任务/4请求、仍1元的新提议尚未确认，原2cap保持；停止新任务与模型调用，模型/Worker配置保持ON。技术、测试、产品基线/变化/版本/统一手册已同步Notion对应原页；后续只在明确确认后进行准确账本增量与有限复验，不复位campaign。
