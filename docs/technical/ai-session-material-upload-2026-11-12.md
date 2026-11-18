# 岐研AI本人资料上传接线

日期：2026-11-12。范围：P01限定授权与P02文献上传；P03模型分析和研究数据入库尚未接通。仅专用合成库和原owner/admin、当前执行范围，不更改旧系统源码、角色或Token额度。

2026-11-13当前结果：P02首片已在主入口完成两账号四格式、原安全决定/草稿及刷新/K01/越权拒绝验证。15675已真实加载独立缓存及临时提交守门，不重复重启；最后沿9条既有材料重走新增0，页面/控制台异常0、模型0。原过程中的等待窗口/400/504继续保留为历史，不再是当前阻断。[最终证据](../testing/ai-session-material-upload-2026-11-12.md)。P03按计划继续免费实施。

## 接口及复用

沿AI01原上传按钮，PDF/DOCX/TXT/MD每份最多100MiB、同批最多20份。服务端全量检查格式和内容hash，不信扩展名/浏览器MIME。复用原KnowledgeService/KnowledgeImportService、对象存储、DocExtract和索引；选择本人同范围private库或原生创建“我的资料”。draft/reviewed=false不改变；通用Hub检索不放宽。

- POST `/sessions/:id/materials`：只有requestKey与file；当前身份/会话/Agent授权两次验证，同key同指纹返回原关联，异指纹409。PG内原子创建关联与原生source/task，commit后才调原schedule，不注册旧队列生命周期、不扫描历史任务。
- GET列表和原key回执：严格scope/account/session分页及父链重验，只投影/协调材料状态，不补传、不开始解析或模型调用。未知响应仅查原key。
- 原生任务blocked后已完成并获allow时，关联必须按既有状态机blocked→importing→ready顺序、同事务CAS，不能直接跨级或修改DDL。ready后原文版本变化即失效，不静默换成新文。
- blocked细分：原生直接身份确认任务给精确K01任务回链，复用原保存/不保存和审计；已放弃/永久隔离不提供错误确认动作。确认后warning草稿只供人工查看、不进AI。手动换研究范围清除原doc/task定位。
- multipart真实测试发现Busboy到达parts上限即触发错误；使用3作为终止哨兵，files=1/fields=1仍严格限制一个文件和一个标记，额外文件/字段拒绝。

## 最小配置与权限

按本轮用户继续指令执行已列明的第2/3项：aisci_app仅rh_ai USAGE与session_materials SELECT/INSERT/UPDATE；无DELETE/DDL/owner/BYPASSRLS等新权。迁移回执记录app-material-rw.v1并继续验证目录指纹。

原合成科研Agent按旧activateConfig、tenant授权锁及CAS切至v2，只增file.read；旧v1保留，模型/env/Skill装备/AgentAccess和账号角色不变。旧updateConfig不接受现存wholeDbRead env；未放宽白名单，而是复制完整原配置为inactive再走原激活/审计。不会因此获得数据写权或他人资料。

## UI及当前边界

K01回链只设置目标docId，统一文档加载器进行一次受权读取并按真实doc.kbId定位。不能在引用入口和普通docId effect重复取文并各自重设阅读模式；迟到第二响应不应把用户已选的抽取预览切回原件。手动换库/建新库明确清除旧文档选择，取消其在途读取，原未保存确认及权限规则不变。该修补不改默认原件视图或页签布局。

紧凑清单显示上传/解析/可查看/不可用，刷新从数据库恢复。成功回链K01真实kb/doc/scope；没有可用材料时不伪造链接。恢复键不存文件名/正文/凭据。切身份/会话的迟到结果不得交付到新会话。

开始上传前先保存原请求恢复键；站点存储不可用则明确“本次未上传”并停止，不把恢复键静默丢掉后继续POST。页面内保留同scope键缓存，临时存储读取故障不清掉未知结果；旧回执只读恢复，不自动重传。

P03之前，已附资料时不把用户问题静默当作无附件问题发送，明确可去知识资料查看；这不是最终AI分析交付。原页面Shell/输入交互不重设计。

## 环境协调

窗口现已由T18技术验收完成后明确解除。本机装配给Vite独立`.tmp/vite-runtime-<具名实例>`缓存，避免默认node_modules/.vite被其他SSR测试改写后出现Outdated Optimize Dep；不修改公共Vite配置或批量改测试。P02临时资料提交守门接入同事务commands.admit、实际dispatch及旧knowledge-messages新请求，原key旧结果继续查询；固定材料分析未接之前不创建无附件模型任务。仅重载当前具名本机实例，先强制只读检查在途/近期任务，不排空或改历史queued。

本机19501由其他用户任务处于短稳定窗口，本线程未重启该实例。其他线程重载后装配过本片初版；400修补需要再次装配，完成前不能宣称主实例上传通过。局部源码/测试照常，窗口解除后先核租约与当前源，再重载并跑两账号真实Chrome。另行本地HTTP测试不代替19501目标环境验收。

证据与四层状态见[上传测试](../testing/ai-session-material-upload-2026-11-12.md)。
