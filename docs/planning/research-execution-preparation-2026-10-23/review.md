# WP05第二切片规格与计划评审

## 实施评审状态（2026-10-23）

E08唯一fresh-context代码总评审`wp05_preparation_e08_review`已返回，33文件SHA匹配，只读且未连接库/浏览器/Provider、读凭据或派代理。结论0 Critical、2 Important、1 Minor；主实现按真实用户影响将该Minor升为Important，三项RED→GREEN修补，217/217相关测试及28项免费综合复测通过；17份正文及本片目录18页Notion回读通过。没有第二次独立复签，AX09待用户。下文文档评审历史不代替本次代码评审；最终证据见[实测报告](../../testing/research-execution-preparation-2026-10-23.md)。

### 本次代码发现与主实现处理

| 发现 | 实际问题 | 最小修补/反例 |
| --- | --- | --- |
| I1 Important | 历史restricted只失效identity，没有失效普通读/写fence；迟到响应可恢复内容/成功提示 | 统一失效身份、请求代次、刷新门闩、operation与反馈；真实Chrome挂起普通读及已提交写响应，两种交错分别RED→GREEN |
| I2 Important | 单字中文科学数词＋日/小时漏过输出guard和输入遮蔽 | 两者共享科学量识别；七日/六小时/半日/刻钟/剂量/长度/小数/比例拒绝与遮蔽，合法引用/真实ID/一般中文保留；19/19契约通过，不重放模型 |
| M1 原Minor→Important | 修改试填答案后旧“通过”仍显示，误报当前输入已验证 | 答案变更即清旧preview；真实Chrome 0通过→改11旧提示清除→重检越界，RED→GREEN |

独立评审未判断：精确实施前diff（不存在）、当前运行配置/价格/余额、独立DB保全复验、独立浏览器目视、重跑集成/付费、真实角色撤权、旧底座全域安全、医学AX09、完整OpenCode/联网/EDC/一期/生产、最终文档同步以及修补后独立复签。主实现分别用限定source manifest、当前本机守门/原账本、最终免费保全、截图/反例/纯测试承接；角色撤权/专业/完整能力/生产继续明确未测或待验，不借来源撤审替代，也不增加权限或费用。成本是没有独立后签，技术通过不等于专业/整体交付。

日期2026-10-23。对象为本片实施规格/小步计划，不是代码或运行效果。状态：唯一一次独立只读总评审已返回；0 Critical、4 Important、2 Minor，主编按源码核对后已补全文档，未派第二次评审，不冒称独立复签。整体规格/计划仍待用户批准。

评审者：本轮fresh-context `wp05_execution_spec_review`。只读两份新稿与限定原源码，未改文件/Git/DB、读凭据、调用业务模型/浏览器或再派代理。

| 级别 | 原发现与风险 | 主编核对及最小处理 | 验证落点 |
| --- | --- | --- | --- |
| Important | check既列持久块又说GET不增版，完成提交边界不明确 | 原本机accept只附provenance、beforeAssistant重验；明确入队版本/job/审计原子，完成assistant/job原子，check仅GET投影不回写版本 | 规格4/5，E02/E05两原子反例 |
| Important | 部分意见推进根版本，与不可变executionVersion冲突 | 沿首切片连续head模式，首次等执行版本，后续opinionHead固定同result/basis/config/rules/revision，根=head=lastRoot；外部写不能续接 | 规格5，E06第二批可保存/任一绑定改动409 |
| Important | 旧normalizeAndValidateAnswers放行空值且不查required，单次仅抛一错 | 外层逐字段真值表与全部errors，明确required+not_applicable、空/未提供、0/false、零字段；旧纯函数仅查类型/范围/选项 | 规格6，E04四类新增反例 |
| Important | 原assertAnswer要求真实[n]，新AI schema与数字guard缺衔接 | 保留原引用门槛/执行顺序；真实引用才剥离数字，本条真实技术ID才豁免；finding不是来源，伪引用与科学值拒绝 | 规格6，E05真实[1]/越界[7]/20例/三十反例 |
| Minor | contentHash/confirmation.hash/picoHash/sourceHash算法不唯一 | 明确可编辑正文SHA256、原confirmation.hash、递归排序对象但保持来源数组顺序的canonical digest；配置不改来源时间 | 规格4、E01/E02 |
| Minor | targetPaths与findingId可随重排漂移 | 固定稳定key路径/白名单、每项1–4路径/0–4finding，findingId由ruleKey+排序路径摘要生成，revision/hash另约束 | 规格6、E01/E04 |

4项Important及2项Minor均是已有代码/本片技术设计可回答；主编未采纳任何扩表、正式EDC、额外权限、旧源码重构或付费运行建议。额外自检补空outcomes/visits/fields的全局missing规则，避免空遍历显示无问题。32小时只是28＋4的条件估计，E01/E05门槛、缓冲耗尽复估及等待单列保留，不能称工期已实际验证。

无需单独请用户决定的新业务问题；用户仍需整体批准本规格/计划及其中实现选择。费用/有效核价/权限等不随本次文档批准自动放行。

未评判：完整一期、正式EDC/采集、临床模板有效性、完整联网/全部AI、生产/云/远端配置、既往专业验收。未来实施E08仍需唯一独立代码总评审；本次文档评审不能替代。

核对范围：最小业务/无正式表写入、旧纯契约复用、原授权/来源、basis/head/root CAS/revision、三生产者互斥/费用key、科学数值及AI真实执行、dirty/失效/版本与32小时范围。评审不得调用模型、连接库/远端配置、读取凭据、改源或新增代理。

当前无业务代码、配置启用、真实AI/浏览器或专业验收证据；文档静态检查不作为四层能力销项。后续代码实施的唯一总评审仍是E08，不被本次文档评审替代。
