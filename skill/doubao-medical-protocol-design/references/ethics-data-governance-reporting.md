# 伦理、安全、数据治理与规范路由

在方案涉及相应研究对象、治理或注册，或论文需要核对实际报告要求时读取相关部分；纯语言处理沿用原稿事实，按任务范围核实。

## 一、伦理不是附录占位符

根据研究语境说明风险、受益、科学必要性、受试者/材料选择、公平性、隐私、补偿、退出、结果返还和监督。不得把“计划提交伦理”写成“已获批准”。机构、法域和赞助方要求需实际核验。

### 人体参与者

考虑知情同意/豁免依据、脆弱人群、招募关系、额外操作、药械风险、妊娠/避孕、伤害补偿、紧急处理、偶然发现和研究后安排。伦理原则核对 [WMA《赫尔辛基宣言》2024](https://www.wma.net/what-we-do/medical-ethics/declaration-of-helsinki/) 现行版。

### 健康数据库与生物样本库

考虑原始同意、二次使用、动态/广泛同意、撤回、再识别、数据/样本共享、跨境、商业使用、结果返还和治理委员会。[WMA《台北宣言》2016](https://www.wma.net/policies-post/wma-declaration-of-taipei-on-ethical-considerations-regarding-health-databases-and-biobanks/) 可作为伦理框架，但正式要求以当地法规和机构政策为准。

### 动物与实验材料

说明 3Rs、伤害—获益、人道终点、镇痛/麻醉、设施和人员；人源材料、细胞系、病原体、基因编辑和生物安全分别核对许可与治理。

## 二、安全与监测

按风险设置 AE/SAE、研究相关性、收集窗口、报告时限、暂停/终止、紧急揭盲、医疗处置和独立监测。观察性研究也可能有隐私、额外采样、偶然发现或心理风险。

## 三、数据治理

至少写明：

- 数据控制者/处理者和合法授权；
- 数据来源、最小化采集、编码/去标识化和链接键；
- 角色权限、传输、加密、日志、备份和事件响应；
- 数据字典、版本、查询、更正、锁库和审计轨迹；
- 保存期限、销毁、共享和受控访问；
- 分析代码、软件、随机种子和可复现包；
- 小单元格、影像、遗传和自由文本的再识别风险。

匿名化、伦理批准、知情同意和数据使用协议是不同事项，不能相互替代。

## 四、质量源于设计

识别对受试者保护和结果可靠性关键的质量因素，设置与风险相称的培训、监查、中心启动、数据检查、终点确认、偏离管理和变更控制。临床试验质量参考 ICH E8(R1)；GCP 根据适用法域核对 ICH E6(R3) 的生效与实施要求。

## 五、注册、公开与报告

在方案中提前记录注册平台、方案/SAP 版本、修订、结果公开、作者/数据共享和负面结果传播。报告清单用于完整性，不是研究质量评分，也不能修复设计缺陷。

以下为研究类型对应的规范与维护方入口；实际使用时核对当前版本、适用范围及目标期刊要求：

| 研究 | 现行母版/补充 |
|---|---|
| 随机试验方案与结果 | [SPIRIT 2025](https://www.bmj.com/content/389/bmj-2024-081477)；[CONSORT 2025](https://www.bmj.com/content/389/bmj-2024-081123)；试验统计结合 [ICH E9/E9(R1)](https://www.ema.europa.eu/en/ich-e9-statistical-principles-clinical-trials-scientific-guideline) |
| 试验质量与 GCP | [ICH E8(R1)](https://www.ema.europa.eu/en/ich-e8-general-considerations-clinical-studies-scientific-guideline)；[ICH E6(R3)](https://www.ema.europa.eu/en/ich-e6-good-clinical-practice-scientific-guideline)；受监管药物干预方案按适用范围核对 [ICH M11 CeSHarP](https://admin.ich.org/page/multidisciplinary-guidelines) |
| 队列、病例对照、横断面 | [STROBE](https://www.strobe-statement.org/)；常规医疗数据加 [RECORD](https://www.record-statement.org/) |
| 诊断准确性 | [STARD 2015](https://www.equator-network.org/reporting-guidelines/stard/)；AI 场景加 [STARD-AI 2025](https://www.nature.com/articles/s41591-025-03953-8) |
| 预测模型 | [TRIPOD+AI 2024](https://www.bmj.com/content/385/bmj-2023-078378)；质量/偏倚用 [PROBAST+AI 2025](https://www.bmj.com/content/388/bmj-2024-082505) |
| 系统综述 | 方案用 [PRISMA-P](https://www.prisma-statement.org/protocols)；结果用 [PRISMA 2020](https://www.prisma-statement.org/prisma-2020)，检索补 PRISMA-S |
| 动物研究 | 规划用 [PREPARE](https://norecopa.no/prepare/)；报告用 [ARRIVE 2.0](https://arriveguidelines.org/arrive-guidelines) |
| 人源标本/生物样本库 | [BRISQ](https://pmc.ncbi.nlm.nih.gov/articles/PMC3169291/)、ISO 20387 现行发布版及机构 SOP；ISO 修订草案不能提前当正式版 |
| 预后标志物 | REMARK；若构建个体预测模型再叠加 TRIPOD+AI/PROBAST+AI |

SPIRIT/CONSORT、STROBE、STARD、TRIPOD、PRISMA 和 ARRIVE主要约束报告透明度；设计方法、伦理和统计还需相应 ICH、领域方法与机构规范。AI 试验在新版母版下使用旧 AI 扩展时要人工交叉映射，不以扩展替代 2025 母版。

## 六、方案变更

每次修订记录版本、日期、原因、影响章节、是否改变主要目标/终点/样本量/分析和是否需要伦理、注册、同意或 SAP 更新。不要覆盖旧版本或在知道结果后静默改写预设内容。
