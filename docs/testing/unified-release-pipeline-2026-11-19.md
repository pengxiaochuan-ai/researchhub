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
