# P05 Study与最小导入授权 · 准入验证

后续2026-11-13用户批准M01–M05，已实施本机首片；[实际入库与最终独审修补报告](ai-data-import-p05-2026-11-13.md)。本文只保留实施前准入证据，下方“待授权”不是当前阻断。

2026-11-13，状态：**准备与可审授权已完成，正式P05导入尚未启用**。本轮只读专用合成库/当前页面；未建新表、未授权、未改旧代码或装配P05接口、未写正式被试/访视、未调用模型。

## 已执行

- `node scripts/ai-research-data-p05-preflight.mjs`：真实aisci_app＋强制READ ONLY；最新`.tmp/ai-file-data-2026-11-12/p05-preflight-1794551812438/result.json`。锁定现有Study b3fa…f090的真实课题/执行项目父链、唯一executing v2/BASELINE、批准政策及已发布value/completed表单要求。AI01来源项目绑定0；来源与目标执行项目不同，不需新增Study或迁移来源。
- 直接运行原authorizeIngestInTransaction与authorizeFormalResponse（无业务写，仅观测当前返回）：owner两项403，admin两项通过。两账号active/authVersion5，admin是真实tenant_admin/isTenantAdmin=true；owner目标project_manager，角色缺data.upload/form.fill/subject.create。此READ ONLY结果不代替带授权锁的提交并发验收。
- 当前可见目标scope计数Subject/Enrollment/Visit/Response/Job均0→0，原两账号Token预留152→152；候选access/imports两表to_regclass均NULL。只证明本次读取与命名范围，不能推断其他并行任务全库静止。
- 未装配的`research-data-import-contract.mjs`：先5项RED缺模块→5 GREEN；独评要求逐行manifest固定后新增反例RED→6 GREEN。绑定source/真实target/映射/许可版本/targetManifestHash，明确requiresCurrentAuthorization=true和confirmationReady=false，不是提交许可或授权器。
- 联合纯测试37/37通过，完整输出`.tmp/p05-preparation-suite-final.log`；命令：`node --test server/ai-agent/research-data-import-contract.test.mjs server/ai-agent/research-data-preflight.test.mjs server/research-studies/authorization.test.mjs server/research-capture/imports.test.mjs server/research-capture/import-csv.test.mjs`。没有持久PG夹具、模型或后台任务。
- `node scripts/ai-research-data-p05-baseline.mjs`：原两账号、1440×900真实Chrome读原AI01本人P04预检及推荐Study概览，`.tmp/ai-file-data-2026-11-12/p05-baseline-1794552186743/result.json`；各2PNG与WebM，pageerror0/blocked0、业务POST0，确认导入按钮仍未启用。早两轮因并行本机重载断连、测试链接缺researchStudy=1 marker分别失败，原记录保留；后者只修测试为使用现有researchStudyUrl，不改产品路由或回退演示数据。
- 隔离Vite构建`.tmp/ai-file-data-2026-11-12/p05-build-1794551930497.log`退出0、4.49秒，原两个大包告警保留；新纯模块另由真实Node执行与语法验证，不称已进入页面bundle。未停止/重载本机环境，无旧服务操作。

## 独立准入复核

0Critical/5Important，已按复核逐条收口规格；这是方案/无副作用契约复核，不是I08最终业务总评审。没有将代理只读报告等同实际能力上线。

| 发现 | 当前收口／后续实际验证 |
| --- | --- |
| 只换写鉴权，旧预检canAssign/canSubmit仍拒绝owner | P05专用资源可写性投影复用业务校验，不全局改能力；I04验证owner预检与提交、普通入口仍403。 |
| self会扩大到历史本人记录 | 许可加scopeKey、来源会话、7天有效期及本轮实际回执/准备对象集合；I03/I06验证历史/他人/另一Study拒绝。 |
| 许可可能代替基础授权或打开correct | 回调携真实资源和操作，保留当前账号/authVersion/功能开通/成员/活跃父链，仅submit；I04验证draft/correct/review/lock拒绝。 |
| 原锁/写规则可接受superseded，全局v2快照不够 | 每行Enrollment/Visit/VisitPlan/Form必须命中固定执行版本；确认hash含逐行manifest；6项纯契约已验证manifest变化，实际版本竞争留I06。 |
| 在途撤权语义不清 | 共用tenant授权独占锁与固定锁序；先撤权则后续拒绝，已持锁导入先提交则撤权等待；两种顺序与撤权后读取留I06/I07，不承诺强中断。 |

## 四层状态与当前停止边界

1. 代码：只读核验工具/纯快照已实现；P05表/服务/确认提交/UI连接未实现。
2. 目标环境：原Study/方案/表单存在；新许可和两表未启用。
3. 真实执行：本轮只执行原鉴权读取、PG READ ONLY和页面基准，未执行正式导入。
4. 业务效果：尚无一次确认后入库，不能称P05完成或数据Agent全能力交付。

待用户批准[最小授权M01–M05](../planning/qiyan-ai-file-data-2026-11-12/authorization-p05.md)后，按[I01–I08](../planning/qiyan-ai-file-data-2026-11-12/p05-minimal-implementation.md)继续；仅这次新增表/限定许可/两处旧授权依赖和本轮合成准备需要确认，不重复请求P04或已批业务规则。

## 文档同步

本轮新增Notion[实施规格](https://app.notion.com/p/41756479ab58814a9a0bc9b1a825682b)、[最小授权](https://app.notion.com/p/41756479ab5881d1a2b0ea2a3bcc8c38)及[准入验证](https://app.notion.com/p/41756479ab5881359d20d107bd3c5859)三页；旧主计划、主规格、产品基线、变更与版本五页仅在开头插入当前状态，保留全部历史/子页。授权页一次旧日期标签由Notion自动规范化，已读取核实日期仍为2026-11-13并修复自动识别的本地文件伪链接；后续写入无警告。同步不表示授权已批准或实际导入已启用。
