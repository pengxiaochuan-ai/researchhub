# WF04入组核对：第1增量工程合同

仅原生CAS与回执，尚未实现集中录入helper/UI；根负责目标装配、PG及真实页面验收。本增量不访问目标、PG、凭证或Chrome，不改旧TS核心、共享启动器、DDL或权限。

## 原生写入

沿用`POST /api/research-studies/:studyId/subjects/:subjectId/participation/events`及`.../enroll`，成功仍200。原body新增可选`expectedLastEventId:null|id`；使用hasOwn区分旧client未传与明确无事实null，非法类型／空ID拒绝400。它参与原完整body的canonical SHA256；不新增批量API。

原participationContext已持当前授权及project→protocol→subject→enrollment锁，返回当前DB actor、原固定policy和按sequence排列的当前Protocol／Policy scoped events。先查原saved key：原hash/action/target不匹配409 RESEARCH_REQUEST_KEY_CONFLICT，新proof与当前身份或封套不符409 RESEARCH_RECEIPT_UNCONFIRMED。已有成功先返回，不因后来事件或政策增加抹掉事实；未完成的新写才比较expectedLastEventId与scoped最后事件ID（空为null），不同409 PARTICIPATION_CHANGED，保留输入，不调用原record/enroll。

政策ID/hash仍按原expectedPolicyVersionId/expectedPolicyHash精确校验，随后调用原core及原审计，不改变其决定、同意、筛选、状态、访视或初始任务规则。新集中意图未来必传CAS；旧无字段body沿旧显式单项行为兼容。客户端不得拿fresh GET中的他人事件自动改写原基准。

## 新严格证明

新record/enroll返回原snapshot，receipt追加：`proofVersion:1,id,requestKey,requestHash,actorId,authVersion,studyId,subjectId,protocolId,policyVersionId,policyHash,action,targetId`。action为`participation.record|participation.enroll`，targetId为subjectId；policy与protocol必须与结果中的原固定定义一致。record另带`eventId/eventSequence/eventKind`，核原native event的id/sequence/Protocol/policy与snapshot中同一事件、kind、recordedBy；不以只套封套替代事实归属。actor使用原native context.actor（0版本合法），后续原生调用、封套审计及repo actor过滤均用此DB当前actor，不以req.role作权威。

沿用`GET .../participation/receipts/:requestKey`，controller转发query。旧无hash读取保持原result／404行为；不增加found包装。新严格query为`{action:'record'|'enroll',requestHash:64位小写hex}`；有hash必带action。合法action可单独用于过滤。未知query或非法值400；记录／目标／action不匹配404，hash不符409 RESEARCH_REQUEST_KEY_CONFLICT，旧弱证明或新封套不完整／不一致409 RESEARCH_RECEIPT_UNCONFIRMED。404仍为未知，不证明从未执行。

读取只要求当前native authorize返回的DB actor、原Study／Subject父链及本人repo行；不调用要求当前executing方案的participationContext。严格证明同时核原row id/hash/action/target、当前actor/authVersion、Study／Subject及返回snapshot中的Protocol／固定policy；record核原事件归属，enroll核原snapshot的入组ID、Subject／Protocol及status严格为enrolled，不把空入组封套当成功，不用当前状态替代原快照。历史结果不被当前状态改写，旧无proofVersion的弱结果只供旧无hashGET，不升级成新proof。

## 验证与停点

RED→GREEN覆盖record/enroll缺项CAS／事件前进／同一原key成功先行、legacy未传兼容、非法CAS、DB actor与authVersion0／变化、完整proof、严格hash/action／父链／他人拒绝、旧proof弱读兼容、无executing历史读及controller query接入。唯一attempt日志保留。本增量冻结后交根确认，再进入集中意图、15分钟隐私窗口和实际组件阶段，不称WF04整体完成。
