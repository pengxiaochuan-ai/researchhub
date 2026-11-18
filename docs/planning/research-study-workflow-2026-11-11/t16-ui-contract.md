# T16 S06 描述统计 · 同页最小差异合同

2026-11-12，承接已授权T16，S05整页已闭环。保留S06现有研究摘要、九页签、主要结果/关键指标/右栏、次要结果/安全性/相关下载/结论母版及冻结Shell，不新增统计页或导航。正式互斥 `formalMethods=1&studyId`，可选runId或严格一组planId+snapshotId；同时存在时必须与真实Run AnalysisBasis一致。常规用户不编辑ID/hash/key。S05有效快照区追加运行描述统计回链，原S06数据集/结果区域承接近期实际运行。

进入→核当前Study/身份→读取已批准计划及当前有效固定snapshot→明确字段/统计单位/来源→用户显式运行→真实Methods/Worker→当前运行/结果→有权人工审核→返回固定来源或后续报告。新运行仅POST snapshotId+原键，不接受客户端答案/行值/hash；基于真实GET snapshot当前有效与支持的number/integer/boolean字段提供运行动作，不从role或T15管理员能力推断Methods权限。暂不新增canCreate context，POST最终守门真实Agent/Skill/feature/用途，权限或503明确反馈；文本/选项不自动排除成数值分析。

页面数值只呈现真实Worker已存outputs与对应numericEvidence，严格核descriptive-statistics、算子/版本、inputHash、AnalysisBasis/manifestHash、变量集合和逐项同值证据。只展示各变量total/observed/missing、数值min/max/mean/median/sampleStdDev、布尔true/false；不重新计算、插补、推断单位、临床阈值或生成疗效/P值/安全性结果。0/false保真，未定义统计null按all_missing/single_observation状态说明，不用0代替。没有真实数据的图表/安全性/AI结论/下载块准确空态，不能把合成样例包装成临床结论。字段标签来自已授权固定版本configuration及快照映射，固定来源回链S05原plan/snapshot。

近期列表真实最多50条，明确范围，不自造分页/全量总数；历史basis失效只显示服务端blocked元数据，绝不显示旧数值或将一条历史失败拖垮新列表。详情读取失败立即停止展示旧结果；网络/503不当注销，未提交审核理由保留。source/current授权变更清数值，当前cancel权限元数据可在basis失效时读取，但Methods权限本身失效仍拒绝。

审核/取消只消费正式GET capabilities的canReview/canCancel和当前status/reviewStatus，再结合新详情/blocked及实际状态。审核只对当前needs_review、有权且来源有效的实际结果；confirmed/returned/needs_input均理由+共享弹窗，不因审核自动重派计算。取消只对queued/running/needs_review/needs_input，明确停止该运行的影响，不能从客户端角色推断。capability位仅动作权限，不保证状态允许；所有写端独立重验。

create/review严格最小未知标记绑定actor/authVersion/Study/action/原键/固定目标，正文/数值/审核意见仅内存，十五分钟未知内存过期清正文。刷新/响应不明只GET原create/review回执→严格核原键/动作/Study/目标→GET当前Run+capabilities，404未知禁写，无POST重试。已保存与当前可用分开；回执后当前读取503/来源失效不得宣称已核对。cancel既有POST无请求键回执；未知仅GET该Run精确capability状态核当前cancelled，文案“当前运行已取消”，不称原动作回执、不重复POST。current状态未确认则保留最小标记，不自动新建或重算。

补充失败边界：原回执已返回200后，list/capabilities外层GET失败与详情/来源读取失败均停止展示旧统计，保留最小核对标记和未过期意见；不因失败发生于readView返回之前而沿用旧视图。POST已返回200但原回执或当前状态尚未核对时，意见的十五分钟内存限时仍持续至成功核对后forget，不在POST返回时提前取消；过期只清正文/确认态，原标记保留。

quiet焦点/在途轮询复核当前身份与Run/来源，读写锁与读取代际防迟到覆盖，不闪busy/重置审核输入，后台不续会话。当前值或状态变化废止旧确认，不静默把新结果换到旧审核下。共享ConfirmDialog支持取消/Esc/焦点，跨页未保存保护与beforeunload保留。S06整页真实管理员/有分析权无审核权研究者/无权owner；实际Worker/独立oracle、数值缺失、当前审核及取消、unknown/404/503/当前来源失效和身份切换；桌面1440/390/native200% PNG/WebM、适当单元/实际HTTP/tmp build留证，文档/Notion由主循环收口后继续T17。

只用全新独立合成来源或根已验证的独立T16 HTTP样例；不修改主ONSITE/H5/CSV三人。T15 UI专用样例已故意解锁/撤回，不当当前有效来源。T17报告主页面不在本包实现，先保留真实未生成状态。
