# Excel选择后无反馈 · 修复验收

2026-11-16，用户确认“Excel，选择后无反应，没有错误”。仅本问题，未恢复原位映射的新空白访视验收或其他专项。[本轮范围](../planning/qiyan-ai-file-data-2026-11-12/upload-focus-fix-2026-11-16.md)。沿当前目录串行实施＋一次独立总评审。

## 原因与修复

文件选择框返回页面触发focus身份重核，Hub曾清空session，上传hook又在paused时直接丢弃change事件，导致0上传POST、0预检POST且无错误。隔离19612真实React/原生filechooser＋受控身份响应重现于upload-focus-red.log。仅改HubAgentPanel与AgentMaterials，不改布局、上传格式/容量、API、数据库、角色、解析/入库规则或模型。

同账号/同来源重核保留会话与内存文件选择；身份、Agent能力和已有会话均核对后才继续一次。读取与写入分开：暂停令旧读sequence失效并清核验标记；已发出的上传generation保留，后续文件/预检等待核验，通过后用当前researchData回调，不重传原文件。真正换账号/会话或撤销能力则停止后续动作。首次创建会话使用稳定创建上下文/版本，focus不使原创建响应丢失；未知创建/上传不自动重发，原恢复键格式不变。

## 一次独评及集中修补

upload_focus_final_review：0Critical/4Important。数据能力撤销仍发后续文件/旧预检、暂停不再隔离旧读取、同账号撤销Agent后旧消息可见、首次创建会话被focus中断。均已用失败用例/原读状态用例复现后集中修补，无复签：按每份文件检查当前能力并使用当前回调；旧读取失效/阻断，保留写generation；撤权清理状态且仅ready展示消息/历史；真实上下文与临时重核的创建generation分离。

upload-focus-review-red、data-cap-red及inflight-red保留失败；最终upload-focus-final-boundaries为18/18，无fail/skip。包含Excel选择中重核、上传开始后重核、双文件中撤销数据能力、撤销Agent后隐藏旧消息、首次建会话中重核、换账号/会话、auth503后显式恢复、未知上传原回执及存储不可用。均在19612与API替身完成，不冒称真实角色撤销或后端写入。

最终纯前端148文件/726测试全部通过（upload-focus-final-pure），显式排除依赖19501/Playwright的6类文件，另以上18项隔离浏览器覆盖本轮；并未以726冒称全量运行所有目标浏览器。7.28秒独立Vite构建通过（upload-focus-final-build），原大chunk提示保持。初次隔离测试已实际发上传/预检但等待折叠表格可见而失败，修正为展开后核对，旧log保留，不称首次全绿。

## 目标环境与真实请求

共享19501暂停期间严格仅本地代码及19612替身，不发19501请求/消息/重载；用户选择等待主动解除。收到明确解除后才继续目标验证，本会话重载0、共享入口源码不变。

ai-upload-focus-live.mjs --synthetic-staging：原owner/admin、原两具名来源/当前合成Study，各一份UPLOAD-FOCUS-20261116-*.xlsx，真实原生filechooser选择时挂住真实auth/me的200响应（核对当前账号），核验中未发上传；释放同账号真实身份后，各仅一次真实上传201及一次预检201，原0/false/2500/true在页面原值表显示。随后进入原位字段核对，不执行正式导入或AI。1440/390 PNG及WebM、HTTP/结果在.tmp/ai-file-data-2026-11-12/general-unit/upload-focus-live-20261116/，双账号passed，pageerror/阻断请求0，刷新无再POST。已查看双账号桌面原值表；原窄屏/滚动限制保留，不冒称全页移动UX验收。

facts.json与upload-focus-live-facts.log以强READ ONLY逐条核对：仅2新上传/2新预检，原件SHA一致、Excel原0/false/2500保持、导入计划0。upload-focus-old-facts仍4被试/4入组/4访视/4答卷/4修订/4来源；baseline证明旧4例、角色/grant及原152预留不变。模型/充值/Token操作/临床/云/远端配置/发布0；未将任何原始患者数据用于开发工具或Notion。

## 体验与边界

刷新岐研AI后重新选择Excel；同账号核验完成后自动继续，无需再次选择。能看到上传/预检结果后再按原规则核对字段、确认课题；已有提交不能覆盖。实际用户此前丢失的浏览器File对象不能补造或恢复，需重新选择一次；本片不涉及新空白访视的持久提交、模型问答或生产发布，用户最终体验签收待其操作。
