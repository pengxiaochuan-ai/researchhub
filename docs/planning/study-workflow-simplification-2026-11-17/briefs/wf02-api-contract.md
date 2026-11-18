# WF02 接口合同与离线实施顺序

2026-11-17。当前只WF02，不访问目标服务/PG/凭证。RED证据：`docs/testing/evidence/study-workflow-simplification-2026-11-17/wf02/red-attempt-01.log`。GREEN前与根核对。本页为工程合同，不是四层验收。

- GET `/api/research-studies/:id/protocol-templates`：search<=120，limit默认10最大20，cursor服务端有界扫描、绑定tenant/actor/authVersion/target/search；返回items与nextCursor，最多扫描100个候选，源授权按Study缓存。不返回无权源标题或正文。
- GET `/api/research-studies/:id/protocol-templates/:sourceStudyId/:sourceProtocolId`：返回source固定ID/version/revision、sourceFingerprint、targetFingerprint、configuration/forms/scales/outcomes、differences（added/same/changed）、blockers、canImport。只读不制造待保存意图。
- POST `/api/research-studies/:id/protocol-template-imports`：严格仅requestKey、sourceStudyId、sourceProtocolId、sourceFingerprint、targetFingerprint。200。一次事务复制或精确复用固定定义、调用原native createProtocolVersionInTransaction新增draft、核对目标固定材料、记录原operation/audit。旧方案/答卷/审批/同意/人员不变。
- GET `/api/research-studies/:id/protocol-template-imports/receipts/:requestKey?requestHash`：200 `{found:false}`仍未知，或`{found:true,...result}`。只读核对不能自动重发。

result={protocol,origin,receipt}。receipt={id,requestKey,action:protocol.template.import,targetId:newProtocolId,studyId,sourceStudyId,sourceProtocolId,sourceFingerprint,targetFingerprint,requestHash,authVersion}。hash使用严格POST body（含requestKey）的canonical SHA256。origin只记录源/目标固定版本及复制/复用映射；详情在当前授权目标方案下仅投影最小来源摘要，不读取其他actor私有receipt。

源/目标必须在当前事务复用原protocol精确canConfigure（租户管理员/Hub负责人，或原ctx.canConfigure且当前有效组角色含study.configure）；source read不足以搬移私有正文。源非fixture approved/executing。源行及固定材料、目标创建边界/固定材料须锁定并重算fingerprint；源或目标改变409 PROTOCOL_TEMPLATE_STALE；材料阻断preview 200 canImport:false，POST409 PROTOCOL_TEMPLATE_BLOCKED；不可读源404 RESEARCH_NOT_FOUND；配置权403 RESEARCH_FORBIDDEN；请求键冲突409 RESEARCH_REQUEST_KEY_CONFLICT。

每个源FormVersion使用确定FormTemplate key wf02-<sourceTemplateId/sourceVersionId hash前32位>，name/description/schema/scoring（含null）及版本原样，sourceKind tenant_published且记录精确源ID。目标FormVersion locked；结局沿源key+version published固定定义，键冲突仅exact定义可复用，否则阻断。多个源版本不丢失；不随机改名、不补数值。量表不复制许可/适用性；C按原licensed完整材料规则，A/B按原published完整材料；目标已有latest applicability指向别版阻断，无记录沿方案固定绑定。

S11基准区details“从已审核方案带入”，搜索label“搜索已审核方案”，搜索结果直接“预览差异”，region“核对模板差异”，单按钮“确认差异并带入草稿”。dirty先保存原修改；导入创建新草稿后保留原四卡继续编辑。unknown先“核对上次带入结果”，found:false仍保留并允许明确“按原请求重试带入”。存储仅opaque marker，绑定账号/authVersion（0合法）/URL/源目标/epoch/当前权限。读取/迟到不清新busy或覆盖新输入。新来源在S02/S07/治理同一详情投影可见。

实施顺序：RED合同→原权限helper最小提取→新独立服务与测试→controller接线→新session helper与页面局部接入→离线相关回归/build→冻结hash/patch交根做PG/原生页面/三侧/异常恢复/PNG-WebM/五宽200%与文档Notion闭环。源复制权已由根在GREEN前核准。

## 离线验证边界

新服务和helper的RED缺模块失败日志保留；后续契约、服务行为、会话恢复与原Formal/protocol/form模式相关回归通过。内存事务测试只证明契约路径和守卫，不替代真实PG隔离、回滚、授权和页面证据。本实现者未访问目标端口、PG、凭证或Chrome，未执行服务重载。

候选以全局budget限制100个binding/协议候选、最多返回20项；先读tenant-only opaque binding，再按Study一次授权后在当前scope读匹配方案；游标加密并绑定身份、目标与搜索。

服务测试覆盖源/目标固定材料、target上下文恢复、exact null计分、逐sourceVersion映射、漂移、键冲突、原键回放、未知结果、当前失权、正式状态、具名literal配置、原子失败回滚、分页游标绑定。恢复测试覆盖authVersion0、刷新后只读核对、错误回执保持未知、账号/URL迟到、旧GET不清新write、存储失败不发POST。构建保留既有chunk大于500k告警。

S11预览和新draft来源摘要说明：源研究执行政策不带入；人群分组与访视分支、同意与独立审阅须在当前研究确认。访视计划条数不解释为实际时点数。

最终独立复核的两项P2已补反例：既有unknown在found:false后明确原键重试遭遇4xx，不能据此判定更早写入失败；保留原opaque marker和unknown，停止继续写，须再次只读核对。只有原成功proof可关闭该未知操作，源权限仍严格重验。首次新请求的确定拒绝保留原确定失败语义。既有按需固定内容同时展示量表固定名称、版本号/版本标签与结局方向原值，不推断医学含义。组件事件测试验证404恢复仍为原key、重挂后只读核定且不产生第三次POST。

未知结果区提供单个标准链接“在新标签页核对已保存方案”，仅打开原S02的当前Study列表。原标签保留原opaque pending，既有target=_blank例外不被站内离页保护拦截；只读查看不核定原key，不发送额外POST，不放宽源权限。

V4原生预览对照发现，既有`full-study-bootstrap.mjs:52`与`visit-workflow-qa.mjs:20`使用明确合成模态标记。模态文件除原`{modality}`外，仅额外支持完整三字段`{modality:'tongue'|'voice'|'eeg',sourceKind:'synthetic_preprocessed_features',rawExtractionClaim:false}`原样带入。既有访视文件消费端仍只按当前访视/被试及modality核验真实文件来源和SHA；这些标记不代表原始信号提取能力。缺少标记、true/其他值、不明sourceKind、其他模态或任何额外引用字段均阻断，不删标记伪装成功，不复制文件或文件来源实体。

V5真实PG回滚预测暴露来源可用不等于可移植：模拟适配器只对原case的精确Protocol ID/hash、variables及固定表单计分映射认可`form_score`。新Protocol（含同Study新ID）不继承注册；原native固定引用只支持`data_field`和`scale`。预览和导入均须对其他sourceType返回`TEMPLATE_OUTCOME_SOURCE_NOT_PORTABLE`阻断：“此方案的总分来源仅用于原研究，当前不能直接带入。请先在当前研究配置可用的结局来源。”即使源fixed check返回ready也不能越过。不得转换成不存在的原始total字段、复制模拟注册或移除目标fixed gate。原真实题名模拟源保留为真实负例；旧失败manifest和0持久写证据归档，不能据其他原生QA源通过宣称该模板已成功导入。
