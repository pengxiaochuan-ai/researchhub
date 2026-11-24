## 2026-11-24 · ResearchHub 发布缓存留存复验

生产只读审计确认当前 `hub-runtime-33a9ffd3-45155206512001` 与上一回滚版本 `hub-runtime-be32ffdb-45145871325001`。首轮维护逐份验证 OSS 及本地完整 SHA-256 后回收 8 份旧安装包，空间由 13,336,592,384 增至 14,988,513,280 字节，保留当前与回滚版本。无符合规则的生产镜像被清理。维护完成后的线上 Chrome 实测 H01 及其动态接口 HTTP 200，列表可读取。 [只读审计](https://github.com/pengxiaochuan-ai/researchhub/actions/runs/45310594110) · [首次维护](https://github.com/pengxiaochuan-ai/researchhub/actions/runs/45310746920)

隔离的本机 Docker 镜像与对应真实打包归档通过精确标签删除与摘要校验路径。时间检查接受 Docker 的 RFC3339 时区偏移。定向测试覆盖空间按需回收、跨组件复用、手工回滚的实际前一版本、在途发布、停止的容器、外部标签、内容不符、软硬链接和 24 小时边界。生产低余量分支将在下次实际触发时记录执行结果。

# 统一发布流水线验证

当前目标仅ResearchHub发布机制，不扩科研功能、权限、业务样例或模型调用。

## 已取得证据

- 变更分类8项：前端页、API、代理、共享/未知文件、文档/测试、全部非测试SQL及模型、组件真实基线、不同run attempt候选独立。
- Release测试4项：复用保留原sourceGit；seed/当前指针manifest和core摘要；真实临时Git复现失败后台变更在下一前端提交仍被纳入；SQL及嵌入CREATE TABLE/SEQUENCE/ROLE/DATABASE/UNIQUE INDEX准确批准摘要；core适配源码变更拒绝静默复用。
- Pair测试5项：成功、失败整组恢复、SystemExit清理、未知现场拒绝、己方exited可恢复。回退明确使用前序backend及frontend模板。
- 实际Bash云幂等键反例：同一run的apply/finalize/rollback、不同attempt/control摘要均不同，正常重试一致，长度44。
- 工作流4项：finalize只有明确skipped才自动恢复；success/failure/cancelled均不会盲回退；旧单端入口移除/仅验证；无生产迁移命令；rehearse不会激活服务器。
- 后端装包2项：新Hub替换旧代码、core逐字节不变、资源仅固定地理资料白名单回退、core篡改拒绝。原runtime 11、bootstrap3、artifact5、前端回退4及8项真实HTTP代理/静态进程测试继续验证。

## 本机真实Docker/HTTP/PG演练

`.tmp/unified-release-20261119/docker-rehearsal/result.json`已记录5项实际通过：坏后端模板恢复旧模板及两组件；坏前端代理恢复两组件；成功成对升级；新API退出后整组回退；两个sentinel旧项目与六类真实新PG任务表未动。

演练使用全新具名镜像、隔离网络/Compose项目和临时PG16，只存合成任务行，最终清理；未连接RDS、临床库或旧本机服务。为适应本机/Runner镜像存储，只归一化从受审归档推导的config ID和fixture项目名称；平台按实际宿主核验，生产默认仍只允许amd64。测试HTTP服务是明确的发布故障夹具，不证明科研业务或模型能力；正式业务仍须目标上线后验证。

首次夹具因COPY文件所有权导致启动失败；修正只在夹具COPY中指定node所有者后重跑。实际成功的5项结果保留，后续加入init与已校验驻留镜像复用以缩短演练；GitHub原生amd64演练尚待执行。

## 独立评审留痕

首轮指出并修补：action云幂等键冲突、回退错误使用新后端模板、历史回退使用当前前端模板、exited被恢复门禁拦截、SQL/嵌入DDL漏判、rerun覆盖版本、finalize取消时错误回退。相关反例已加入。SQL嵌入检测是保守启发式，不声称能证明任意动态拼接DDL无遗漏；非测试SQL全部受控，流水线自身不执行生产迁移。独立总评与真实GitHub/生产配对结果在取得后追加，不以本机测试代签。

## 首轮GitHub演练

分支4773996、运行44518031809：变更识别无数据库差额、当前Git装包、原生amd64前后端构建及同版归档私有上传成功；后续Docker夹具归档校验失败，未绑定/激活生产。错误为HUB_RUNTIME_IMAGE_CONFIG_ARCH_REJECTED。校验器此前会对所有带rootfs的归档JSON都要求amd64，已改为仅对manifest精确选择的Config核平台；其他元数据不作运行镜像，路径/摘要/唯一tag与所选平台守门保留。新增“附加unknown构建元数据＋正确运行Config”反例通过。完整GitHub重跑尚待证实，不将此推测原因当成已验收成功。

另补finalize留存基线漂移反例，Pair现7项；启动切换前对既有服务器发布存储凭据作当前指针校验及具名私有对象读写探针，403时在任何停服务前停止，绝不自动授予权限。该存储探针不由本机Docker夹具代签。

## 第三轮GitHub演练已通过

8f5aee0／44524167160 completed success：两端amd64构建、当前Git后端sourceGit核验、旧seed两镜像真实校验与retag/resave/config ID不变、旧sourceGit保留、5项Docker/HTTP/PG演练和11份控件绑定全部通过；apply/browser/finalize明确skipped，服务器serviceWrites=0。最终上传manifest SHA为e69d4a400a16e0c86283d63df52da9f90bdcf228f952861363b94ffaf8216877，中间collect日志摘要不用于激活；control SHA0257d88917cfb2004976096a7e36040805bef8e4431d9c3422477d32c3a3a914。

第二轮44522291561已通过归档，PG夹具在临时Unix初始化服务退出时发生连接竞争；改psql -h127.0.0.1等待最终TCP实例并显式超时后转绿。首两轮失败保留，不覆盖为成功。

当前Pair为9项，覆盖finalize期间基线漂移不推进、存储403停线和解析模板坏worker／前端秘密／DB绑定漂移在up前拒绝。主机真实首次成对release44525278754正在执行，角色写权限、切换、浏览器与成功指针仍待目标证据。

## 首轮main实际发布与角色复验已通过

运行44525278754：completed success；源码8f5aee0472f2f90b52abeb45832720738a9ae384，发布tag `hub-runtime-8f5aee04-44525278754001`。最终上传manifest SHA `21a660286c948bbbd4b463bcfcd08881cc8961bb112697f340f547b6f63f60db`，control SHA `8f2b5c02ab6522086038d68fd3f91a227931e2bc89a4f673c85a3d3821c6c59c`。完整私有日志及抽取回执在`.tmp/unified-release-20261119/`，中间collect摘要不用于激活。

现场apply返回frontend200/auth401/publicData200、oldServicesUnchanged=true、historicalTasksUnchanged=true、databaseMigrationExecuted=false；浏览器成功后finalize返回paired-release-complete，成功指针完成写入/回读。RDS保持独立researchhub库；唯一.env.prod参数保留，旧ops和official-site容器身份/镜像/状态以及六类历史任务全行hash前后相同。

额外Chrome：owner/admin两账号原UI登录→P01、H01/E01/K01/A01真实接口读取，12检查、12截图、2录屏、0页面异常。仅登录前auth/me预期401，无非认证接口失败；未记录密码/Token/响应正文。AI付费调用0、外发邮件0。浏览器证据目录`.tmp/unified-release-20261119/browser/`；A01统计0/真实空态，K01仅证明文档树，正文/原件/解析/AI另验。截图已人工观察，当前页面布局未改动。

生产成功升级已实际执行；生产故障注入/生产事故回退未执行，整组回退由独立Docker/PG及GitHub演练证明。不能将本次发布验收替代科研业务和用户专业签收。

## 最终独立总评

独立评审只读核对main/head、GitHub apply/browser/finalize及Chrome实证，无新增P1/P2；明确生产故障回退、正文附件与AI不在本次业务验收内。下一步以纯文档push验证自动入口及无运行差额跳过。Notion技术/测试专项及产品基线、版本、统一手册同步。

## main普通push自动触发验证已通过

文档提交5f142ae51aaa0bb29510b948f3a1d5464aa0d00b实际触发push事件运行[44528390325](https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44528390325)，completed success。计划正确引用刚发布的hub-runtime-8f5aee04-44525278754001为基线，frontend=false/backend=false/databaseChanged=false/releaseRequired=false；构建、复用、封包、服务器apply、browser、finalize全部skipped，未产生新部署。由此证明main自动入口和文档独有差额跳过已实际生效。最终此条证据以`[skip ci]`文档归档，避免仅为记录验证重复触发工作流；运行镜像仍保持上述配对版本。
