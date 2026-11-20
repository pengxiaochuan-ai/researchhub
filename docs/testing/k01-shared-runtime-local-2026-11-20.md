# K01共享正式后端：本机免费复验记录（2026-11-20）

状态：既有19501本机真实问答及固定版引用点击已通过；本轮尚未发布生产。没有创建新API、数据库或验证环境。旧系统、官网、生产配置和历史账本未修改。

## 已实施

- 本机知识资料服务图与正式后端共用knowledge-services.mjs，读取Hub私有固定core55；26个原生服务适配器改为显式固定依赖，保留其他现有功能。K01 Python和固定模型已归Hub；其他专用业务仍有旧目录配置辅助读取，不称整个启动入口独立。
- 普通知识问答直接复用createRuntimeKnowledge/createKnowledgeTurnRuntime：当前真实Study、原生管理员规则、同一检索编译、来源审核/版本校验、无依据不补建议及固定引用。原WP方案/EDC/方法/资产专用分支保留旧facade，不切换业务范围。
- K01状态/Token预算复用createRuntimeChatStatus；普通入队复用正式fence与同事务当前授权重验。旧HTTP校验之后发生身份版本/授权变化时，消息和任务均不得写入。
- 原生Sessions计费保留，standard K01共用Hub已有持久调用凭据：发送前保护、实际HTTP用量留痕、成功/失败结算、未知用量保留。实际调用前与响应后重验任务；晚撤权拒交付并保留knownUsage。外联限定原DeepSeek官方准确路径，禁止重定向。
- 契约会话内部命名空间rh-aiq-不进入正常认领；175条历史排队任务保留，不终结、不清理、不重跑。旧验收账本未重置。

## 免费验证与真实浏览器

1. 57项相关回归全部通过、0失败/跳过，包含权限、共享知识图、原生问答契约、任务执行、持久用量和依赖校验；不是全仓测试或生产能力证明。
2. 真实专用PG四个事务全部回滚，使用原admin/owner与既有Study：管理员无成员记录、普通成员、错误父对象、旧authVersion及AgentAccess撤销后零消息/零任务写入；原生入队、claim、Sessions、Orchestrator与真实资料检索。四个HTTP响应为合成响应，外部模型请求为0。
3. 两个成功案例产生助手消息并按70个合成Token结算；缺引用案例拒交付、已知70个合成Token正常结算；缺usage案例拒交付、保留reconciliation_required，不误退款。全部记录随事务回滚，未影响既有额度/用量。
4. 既有19501原位重启后，Chrome两角色读取资料/状态正常；新增1份原创合成PDF，实际上传到既有本机对象存储，解析中文标题和正文、原件预览、Markdown及审核通过。文档3ea560bf-4aac-4dba-a9df-d0f16abaff7b，v1。复验沿用此资料，不重复上传。普通会话创建HTTP200，真实模型调用0。
5. 页面布局和操作未改；截图及录屏位于.tmp/single-hub-runtime-20261120/。测试脚本、私有凭据、依赖副本均不作为发布物。

## 保留的失败记录

- 首轮浏览器脚本在文档树隐藏时选择知识库超时；改为先点击现有文档树页签。随后将input标题误作body文本、以及在自动创建会话已发生后才等待响应，导致脚本误报。保留原日志和录屏；修正断言后仅恢复原资料读取与同一会话，不重传。
- 初次普通会话创建曾观测500。补齐正式入队/会话的官方锁优先顺序及真实作用域接线后，现有页面和显式会话请求复测200；未据此宣称所有并发异常已消失。
- 一次本机退出等待连接超时，核实无在途问答/导入后，只结束已核身份的本机宿主及4个自有子进程并原位恢复。随后补空闲连接关闭，后续两次原位停止成功；不涉及生产停线。
- 原生缺usage用例触发旧Orchestrator的确定性摘要回退警告；共享交付围栏仍拒绝答案，未把回退当成功，未知用量保留。

## 证据与未完成项

证据目录：.tmp/single-hub-runtime-20261120/。主要文件：k01-final-free-regression.log、normal-k01-execution-native.log、normal-k01-native.log、contract-isolation-native-pg.log、k01-browser.json、k01-upload-browser-first.json、k01-upload-resume.json、k01-upload-reviewed.png、k01-reviewed-markdown.png、k01-normal-agent-ready.png及video目录。

尚未完成生产standard配置/发布控制链、生产解析和向量依赖对齐、新代码真实模型问答及引用浏览器验收、最终发布评审。P2通配AgentAccess语义仍待统一核对；当前两原账号有明确授权，但不能扩称所有授权配置均通过。本机Node25与生产Node22尚未完全统一；知识依赖目录已独立，不等于整个启动链已脱离旧目录。

## 独立复核与文档同步

只读独立总评确认：外联路径、旧业务facade和普通入队事务围栏三项P1已关闭，选择性接线未发现新增P1；通配授权P2保留。不构成真实模型或生产验收。产品基线、变更、版本记录、知识问答规格、用户操作手册及技术进度已同步原Notion页面，新测试记录已并入testing目录。Notion自动将旧mention-page引用标签转成当前mention语法，内容同步成功；未覆盖其他章节。

## 继续实施：真实模型与发布链

- 既有环境原位重启；未新建API、PG或验证环境。候选源码副本只做单元/静态测试，引用同一份私有core，不启动服务。
- 原创中文PDF标题正文正确；图像PDF触发OCR，人工审核字段可读，ResearchHub英文被OCR多出空格，不声称逐字无误。512维向量实际生成，两账号分别6/4条via=vector命中。
- Chrome实际发送1次，job cmwouzoa90007lu3newnwk5v3；依据[6]正确回答人工审核后进入检索、原文没有指定负责人，不补造建议。六条来源接口current，点击[6]展示固定v1中文原文。截图k01-real-answer.png/k01-real-citation.png及video/real-qa、video/upload。
- 原生调用凭据1次已知用量；保守14427microCNY。私有测试回执绑定原账本SHA和2258541microCNY，合计2272968microCNY<5000000。原100笔账本、全局价格过期规则和其他模块不改。产品依原生权限/Token/账务，不使用验收次数当运行限制。
- 首个浏览器脚本误用“发送”按钮名，原生PG核实新job/调用均0；保留free-locator回执，仅修正为现有“发送问题”，未重试模型。
- 回归pair17/server16/config9/profile13/artifacts8、DDL分类11；覆盖首次切换失败恢复、依赖集合/镜像/健康、缺失配置键恢复、正常任务推进后回滚语义。精确候选runtime119通过；工作目录128包含其他未并入变更，不混报。
- 生产只读run44721937685：app/owner都为researchhub专用账号，search_path public、vector可见、扩展public；查询2、写入0。旧服务不改。
- feature plan run44723041031因local-crf-methods旧SQL字符串误触迁移门禁；实际仅依赖路径。新增严格逐字机械替换识别，SQL/GRANT或其他字节变更仍阻断。独立审查发现打包遗漏py/Dockerfile，补knowledge九文件精确复制和真实封包inventory，不全局放开Python。
- 待完成main发布和生产上传/检索/问答/引用。通配AgentAccess、Node25/22及其他业务装配仍须单独收敛，不据本次K01两账号通过扩称全部能力一致。
