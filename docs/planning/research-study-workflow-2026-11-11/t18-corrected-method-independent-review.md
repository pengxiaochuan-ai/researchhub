# T18 更正后新Methods脚本只读窄审

2026-11-12。依据[准备合同](t18-corrected-method-acceptance.md)，仅审查从主Methods基线脚本复制后的输入/来源/原actor恢复差异。没有执行或导入候选，没有HTTP、浏览器、SQL连接或写入；不接管主三人、更正或S10执行。

当前文件 `scripts/research-t18-corrected-method.mjs` SHA256 `04eb12eb73b2f646dd710ce5964a871ee11a1ad4851acf1205ce14e5811362e0`。line12在参数检查后无条件抛 `CORRECTED_METHOD_PREPARATION_FAIL_CLOSED`，业务文件读取、目标检查、网络和浏览器动作均不可达。**只读窄审未见新增阻断，仍为准备状态，不是执行许可。** 主S10 Report proof、更正成功证明与实际actor尚未形成，必须最终对齐后再审。

## 输入与唯一主例

- 只认主benchmark `rh-workflow-benchmark-747c689d`、原capture/basis/method/report与独立correction成功指针；更正证明须passed/syntheticOnly及phase=`correction-and-new-basis-only`，Study/plan/旧snapshot精确对应，新snapshot不同。basis/method/report文件字节摘要与correction.inputSha256一致；capture与原basis摘要绑定，原成功指针不覆盖。
- fixed generic-v2 oracle SHA为 `f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b`；核数使用`correction.expected`并按fieldKey映射Run变量key。1e-12是已定数值验收容差，脚本不修改持久Run或在页面补值。
- assertMainSources核同原plan definition/contentHash/approved reviewId/sequence；新snapshot manifest与更正时preview精确相等，当前basis固定新manifestHash、原planReviewId且新qualityGateId不同，后续完整basis保持相同。
- ONSITE保持原assignment/responseId，仅value使用oracle.correction.newValue，当前ref精确等更正证明ref2，原ref1历史不变。H5/CSV使用assertOriginalCapture核原response.version/ref/答案/父链及历史source/actor；H5全部冻结字段、CSV原导入回执均复核，不写二者。
- 三visit均completed/current、原完成日期不变；H5/CSV原visit.version不变；manifest精确visit/enrollment、当前responseVersion/值/缺失/ref。未新建被试、邀请或入组。

## 写入与未知恢复

只允许新Run create和该Run review两类UI业务POST；每次dispatch前核runtime ready/pid/完整ids、当前actor及assertMainSources，持久原key/actor后才放行。新Run与原Run不同，真实Worker一次dispatch/一次成功response，descriptive-v1/t19-1、llm=false；实际值与独立更正oracle核对。

pending恢复核原动作会话与accountId/authVersion，仅GET原key。恢复后也无条件停根审；未知404或不匹配均不重复POST。已有部分Run而未确认也停线。成功state/current/evidence使用独立corrected-method命名，输出原新Run/snapshot、原键/actors、输入摘要、真实轨迹与唯一归档journal，不覆盖基线记录。

## 窄审发现与闭合

首读版本SHA `86acd3be6186659d16e3bc3579e7b1995b6dee3e2059c803b8fa763e32edc614` 有以下差异，已通知根并由根修订：

1. 成功pointer存在但state丢失时，只读复用分支没有恢复prior.actors，新result会丢失原actor证明。当前line49要求原create/review actors存在并从prior恢复，未猜当前身份。
2. 核数只比较snapshot/plan ID，不够证明完整新basis。当前line84固定真实current.basis并核新manifestHash/新gate/原planReview，line140对Run的analysisBasis完整deepEqual。
3. 最终只显式核completed。当前line171同时核completed及confirmed，再核数值与完整basis。

上述三处已只读确认闭合，sentinel保留。这个结论只覆盖准备脚本的这些差异；未独立运行候选node检查、Methods服务或Worker，也不把之前主Methods通过当成本次更正运行已执行。

## 最终执行前仍需

真实S10 Report proof与correction proof形成后，核其实际字段、逐动作原actor、文件/来源摘要及当前状态；按根批准的阶段续验方案处理任何已确认部分journal。当前all-admin报告证明限制不能代替实际actor事实。根最终复审和明确执行前，禁止删除sentinel或运行脚本。S10、主更正和更正后报告的专业业务验收各自独立记录。
