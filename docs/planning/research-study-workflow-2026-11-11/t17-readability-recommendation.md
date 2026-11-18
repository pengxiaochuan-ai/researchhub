# T17 变量可识别性窄核与最小兼容建议

2026-11-12，只读源码与已保存主S05证据核查。未运行报告/导出、未改实现/UI/主例。本文件是待主循环决定的建议，不是新增功能已验收声明。

## 结论与证据

确认存在专业可用性缺口：主计划的v1/v2/v3只是分析别名，独立阅读导出报告无法识别其科学字段。保存的主计划实际映射为 v1→value→“观察值”，v2→optional_value→“选填观察值”，v3→completed→“已完成”；当前三个单位均未声明，不能猜为无量纲或补临床单位。

- `t17-report-content.mjs:24–34` 只遍历 Worker outputs.columns，以 `## key` 为标题，表格为指标/结果/固定结果路径；没有读取批准计划、字段label或unit。
- `t17-report-content.mjs:41–43` 的contentBlock/sourceSnapshot保存Run、basis、outputs及numericEvidence，没有变量展示映射。
- `t17-report-exports.mjs:28` 将持久正文交现有renderer；`research-artifact-export.ts:114–173` 的DOCX直接渲染contentMd，无法从S10页面临时映射补齐标签。因此这是导出路径的确定缺口；本轮没有把静态核查冒称实际DOCX视觉验收。
- `t17-reports.mjs:45–52` 每次按当前Run/basis重新build，并精确核正文、contentHash、contentBlocks、sourceSnapshotHash及两个来源。直接全局替换模板会使已存v1重建不一致，不能这样修复。

建议在主基线报告正式交付前处理，保持数值生成、证据路径及原报告内容不变。

## 推荐的最小兼容实现

1. **旧格式原样重建，新格式显式标记。** 保留现三参数builder的旧输出逐字节一致。仅新建报告使用服务端选择的展示模板标记（例如 `presentation.schemaVersion='formal-report-presentation-v1'`），记录于现有contentBlock与data_snapshot来源snapshot；不新增表或DDL，Artifact仍versionNo=1。真正无展示标记的旧报告走旧builder；有标记却缺字段、版本未知或非法时拒绝，不能降级到旧分支。旧回执/幂等回放按已保存报告格式读取，不能因新默认模板重建旧报告。
2. **展示信息只从可信来源导出。** 创建时在当前授权事务内，经 `analysis.assertCurrent` 得到批准计划对应manifest，再按其 `key/formVersionId/fieldKey/valueType/unit` 读取同scope固定FormVersion.schema、复用正常schema校验得到label。校验formDefinitionHash与manifest固定源一致、plan映射一致、与outputs列一一对应。不给客户端新增label/unit参数，不用LLM、UI临时字典或别名猜标签。
3. **封存且重建校验。** 展示封套仅含 `schemaVersion` 与每列的 `key,formVersionId,fieldKey,label,valueType,unit,formDefinitionHash`，不放原行值。相同封套纳入contentBlock与data_snapshot来源snapshot，参与既有完整性摘要。新报告读取/审核/发布/导出时，仍先current basis守门，再从可信固定源重导预期展示映射，与封存值精确比较，最后按新builder重建并执行原整套正文/来源校验。不能只相信保存在报告里的label再用它自我重建，否则协同修改label/正文/摘要可能绕过“标签来自实际字段”的要求。
4. **保持锁顺序和数值代码。** 展示源读取与核对放在现有来源阶段，先于Run/Artifact/Job后续锁；不在持Artifact/Job锁后反向读来源并取锁。Worker inputs/outputs、numericEvidence的name/value、AnalysisBasis和统计实现不改；报告只复制已验证结果，新增展示文字不参与统计计算。

示例展示结构（字段值来自真实schema，不是新的填写项）：

```text
观察值
固定变量 v1 · 原字段 value · 单位未声明
指标 | 结果
…复制原结果…

附录：固定结果索引
变量 v1 · 均值 → columns.v1.mean
…保留每个指标的原JSON路径…
```

label可重复，因此正文或附录仍保留key、固定字段和表单版本来消歧；源label含控制字符或Markdown分隔符须按现有安全转义，不能让标签改变报告结构。单位为null显示“未声明”，不得推断单位。

## JSON路径的位置

建议从主指标第三列移到**始终随报告导出的可复核附录**。主区突出真实变量名/单位、指标和结果；附录仍逐指标绑定变量key、原固定结果路径、Run/算子/快照与依据摘要，rowCount路径也保留。numericEvidence原一一同名同值校验必须继续覆盖所有数值；不能删路径、改Worker别名，或只在网页展开而DOCX丢失。移动属于新模板，旧正文不重排。

现DOCXrenderer把Markdown行逐行变成段落，并未把管道表格转换为Word表格。两列表与附录可先在现renderer交付，真实DOCX须再看图确认；本建议不扩展为通用排版重构，也不凭模板文本承诺发表级版式。

## 风险与定向验收

- 兼容风险最高：保留真实旧报告fixture的contentMd/contentHash/sourceSnapshotHash及读回/下载回归；新模板不得更新任何旧行。无DDL不等于旧代码能读取新标记，回滚应保留双格式读取能力、只关闭新格式创建，不能默默改存量报告。
- 来源风险：篡改label/unit/fieldKey/映射、重复/缺列、未知展示版本应失败；同名label与null单位须可识别，不允许猜常模/单位。固定schema发生变化时按既有basis失效，不能静默刷新已封存报告标签。
- 科学完整性：相同Run的新旧模板所有统计数值与JSON路径完全相等，0/false/缺失/不可估计保留；新展示封套不能成为客户端注入或新增数值入口。
- 实链验收：新合成报告走实际Methods/审批/发布/MinIO DOCX导出与受控下载；检查DOCX内部文本与实际渲染，能看到三中文变量、真实单位状态、清楚指标，以及完整附录来源。权限撤销、来源更正、错误旧快照和文件摘要验证仍拒绝当前交付。

当前源码SHA：content `1b3bc56ae9a3c72acaa19668580988f3280725f092680fe22e25ae4eba2c24d9`；reports `816b7a1bf7ea5a310203682c179430640b12015e5b1e9e43249cce5ef9fd02e9`；exports `4116a5d4b3e8f7d85a641bb7629f42de43d60e873904ba0ac3b0e451141b47b7`；renderer `48bc07914f9ad2696ef1defc3854de15f4ce7f60871d48e695b8d1c04980eb2a`。建议先由主循环确认此窄范围，再按合同/RED→实现及旧新格式实链验证推进。
