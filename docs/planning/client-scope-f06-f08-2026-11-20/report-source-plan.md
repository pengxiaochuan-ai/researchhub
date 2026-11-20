# F06固定报告来源核验 → F07 实施计划

日期：2026-11-20。当前用户明确要求先补通固定报告→Hub成果→跨课题复用，完成后再进入F07。沿已确认方案A及原H01/G02/A02局部入口，不重新征询已批准流程或改变页面布局。

## 设计与边界

原生报告读取层多次核对源Study角色，不能借用作者身份或取消Study权限。采用**精确条目限定的服务端来源数据包＋现有原生纯验证器**：在现有应用事务内，SQL按真实当前成员、固定条目及具体用途核权并持有原源锁，取限定报告所需的当前依据；服务器复用既有修订封印、参与/数据使用政策、答卷投影、manifest、质控和报告构造规则验证。原始记录只用于服务器内部核验，不经Hub API返回，不赋予源Study成员权。

SQL基本生存检查不等于完整科研来源核验。报告分支`read_source`仅返回固定引用元数据；服务层必须执行完整验证，成功后只对获准阅读/复制交付对应固定报告正文。元数据目录、审核、正文、引用、复制、来源状态及回执恢复均走同一必需核验，不能把未执行的验证当作成功。

首先适配当前项目已有原生T17固定方法报告，不改变其synthetic限定、计算方法或数值。复用原MethodsService与新的独立确定性Python Worker生成一份全新报告；不手造completed Run，不运行旧硬编码夹具。未知报告adapter、其他附件/知识来源继续明确拒绝，不用复制无上游声明“洗白”来源。

## 契约与分工

- `report-source-verifier.mjs`：`createHubReportSourceVerifier({load})(bundle,expected)` → `{reportId,version,contentHash,contentMd,basis}`。expected固定`studyId/reportId/version/contentHash`；重建当前manifest并完整对比snapshot及native report正文/blocks/sources，未知/缺字段拒绝。
- `report-source-migration.mjs`：`hubReportSourceMigration({ownerRole,appRole})` →准确差量SQL；仅owned新schema，无启动自动迁移。报告SD数据包由精确entry/purpose解析，无任意表/Study参数。报告基本函数不授app单独执行；数据包仅内部验证。
- 原`read_source`报告元数据：`sourceType:'fixed-report',studyId,reportId,reportVersion,reportHash`，以及原`entryId/version/contentHash`。报告正文不从此基本函数返回。
- Hub服务新增必需来源读取适配，正式runtime接纯验证器；原作者提交沿现有源Study授权，接收者只使用单资产许可，目标仍原生本人私有草稿。
- 独立fixture：本次owned F06库、3个合成身份与两个Study；新worker19664。来源资产由真实报告登记和原审核生成，Hub再纳入。

## 串行步骤与验收

- [x] 原生报告完整纯核TDD：固定版本/封印、最新plan与method/report审批、protocol/policy/participation、subject/enrollment/visit/assignment/revision、manifest/质量门、固定正文及sources；任一撤回/换版/失效均拒绝。
- [x] 精确来源SQL及同事务锁、service/bridge装配，补原原创与私有目标回归。
- [x] 全新原生报告已实际生成：表单write/review/lock→T15快照→真实独立Worker HTTP200→method确认→T17审核发布；新环境报告证据私有留本机，无患者/生产/模型调用。
- [x] 真实PG、HTTP、管理员/接收者浏览器走报告登记→原资产审→Hub纳入→用途许可→跨课题复制→修改/刷新→原来源失效停止新交付且历史私稿保留，接收者源membership始终0。补未知响应/并发/越权/原URL与负例，保存PNG/WebM。
- [x] 独立审查、构建、living spec/客户审查/统一手册/版本与Notion回填，区分独立合成结果和生产/用户签收。
- [x] F06报告链验收通过后进入F07：本人普通/笔记/想法/指导模板→真实保存/刷新/检索/来源回看→当前合法AI回答主动采纳到本人编辑草稿。保持原K01三栏及个人库模型，普通新成员精确授权、隐私隔离和CAS保稿。无目标环境真实AI执行证据不冒称AI采纳已完成；不启动并行聊天的生产付费任务。

F07当前只读准备见子任务核查记录；不因旧K01计划/生产聊天自动扩展本轮部署或调用预算。共享工作区其他聊天改动保留，19501/19502不重启。

## F07已确认范围的实施细化

F06真实报告正向HTTP及实际SQL bundle原生复核已通过；浏览器与来源失效负例由独立子任务收尾，通过后开始F07实现。

- 沿原新建文档弹窗增加默认普通文档的模板选择。笔记/想法/指导记录可选当前库已有材料，系统核对实际文档与固定version/hash后带入来源链接；不要求用户填写ID。POST仍只创建原空白草稿，模板绑定实际新docId，在唯一GET loader后带入未保存正文，沿原PATCH/CAS保存。
- 编辑区仅对已识别的站内固定知识资料链接提供“关联资料”回看，沿原未保存离开确认；目标页重新核权、版本/hash不符拒绝，不能替换latest。保持原三栏、导航和树。来源关联不是Hub发布或专家确认。
- AI回答次要动作仅对当前本人私有可写、正在编辑的文档出现；点击时重新读取实际会话及每个固定来源，current才追加到现有草稿，原内容不覆盖。异步返回后再次核对账号、scope、kb、doc、版本及编辑状态；正文作为安全文字，关闭模型图片/HTML/链接的自动执行；来源链接由已核元数据生成。只改内存，不自动PATCH、审核或调用模型，仍由本人保存。
- 私有笔记沿原本人审核后才进入全文/AI检索，不改审核门。验收明确保存与“已审核·可检索”是两步，不自动把本人草稿送入AI证据。
- 本轮先用owned新环境完成三类记录、来源、CAS和隐私隔离。该环境未开放资料问答且无合法现存AI回答；如仍无当前真实回答，AI采纳只能登记代码/免费契约与阻断状态，不使用伪造消息冒称真实能力已验收。生产并行聊天的限定预算和资料不被本任务借用。

## 实际执行回填

F06：positive浏览器d754369e及negative续验d5cb7729均通过；真实plan审核撤回后新增交付拒绝，既有私稿v3刷新，source membership0。新native worker一次计算HTTP200、模型0，作者feature撤销rollback和双连接form SHARE锁55P03通过。

F07：8f1e96a7真实Chrome三模板/原审核检索/固定来源/私库/409/身份切换通过。用户明确确认真实AI采纳并入K01问答验收、当前单列待验；代码与免费契约继续收尾。390默认展开侧栏限制造成挤压，保留问题；模板dialog Esc焦点恢复发现真实缺陷，已局部修复，待响应式子任务复验。未改sharedShell/生产/旧服务或模型预算。

最终：F07本机记录闭环通过，免费采纳真实组件模拟API契约7项通过（不是AI执行）。用户确认真实采纳并入K01待验。新建dialog焦点修复后720/桌面/原生200%复验通过；390既有Shell占位限制保留。产品、审查、版本、统一手册与专项文档回填并同步Notion，不推进F08。
