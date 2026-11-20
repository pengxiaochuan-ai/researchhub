# K01 对象存储启动顺序修补及导入阻断

## 已观察的生产事实

bridge同版发布7590091已完成，v2准确准入与累计账本已激活，模型/knowledge-chat继续ON，knowledge-import只认领下列两个新ID。原623条历史任务hash、原两笔失败问答与账务记录保持；仍仅有原2次真实Provider请求，费用上界0.05454元，本轮新增模型调用0。

| 账号 | 新私有库 | PDF任务 | 实际失败 |
|---|---|---|---|
| admin | cmwogc60l0003nq0764rrwb8h | cmwogdsd60011nq0786q4foiy | 2026-11-20T04:09:11.190Z，IMPORT_FAILED，进度25，`对象存储不可用`，docId=null |
| owner | cmwogdump0015nq07gkdim17h | cmwogdwe10022nq07s1xoo7zq | 2026-11-20T04:09:11.193Z，同上，docId=null |

两份原文件通过原页面真实上传，后台sourceFile SHA与批准材料一致。当前只有4份MD/未审核草稿；不能把两个失败的PDF说成已成功入库。没有执行手工正文替代、任务状态重置或付费问答。

## 根因及已验证修补

Nest在同模块中并发执行provider的onModuleInit。原RuntimeStorage在异步HeadBucket期间ready=false；KnowledgeImportService在自己的onModuleInit立即resumePending，任务到statObject时存储仍未就绪。随后存储已就绪、HTTP可用，因此晚到的HeadBucket检查为true并不能否定早先的启动竞态。

已在独立本机容器以**真实Nest生命周期＋真实既有MinIO HeadBucket**复现：旧顺序consumer观察ready=false；新顺序ready=true，最终均可连接。对象读写、数据库连接、Provider调用均0。证据：`.tmp/k01-production-20261120/storage-order-native.log`。

仅改Hub自有RuntimeStorage与foundation：先await存储就绪，再装配任何Worker；初始化去重且已就绪时不重新置false，Nest后续回调复用同一实例。保持旧项目源码/服务、存储配置、文件IO、角色、用途及累计账本不变，不新增解析服务/依赖/权限/费用。配套将原区域上传提示由“正在解析”改为“等待处理”，不把queued说成已执行；非OCR解析进度不再固定显示OCR。未获AI用途的可读库只显示问答尚未开放，不误报整体阅读授权丢失；实际阅读撤权仍403。

发布沿用同core55与准确v2准入SHA6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492，前后端同版；数据库结构/权限无变化。失败任务不因发布自动重跑。

## 仍待确认的数据修复动作（不得自动执行）

原生接口没有失败导入的重试入口。重跑需要将**原两条失败任务**重新入队，属于新的具名数据修复操作，原stage/activate操作员批准为数据库直接写入0，不能据此自动执行重置。

建议准确范围：仅上述2个任务各重跑1次、不新建任务/源文件/文档替代；重新核对当前账号/真实KB/Study、原始SHA、failed+docId=null、原失败时间/错误和无在途认领；同一事务先追加2条包含完整原失败快照的系统审计，再CAS重新入队，原生Worker复用原对象存储文件重新执行，仍只按原两个ID认领。任何归属、状态、SHA或CAS差异即全回滚并停。成功各生成1文档后总文档仍最多6，每份最多3版；不扩账号/角色/Token，不对账，不触历史任务或其他库。原2次新模型请求/最多4新问答任务/累计1元上限不变，重跑本身不调用模型、不发邮件、不增云资源。

确认前可继续免费代码、回归和发布就绪验证；**暂不消费新Provider请求、不把K01验收标为通过、不切E02**。一次性修复脚本须预先准备、免费验证并独立评审，提交用户确认后才执行重跑及原页面两角色验收。

## 2026-11-20 发布过程留痕（仍未切换）

修补71bbc4c的44674658104首轮：前后端构建与镜像内容校验通过，04:32:49Z已输出manifest；之后OSS上传长时间无输出，04:54Z在任何生产apply之前取消。没有更改生产入口、任务或账本。原日志storage-fix-cancelled-release.log保留。

同SHA第二轮仅重跑发布，不重跑任何导入/模型；在免费测试Validate inputs and release controls停留，仍未上传/切换。已停止获取实际日志定位，不跳过测试、不把未切换修补称为生产生效。两份原失败仍保留，本轮新增Provider为0。

### 第二轮门禁的端口复用风险与最小测试修补

