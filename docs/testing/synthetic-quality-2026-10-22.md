# 合成试运行与质控：本机技术验证

范围：用户批准的本人本轮合成派生数据，原两个账号/租户/研究，当前目录串行。本机19501–19505、专用wp01合成库；不接临床，不改旧源/服务，不发布，不扩大审批/锁库/导出权限。专业效果待用户验收。

## 交付与四层结论

- 代码：Q01真实方案分支的创建/列表/详情、seed生成、当前授权/来源/方案版本及执行CAS、问题定位、白名单人工修订/原因、新快照复跑已实现。94项契约测试、828项既有已编译内核、原Python4项通过，ResearchHub构建通过。旧编译内核回归不替代新适配的PG/API实测。
- 本机启用：仅本机合成租户feature与原owner/admin指定DQ Skill；授权初始化审计仅一次，重启不恢复已撤销项。原角色菜单/按钮不变；自有原Python子进程回环19505/随机Token，不连接旧计算服务。
- 真实执行：原TS assembleQualityManifest→executeDeterministicDataQuality/ResearchMethodWorkerClient→原Python research-data-quality→原数值策略/mapper/评价纯函数实际执行；有真实请求、manifest指纹、时间、HTTP状态和结果，不是Mock或模型写数值。只处理存于原ResearchMethodRun的本人派生快照；没有调用全Study的完整ResearchMethodsService，也没有写Study放行门禁。
- 业务：两原账号各8项真实Chrome“已保存方案→生成→五类问题→定位→人工修订→新版本复跑→刷新/历史恢复”通过；用户专业验收仍待进行。软件夹具不是临床受试者、正式访视、获准量表、纳排规则、样本量/疗效统计或正式研究放行。

## 证据与复现

证据统一在根目录 `docs/test/evidence/2026-10-22-researchhub-synthetic-quality/`，不修改既有冻结目录。测试新增夹具均具名，未删除历史或重建数据库。

- `contracts-red.log`/`contracts-green.log`：4项生成/编辑/绑定纯契约RED→GREEN；直接执行原TS/Python，五类预埋问题为MISSING_RATE_WARNING、RANGE_ABOVE_MAX、LEAKAGE_MULTI_GROUP、TIME_ORDER_BLOCKING、DUPLICATE_KEY。
- `runtime-red.log`/`runtime-green.log`：固定19505内部执行URL和原四项启动保护；`client-red.log`、`regression-final.log`：前端严格路由/编辑表单及完整相关94项。
- `api-02772ff6/result.json`：真实PG/API13项。创建/幂等冲突、严格字段/伪造scope、跨账号/只读/未邀请403、无审批/锁库/发布/导出路由、白名单编辑/最新版本409、旧快照保全与分页。
- `browser-owner-89aee491/`、`browser-admin-580543e7/`：各8项真实Chrome主链/截图/录屏/网络；实测操作14/22、长说明16/28；旧输入不变，六处人工修正后五类预埋问题均消失，其他真实限制/提示保留。不把“这些问题消失”称作临床质控通过。
- `boundaries-*/result.json`：实际并发修订只允许一项提交；在真实算子请求已发出后暂停仅本轮自有Worker，变更本轮具名方案/Skill/来源，恢复Worker后拒绝提交数值结果。暂撤Skill按共同锁仅恢复同一原授权；不动其他账号权限。源码/服务与历史不在此暂停范围内。
- 边界夹具通过公开知识/会话/建草稿接口创建，再由guarded合成事务追加明确标识的软件测试版本，复用先前已验证PICO/正文。仅为栅栏测试输入，不伪称重新执行AI或人工专业确认；两角色实际主链仍使用原已确认/保存方案。
- 边界脚本的503/409页面反馈是明确标注的浏览器注入，仅证明保输入/错误焦点；真实409另由并发提交验证，不能据注入宣称计算服务实际故障。真实Chrome设置200%，dpr=2、visualViewport.scale=1，页面无横向溢出，宽表内部滚动，截图与录屏保留。
- `restart-bab6e2ca/`：5项自有停启恢复；撤销owner Skill后重启仍403/不重新授权，显式恢复同一授权后两账号数据/结果/选中版本可读，viewer/uninvited仍拒绝。不是生产排空/旧服务停线。服务留常驻体验，不是开机自启。
- `kernel-regression-correct-cwd.log`：在app/server按既有主测试列表运行828项；不重建旧dist。`python-regression.log`：原DQ4项。`build-final-current.log`：仅Hub最终构建，既有大chunk提醒保留。
- `preservation.json`：691份旧源/配置哈希、8个旧PID/启动身份、11类其他租户历史count/digest、600份既有冻结证据条目不变；原角色权限不变，只有两个具名Skill授权；未创建Subject/ScaleResult/Study放行门禁。`operator-traces/`只复制本片实际执行轨迹，无密码/Token。

## 实测修正与限制

浏览器先失败再修复：折叠表目标定位未展开→展开祖先details并滚动聚焦；错误摘要渲染前聚焦无效→渲染后聚焦；子模块403清空后丢失原因→父组件同步显示真实错误。均保留失败截图/录屏，不用“最终全绿”抹除过程。

视觉复核发现通用Card规则使新长说明仍为12/22；先加真实字体断言复现，再仅在本片局部纠正为16/28、一般状态14/22，元信息12/18保留，不更改全局字号或旧页面。再次通过两个账号主链与当前200%验证。

一次浏览器状态选择器误选隐藏历史按钮，已改为role=status；一次旧内核全dist探索命令在根cwd运行导致相对源码ENOENT，日志保留，不改旧测试/源码，改用app/server既有主测试列表后828通过。未宣称所有仓库测试均通过。一次保全检查与暂撤授权演练重叠，预期被拒绝，待授权恢复后重新检查通过；不以扩大授权绕过。

本片新增模型请求0次/费用0元，原账本完整保留27次、保守¥0.468522/¥5，包括此前失败调用；不充值/自动续额，报价门禁未延长。未来实际统计、CRF/量表配置、正式采集、审批/锁库/发布/导出、全科研Agent编排与生产接入仍按原范围另行实施/确认。

仅实现者自检与当前目标环境技术验证，不冒充独立总评审或专业验收。无新重大选型、表/DDL或生产部署。
