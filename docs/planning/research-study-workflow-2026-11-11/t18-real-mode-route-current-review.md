# T18 写入前路由漂移 · 当前文件窄审

2026-11-12。根在更正脚本新UI guard构造处发现`src/real-mode-route.js`漂移并停线，报告当次无journal/0业务POST。本审查仅完整阅读当前小模块与直接纯依赖，实际运行route/report纯测试，不执行/导入更正候选、不发API/SQL、不操作浏览器或主三例。

**当前配置目标的S10入口/模式行为未发现阻断。** 当前文件SHA为 `ff7109d2554e72d23fc5ab4545197c388268b7c7fa0f371b199b38a4ccd8914a`。旧清单只记录历史SHA `a5e90c5ae6bce6144cc131f53124400f35c077609921125227888a2a4b64fdb7`；仅删asset import及A02判定不能还原旧SHA（得到2217d6c9），因此撤回“只有两行增量/原分支逐字未变”前提。本结论建立在当前完整文件和当前测试，不伪造未知旧原文，也不无限追溯其他任务。

当前实际行为已核：

- 已配置时，S10带formalReports参数先于explicitDemo判断进入live；残留demo偏好不能覆盖真实模式。参数值错误、run/artifact混合、重复Study仍进入正式workspace的严格parser受限，不回演示数据。
- 普通S10不带正式参数时，已配置且未显式demo仍pending；显式demo保留原型选择。未配置时当前模块仍返回demo，此为现行原型选择，不能冒称未配置环境的正式能力已启用；本轮目标19501为根实际已配置目标。
- 当前`isResearchAssetRoute`严格仅A02，对所有S10参数恒false。直接依赖`research-assets-session.js` SHA `226e2bf7d2b955fb335be67dd67425d9ecd8c8428ea094c3b0029918c745bccb`与纯传递依赖`synthetic-asset-route.js` SHA `2061767a1736868a6f74844388b074d1e0b9de5b7c553f11b1938e69dd156f47`已核纯声明，无顶层网络/storage或写副作用。
- 模块负责呈现分类，不执行认证、报告写入或回执恢复；S10现行账号/authVersion、未知原键不重放、fresh下载仍由原已审hook/client和后端负责。本审查不将路由分类当作授权，也不扩大为A02功能验收。

独立实际运行作者route/report13项与新增模式矩阵2项，**15/15通过**。测试前后五份相关源码SHA逐项相等（route、asset、synthetic、report helper、session）；[结果与源守门](../../testing/evidence/research-t18-2026-11-12/route-drift-independent-ff7109d2/review-and-test.json)、[TAP](../../testing/evidence/research-t18-2026-11-12/route-drift-independent-ff7109d2/route-report-independent.tap)、[独立矩阵](../../testing/evidence/research-t18-2026-11-12/route-drift-independent-ff7109d2/current-mode-independent.test.mjs)。当前完整源文本保存在同目录，不以重建失败材料冒充原a5。

本结论只签当前ff快照代码/纯测。根另以本轮全源/runtime前后相等的真实只读S10窗口、新清单与proof决定后续唯一更正执行；每POST前仍核同一已验源，变化即停止新写、保原journal，不重放未知。既有主报告和更正保护条件不因本次路由窄审放宽，未声明更正业务或临床/生产已验收。
