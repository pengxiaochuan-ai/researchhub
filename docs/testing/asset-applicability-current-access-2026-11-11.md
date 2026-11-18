# 本人资产核对当前权限恢复验证

2026-11-11；[已批准规格](../product/asset-applicability-current-access-2026-11-10.md)。仅本机专用合成环境、原两账号及当前Study，无临床库、旧服务、云资源、远端配置或发布操作。

## 四层结果

1. 代码：正常策略已实现，原测试构造仍检查临时期限；40项适用性单元/契约/UI测试通过，322项src/tests回归通过（两组含1项重复UI，不累加成独立总数）。构建通过，已有大chunk提示保留，不扩展包拆分范围。
2. 目标环境：用户批准后显式写入一笔独立模式登记审计，并在本机装配access策略；启动不创建审计或重授角色。当前19501–19507健康，正式环境未配置/发布。
3. 真实执行：两账号真实PG撤销edit/chat、authVersion变化及项目成员停用立即拒绝，事务回滚后角色/成员/账号一致；Chrome从P01进入、意见保存/刷新/历史只读、原资产服务派生及新本人双端组合通过。
4. 用户可用：桌面/390/320截图录屏，窄屏无文档横溢出；共享弹窗取消/Esc保留输入及焦点，确认离开仅一次，无原生业务弹窗。最终用户体验与科学签收独立。AI权限恢复不代表本轮新付费执行，真实新模型执行尚未验收。

## 证据

- [启用前保全/批准审计](evidence/applicability-current-2026-11-10/1794311411793/baseline.json)。
- [真实PG撤权/回滚](evidence/applicability-current-2026-11-10/pg-1794361743536/result.json)。根因为测试误改旧ids.role而非owner实际任务管理角色；成员撤销状态改用真实enum disabled。未放宽产品校验。
- [两账号浏览器结果](evidence/applicability-current-2026-11-11/browser-1794363323951/result.json)：[owner保存](evidence/applicability-current-2026-11-11/browser-1794363323951/owner-saved.png)、[admin派生](evidence/applicability-current-2026-11-11/browser-1794363323951/admin-derived.png)、[320窄屏](evidence/applicability-current-2026-11-11/browser-1794363323951/owner-320.png)。同目录webm保留两角色录屏。新增且仅新增每人1份候选和1份核对记录，其本人意见v2；失败测试尝试留痕，不删除，不重新生成夹具凑绿。
- 视觉评审发现前次`browser-1794362612902/owner-320.png`截到侧栏transform的0.2秒收起过渡帧，左侧遮挡正文，不能按无溢出断言视作可读通过。已复现并改测试等待侧栏实际right≤0再截图，最新两账号390/320稳定状态无遮挡；[独立稳定复核](evidence/applicability-current-2026-11-11/owner-320-stable.png)中侧栏x=-220/right=0。保留旧中间帧，不改共享导航或CSS。
- [固定具名对象](evidence/applicability-current-2026-11-11/browser-fixtures.json)：浏览器脚本续跑使用原具名对象，不重复创建新对象。首次脚本误读派生响应assetId字段已修正为真实asset.id；首次历史切换断言缺等待、重跑无脏值与P01初载折叠时序均修正测试等待/准备，未改变产品以规避测试。
- [P01全链路回归](evidence/p01-closure-2026-11-10/1794362530843/result.json)：两角色八类专用入口、三类报告预览、分页/空态、真实任务深链、源403及会话401清理、迟到响应、390/320均通过；0业务写、0模型调用。原七类限制已由新批准替代，前序记录保留。
- 保全再次只读核验：wp06/wp07/wp08/wp09-scope及ai-budget-20261022文件SHA256与批准前一致；全部前序research_artifact及research_artifact_version的逐行指纹无变化。只新增本轮本人对象和必要审计/版本，不改历史。
- 独立只读评审：`/root/applicability_current_access_review`复核新模式、旧期限隔离、当前撤权、真实父链及共享弹窗，无阻断项；不得把授权恢复宣传为已重新付费AI验收。

## AI与费用边界

原U03准入恢复；正常业务链仍使用BillingService的租户/账号Token预留与结算。最新验证owner有效剩余8,243，小于所需12,288，故canAi=false；admin35,964，canAi=true（额度为动态快照）。浏览器实际打开admin计费确认后Esc取消、焦点返回，未发jobs请求。本轮无新增模型请求、任务、费用、Token补额、充值或旧任务重放；不对其他会话的并发正常用量作零消耗保证。

旧5元/20任务/12请求为保留的历史测试授权与账本，不宣称当前正常provider已受该旧费用guard执行约束。后续新付费核价/执行需按当前授权重新核对；此轮不据恢复AI权限自动发起调用。其它模块期限与原版本/容量/来源保护不移除。

## 复现命令

```sh
node --test scripts/asset-applicability-current-access.test.mjs scripts/asset-applicability-scope.test.mjs scripts/asset-applicability-contract.test.mjs scripts/asset-applicability-opinions.test.mjs tests/applicability-current-ui.test.mjs
node --test src/*.test.mjs tests/*.test.mjs
node scripts/asset-applicability-current-pg.mjs --mode local-synthetic
node scripts/asset-applicability-current-browser.mjs --mode local-synthetic
node scripts/p01-task-draft-browser.mjs
npm run build
```

不运行旧付费fixture/激活脚本续期，也不运行可能新增持久任务的无关全库测试。PG回滚测试仅对具名合成角色短事务操作；并发真实业务写入前须重新确认环境。
