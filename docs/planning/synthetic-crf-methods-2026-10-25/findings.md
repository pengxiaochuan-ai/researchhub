# WP07规格编制事实与取舍

只记录本轮证据，历史规划不是执行指令。

- WP06动态CRF报告rh-synthetic-edc-report.v1明确未执行Python/ResearchMethodRun，不能继承旧固定种子run/报告的成功记录。
- 旧research-data-quality支持紧凑去标识manifest，TS执行路径executeDeterministicDataQuality→WorkerClient→Python t19-1→数值/版本校验；不是任意统计方法。
- 原assembleQualityManifest消费旧Subject/Visit/Feature等源形状，直接转换动态CRF存在年龄、默认范围、访视时间与全Study计数的语义风险；需本片窄manifest适配，不写旧表凑输入。
- 原科研Agent、Queue/最终publication、Artifact/Version/Source/Audit均可参考复用；旧8条生成数据/旧报告和资产schema保持，不纳入新CRF结果。
- WP06确认跨版、分页/慢轮询、历史freshness、故障注入未命中也回滚均是已知教训，必须进入新片反例。

已只读核对Python实际输出、manifest/response政策、原run模型及最新本机装配，事实如下；运行时原授权及Artifact来源实际兼容性留批准后D01/D02/D06验证，不在本轮连接数据库或运行服务。

## 已核对的关键源码（只读）

| 来源 | 事实／本片决定 |
| --- | --- |
| `app/server/prisma/schema.prisma` ResearchMethodRun | inputSummary/inputHash/requestHash/dataSources/artifactRefs/environment已存在，randomSeed可null；无需新表/列，不能用虚构seed |
| `app/server/src/research-methods/research-method-worker.client.ts` | execute验证executor/request body/超时、响应shape、worker版本、numericEvidence来源；可无副作用实例化复用 |
| `app/server/src/research-methods/research-method-quality-mapper.ts` | 附加全StudyacceptanceMatrix、阻断/确认语义；不直接用于新CRF业务结果，不改旧mapper |
| `app/research-methods-worker/data_quality.py` | missing-rate对每变量取nMissing/n、六位精度；20%/50%固定技术提示；range finding.n=1只指边界触发。原输出有6类scope计数及其他算子零值，必须按coverage窄投影 |
| `researchhub/scripts/local-synthetic-quality.mjs` | 工厂初始化会创建Feature/Skill/Assignment；不为新CRF调用该初始化。参考CAS/原run模型而不复用旧seed生产器或自动开权 |
| `researchhub/scripts/local-synthetic-edc.mjs` | 已有withCollection/inCollection/currentState，先验证原包/父方案；最小新增同事务冻结Version读即可；新run不改包/父版本 |
| `researchhub/scripts/local-knowledge-ai.mjs` | 当前四互斥任务、ownInTx、原state/source和beforeAssistant已装配；新增第五kind必须同时防旧会话旁路，不能仅保护S06 |
| `researchhub/pages/shared/missing-main.jsx` | S06真实分支应在当前实际入口接入，而非按旧举例改Workflow入口；显式query优先且拒绝混合demo |

选择：WorkerClient＋原numeric policy＋CRF窄manifest/投影，而不是executeDeterministicDataQuality附带全Studymapper。保留raw trace仅作受控执行证据；公开结果/AI/新报告只取可证明范围。其余算子/默认阈值明确未用于本包审核标准，不调用质量放行服务。

拟新增3个运行目的R01–R03，均待用户批准，不改原角色/Feature/Assignment；F01另批。数据/hash/实际run来源与旧artifact模式沿用，不改变Accepted ADR-0001–0004，无需新增技术栈ADR。WP07仅第一切片，不把正式EDC、所有18项AI、联网或资产共享/目标发布销项。

唯一独立文档评审后补正：原run唯一约束不覆盖包级活动并发，新片用同事务advisory锁且不改包；Worker响应不回显requestId/inputHash，关联在fetchImpl实际发送边缘验证；重启标识用随机instanceId而非PID；原AI第五kind须覆盖两种Provider、grounding与工具结果视图。完整Worker请求上限65,536字节，manifest保守限60KiB；见review.md。以上仍为待批准实施设计，不是运行结论。
