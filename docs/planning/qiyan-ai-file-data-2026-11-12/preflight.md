# P01准入与免费契约验证

## 当前覆盖状态：继续指令后已启用最小接线，进入P02

本轮用户要求按顺序继续，不重复停在相同确认。限定表DML和原科研Agent v2 file.read已启用，6项真实应用身份/ACL/隔离验证通过；不扩角色、其他账号、数据写权、额度或模型费用。下方“待GRANT/file.read”仅保留历史准入快照，不再是当前待用户确认项。P02真实入口400已复现并修multipart，恢复/晚到/身份复核与安全任务回链继续验证；19501短稳定窗口未解除，本线程不抢重载。详见[当前测试](../../testing/ai-session-material-upload-2026-11-12.md)。

## 2026-11-12新增表批准后的实际状态（覆盖下方同日历史未建表描述）

专用合成库已新增rh_ai.session_materials，持久0行、RLS启用且FORCE，重入created=false。没有应用GRANT/Agent file.read/上传或模型。独评3Important作者RED→GREEN关闭，25定向、534组合及隔离构建通过；新增应用无权负例与最终结果见[DDL测试](../../testing/ai-session-material-schema-2026-11-12.md)。新浏览器baseline-1794491032996仍因原K01两次自动建会话POST被只读拦截而partial，未扩修/放开。旧结构/角色/原账号/AgentConfig限定审计通过；P01及整个上传链仍未销项。[结构与兼容决定](../../technical/ai-session-material-schema-2026-11-12.md)。

2026-11-12，本次用户已确认规则并批准串行推进。范围仅本机专用合成环境，当前目录；没有运行旧任务或更改旧服务。

## 运行和权限事实

- 本机status：PID91477，前端19501/API19502/解析19503/向量19504/质控19505/SMTP19506/收件箱19507均ready。只调用status，不重启；ready不是本轮真实解析/向量/数据处理验收。
- `assertFixtureTarget`核wp01_test_full_baseline及合成标记；实际检查事务强制SET TRANSACTION READ ONLY，statement_timeout=5000。未连接临床库、读取远端配置或输出凭据。
- owner=active researcher、admin=active tenant_admin；原合成组/执行项目成员有效。两账号已有knowledge/workbench/artifacts及knowledge.edit/chat.use；owner的当前菜单/按钮不含data/subjects/data.upload。没有新增任何角色/权限。
- Agent type=research，当前有效配置tools只有knowledge.search，没有file.read；当前scope下private库owner32/admin2（本次时点快照，不是产品配额）。rh_ai当前无表。
- 原SourceFile/ImportTask不具备会话幂等关联；StructuredInteraction有强问答语义。建议一张关联表而非平行知识/患者表，具体执行见authorization-slice1.md，未执行DDL/GRANT/配置更新。

## 代码契约与测试

新增`server/ai-agent/session-material-contract.mjs`是纯固定材料契约，**未接入产品执行链，也不代替数据库授权服务**。请求只接ID/version，最多20；规范去重、同ID异版本拒绝、严格自有字段；根据当前后台载入的tenant/account/group/project/session、private owner、source/doc/kb父链、hash/版本、安全状态冻结脱离原对象的快照。private草稿不需伪造审核/发布。

新增11测试先RED→GREEN：首次模块未实现8/8失败；补充继承字段与源/文档/库父链反例时8通过/2失败（parent-red.log）；补齐后10/10通过；独立复核要求删除状态必须显式null，缺失字段反例先10通过/1失败，再11/11。包括共享/他人/错课题/错会话、管理员标签不能短路、blocked/warning/未解析/过期/删除、缺记录和重复后台行、后续对象变化不改旧快照。warning按原安全流程，当前纯契约拒绝，不擅自新增安全豁免。

完整免费前端/定向组合首次503/503；随后free-suite-final.log为506/505通过/1失败，另一进行中模块researcher-profile测试缺源文件，未改该模块；该文件随后出现。当前组合free-suite-reviewed.log为509/508通过/1失败，`tests/directory-session.test.mjs`的team URL状态live/pending不匹配，非本片文件，未扩修或抹掉失败。定向材料/联网意图/浏览器就绪组合focused-final.log为15/15，零跳过。独立临时outDir构建5.77秒通过，原大包警告保留，未覆盖运行dist；不是全量全绿。未运行包含持久PG夹具的server/ai-agent通配测试；当前没有新上传、模型或业务写入，因此不能冒称PG上传/AI功能验收。

## 浏览器基准（非功能交付）

脚本`scripts/ai-file-material-baseline.mjs`用真实Chrome、两个原合成账号1440×900登录后读AI01/K01。浏览器产品API除登录/续期外仅GET/HEAD/OPTIONS；不发消息、不选文件。AI01实际历史200加载完、输入14/22可用、智能搜索OFF、原上传仍禁用。登录/续期属于已有认证操作，不称全数据库零写。

首轮`.tmp/ai-file-data-2026-11-12/baseline-1794487527986`截图捕获过早，含历史/身份加载态；第二轮1794487694000只等bases响应头/搜索框，独立复核指出仍不能证明树已加载，不能当最终K01就绪证据。

修补基准等待器：消费bases与对应tree的JSON，核实际选中库并等每个根节点/真实空态呈现、无加载错误；独立真实Chrome小DOM＋受控响应体的两个反例先2/2失败再2/2通过（review-readiness-red/green.log），该小DOM不是产品主链。最终产品基准`.tmp/ai-file-data-2026-11-12/baseline-1794488796252`，两账号对应真实同库各1根文档均已呈现，有4PNG及WebM，0pageerror/0新增上传或模型。

最终result **passed=false**：完整K01就绪触发原KbAgentPanel的自动POST `/api/sessions/knowledge`，两账号各一次均被只读路由拦截，未发到后端。真实基准有状态/树证据，但“无自动写尝试”条件未通过，不放开写入或把该轮涂绿，不在本片修旧K01自动会话行为。已查看实际根文档截图；新AI01上传不得沿用这个自动建会话副作用。K01默认显示已有共享库，**不是新上传要默认放共享库**；新功能必须按owner私人范围选择库。

页面未改变，基准不等于上传、本人草稿分析、移动/200%或用户专业验收通过。原K01遗留说明/单篇及其他模块问题不在本轮扩修。初始本机PID91477，末次status观察到31042且七服务ready；本轮未发任何start/stop/restart，不据此声称服务进程全程未变或其他工作完全无写。后续实际启用前重核当前身份/配置，不能复用过期快照。

## 当前门禁

P01安全可做部分已推进；进入P02需要用户批准首片明确的rh_ai.session_materials结构、现有应用角色仅限该表读写、当前Agent新增file.read。确认前不执行迁移/GRANT或改配置，不用Message.meta绕过；已批准业务规则/顺序不重复确认。付费试跑、数据写授权和其他Study未随本次开放。

本片独立只读复核见[p01-review.md](p01-review.md)：无Critical，2 Important已主代理逐项RED→GREEN；没有第二轮评审或“全部功能总评审通过”声明。
