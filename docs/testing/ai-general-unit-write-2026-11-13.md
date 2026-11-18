# 带单位一般表格 · 真实写入验收

2026-11-13。用户已批准[最小范围](../planning/qiyan-ai-file-data-2026-11-12/authorization-general-tabular-write.md)，W01–W06本机技术闭环完成。原两账号各一份CSV/XLSX、各一次页面确认，实际持久写入4份固定CRF，0Provider。原P05/其他研究、角色、旧授权与账本保持。本机验证不是用户专业签收或正式部署。

## 范围与实际准备

新Study `rh-study-11832fe2-f2ba-4657-a3dc-5eb8b42d9864`，标题“GENERAL-UNIT-20261113 合成单位验收”；真实管理员经现有研究创建接口建立。仅新Study安装weight/kg与completed固定Form、单BASELINE及明确合成N/A政策。没有调用正式审批接口、不冒充临床批准。

先真实回滚演练，再具名事务准备4Subject/4独立Enrollment/4Visit，随后页面实际写入4FormResponse及4Revision；每份revision为1，未锁定。复用原SubjectsService、Participation与Enrollment能力，非页面导入自动创建访视。owner增加新Study的researcher关联供原生读取校验，沿既有组角色，不另创“只读角色”；单独grant为profile.create/visit.import/result.read，到期2026-11-20T07:36:52.684Z，不续期。其他普通研究操作规则不改；admin沿当前租户管理员身份。仅两个新来源会话能选择该目标，应用入口仅允许本人两条固定代码的访视导入，拒绝profile模式和额外被试代码，不把准备能力变成无限新建入口。

4条来源关系固定本人原件SHA、工作表/物理行、导入计划与答卷revision：原0g/2500g实际写成0kg/2.5kg，false/true保持；S09显示“体重（kg）”与2.5。程序概览每账号最大2.5kg、均值1.25kg、零值1、是1/否1。准备访视不等于完成访视，完成访视数实际0；未评估项没有冒称通过。未调用审批、锁库、共享、发布或导出接口，无DDL、Token或充值操作。

## 已有证据

证据目录`.tmp/ai-file-data-2026-11-12/general-unit/`；短日志在`.tmp/`，不上传运行凭证/DSN/Cookie。

- `p06-unit-scope-red.log`→`scope-order-green.log`：来源、对象上限、跨账号、无额外profile写入、配置JSON键顺序不改变账号判定。
- `p06-unit-baseline.log`：旧P05角色/grant/4例全部记录、旧上传原件元数据及原152笔预留逐条固定指纹。准备后再次读取相同，原件仅读。
- `p06-unit-setup.log`保留回滚失败：grant对象登记的audit.target误用scopeKey，被原DB `DATA_IMPORT_AUDIT_REQUIRED`拒绝，整笔准备回滚；仅新研究壳已按原key建成，不重复创建。改为真实grantId后`p06-unit-setup-green.log`演练/持久准备通过，未修改守门/旧表或删失败。
- `p06-unit-native-write-red.log`发现原概览丢单位；`p06-unit-native-write-green.log`22项包括双账号真实app native写入0/2.5与false/true、固定修订、程序最大2.5kg及原key重复返回；演练数据全部回滚。单位仅在明确存在时加入投影，旧无单位hash及原P05读取仍通过。

## 一次独评与集中修补

唯一general_unit_write_review为0Critical/2Important/1Minor，作者已集中修补并回归，无第二次复签：新配置与安装时可信fixture_run登记完整匹配；setup先查已登记Study再恢复配置，丢checkpoint不另建Study；新配置失效不污染旧P05。应用账号读取wp01_meta真实42501，未增权限，使用仅指向合成库的受控只读登记读取。原生提交仍在原事务内校验当前授权、真实父对象与版本。

review-registry-red→green、review-recovery-green（恢复0次Study创建）、review-serial-final（9/9）保留集中修补证据。新scope实际接受后，protected-accepted-pg最终3/3只读核对已持久记录，不重复故障注入/改写；core-final为49/49，reviewed-frontend为当期691/691，隔离构建5.14秒，已有大chunk提示未扩大处理。旧无unit投影/hash兼容通过。

## 真实浏览器与最终保全

browser/result.json与PNG/WebM记录两账号有效/负例各一文件、有效各一次UI确认。owner异维度被DATA_IMPORT_UNIT_REQUIRED拒绝，admin非法数值被DATA_IMPORT_INVALID_ROWS拒绝。admin真实成功响应被模拟503丢失后，通过原GET回执恢复，没有重复提交；原版本/hash幂等返回同结果，刷新无再POST，跨账号私有来源/导入拒绝。

实际HTTP正常200→新配置漂移403→旧P05仍200→恢复200；live-scope-guard.json保留证据。final-facts.json与baseline.json强只读逐条证明4Subject/4Enrollment/4Visit/4Response/4Revision及4条来源，旧4例、角色/grant、旧上传原件及原152笔预留指纹一致；final-facts-final、baseline-final-verified日志均通过。旧P05/P06兼容16HTTP/13视图通过，无业务写入/模型。

readback-1794582727043及readback-1794582915324为两账号1440/1280/1024/768/390/320及Chrome原生200%共13视图，无pageerror、业务写入或模型调用，字号14/22与页面宽度守门通过。原生200%截图在Playwright取图时仍有视口裁切（补fullPage也未解决），仅采用该项DOM/缩放指标证据，不宣称该截图视觉验收通过；正常缩放六宽及实际固定S09截图已核对。原窄屏AI工作区布局未重新设计，不能将宽度/字号检查宣称为全页UE验收。

本轮自有装载停止/启动一次，随后观察其他会话重叠重载；连接中断保留，不据此重放提交。目标scope守门、旧兼容与只读浏览器均重新验证，不将瞬时PID当持续服务保证，不再重载共享环境；原完整Study模拟工厂与其他挂载保持。全部工程证据仅在上述.tmp目录及短日志，不上传凭证/DSN/Cookie。

## 用户回看与后续边界

登录对应账号后打开[owner资料会话](http://127.0.0.1:19501/pages/ai01/?sessionId=cmwevnq180005lu2arv5lqab9)或[admin资料会话](http://127.0.0.1:19501/pages/ai01/?sessionId=cmwevnzrb000dlu2a2qm8k5ao)，展开数据概览核对kg与0/false，再从导入结果进入固定记录。现有成功结果直接查看，不为验收再次上传或创建对象。

本轮不代表全类型表格、全Study质量工作台或专业/生产签收完成。歧义字段仍拒绝猜测；原位映射确认如需建设另列最小交互范围，不自动改既有布局。正式写入不可用/失败保留原任务、文件与回执，不自动重传或补对象。
