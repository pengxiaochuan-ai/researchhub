# 岐研AI P06 · 固定研究数据概览与解释契约

2026-11-13。范围：[P06首片规格](../planning/qiyan-ai-file-data-2026-11-12/p06-overview-quality-implementation.md)；前置[P05入库](ai-research-data-import-2026-11-13.md)；[真实验证与当前未完成项](../testing/ai-data-analysis-p06-2026-11-13.md)。仅本机专用合成库，不新增表、角色、Token额度、旧app改动或生产部署。

## 数据读取与确定性结果

新GET `/sessions/:sid/research-data-imports/:planId/analysis`沿当前Cookie身份与来源group/project headers；只允许空query，不接受Study/账号/角色/答案/统计值参数，没有POST分析、导出或自报授权。源会话、本人P05计划、真实目标Study、当前result.read与原file.read、原件SHA/预检版本逐一复核。底层固定答卷复用`readFormalResponseInTransaction`，核当前ref与原P05 receipt一致、真实Subject/Enrollment/Visit/Plan/Form/执行方案/政策和schema hash；发现变化拒绝原快照，不混读新旧数据。

`local-research-data-imports`提供`analysisInTransaction`/`currentInTransaction`，在任务既有连接内重用真实Study resolver和来源校验，finally恢复来源GUC。禁止锁内启动第二事务等待自身授权锁。旧原生读取使用行锁，保持业务只读但不能标成数据库强READ ONLY；只读准入脚本单独强制READ ONLY。

`research-data-analysis.mjs`以原生schema/答案类型和范围校验为基础，计算本人固定批次的被试/访视/CRF数、真实完成访视数、字段缺失/异常、有效数、数值最小/最大/均值/零值数、布尔是/否数。0/false不是缺失，required缺失单列；非法值不参与描述统计，缺失不补零。没有访视数据时not-evaluated，不输出虚假的均值0或质量合格。未配置医学范围/单位不猜填，不做插补、假设检验、疗效或跨组推断。

结果`hub-data-overview.v1`含算法版本、本人/源会话/目标Study/执行项目及当前许可ref、原导入/预检版本、文件引用、Form hash、计数/字段/质控覆盖、固定来源；以canonical digest生成packHash。packHash不是客户端授权，服务端始终重查当前访问。来源中的D1等锚定固定CRF revision/hash及原文件sheet/行，只回授权用户。

质控状态：checks-passed＝已列规则未见异常；needs-review＝必填缺失/类型或配置范围异常/未知字段待核对；not-evaluated＝无访视数据。医学合理性、跨时点、疗效/组间及未设置的范围保持未评估，不等于Study质控放行。

## 入队、执行与交付

原commands接口由服务端admit固定`hubResearchDataSelection`：本人来源principal、session、import/version/packHash及selection hash。message.meta→stage→knowledgeChatJob.payload始终保留同一选择；stage重建固定结果，变化则暂停，不悄悄换成最新批次。未入库、混合资料/数据范围不明或智能搜索开启时明确拒绝/澄清；旧直发资料问答端点不用于绕过数据入队契约。

admit先设置已认证当前账号的`app.account_id`再查Hub私有表；原生会话事务只初始化tenant/group/project，不能将空account GUC下RLS过滤出的0行当作“没有研究数据”。空上下文真实app负例已补，避免带预设GUC的测试掩盖实际入口差异。

识别到可信`hubResearchDataEvidence`才进入`hub-research-data`，路由绑定策略hash/packHash/输入及本人会话。既有九项Skill不改；本能力skill=null，不将体检报告Skill冒充科研质控。`research_data_result_read`是服务端固定读取执行记录，沿现有file.read授权，没有新增通用db.query、上传、写库或任意网络工具。

真实OpenCode综合复用既有`runOpenCodeSynthesis`：每任务独立受控上下文、一次Provider请求；最终DeepSeek输入必须精确等于本次指令＋聚合问题。模型只收到counts/fields/quality和R1结果标识，不收到逐行答案、被试代码、来源路径或文件原件。R1指完整确定性结果，避免模型在未读逐行值时把聚合均值错误归给D1或某个被试。原始D1/D2仅由服务端为用户展开回查。

模型JSON只含解释/局限/建议及真实R1引用；后端渲染“程序结果”和完整指标/数字，AI只作定性解释，不自由转述计数、均值、范围或比例。不能因为数字在其他指标中出现就认定归属正确。数值句按子句过滤，保留合法零值/0/false及源指标术语、可独立定性解释/建议，并提示未保留的转述；全无可交付内容才停止，不重试。其后仍复用原数值/数据边界，历史复验执行同一处理。自然语言推论并非穷尽可证，专业语境仍须验收，不能把本守门称为覆盖一切科研场景。

伪引用、空解释、越界数据或变化的来源不可冒充成功。认领/Provider前/原子回答提交/历史读取均重验当前账号、工具权限、任务租约和同一结果；历史失权/版本变化清正文与来源，不仅禁用按钮。

## Token与证据

复用原账号/租户额度、并发Token预留、实际Provider尝试/已知用量与原子封口。预留覆盖实际聚合输入；没有开发费用上限或临时过期规则进入产品。未知用量保留待核对，失败不自动发起第二次请求，不补额度、不充值或修改旧预留。

用户本轮已批准owner/admin各一次真实合成解释，共最多2次请求；工程脚本`ai-research-data-p06-ai-acceptance.mjs`在发送前落唯一checkpoint，重跑只查原任务，未知发送不重发。这是本次验证边界，不是业务用户限制。公开模型价格另作证据快照，不改变计费逻辑；执行及实际Token结果以测试报告为准。

已执行结果：PID46020下两账号各一次实际Provider请求completed/settled，1150＋1178＝2328 Token，无未知/不一致事件。来源S09与刷新恢复经过真实Chrome，原152笔预留和P05对象逐条保全；只读核对脚本`ai-research-data-p06-final-facts.mjs`不创建或结算任务。回答中定性措辞仍须专业判断，不能把数值过滤和R1引用一致性当作全部自然语言推论正确。

## 原页面与角色

原AI01导入区增加折叠的“数据概览与质控”，不改Shell/会话/导航/上传/一次确认路径；唯一目标沿P05展示，概览自动读取，无额外业务确认。数据核对成功后可直接在原输入框提问并沿既有队列执行；失败清旧概览、阻止误发，显式GET恢复。切账号/会话/批次丢弃迟到响应。前端transport只新增精确GET analysis路径。

回答的R1来源折叠区显示实际Study/方案/计数及底层固定记录，S03/S09沿既有helper，不拼演示路由。数据AI与智能搜索互斥，私有数据不进入网页检索。14/22与共享按钮/焦点规则不变；窄屏沿既有独立消息滚动。管理员同样只分析本人本次导入，不因角色显示他人的私有会话；原Study业务权限不修改。
