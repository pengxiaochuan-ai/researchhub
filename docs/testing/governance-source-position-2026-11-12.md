# G02来源审核：左侧定位与两项术语核对

日期2026-11-12。本轮仅用户指定的跳转定位修补及只读解释，不恢复前序开发计划，不改变既有布局、来源审核规则/决定、方案状态、权限或旧服务。

## 交付与证据

真实管理员从治理总览点击“循证针灸临床实践指南：抑郁症（修订版）”审核：原左侧题名top4460–4482，列表视域136–883，已选但看不到；修后scrollTop4282、题名178–200，高亮与右侧同一文章。桌面仅更改左ul.scrollTop，不动右详情及祖先滚动。窄屏保持原详情/返回队列模式，返回时题名可见。CSS、导航、后端、表结构均未改。

- [真正定位RED](evidence/governance-source-position-2026-11-12/red-result.json)、[修前截图](evidence/governance-source-position-2026-11-12/red-entry.png)。
- [最终六组结果](evidence/governance-source-position-2026-11-12/final-result.json)：真实总览入口、刷新、真实GET扣住→loading→放行→ready后的显式重新核对，1440/1366/1920/1024和390/320，移动返回当前题名且无横溢出；隔离实际组件+真实GET验证背景读取不拉回手动滚动。此最后一项不冒称完整全局身份刷新通过。
- [当前桌面](evidence/governance-source-position-2026-11-12/final-entry.png)、[320](evidence/governance-source-position-2026-11-12/final-320.png)，全部尝试视频保留在同目录video。作者实际读图比较，右侧标题/决定区布局未改变。
- 专项 `node --test --test-concurrency=1 tests/source-review-queue.test.mjs tests/review-decision-actions.test.mjs tests/governance-overview.test.mjs server/hub-sources/object-review.test.mjs server/research-execution/review-queue.test.mjs`：30/30；覆盖部分/失效/混合审核判定、队列筛选与下一项、权限/分页和决定动作。
- [完整前端](evidence/governance-source-position-2026-11-12/frontend-tests.log)：406/406，无失败/跳过；[构建](evidence/governance-source-position-2026-11-12/build.log)：5.00s退出0，既有>500KB分块告警未扩改。
- 最终主页面无错误；隔离组件测试页Vite HMR触发Chrome本地网络检查的3条错误另存harnessWarnings，不把它们隐瞒为零控制台错误。HMR不承担业务GET，真实组件请求/DOM断言通过。两个页面均用context级监听，0业务写请求；没有模型调用、付费、权限变更、重启、云操作或发布。登录/认证审计属原会话机制，不称数据库绝对零写。

## 实际状态解释（未代审）

该指南当前两笔有效public display批准：bibliographic v162、guidance_clauses v7，历史依据不同；没有bibliographic ai_retrieval批准。旧objectReviewState需要当前全部可用分项同动作完整决定，因此partial/“审核范围尚需统一核对”。它不是“文章未审核”，也不是“自动撤掉旧展示”；现有总览和详情说明过于笼统，后续建议按真实分项状态说清“已展示／AI未授权”，不能直接把partial改成全部批准。

“通用合成研究方案”真实记录：Study rh-study-5c032bff-dabe-409d-8673-eb0b5f3ad4e0（科研流程合成贯通 · T05 rh-t05-http-1ddd65d6），Protocol cmwcby10z0006lukupsf2v8pp v1 pending_review。是已有Study的方案版本审核，不是新建课题审批，也不是外部伦理审批；本轮只读，未提交批准/退回/启用。

## 独立总评与边界

一次独立只读总评：无Critical；1 Important指出原ready可能命中保留的旧DOM，作者已改成真实响应扣住并观察loading→ready后断言，最终六组通过；不追加另一次评审。Minor中的跨页面写监听已改context级。另一Minor：同一已选条目只露下半部时再次点击仍沿旧行为定位右标题，未另加左重显；本轮不声称所有重复点击边界都修好。

额外全页focus试验触发原全局身份重核checking→组件清选，可能重新选首项；未扩改认证模块，不能拿隔离组件GET结果代替该全局路径验收。旧失败red-refresh、green-final、green-guard、component-diagnostic、verified全部留存，不以初修通过覆盖最终失败。此轮未重新验证审批提交、AI检索生成、全站无障碍、原生200%、生产或专业内容正确性；四层只对本机指定跳转定位有据，用户最终体验确认另行完成。

## 同步和运行状态

规格、基线、变更、版本、使用说明、前端技术、UI验收、文档索引与本轮计划事实/进度均同步本地及原Notion对应章节，旧内容保留。[Notion交接](https://app.notion.com/p/41656479ab5881ce8375cbe328bebb75) · [本轮执行记录](https://app.notion.com/p/41656479ab58810b8301d94c5fb323e6)，已回读报告核验。七服务ready，PID65569，本轮未重启。代码和脚本SHA256存于同证据目录source-sha256.txt；无Git提交、暂存、推送或生产发布。
