# 模块复用清单与任务计划：核对和评审记录

日期：2026-11-11。用户本轮要求逐模块复用清单、现有入口/直接调用/适配/新增项和开发任务；本轮只写文档，不实施代码、数据库、配置或部署。

## 交付与核对方式

- [13模块复用清单](../../product/research-study-module-reuse-2026-11-11.md)：M00–M12，逐项列HTTP/Service/纯策略、调用前提、副作用、Hub适配与真正缺口。
- [19项开发任务](implementation-plan.md)：T00–T18，列依赖、交接、现有/拟新增文件、验收和验证入口；新增路径与接口是建议，不冒称当前存在。
- 两个只读子Agent分别核对课题/受试者/执行，以及表单/H5/导入/量表/质控/Worker/产物；主Agent核对Hub Auth、作用域事务、当前装配、正式项目CRUD、模板/服务副作用、package命令及Worker真实白名单。
- 本轮没有访问数据库、读取患者数据、执行模型/渠道/计算请求、启动服务或重跑历史业务测试；不能从源码存在推断目标环境可用。

## 重要核对结论

1. 旧系统有正式ResearchProject CRUD，tenant_admin限制在Controller；Hub研究者创建及Project/Study身份需适配，不得裸调elevated Service继承不存在的权限。
2. 项目创建自建事务，Hub意图/Study绑定不能靠外层第二事务假装原子；需最小兼容tx核心或一次受控原子命令。
3. 方案初建会写要求项，addVisitPlan当前未保存其requirements；采集配置必须保存后重读验证，不能只测HTTP成功。
4. 正式入组未形成完整筛选/同意/退出命令；FormResponse无正式修订，研究者和H5提交后均拒改；合成包不能冒充该能力。
5. H5发送为sandbox；Feature有源文件字段不等于导入路径已经填写；ScaleResult/Feature无直接访视键，问卷答案未自动进入统计。
6. 当前Worker实现handshake/research-data-quality/statistical-power；效能/样本量设计不是疗效推断。旧Feature汇总不能把重复访视行当独立受试者。
7. 质量current/assert可能写stale；listTemplates可能初始化模板；产物导出须启用research-artifact-export且有后台恢复行为。不能把这些列成无副作用查询。
8. Hub局部复用已经存在，但本机fixture装配不能通过删围栏直接升为正式后端；独立入口、当前权限和目标环境验收需单列。

## 独立评审

全新只读Reviewer完成检查：提出一项P2实施依赖补充及一项入口完整性补充，未发现其余重点的重大问题。原意见和作者处理如下，**未作独立复签**。

| 原意见 | 作者定点核对与处理 | 状态 |
| --- | --- | --- |
| T16仅扩Worker执行器/白名单不足以接通新统计方法 | 核对research-method-run-policy.ts与MethodsService分派；T16补方法/Skill注册、执行分派/结果映射、适用入口及目标Agent/Skill授权，并要求S06经正式服务实际抵达Worker | 作者已补充，待实施验证 |
| M08遗漏承载量表版本发布/适用性/结局的治理Controller | 核对scale-governance.controller.ts:101，M08补实际路由/服务方法及scale.manage、study_operations条件 | 作者已补充，待实施验证 |

Reviewer没有运行服务、测试或数据库；源代码/测试入口存在不代表业务验收。

## 本轮验证与同步

已核验13模块/19任务顺序及相互引用、21个模块/文件条目的41个源码符号、7个package命令和本地链接；机器报告[reuse-source-check.json](reuse-source-check.json)仅为静态证据。业务测试/构建/Playwright不适用（仅计划），将来实施按任务执行；最终链接与diff检查在交付前重跑。

按项目规则同步到指定Notion研发文档的ResearchHub product/planning章节。既有设计与记录保留，不覆盖成已实施状态。

## 工具/检索记录

定点查找中有若干猜测文件名不存在，已改用实际目录文件清单和精确路径；部分单行.mjs及package脚本过长，后续限制行长和按指定字段提取。未扩大到项目根外递归检索。
