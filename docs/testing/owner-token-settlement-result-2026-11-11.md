# 科研人员15笔历史Token对账执行结果

状态：用户批准后已执行并完成独立数据库回读及真实Chrome准入验证。仅本机专用合成库，不涉及临床库、旧服务、远端配置、充值或发布。[批准范围](owner-token-settlement-scope-2026-11-11.md)。新付费AI调用未执行，本次不把准入恢复称为模型效果验收。

## 实际结果

| 项目 | 执行前 | 执行后 |
|---|---:|---:|
| 科研人员Token总分配 | 313,034 | 313,034 |
| 已记账历史消耗 | 108,183 | 128,595 |
| 待对账预留 | 196,608 | 12,288 |
| 账号及有效可用Token | 8,243 | 172,151 |
| 本次15笔结算数 | 0 | 15 |

本次补记已发生历史消耗20,412 Token，关闭对应184,320预留，净释放差额163,908 Token；新增15条原UsageRecord和15条结算审计。没有新增模型消费、额度授予或充值。第12笔用量未知，原12,288预留、任务和审计完整保留。

上表是执行后快照，不是承诺余额永不变化；后续正常使用仍按实际消耗和预留变化。租户总分配613,034不变；执行前可用43,657、执行后207,565，同样增加163,908，当前有效可用取租户/账号较小者172,151。

## 执行路径与保护

- 只使用批准清单中的原序号01–11、13–16，固定15个reservationId；预留归属均为原合成租户及owner账号。第12笔被明确排除，不把“批准”理解为所有历史预留清空。
- 使用现有具名合成平台管理员（非将体验admin改为平台管理员）调用原BillingService.resolveTokenQuotaReconciliation。未编辑旧系统或ResearchHub业务代码，未更改角色、权限、总额度或任务。
- 执行前重新验证原始HTTP文件SHA256、runtime指纹、历史费用条目、当前预留/任务/审计、模型及精确用量重复入账；15笔均保持待处理，无冲突。
- 先做一次原服务真实PG回滚试验，验证UsageRecord/预留/审计写入链和回滚后无残留；实际执行时每笔独立原服务事务，原预留锁/状态守门保留。每笔事务中确认actualTokens、关联usageId及唯一结算审计，失败即停止，不自动重试。
- 15笔全部成功；没有部分失败或待恢复操作。再次执行同一清单会被已结算状态阻断，不应重放。

## 新鲜验证证据

1. 原BillingService／Token policy针对性单测13/13通过：待对账持续扣留、原子留置、一次结算、模型不一致拒绝、额度确定性与幂等等。不是全库回归或新模型执行证明。
2. [批准记录](evidence/token-reconciliation-owner-2026-11-11/approval.json)：当前聊天明确批准、15个固定目标、proposalHash及零新Provider调用边界。
3. [执行前与回滚验证](evidence/token-reconciliation-owner-2026-11-11/preflight-result.json)：全部15笔仍pending，原服务试结算回滚完整，持久结算0笔。
4. [实际执行结果](evidence/token-reconciliation-owner-2026-11-11/apply-result.json)：15笔成功、逐笔UsageRecord ID、前后额度和保全指纹；新增用量合计20,412，账号净可用差额163,908。失败任务、额度分录、角色、账号状态/authVersion、未知第12笔、其他预留逐项指纹不变，原AI费用账本字节不变。
5. [独立只读数据库回读](evidence/token-reconciliation-owner-2026-11-11/readback-result.json)：15笔均settled，各自关联一条准确用量和一条既有平台管理员写入的结算审计；第12笔仍reconciliation_required且无结算关联。
6. [真实接口与Chrome](evidence/token-reconciliation-owner-2026-11-11/browser-result.json)：owner登录201、原核对记录GET200、sourceStatus=current、canAi=true、TOKEN_QUOTA_READY；有效172,151大于所需12,288，原计费按钮可用。0页面异常，0jobs POST／0新模型调用。[页面截图](evidence/token-reconciliation-owner-2026-11-11/owner-ai-ready.png)，同目录webm留存。未修改页面布局，无需以本轮冒充全站UI或真实模型验收。

## 后续边界

独立只读总评审：`/root/applicability_current_access_review`复核批准proposalHash、固定15笔HTTP/账本用量、15个不同UsageRecord与15条结算审计、旧记录与未知预留保全及浏览器结果，结论通过，无越界、重复记账或用量错误。交付口径仅为“历史Token对账完成、AI准入恢复”，不是充值、退款、旧任务恢复或新模型验收。

本轮仅历史真实用量对账。第12笔仍需取得可信用量或明确未计费证据；不得按失败/过期直接清零。新付费AI验收需重新明确核价、预算守门及调用范围，不能把本次释放预留视作新增付费授权。现有正常provider使用BillingService Token准入，不宣称自动接入旧5元测试费用守门。
