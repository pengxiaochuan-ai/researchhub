# H01论文去重与广义纳入 · 本机技术验证

日期：2026-11-10。[规格](../product/h01-publication-count-2026-11-10.md) · [逐篇证据清单](../product/h01-publication-intake-2026-11-10.md) · [计划](../planning/h01-publication-count-2026-11-10.md)。仅专用合成库、本机独立服务；无临床数据、旧系统变更、角色/权利新增、模型调用、外网采集或发布。

## 实际业务结果

当前公开来源13条，DOI均有且不同。按用户确认的广义规则和当前版本原文证据，实时投影9篇纳入、2项待核验、2篇不满足主要主题门槛。类型为综述3、人体临床1、动物机制2、系统综述1、病例1、计量1。动物/病例/计量不会冒充人体试验或疗效证据。

待核验的纤维肌痛病例及偏头痛方案都有明确情绪/睡眠次要观察，并非只有背景提及；次要结局能否构成领域纳入仍需用户/专业管理员确认。干燥综合征与战伤综合康复按整篇主要研究问题不纳入本指标，但原文保留、E01仍13条，未改变展示/AI用途审核。全局scope_version仍草稿；本轮是用户确认规则下的工程初筛，不假造管理员逐篇审核或教授签认。

## 自动测试

- `red-contract.log`：旧HTTP value=null!=9、旧论文卡缺少待核验状态先RED。`red-identity.log`：新模块尚不存在。
- `targeted-tests.log`：9项身份/组件/真实PG通过。覆盖DOI前缀与大小写、精确DOI/PMCID跨源别名与来源保留、同标识冲突/题名/年份冲突、无标识、不同DOI更正不合并、当前版本/内容/证据字段、未知/私有/待核验和互斥判定。
- 独立总评发现同DOI但多个PMCID未拒绝：`red-pmc-conflict.log`记录value=1!=0；加PMCID冲突守门后回归通过。独立评审6项复跑通过且当前13篇证据逐字匹配，最终无剩余阻断项。
- 真实PG当前9/2/2、类型分组、public→tenant/withheld→恢复、新内容hash/版本及摘要字段失效、跨租户拒绝、另一个新具名回滚run混入旧pilot导致21条/重复PMCID时null守门，全部强制回滚。首次容量夹具同run重复被数据库唯一约束拒绝，已按真实约束改为新run的数据漂移测试，不删约束/扩权限。无持久采集请求、来源或审核变更。
- `backend-tests.log`：29项Hub/目录读模型/论文分类筛选（含PG）通过。`http-tests.log`：3项真实接口通过，匿名/owner/admin均9，其他四项仍2/3/3/3。
- 全前端回归`frontend-tests.log`及`frontend-final-tests.log`：308项，307通过，1项`tests/article-ai-ui.test.mjs:39`失败，期望textarea包含“第一行\\n第二行”。单独复跑`article-ui-diagnostic.log`仍失败；本轮未修改该文章问答模块/测试，不擅自扩修或宣称全绿。
- `build.log`：构建通过，既有大chunk警告保留，不宣称零警告。

## 目标运行时与真实请求

本机首次观察到6条排队记录，进一步核对实际状态为queued且无worker/租约，不是processing；正式重载前快照已有8条（同目录其他工作仍在进行）。本机Queue未注册自动历史resume。使用owned控制脚本仅重载本机独立服务，保留排队记录，未排空/取消/认领。

验证中另一次服务重启导致`api-verification.log`连接中断，已保留失败日志；当前服务重新运行`api-verification-final.log`通过。`before-runtime.json`及`api-verification.json`确认原8条排队记录状态/时间/租约完全不变，全部PMC版本/文章审核指纹和原3团队档案/草稿/审核指纹不变。实际API返回9/2/2且三身份一致，E01来源目录仍13。业务写0（除签发/退出既有合成认证会话）、模型调用0，不新增额度或充值。

## 真实浏览器

CUA内Playwright直接访问现有前端：科研人员刷新后看到9篇和“规则纳入·待核验2项”；原临床2项、指南标准3、机构/研究者档案各3不变。进入既有研究论文导航核对完整来源目录后返回；匿名与管理员同口径。布局沿用五卡，`before-stable-layout.json`对`after-layout.json`的x/y/width/height最大差0；数字28px、说明14px不变。

实际视口1421×1419、1280×901及389×1260留图，1280/389卡片及说明内部无横向溢出。手机根390/视口389既有1px不扩修；不冒称真实320px或原生200%缩放已测。页面错误/加载/0/未知的组件契约保持；网络503/超时和迟到多次重试的本轮浏览器故障注入未新增。当前技术执行不代替用户逐篇专业签认或生产发布。

证据目录：`docs/testing/evidence/h01-publication-count-2026-11-10/`。重跑本轮实际请求使用`node scripts/h01-publication-count-api.mjs before`（只读快照）及`node scripts/h01-publication-count-api.mjs`（认证/只读业务验证）；旧H01统计轮次日志保留历史值，不覆写。
