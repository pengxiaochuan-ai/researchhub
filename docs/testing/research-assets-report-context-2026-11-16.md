# 方法报告资产上下文：本机技术交接

2026-11-16｜RC01～RC05获批范围，本机专用合成环境。S10实际方法报告→正式资产→G02提交/退回/批准→A01/A02查看已执行；用户专业签收、任意Study通用准入与正式部署未代验。无模型调用、新费用、临床、远端配置、云或旧系统修改。

[实施规格与授权](../product/research-assets-report-context-2026-11-16.md) · [API与自有约束](../technical/research-assets-report-context-api-2026-11-16.md) · [原始证据目录](../planning/research-assets-product-2026-11-12/evidence/report-context-20261116/)

## 可体验对象与结果

用原admin账号，从《通用合成研究更正后描述统计报告》固定v1的“来源与后续操作”进入。新资产仍归来源Study，不放进旧Study槽位，也不改变原报告审核/发布。

- [原报告S10](http://127.0.0.1:19501/pages/s10/?formalReports=1&studyId=rh-study-72203d59-4db8-4e74-9444-edff3b088b6d&artifactId=rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe)
- [G02同对象审核](http://127.0.0.1:19501/pages/g02/?view=asset-review&studyId=rh-study-72203d59-4db8-4e74-9444-edff3b088b6d&studyGroupId=rh-kb-local-b0e2af9d-group&researchProjectId=cmwczp5hk0003lud9lsla5b75)
- [A01本研究资产](http://127.0.0.1:19501/pages/a01/?studyGroupId=rh-kb-local-b0e2af9d-group&researchProjectId=cmwczp5hk0003lud9lsla5b75&selectedAssetId=rh-report-asset-20261116-admin&selectedVersion=2)
- [A02固定第2版](http://127.0.0.1:19501/pages/a02/?researchAssetId=rh-report-asset-20261116-admin&assetCatalog=1&assetVersion=2&studyGroupId=rh-kb-local-b0e2af9d-group&researchProjectId=cmwczp5hk0003lud9lsla5b75&assetReturnTo=%2Fpages%2Fa01%2F)

当前唯一新增资产`rh-report-asset-20261116-admin`，2内容版、revision6，approved/unreleased；6成功事件：创建→提交→退回→说明修订→提交→批准。上限仍1份/2版/12事件；未为继续测试重复提交、重置状态或另造正向资产。owner对该来源与新资产均拒绝，不新增成员或权限。

## 四层证据

| 层 | 本轮实际证据及限度 |
| --- | --- |
| 代码 | 184相关后端/778当次全量前端测试通过，最终构建4.94秒；纯测试只能证明代码契约 |
| 本机配置启用 | D03与D03-scope分别预测/回滚、精确应用并保留不可变回执；原app角色核验。新来源装配经本任务两次owned加载及后续与治理读取合并一次加载，后者由治理任务唯一执行；本任务独立核对最终PID22519与19501～19507监听 |
| 真实执行 | 原admin实际S10来源读取、四阶段6次业务POST、同原键GET查回及G02/A01/A02读取；独立真实HTTP负验、实际注销200/401后释放原200不显示；非Mock替代 |
| 业务产物 | 页面显示同一来源Study、固定报告、资产v2与审核理由；原报告hash不改、批准后私有未发布。此处为合成科研流程技术结果，用户对科研使用价值与正式产品的专业签收另列 |

## 真实PG、约束及保护

`source-native-pg.json`调用原T17来源链（同一事务中的真实Study、方法人工确认、快照与原报告完整性）。`pg-rollback.json`、`pg-rollback-revise.json`、`pg-rollback-approve.json`为三个真实app-role回滚测试；没有持久修改旧报告来伪造来源失效。单元依赖注入的来源失效例不冒称真实运行时撤回。

两项只改rh_asset自有必要守门：精确新project＋原admin＋单一新assetId，正文固定来源、最多2版/12事件；保留旧分支，不改public定义、原RLS/GRANT/角色或共享启动源码。不可变迁移模块及预测/apply receipt见代码与本机原件；已应用源文件不能改写后重算基线。

`protection-before.json`/`protection-after.json`核对原报告（含版/来源/审核/文件）、旧26目录＋4B草稿、旧资产事实、既有角色/只读族、两份共享启动入口及费用账本不变。当前新registry符合v2、approved/unreleased及事件上限。新模型/费用均0。

## 浏览器与HTTP

| 检查 | 结果/原件 |
| --- | --- |
| 真实创建及丢响应 | `live-create.json`：后台原生201，浏览器改503，先GET原键查回；只有1创建POST，无重复对象 |
| 真实G02退回 | `live-return.json`：提交与退回实际保存；保留原失败登录返回原件，修复安全return契约后执行成功 |
| 真实说明修订 | `live-revise.json`：生成v2，源报告/资产正文hash不变 |
| 真实提交及批准 | `live-approve.json`：3项核对含自审事实，当前v2/revision6/私有未发布 |
| A01/A02只读 | `live-readonly.json`：题名、当前版本、原报告回链与审核理由实际可见；0业务POST |
| 当前权限/防重 | `negative-http.json`：owner来源/详情403、错project403、错Origin403、同键回放原receipt、异输入409、第三版409、普通登记/修订与发布403；无新成功事件 |
| 503输入及原提交恢复 | `ui-faults.json`：真实页面正常后台轮询注入503，临时隐藏私有区，恢复保输入；在途结果未知先GET原键，再明确使用同body/key重试。为了不覆盖已批准v2，预览existing为空及POST/receipt是受控注入；所有业务POST在浏览器截断，不能算第二轮真实资产写入 |
| 真实身份及迟到回包 | `readonly-browser-final.json`：实际GET来源200先挂起，同一真实会话由另一个登录页注销200；原页收到真实auth/me401，再释放200，无按钮/弹窗/私有来源复活；owner真实登录同来源拒绝 |
| 布局/键盘 | 同文件：S10/G02/A02分别1440与1280截图；S10实际计算操作字号14px、行高22px，桌面无额外横向溢出。`ui-faults.json`含Esc关闭后重开输入。原Shell/卡片顺序/七Tab/右栏保持，只增加获批原区域动作及同对象治理视图 |

证据目录每阶段都有真实Chrome录屏。**视觉留项**：1280宽度下，原A02外层500px侧栏叠加预览内240～280px元信息列，使长报告正文阅读列偏窄（实际截图可见）。没有横向溢出不等于长文阅读体验合格；不把这项宣称专业验收通过。遵守已确认母版约束，本轮未改CSS/列宽；需先提交A02预览区局部阅读优化方案取得用户确认。

截图已逐项检查：G02操作区留在原content容器，链接有既有间距；A02七Tab与审核理由在原变更列表内；S10动作仍在报告末尾来源操作行。实施前G02截图截于加载中，不用它冒充完整稳定像素基线。1280以下及原生200%不在本轮新验收范围，保留原Shell约束，不宣称已解决全站窄屏。

## 单次独立总评与修补

`independent-review.md`：Critical0/Important1/Minor0，36项纯测试通过。重要项是S10来源503使登记组件卸载/空身份，丢失输入及在途原body。集中修补：稳定页面钩子持有状态，暂时失败隐藏来源并禁用操作，保留同身份输入；真401/403/身份或来源范围变化清私有状态并丢弃迟到响应。没有停止当前授权轮询来规避问题，修补后受控Chrome与全量前端通过。未启动第二轮独评或修改已封存迁移。

## 失败原件与边界

初次RLS拒绝、20秒回滚探针超时、NAME截断指纹排序碰撞、真实运行装配500、登录返回白名单遗漏、A02审核理由缺失均保留日志/失败JSON。首次额外只读脚本错误假定logout=201，真实契约200；修正测试断言，原件`readonly-browser-final-attempt1-failure.json`保留。随后强化owner拒绝证据时错误等待列表403而超时：既有授权实际允许列表200、具名报告详情403；原件`readonly-browser-final-attempt3-failure.json`保留，不改权限来迎合测试。原owner截图截于正在核验身份，不能作为最终拒绝证据；独立新Chrome的`owner-browser-final.json`已明确捕获列表200/详情403，等待已判定错误区后再截图。`return-g02.png`旧截图可能仍显示异步重读前待审核，实际退回依据原生回执/后续修订；不用它证明最终badge。

共享窗口严格按解除后续跑；早先两次保护只读与另一个任务性能窗口重叠，时间区间见`shared-window-timing.json`，不称隔离性能基准。治理读取的性能/业务结论不作为本轮资产验收证据。

本轮不是全60项科研资产销项：S06/其他来源通用登记、Hub纳入、该新族共享/AI/派生/导出仍未开放；旧模块已有能力和前序付费额度保持，不能由本次批准推导新模型请求。下一步建议先确认A02长报告阅读区局部优化方案，改善真实报告可读性；随后再确认“已审核资产→AI检索与固定版引用”的最小规格、用途/撤销与验收样例，按明确授权开发。
