# 四访视整课题模拟 · 实施与运行契约

日期：2026-11-13；仅针对已登记的合成模拟 Study。产品范围见 `docs/product/real-study-full-simulation-2026-11-13.md`。普通研究、旧T15 v1契约及旧系统源码不改。

## 组成和可信边界

`scripts/local-full-study-simulation.mjs` 是受 fixture guard 约束的本机装配，先校验目标库、租户及本轮 synthetic fixture marker。目标清单仅来自私有部署文件；产品 `server/research-simulation/admission.mjs` 不读文件或fixture，逐请求按精确scope/actor/audit ID验证登记内容/hash。普通scope不读取登记。未登记、待批准或撤批明确未就绪，不能回退普通执行。

`createSimulationProtocolAdapter`、`createSimulationCaptureAdapter` 和 Word renderer 使用私有 CommonJS 依赖图。保留原授权、版本、收据和来源校验；不修改旧系统文件、require全局缓存或导出。`form_score` 仅允许本轮case登记的三项OutcomeDefinition版本、总分变量、固定问卷及物理访视映射，其余未知来源继续拒绝。实际协议内容、政策、表单schema/scoring哈希参与当前来源复核。

## 人群、时钟与采集

单方案5个物理计划映射4逻辑时点；6人18访视。typed `populationSchedule` 和 `simulation` 纳入原政策审核/hash。只有可信case的既定6个被试及arm可以使用模拟执行代理。入组筛选适用计划；仅入组/访视域日期使用逻辑时间，认证、审计、修订createdAt均保留真实时钟。

`GET /api/research-studies/:id/simulation/context` 返回 `{studyId,simulation}`。普通研究为null，模拟未就绪有明确reason。`POST .../simulation/advance` 仅接受 `{requestKey,expectedStage}`；当前租户管理员、固定方案/计划与当前适用访视完成依据全部复核后，按0→14→28→56顺序追加Audit，不能传任意日期。

现场/CSV/H5原writer的收据优先，随后新增阶段守门；原key跨阶段读取原结果，异body同key冲突。H5会话和历史读取保持阶段中立。旧访视更正仍走原授权、解锁、版本修订、独立审阅/锁定、完成依据重核链，不改原完成日期。文件上传在原publication内收据核对后守门；权限/未就绪/阶段错误转为原HttpException以触发暂存对象清理。

访视读预览使用原 `refreshSystemVisitRequirements` 和原reader，在阻写代理内仅计算候选履约；真实DB upsert为0。普通/已完成访视保留原投影，实际完成仍执行原刷新和全部校验，不能用预览替代完成记录。

## v2分析和报告

`analysis/configuration` 显式分派v1/v2。新schema为 `full-study-simulation-v2`，根快照为 `full-study-simulation-root-v2`，子快照为 `full-study-simulation-slice-v2`。旧Methods只收到真实子快照，一片一个变量、受试者唯一有效行，执行原 `descriptive-v1` Python Worker；不生成虚拟MethodRun根。

计划提交/审批/preview/snapshot复用 `/analysis/plans` 契约。运行创建使用 `{requestKey,snapshotId}`；显式 `POST /analysis/runs/:runGroupId/process` 使用 `{requestKey,expectedStateHash,limit:1}`。GET无派发副作用；持久claim、actor/authVersion、幂等收据和状态CAS阻止并发或盲重试。未闭claim明确阻断。取消先在原事务内调用原Methods授权/行锁校验，再写group取消记录，不能先落取消后收到403。

54个适用/不适用切片按变量独立分母；本固定生成器预期39个非空实际执行。PHQ功能题不计分，0有效；Fang/HAMD只有 `scoreComplete=true && processingStatus=scored` 才有完整总分，NA/特殊9/待复核/漏答保留原因。配对变化固定为后续减基线并保存两端引用。无有效数据不调用Worker，N=1样本标准差不可估计。

报告创建使用 `{requestKey,runGroupId,title?}`，顶层返回runGroupId/snapshotId，不冒充单run。全部非空片均经真实Methods审核确认后，才可进入原Artifact固定版本、独立报告审核、发布、export claim、Word渲染、私有存储SHA读回及fresh download。报告审核人只需对应artifact权限；内部export来源复核允许当前 `artifact.read`，普通分析snapshot/dispatch/publish仍要求 `data.analyze`。HTTP不接受切换内部phase。

待审分组结果也显示实际算子摘要；仅needs_review/completed状态且study/snapshot/manifest/数值证据一致时复制单列原值，不改变确认状态。N=1使用原Worker的single_observation与SD=null。Methods-only权限403不等于analysis只读权失效：仅该明确错误重核当前configuration后允许只读结果、三个操作能力全部false；401/其他错误仍抛，命令执行不走此降级分支。

