# S08有界API与运行实现

仅当前本机专用合成装配；复用旧Task、账户、角色、Notification和Audit，扩展`rh_study_tasks.context/operation`两表。源库与旧服务不自动迁移或发布。[完整目标与14路由](../product/study-tasks-s08-complete-spec-2026-11-02.md)和[实测](../testing/study-tasks-s08-2026-11-03.md)为配套。

客户端`src/study-tasks-session.js`仅同源`/api/study-tasks`：studies/context/participants/list/detail/operations/link-options读取；create/edit/assignments/transitions/reviews/reminders/context写入。scope固定studyGroupId/researchProjectId，actor/tenant/管理者能力来自当前后端，不信客户端标记。私有响应no-store；每次写入同一租户授权锁内重验原角色、真实父对象、CAS、原状态规则。

全部写入需requestKey，非创建需expectedVersion；同key同body且当前有权返回原receipt，不重复任务/版本/通知/审计；不同body409。Task核心、关系、context、operation、Notification及Audit在同一caller tx提交，旧公开入口策略及质控联动不变。Hub单独将旧`INVALID_TASK_TRANSITION`映为409，旧接口仍原状态码。

输入白名单/32KiB；错误400输入、401会话、403当前授权、409版本/状态/来源/幂等、429容量/频率、503不可用。结果不明不自动重试，新请求前先GET原receipt。409草稿核对明确确认后才新key＋当前version；读取序列/编辑修订/身份epoch守门，旧响应不能重挂载草稿或恢复失权私有摘要。

列表默认20、limit1–20，签名cursor绑定actor/scope/filter；选中和筛选/前页栈只保存在当前history.state且绑定身份/Study，不写demo-store/localStorage。活动页每3秒及focus/visibility当前授权/来源重验，不自动执行写入。

提醒只接受requestKey/expectedVersion，后端当前负责人/协作者唯一集合且逐个当前可读授权重验；收件人快照封存于operation，原Notification为recorded/sentAt空，详情当前收件人可读，不表示已读或外部送达。新key每任务60秒有界限频，原key回执恢复不重复限频。

context严格区分none/synthetic_crf_record/formal_visit，合成记录不是正式visit/enrollment外键。只读借用原edc.inCollection→plan/collection/record真实父链、当前授权/固定版/seal/hash，写入重验；当前来源变化即restricted，不交付旧ID/标题/hash。当前local allowFormal=false；现有采集页无固定历史版URL，navigation.href=null并说明，不能伪造回链。候选过滤在limit/cursor前，最大20，未知字段拒绝，不交付CRF答案。

运行0模型/0外部邮件/0新Worker/依赖；重启仅现有owned19501–19507本机环境并先核知识任务在途0，不能借装配触碰旧服务/云/临床库。任务8/8已用，复测复用现有本轮对象。
