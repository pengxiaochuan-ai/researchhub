# T18 S06 近期运行列表：超时与锁路径

## 已观察事实

- [真实浏览器诊断](../../testing/evidence/research-t18-2026-11-12/method-researcher-diagnostic-5deab6d3/result.json)：研究者身份 `/api/auth/me` 为 200；列表 GET 于 1794499702212 发起，1794499722214 以 `net::ERR_ABORTED` 结束，间隔 20,002 ms。随后安静重读再次发起。证据只证明客户端期限内未收到列表，不证明服务端最终完成时间或数据库锁等待占比。
- [续审核失败记录](../../testing/evidence/research-t18-2026-11-12/corrected-method-608152db/failure.json)：预检阶段 90 秒未见统计表，`pending: null`，所记录网络请求均为 GET；本次没有新增业务写入。既有 Run 不应重建或重算。

## 源码核查

1. `server/research-analysis/t16-runs.mjs` 的 list 最多取 50 个按创建时间和 ID 排序的运行，然后逐项串行调用 `getDescriptiveListItem`。
2. `app/server/src/research-methods/formal-descriptive-runs.ts` 的 `listItem` 对每项执行当前身份、权限及来源验证；失效来源仅输出受限的 blocked 元数据。`live` 在事务中复核运行行。
3. `server/research-analysis/t15-analysis-service.mjs` 的 `assertCurrent` 调用 `approved`，后者取得按租户和 plan 固定的排他事务 advisory lock，直到事务结束。同一 plan 的验证即使改成并发也必然在此锁串行。
4. `server/research-analysis/t15-analysis-core.mjs` 的 `project` 按主体 ID 排序并对主体行 `FOR UPDATE`；不同 plan 如共享主体也可能等待。以上是可核实的锁路径，不是对本次具体等待比例的测量。

## 处理边界

没有实施列表四路并发，也不承诺四路并发能加速；它可能增加连接占用而不改变同计划锁串行。主线程选择让精确 Run/快照详情读取与近期列表解耦，近期列表单独采用 60 秒期限，其他请求保持 20 秒；后端现有串行验证、当前权限、来源及 blocked 元数据规则保持不变。该方案已在目标本机合成环境完成只读验证，结果如下；延长期限本身不证明服务性能改善，也不保证列表一定在期限内完成。

下一步需以真实现有运行验证详情独立可用、近期列表最终结果和撤权/来源失效边界，保留失败证据；不得为通过验收重复创建 Run 或绕过授权与来源核查。本记录仅针对本机通用合成样例，不代表临床或生产验收。

## 后续实际验证

[真实只读浏览器结果](../../testing/evidence/research-t18-2026-11-12/method-read-isolation-8f3f43b3/result.json) 显示精确详情 3.110 秒、27 项列表 25.668 秒，且当前详情先显示；注入列表 503 时详情和权限仍可读，注入精确 Run 409 时不显示数值，快照页在列表 503 时仍可读取来源。此为一次本机合成观察，不是性能保证。最终受控源清单及独审见 [source proof](../../testing/evidence/research-t18-2026-11-12/read-isolation-final-proof/manifest.json) 和 [独审记录](t18-s06-read-decoupling-independent-review.md)。

更正后 Run 已分阶段实际完成：原审核成功后页面提示超时，根用原键 GET 确认并仅只读恢复；[最终 producer](../../testing/evidence/research-t18-2026-11-12/corrected-method-d9292461/result.json) 读取同一 Run 的 completed/confirmed，未重建或重算。更正后报告仍待验证。