实际日志：不可用后端测试耗时18.6秒，随后两个listen(0)测试EADDRINUSE。原测试先释放后端端口，再绑定前端，操作系统可将同一端口分给前端，代理便递归连接自身并耗尽临时端口。原生Node强制复用该端口可重现两次自循环，在第二次主动截断，未造成资源耗尽。该风险符合本次日志表现；原CI未记录实际分配的端口，不能声称已直接观测到那次自循环。证据proxy-test-port-reuse-repro.log。

仅调整server/api-proxy.test.mjs中这一个测试：先绑定前端，再占用不同的临时后端端口，核验不等后释放后端，保留原真实502/不重试断言，并将该负向测试的代理超时限定100ms。生产代理代码/端口/配置、业务行为、权限、数据库均不变；不跳过测试。

复验：Node25本机7项通过；独立Linux Node22.23.5容器在无外网、无DB/模型环境连续20轮，每轮7项均通过。证据proxy-port-fix-unit.log、proxy-port-fix-linux.log。

## 生产复验与状态接口修补

5f0161b经44678326149成功配对发布为hub-runtime-5f0161b0-44678326149001；升级/回滚演练、真实浏览器冒烟和健康检查通过，旧服务、历史任务未变，数据库迁移0。只读44678685955在生产读取两份原PDF，验证SHA一致、中文标题/正文可读、真实1页、Node本地解析、非OCR；原两任务失败状态未变，对象写/数据库写/模型调用/导入执行均0。证据pdf-preflight-production.log。

Chrome只读复测发现GET /knowledge/ai-status?kbId在正确headers下仍400“请选择当前课题组”：该路由为兼容Hub全局状态未启用Study metadata，JWT principal因此没有研究字段。首次脚本怀疑所选库范围，原记录保留；补精确范围后仍400，确认接线缺陷。没有创建会话/任务或模型调用。

最小修补仅在Hub自有controller.status：有kbId时用原生header解析器取group/project，复制principal传给原status/evidence；原生withCurrentKnowledgeRead仍核当前账号/成员/研究/KB可见性，再核AI用途。不改原principal、角色、authVersion、无scope Hub状态、写路由、权限或core。5项Controller先红后绿；精确源72项回归通过；专用合成PG＋真实Nest HTTP＋原生StudyGroupGuard，两账号正向、伪造project403、缺header400、global200均通过，持久写/Provider0。证据status-scope-red.log、status-scope-green.log、status-scope-exact-regression.log、status-scope-http-native-pg.log。状态修补仍待复核/发布/真实浏览器复验。

## 最终生产回执（2026-11-20）

上述状态修补经独立复核后随6e6ffbaa6155866a36a515ddc9ee69d5d082a43e发布；44679992177成功，准确配对tag=hub-runtime-6e6ffbaa-44679992177001，上传最终manifest SHA256=2160afaa36624aab3937b2b7004dae6252521fb9a61c61cf882fc61f11cdce65。此回执更新上一节待发布状态；没有数据库迁移。

两原账号真实Chrome1440×1000复验通过：已授权原库状态200/enabled=false/尚未开放问答，新具名私有库200/enabled=true/canStart=true；页面保留原Shell与页签布局，脚本异常0。截图admin-postfix-final.png、owner-postfix-final.png和录屏video/postfix-readonly保留。只读脚本阻止了admin默认新库一次会话初始化请求；没有据此声称页面不会请求会话，实际AI会话/问答任务/Provider写入0。最初脚本漏docId导致无效深链接，及将这次被拦初始化误作失败的记录均保留，修正测试后通过；未更改页面来迎合脚本。

44680156763最终只读核对：paidEnabled=true、workerKinds仅knowledge-chat/knowledge-import，后者仍只认领原2ID；历史623条hash735bdccbbc401c67285f0dd9714a2bed及chatBudget与激活后快照完全一致，2会话/2任务/2真实请求、费用上界54540微元，模型新增0、原2条PDF失败/docId=null。旧服务保持，未自动重排/对账。证据status-scope-final-inspect.json、readonly-browser-postfix.json、status-scope-release-receipt.json。

存储及状态修补已在目标环境复验；PDF真正导入、已审核资料真实问答/固定版引用/撤回恢复和专业签收仍未完成。下一步只提交k01-two-import-retry-proposal的准确两笔修复确认，未批准前不重新入队。

独立总评保留未关闭问题：owner浏览器实际GET /api/knowledge/docs/ee2531ba-4f56-4ffb-90e6-95aa6ba83cba/source返回500，不能宣称整页无HTTP错误或全部历史原件可读。该历史原件不属于本轮两份新PDF，未改历史资料；来源/错误原因待另行只读核清，不能据此否定已单独通过的两份准确原件预检。auth/me的401发生于登录前，另行区分。
