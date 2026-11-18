# WP05第二切片源码核对与裁决

## 当前实施核对：E08代码评审修补及技术复测完成

唯一评审0 Critical/2 Important/1 Minor；主实现将误报当前试填已通过的Minor升Important，三项一次修补内RED→GREEN：历史restricted后作废普通读/写迟到；单字中文科学量共享输入遮蔽/输出拒绝；改答案清旧校验。217/217相关测试及28项免费门禁通过，没有新模型调用或二次独立复签。下段216/22为修补前检查点，最终文档/Notion证据另记。

全新材料两账号均实际执行原Agent/KB/pgvector/DeepSeek，分批核对意见后原executionVersion不变、根head推进；外部写/正文改回不恢复，重绑保留旧basis与配置历史。旧TS/Python质控、报告、资产在新根运行成功，配置修订后三者均stale且UI不自动重绑。实际在途撤审返回HTTP200但最终PREPARATION_SOURCE_CHANGED、assistant=null；不仅是UI注入反例。

真实故障修补：重绑空理由的焦点被全局error effect夺走，改为局部关联错误；管理员AI把R04写正文被数字guard正确拒绝，保留失败费用，模型规则投影删除纯展示编号、保持真实findingId/path，严格输出校验未放宽，显式一次修补验证成功。216/216相关测试、1054/1054原内核及22项免费门禁通过。累计63笔known/¥1.246815，原52笔前缀不变。下方E04零费用/SHA全文不变为历史，不再作为当前全账本结论。

## 已批准实施的裁决与实测（2026-10-23）

原两账号既有本人产物读/建/改及科研Agent授权足够，无新增grant。复用旧纯表单validator，不调用模板列表或正式Protocol服务；配置保存在原产物新版本，答案只在浏览器内存和本轮预览请求中。

免费夹具只复制本人已有真实成功方案/PICO快照到本轮新具名产物，保留源产物与版本并明确未执行新AI；历史方案和审核资料不改。该证据只覆盖配置链，E05/E07全新材料模型链仍待实跑。原账本52笔/¥0.984879/¥5的完整SHA保持，未核新价、付费或续额。

Chrome反例发现并修补：嵌入方案h1与页面h1重复，改为显式嵌套标题模式且原聊天默认不变；input/select/textarea的控件名称混入错误、选项或文本值，改为独立可访问名称并关联错误；未改全局Shell、颜色或字号基线。初次API负例误用kind而旧端点要求stage，已按原契约修正后验证免费key不能启动收费任务。迟到响应测试早期在fulfill前unroute导致测试脚本异常，改为等待交付完成；不当作业务失效。失败证据和日志均保留。

严格保全覆盖691旧源、32表16845旧行、9正式表2024行、8旧进程、原授权和63冻结证据目录。唯一独立代码总评审留E08，未提前派审或用文档评审替代。详细结果以[阶段报告](../../testing/research-execution-preparation-2026-10-23.md)为准。

## 当前事实与复用陷阱

- 首切片已技术交接，专业A09仍待用户；不是正式Protocol、EDC或完整科研Agent已交付。
- 旧`app/server/src/study-operations/study-forms-policy.ts`实际字段类型为number/integer/text/select/boolean，可复用normalizeFormSchema与normalizeAndValidateAnswers；本片不调用scoreFormResponse，不发明日期字段/量表算法。
- 旧StudyFormsService.listTemplates会ensureBuiltinTemplate，不能拿它当无副作用只读入口；createProtocolVersion会写正式StudyProtocolVersion且acceptanceFixture=false，不能直接用于合成草稿。
- 现有local-research-plans提供withDraft/inDraft/formatContent，校验本人、当前授权、来源与seal，原产物版本和审计可承载可选准备块；不需要另建公共业务表。
- 配置元数据和AI入队也会增加根产物版本。若把来源方案版本等同当前CAS，会自我失效；若只比正文hash，改回正文又可能复活旧配置。拟采用准备head连续链：仅本片写推进head，其他根版本写一律使本准备失效；用户显式重绑才开始新配置revision。

## 编制过程留痕

最初在父目录执行Git核对得到codex/zhenjiu，进一步git -C researchhub确认Hub是独立仓库，仍为codex/ui-ue-validation；已纠正初稿的仓库归属，不切分支、不覆盖既有改动。初次多文件读取输出过大截断，改为小段及定点源码；不把截断视为已读完。产品维护规范实际在父项目docs/product，错误推测Hub同名路径后已改读实际路径。以上均无写库或业务副作用。

## 独立文档评审后的主编裁决

本轮一次独立只读评审4 Important/2 Minor，无Critical或必须新增业务授权的决定。已核对local-knowledge-ai原assertAnswer→accept→beforeAssistant执行序、design连续head、原confirmation.hash与picoHash区别、旧表单validator空值放行/不查required后补全文档，处理见[评审](review.md)。未要求第二次独立签认。

check只从不可变assistant投影，不能为了保存AI结果再写准备版本；入队和完成是各自原子事务。意见允许同一结果在连续opinionHead上部分保存，但不能弱化外部根写失效。预览必填/缺失与多错误聚合由小外层适配负责，不改旧validator。保留原KB引用门槛，只允许实际[n]及精确技术ID免科学数字误判，不绕assertAnswer。hash取editable正文/confirmation.hash/原sources canonical digest；稳定路径按key而非下标。这些均是本片实现约定，不升级为新平台。

额外自检：空配置仍需全局缺项发现，不因没有数组元素而显示无问题。正式临床适用性/单位等价/时点设计不由规则或合成模板替专业确认。保持28＋4预算，任何越界或等待如实复估。

## 供用户整体批准的实现选择

由主编提出的容量、接口、head失效、数字隔离与合成模板均已写入规格供用户整体批准，不冒称用户逐字段指定。临床模板适用性、正式采集/审批和完整联网不是本片默认授权。
