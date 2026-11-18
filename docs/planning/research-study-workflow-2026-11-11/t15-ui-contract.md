# T15 S05 分析数据准备 · 同页最小差异合同

2026-11-12。承接既定 T15，保留 S05 冻结 Shell、九页签、六指标、三图、主列表与右栏。正式互斥路由 `formalAnalysis=1&studyId`，可选 planId/snapshotId；固定快照须真实服务端核其 plan/Study，不让用户编辑 ID/hash/key。与 formalCapture、其他正式或演示模式参数互斥。S01 现研究准备卡与 S05 常用操作追加既有研究内入口，不新增导航/页面；header 仅同已有 scope 适配，不改布局。

沿已有数据核查/质控规则/数据导出区域完成：计划列表→选择当前已执行方案、BASELINE固定表单字段、明确3名合成受试者→提交→当前审批→核对真实变量与质量阻断→理由放行→不可变快照与当前可用性。非当前区域没有权威来源的指标/图表保留准确空态，不将当前计划3人数量声称全研究总数。右栏显示本次范围、下一动作、访问采集/疑问和返回研究。没有新增AI推断或统计值。

当前后端合同仅启用显式合成Study/三人/subject单位/BASELINE/描述统计；页面保留明确合成范围声明与用户确认，不把软件用计划称作真实临床SAP。protocol/form/field来自已授权configuration固定版本；受试者分页搜索直接选择，选中时核真实detail的协议/入组/访视。版本标记由系统管理，字段键仅映射详情，常规选项展示人类标签与固定版本；单位仅固定schema明确声明，无单位为未知，不换算/补值。全批任何来源问题都阻断，不静默剔除。

计划元数据列表/固定详情的能力仅消费服务端canSubmitPlan/canReviewPlan/canReleaseSnapshot，不从客户端角色、邮箱或其他模块能力推断。元数据当前approved不代表已放行；release同时要求真实最新review、有效preview、evaluation无阻断及当前manifestHash，后台最终重算CAS。approved/revoked追加事实有明确理由与共享弹窗；未批准不能preview，撤销后历史保留但新使用受限。

preview/快照表展示逐人逐变量原值、0/false、not_recorded/null/blank的分别含义、真实访视状态、固定来源修订回链；不从null猜未测/不适用，不渲染原始JSON作业务说明。fixed S09链接含assignment/response/revision/hash，仅后台投影已授权来源，常规用户不编辑。来源更正、解锁、质疑/偏离、审批/用途改变后旧快照只留历史；读取/使用重新守门，不从已保存hash自行批准。预览不写，放行须当前hash与理由，不自动完成访视或执行分析。

每次写使用原键/动作/目标、严格核receipt及结果，再GET当前plan/preview或snapshot；成功历史回执不是当前审批状态。待发定义/理由与投影只内存，15分钟清正文；sessionStorage仅actor/authVersion/Study/action/原键/目标的最小未知标记，不存答案/理由/受试者清单。刷新仅原GET回执，404未知禁写，不自动重放POST；已确认保存但当前复核失败要分开显示。普通409/CAS保留输入并废止旧preview，当前权限/用途敏感变化清投影与待发，503不作注销。quiet focus/10秒核当前身份/角色与已打开的来源状态，独立读写锁/读取代际防迟到覆盖，不重置输入或制造loading闪现。

全部业务确认共享ConfirmDialog，取消/Esc/焦点恢复、beforeunload和跨页丢失保护；保留已确认母版，不以禁用占位/演示值销项。真实管理员完整链、研究者只读/写403、无关owner、旧来源失效、审批CAS、回执unknown/404/503/身份撤销、列表/快照分页与固定回链；桌面1440、390与Chrome原生200% PNG/WebM、适当单元/实际HTTP及独立tmp构建留证。独立新3人案例，不改主ONSITE/H5/CSV三例；产品/使用/版本/API/test/Notion同步由主循环收口。
