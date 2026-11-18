# 本轮进度

- 2026-11-06：用户已批准按三档矩阵实施，已写产品矩阵/小步计划。继承本机合成范围、原两账号、业务Token计费与页面布局；不恢复开发预算门禁。下一步P01先RED。
- P01：测试最初字符串引号语法错误，先修正测试后确认缺少新模块而RED；实现后10项GREEN。精确三类数字有来源检查，其他数量句局部提示，无有效段停止；新契约不再调用旧整篇数量断言。
- P02：新增真实PG回滚篡改探针先RED，接线后暴露JSONB键序问题（合法回执误restricted）；补JSONB纯回归RED后，仅新v3规范化对象，旧v1/v2保持，纯/PG组合29项GREEN。第一轮完整315纯通过/PG20过1失败留在evidence/business-ai-quota-gates-7e4fa322-8131-4c41-94f7-63f3d893e608，本轮修补后重跑。v3全量规范化会变更旧v1模型数值ID，原失败回复若带旧ID仅局部提示不匹配，不伪造迁移。
- 独立审查按同次轮次关闭全部重要项/Minor（详code-review.md），新14项policy通过；最终319纯测/21合成PG/build/diff及旧内核/账本保全通过，evidence/business-ai-quota-gates-d3042341-dec1-4d07-8103-1d748f38fcaa。
- 免费Chrome故障注入：evidence/article-response-free-3cf61f1d-a5ca-4c85-9120-0b2448705d15，明确非模型/非DB保存；术语/年份/计数保留，未核实测量局部提示、刷新和两身份隔离通过，0模型请求。本机无在途后自有重启至PID21150，七服务健康；开始一次新实际请求，尚待回读。
- 首次真实验收脚本在发请求前的额度GET因漏课题组/Study headers返回400，未创建任务、未调用模型；登录201及带作用域GET200/canStart true免费定位后，仅修测试脚本的headers/stage标识。失败证据保留evidence/article-response-real-aec7d64c-c075-44de-96d0-ce6d14df7f24，不伪称模型失败或重试消费。
- 新真实任务cmw4etple0006lubi8iccgo43实际Provider200/4814 Tokens，但模型选择每段3/2个numericFactIds超过原单项schema，整篇未交付；旧失败/预留保留。已暂停付费后补RED，将有界候选超显示容量改确定性省略而非协议失败，并支持“2025年一项meta分析”常见词序；原真实回复免费回放可局部交付，未改旧任务。更新为16项policy，等待同次独立复核/完整门禁后再新验证。
- 最终同一独立评审Ready；321纯测/21合成PG/build/diff及旧内核/账本保全通过，evidence/business-ai-quota-gates-d2d0ceb5-f506-4623-950a-6a324812b2d4。自有环境在途归零后重启PID25182，七服务健康。
- 新真实任务cmw4f3tst0004lufib1mxpyub成功，Provider HTTP200/stop、4516 Tokens（4027输入/489输出），原BillingService实际结算；保留IL-17、Th17/Treg、2025年meta分析、一项RCT与AI推断标识。两项系统原文引用，额外合法候选自动省略。evidence/article-response-real-c4da1640-c0f8-4b81-b335-63fc82a480ed，真实Chrome刷新/权限隔离、1440/390截图录屏、16/28字号及无横向溢出通过。本轮两次真实调用合计9330 Tokens，失败4814 Tokens及原历史预留不改。
- 免费故障注入另见evidence/article-response-free-c84642a5-7f5c-4a7b-bb12-ab8e82fc9d51，0 Provider，不与真实模型结果混淆。本机技术交接文档已整理；专业结论尚待研究者签认，不将有限来源关系核验声称为全文科学正确。
- 产品/版本/使用说明/技术/测试同源文档更新完成；Notion新增3页、既有10页最小追加，P04在原计划页定向销项且无warnings，详notion-sync.md。补拍两张真实只读截图已目视核对，不新增调用。当前仅本机技术交接，不自动恢复其他任务。
- 收尾再次完整门禁321/321纯、21/21合成PG、build/diff和旧内核/账本保全通过，evidence/business-ai-quota-gates-3d48c07d-0d05-4abc-9bdd-6015678e8799，0新增Provider。没有对大量既有untracked文件做提交或清理。
