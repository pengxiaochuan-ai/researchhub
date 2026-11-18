# WP07首切片独立文档评审及主编处理

2026-10-25。对象仅为[规格](../../product/synthetic-crf-methods-spec-2026-10-25.md)、[授权](authorization-scope.md)、[八步计划](implementation-plan.md)及源码取舍。一次原生只读代理`/root/wp07_spec_final_review`，无实现代理/第二轮复签。当前目录串行，保留已有脏修改。

## 独立原结论

**需要先补齐四处关键契约，再提交用户批准。0 Critical、4 Important、2 Minor。** 评审认可WorkerClient＋原policy＋窄投影、避免旧全Study mapper/质量放行、当前head/冻结历史区分、R01–R03/F01待批及24＋8小时条件预算；问题可在本片文档最小修正，无须扩底座/算法/旧Worker。

| 级别/原位置 | 触发及影响 | 独立建议 | 主编核对及处理 |
| --- | --- | --- | --- |
| I1 规格原77/79、计划原106 | 不改包根且不同key并发均读到无在途；原run唯一约束只有tenant/idempotencyKey，不能保证每包一个活动run | 指定已有排他锁，或仅新片事务级包锁；独立连接反例 | 已核对schema原1268。规格§5明确共同授权锁之后取得tenant/owner/collection事务advisory锁、锁内重读，D02增加不同key一成功一409；无DDL/包更新 |
| I2 规格原66、计划原50 | 纯投影拿不到Worker归一化响应未包含的requestId/inputHash，易伪造回签关联 | 执行适配器核真实发送body和本次claim/返回，纯投影只验可推导事实 | 已核对policy响应161/226及WorkerClient.fetchImpl。规格§4.3/D03增加真实body/hash/claim trace，无Worker回签承诺 |
| I3 规格原81/83、计划原119 | 仅hostPid遇PID复用可误认旧运行/阻新run | 每次启动随机instanceId，PID仅诊断，同PID不同实例反例 | 已核对本片environment承载点；规格§5/D03明确创建/活动/认领/提交核instanceId，旧任务只读interrupted、不扫表不写旧行 |
| I4 计划原61、规格原93/97 | 第五kind未覆盖现有prompt、Provider JSON、工具输出及通用assertAnswer；可能强制无关KB/泄露数值 | 第五kind可信DTO/提示/两种Provider/去数值工具视图/专用accept契约表 | 已核对local-knowledge-ai.mjs原85/88/93/99。规格§6与D05补齐固定hook，原KB/hash和模型视图分离，旧四族不变 |
| M1 授权原37、计划原147/169 | D05三次后D07再全新AI可能至少五次，最低费用样例不清 | D07复核同批trace不重放；额外调用单列 | 授权F01与D05/D07对齐为最低总数3次；额外需明确原因/数量并核许可预算，不把设计次数当收费批准 |
| M2 计划原174 | D07要求含D08评审/文档的AC09，退出条件循环 | D07仅AC02–08及AC09测试/保全，D08关闭评审文档 | 已修正D07退出条件，工时保持24＋8 |

行号为独立评审时定位；修订后以章节/任务为准。主编处理是文档闭环，**不是独立再次签认**；原“需修订”结论保留，不改写为代码评审通过。

## 主编额外协议核对

旧WorkerClient限制的是完整JSON请求65,536字节，不是仅manifest。将本片manifest上限改60KiB并另核全body≤65,536字节/旧8秒超时，未提高旧上限；增加新报告幂等命名空间避免与旧EDC键混用。仅规格文字，不修改代码/协议/配置。

## 不在本次判断范围

未运行脚本、编译、PG、HTTP、Worker、模型或浏览器；未验证当前授权/运行scope/预算/服务。Schema字段存在不能证明原Artifact服务接受新来源，这仍须批准后D01/D02/D06真实举证。没有确认实际方法/AI能力、3天完成概率、UI可用性或用户AC10，前序WP06证据不能替代本片。

## 当前结论

六项评审问题及协议容量歧义已由主编据源码补正文档；规格可提交用户审阅。业务实施、R01–R03和F01仍未批准，禁止自动开始D01。D08唯一代码总评审、真实合成环境验证及用户专业验收均为未来事项。