并发原生审核引起的精确409 `METHOD_RUN_CHANGED` 只触发受保护事务内重新读取当前group/来源并返回无动作元数据；当前来源失效仍抛，不吞其他409。前端已知来源失效保留有权配置/计划并提供重新预览，旧运行不会自动绑定新来源；401/403/404和未知409仍关闭操作。最新对象默认按createdAt排序，显式选择保留。

本轮v2分析/报告客户端显式使用600000ms，shared默认及普通报告/H5保持20000ms；身份失效立即abort，未知写结果沿原key核对，不因加长等待自动重发。真实manager读取有结果但无三个动作，取消他人403且无cancel audit；报告reviewer公开snapshot传phase=export仍403，见analysis-reader-capability-result.json。

验收CLI另遇Node25.9.0/内置Undici7.24.4的300秒headersTimeout；更长AbortSignal不能覆盖该传输上限。两轮真实bulk审核的原生子事务均继续提交，按相同原请求键/commandHash/reviewer/reviewId/version逐条证明后只恢复本地journal，未重发审核或改DB。本轮工具仅对timeoutMs>300000改用独立node:http长请求，限定127.0.0.1、总截止最多600秒、不重试/跟随重定向；六项真实短延迟HTTP测试与目标环境只读GET另留证。该工具修复不等于已消除产品批量审核延迟。

真实profile发现一次投影重复5328次读取。`full-study-authorization-reads` 只在单次project持原tenant授权锁后，对六类授权模型精确参数复用并深克隆结果；失败清除、该模型写入清缓存。来源/访视/表单/修订/政策/质量与所有SQL/行锁都不缓存，不跨请求/事务。实际单根5.351→3.550秒、3065查询，根hash及来源读取/锁计数不变；API逐片总时延仍另测，不将33.7%的单根改善冒称完整工作流改善。

本机模拟邮件由case前缀限定的 `@example.test` 收件人进入既有127.0.0.1:19506 SMTP测试箱，使用其原捕获协议并读回UUID/digest后才记accepted。其他Study保持原邮件渠道。本轮不外发真实邮件。

## 数据库和验证

增量只替换 `rh_analysis.parents()`；旧v1分支、owner/ACL/RLS、表和旧SQL原件保留。候选及回滚位于本轮planning目录，必须经目标库guard、当前完整函数指纹和原prosrc双fence，禁止启动时自动DDL。已实际先回滚演练再应用，旧v1正/反例及v2缺case拒绝有证。已有v2数据时回滚候选拒绝，不删除历史强行回滚。

定向单元、旧采集/报告回归、真实PG/API/Worker、科研/管理/H5 Chrome截图WebM、独立Python oracle及应用Word视觉核对分别留在本轮testing evidence。代码、环境、实际执行、业务签认四层独立；用户未签认前不称整课题业务验收通过。该合成模拟不代表临床规则、真实样本量、多模态模型或生产已验收。

## 本轮实际交付

同一Study两轮各39个独立真实run，ID无交集；新版2042项输出、48修订1578项源核对均0差异，只有预期四个PHQ切片变、全部分母不变。两个Artifact分别保留固定version1；更正使旧来源/导出/下载409，新报告独立审核发布后导出22581字节Word，SHA e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7。私有存储读回、API fresh download与Chrome实际下载相等，原Word不修改；离线28页、368单元、64配对端点、84完整hash核验通过。

新版38个显式process加1个create共39个200写请求，原bulk审核无HTTP响应事实与39个原生审核收据并存；恢复阶段未再次POST bulk review。逐片耗时35.967–53.335秒、中位45.418秒，完整链性能未验收。对应证据为analysis-corrected-request-chain.json、report-corrected/review-client-recovery.json和word-corrected/qa.json。

S10只对已验证report.runGroupId使用专用切分，按最后一个精确整行“可复核来源”边界把主结果放回原正文容器、来源保留原details；body+appendix逐字回拼原文。旧split/Shell/CSS/导航及报告内容/hash/Word不改。最终桌面1440、390、原生Chrome200%和已有Word下载复验通过，见ui/report-body-18fd82ab；最终35唯一测试文件219项全通过，构建4.59秒。

## 用户业务签认

用户已针对更正后Word及本次完整合成模拟范围回复“核对通过”，于2026-11-13北京时间22:37:39记录至user-business-acceptance.json。四层验收的业务结果层现为accepted_by_user；当前会话用户不被推定为真实PI或临床签署人。本次只更新台账与文档，原Word、技术结果、QA及冻结期望不改，未重算/导出或写业务数据库。性能、真实临床/生产和融合模型效度仍未验收。
