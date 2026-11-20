## 2026-11-21 · 5876c216同版发布完成

44765415412第二次执行成功，前后端同版hub-runtime-5876c216-44765415412002，配对成功指针已提交。首次在切换前因磁盘余量停止；仅清理已验证OSS可恢复的四份具名旧Hub安装包本地缓存后重跑，未降低磁盘门槛、不删除镜像/数据库或当前及上一回滚产物。一次性恢复清单在服务器ops/cache-recovery-20261120.json。当前没有新增自动清理策略，后续缓存留存作为部署维护待办，不能由本次四文件操作推导为无限清理许可。

CI浏览器步骤因下载Chromium依赖耗时约8分钟，最终完整通过；没有改跳过、自动取消或强制finalize。当前业务实测与剩余附件AI缺口见三项故障记录。

## 2026-11-20 · 精确区分运行依赖与手动数据库操作包

`deploy/backend-runtime-exclusions.json`列出21份手动安装、迁移候选和合成操作脚本。源码保留main/本机，运行镜像不携带这些准确路径。封包检查正式入口的Hub内部字面量模块导入依赖不得缺失；静态检查不代替真实启动。planner在excludedDatabasePaths留痕，实际运行SQL/prisma/未排除DDL仍要求原databaseApproved，不填造批准摘要、不执行迁移；数据库身份、marker、schema指纹守门不变。JS注释不作为SQL证据，真实字符串/模板中的DDL继续识别。既有databaseSources若只是历史注释误报，保留来源记录但不再次将纯代码修改误报为DDL。

# 前后端统一发布流水线

> 当前阶段：代码8f5aee0已进入main；GitHub演练44524167160及实际成对发布44525278754均成功，现运行hub-runtime-8f5aee04-44525278754001。数据库迁移仍独立确认。

范围来源：用户2026-11-19明确要求“按变更构建、使用同一版本发布；数据库迁移保留独立确认”。仅ResearchHub，不改旧aisci与官网、模型/邮件/后台任务启停和业务权限，不改页面布局。当前目录串行实施，独立总评。

## 最小实施规格

- main普通push只有一个生产发布入口；相对上一成功版本仅文档/测试差额时跳过生产发布；若仍有失败或skip-ci留下的运行代码，后续提交会补齐这些差额。手动支持预览计划/构建演练、整组发布和整组回退。旧前端单独发布、旧拆分激活入口退出生产路径。
- 变更识别以“上一成功发布所含实际源码”作基线，不能只比较本次push前一个commit；这样不会漏掉此前skip-ci或失败发布的变更。首次采用已验证hub-runtime-1e0d7087-44502950789及其固定manifest SHA作为种子。
- 页面/静态资源只建前端，server业务只建后端；共享src/依赖/资源或发布契约保守构建两端。未知运行文件保守构建两端；测试文件与文档不触发业务镜像构建。未变组件只能复用上一成功发布的受审归档，保留它真正的构建SHA，重新标记同一release tag，不冒称重新构建。
- 每份release manifest绑定一个发布Git SHA、前后端归档SHA与平台/config ID、各自真实源码SHA、core/hub摘要、基线和数据库源码摘要。私有core维持已核准摘要；后端Hub文件从本次干净Git快照重新生成，不使用旧私有包中的旧Hub代码。封存资源只允许固定地理资料白名单回退；缺失新资源明确失败。
- 复用现有GitHub Secrets、OSS私有前缀、云助手、单服务器和两个Hub Compose项目，不新建云资源。私有core不进入公开Git、GHA缓存、构建记录或日志。
- 涉及数据库模型、迁移、DDL/GRANT类文件的差额时停止自动发布，输出待确认摘要；只认经用户独立确认后由运维设置的准确数据库源码批准摘要。流水线不执行SQL迁移、GRANT、Prisma migrate，不自动更新批准摘要/运行时结构指纹，不触aisci。
- 新API和前端归档先校验、加载后核平台与canonical config ID。发布时仅Hub短暂切换：有后端变更时暂停Hub前端，替换独立API并验证，再启动同版前端；失败恢复上一成功版本的两组件，保留DB和.env.prod原有参数。旧系统/官网全程不重启。没有完备可回退基线或现场身份不符时先停，不接管未知状态。
- 同一发布锁覆盖构建/启用的工作流，服务器覆盖Hub两种原锁；以实际容器ID/镜像和上一成功manifest核对，成功且真实HTTP/业务只读验证后才更新“上一成功版本”私有指针。失败、回退失败和状态未知分别记录，不将部分成功写作发布完成。
- 全程历史Worker/付费AI/邮件仍关闭，六类历史任务状态与旧容器identity/image/status前后核对。配置唯一/srv/researchhub/ops/.env.prod；前端不注入DB/JWT/S3/SMTP秘密。

