## 2026-11-17 已批准并实施

用户已批准本申请及后续仅raw管理员原生授权一致性修补。两项补丁均按源码checkpoint核对后应用；原管理员/成员/角色未变。50项定向测试、tsc --noEmit及15项真实合成PG回滚检查通过；独立只读总评通过。当前只完成精确执行入口，不代表Hub完整上传链已启用。以下申请保留为原批准范围；现行证据见 `exact-rollback-result.json` 和Hub测试报告。

# 精确执行旧数据处理器 · 最小共享源码修补申请

2026-11-17。用户确认先完整复用旧系统实际已有能力；本申请仅解决该主线的精确执行入口，不增加算法或数据用途。

## 为什么需要这项差异

旧`RawProcessingService`的实际确定性处理、心跳与发布检查均可复用，但执行方法为private，公开入口只有会扫描租户队列的bootstrap/kick。公开`claim`只能认领，不能执行。直接启动旧轮询可能消费历史任务；用JS绕过private也不是合法模块接口。独立只读复核已确认这一点。

## 准确改动

- 源码仅`app/server/src/ingest/raw-processing.service.ts`：新增可信进程内部`executeClaimed(ref)`；形状、Worker启用/关闭、部署租户及真实claim/lease/当前授权检查通过后，只委托已有process处理ref.taskId。
- private process增加默认false的失败传播选项，仅新入口传true。关闭/越scope或解析/授权/租约失败向调用者抛出；原tick默认调用、失败登记及所有确定性算子保持。业务`needs_review`保留，不把它叫作数值成功。
- 旧默认启停、bootstrap/kick/claimNext/recover的行为不变。Hub实例手工构造、不注册为Nest生命周期Provider；Ingest持有Hub受控调度器，不持有该实例的kick。该ref不作为HTTP DTO或LLM参数，不允许客户端传token/owner。
- [拟议patch](raw-processing-claimed-entry.proposed.patch)尚未应用。应用前核对[源码指纹](raw-processing-source-checkpoint.json)，若共享源码并行变化先重建diff，不覆盖其他人修改。
- 测试仅在原raw-processing scope/执行测试中补精确入口契约及失败传播；Hub测试验证只认领自有记录给出的单一taskId。原Worker逻辑不另建一套。

## 合成验证的准确范围

申请只在已有专用合成库建立一个回滚事务内的具名临时夹具：原admin、一个新假名被试、两份新ModalityFile与两条新ProcessingTask（A用于确定性CSV检查，B为不得被消费的排队哨兵）。不改旧被试/任务或原账号/成员行；不新增Study/账号/角色/AgentConfig。A的状态、审计等原生PG写入仅在同一回滚事务内验证，最终全部回滚；源CSV为程序生成合成字节，临时文件校验后清理，不调用模型或外部渠道。

覆盖：无效ref、Worker关闭/销毁、跨tenant、错误token/owner、queued/终态、过期租约、无效当前身份/版本及新来源失效、在途代次丢失、真实解析失败（另区分finally清理失败，不扩大改写旧清理逻辑），以及A执行/B完整行及其关联Feature、ProcessingStatus、Audit均未动。原账号/成员的真实撤销竞态不在本次临时夹具授权内；本轮不得改旧身份行来声称测过该竞态，保留为后续具名验收依赖。

真实PG测试必须把forTenant/withTenantTransaction以及所有elevated.$transaction（含心跳与recordFailure）显式绑定同一外层回滚事务，不能漏到其他连接。禁止bootstrap/tick/队列扫描/恢复定时器；原process内部15秒claim心跳是执行保护，允许保留并由finally停止、等待未完成续租。JSONL执行日志不属于PG事务：使用本轮隔离临时目录，flush后保留为合成测试证据或显式清理，不写默认服务日志、不称文件日志已经回滚。条件不满足即停，不用mock替代实际PG结果。

## 明确不在此申请内

无新表/列/GRANT、无角色/数据或Agent授权扩大、无tenant轮询/历史租约恢复、无持久化业务夹具、无云资源/远端配置/费用/发布。后续格式扩展、专用导入确认/暂存模型和具名实际上传验收，须先给出准确差异，不由本项替代批准。

## 当前证据与状态

- 新会话目标解析模块6项边界测试及原导入/媒体契约定向回归合计15/15通过；来源失权传播及来源/目标principal混用已根据独立复核修补。
- 该模块尚未装配到运行服务；真实RLS、浏览器与完整数据能力尚未验收。
- 本申请patch未应用，旧源码/服务/角色/数据库/模型无本轮执行变更。仅源码元数据只读核查、纯测试和文档，不把设计或单测当作能力已启用。

状态：待用户确认共享源码修补与上述回滚夹具范围。确认前不修改旧处理器、不创建夹具、不启用raw Worker。