## 小步实施与验收

1. 变更分类/失败累计差额/数据库门禁测试，先红后绿。
2. 当前Git Hub装包+受审core复用，证明新后端文件与旧包不一致时确实纳入新包，core不变。
3. 按变更构建/复用并生成同版本manifest，记录真实源码来源；私有上传和旧种子兼容。
4. 独立合成环境验证配对升级、任一组件故障整组回退、中断/锁/过期基线、不自动迁移。
5. 独立总评后接main生产入口；用当前获准独立演示环境验证实际工作流与Chrome登录/目录读取，无模型/邮件/新业务写。不扩大样例和权限。
6. 产品基线、版本记录、操作手册与Notion同步；四层状态分别记录，不把演练等同生产执行。

## 实施细化

- 每次构建候选tag以run_id×1000＋run_attempt编码，重跑不覆盖旧候选。每个组件保留sourceGit、built/reusedFrom，模板和归档均从该版本manifest绑定的私有对象取回，不能用当前checkout模板代替历史模板。
- 成对发布会短暂暂停Hub前端并依次替换API和前端；即使只重建一端，部署仍使用一份成对版本。不承诺瞬时原子切换/零停机，不引入蓝绿基础设施。旧系统和官网始终不参与停止。
- pair-finalize仅在目标HTTP及浏览器验证后，在服务器双锁下写成功指针并回读，随后原子保存本机成功记录。OSS普通PutObject默认覆盖，未依赖未经确认的If-Match CAS；遵循现有串行发布锁和现场版本核对。[OSS官方PutObject契约](https://www.alibabacloud.com/help/en/oss/developer-reference/putobject)。
- finalize已经开始后若失败/取消或网络响应不明，不自动回退，保留成对运行和回执待核对；避免成功指针已推进后又退组件。可在服务器准确的`runtime-releases/<tag>/control-<sha前16>/`目录重验后执行`python3 pair.py pair-finalize --control-sha <完整sha>`，此操作重验版本/HTTP/基线，不触数据库迁移。不得用新run覆盖旧候选恢复。
- 数据库批准摘要覆盖非测试SQL、模型、已识别的DDL执行模块；仅扫描新增/变更模块及其旧版以识别嵌入DDL，保留databaseSources，避免全仓逐文件读取。Python注释不作为DDL，实际字符串仍检查；动态拼接需代码评审，扫描不是SQL解析器。新独立测试PG夹具仅脚本hub-release-rehearsal.py明确豁免，不放开其他SQL。
- 不执行自动GRANT/DDL、不写HUB_DATABASE_APPROVED_DIGEST。遇待确认摘要，先用户独立确认SQL和目标schema证据、人工执行及更新准确运行配置/策略后，运维才设置生产环境同名批准变量。原core摘要/适配源码及后端nodemailer依赖契约不允许在刷新Hub时静默改变，需另行封存/评审。

## 实际发布与日常使用

首次main release44525278754完成成对切换、公开浏览器和成功指针回读；额外owner/admin真实Chrome只读复验通过。普通main push自动执行本工作流，手动plan只核计划、rehearse只演练和封包，不切换服务器；rollback须准确历史tag/manifest SHA及ROLLBACK确认。数据库迁移仍人工独立确认，不因代码发布自动执行。

变更识别、原生构建、复用和整组故障回退已有真实演练证据；生产现场只验证了成功升级，未在生产故意注入故障。没有宣称生产回退事故已发生或所有科研能力可用。详情见对应验证记录。

## main普通push自动触发验证已通过

文档提交5f142ae51aaa0bb29510b948f3a1d5464aa0d00b实际触发push事件运行[44528390325](https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44528390325)，completed success。计划正确引用刚发布的hub-runtime-8f5aee04-44525278754001为基线，frontend=false/backend=false/databaseChanged=false/releaseRequired=false；构建、复用、封包、服务器apply、browser、finalize全部skipped，未产生新部署。由此证明main自动入口和文档独有差额跳过已实际生效。最终此条证据以`[skip ci]`文档归档，避免仅为记录验证重复触发工作流；运行镜像仍保持上述配对版本。
