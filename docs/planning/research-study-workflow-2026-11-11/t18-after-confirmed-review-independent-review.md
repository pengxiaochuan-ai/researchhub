# T18 已确认更正及审核后的续阶段独立窄审

2026-11-12。最终结论：候选 `b1d08e819a48731ca02b2eea1e69840bb70c4ad47beb5715b153358af244d5ba` 无剩余阻断，`node --check` 通过，准备阶段 sentinel 保留。本次只读代码、差异及已保存的合成输入；未执行或导入候选，未发 API、SQL、浏览器请求，未改产品、身份、两旧 journal 或主三例。真实续阶段结果由根执行后另验。

初版审查发现并先行报告四项执行前问题，均已关闭：

| 原版本 | 发现 | 最终修复 |
| --- | --- | --- |
| `692574a1` 第 66 行 | correct 真实回执的结果为 `id`，没有 `result.responseId`；统一读取会在预检失败。 | 共同核 `ref.responseId`，另分别核 `correct.result.id`、`review.result.responseId`，与真实 journal 对照。 |
| `692574a1` 第 198 行 | 原 correct 段移除后，release 的 `dialog` 无声明，ESM 会在后续阶段抛错。 | 同作用域 `const dialog`。 |
| `692574a1` 第 11 行 | 实际没有所述 fail-closed sentinel。 | CLI 校验后恢复无条件 sentinel，审核前无法进入后续代码。 |
| `1dec3f9b` 第 192 行 | 原 capture 的 visit 没有 `requirements`；新增 `.requirements.filter` 会失败。 | 使用实际保存的 `visit.fulfillments`，按原 ref1 定位唯一原 fulfillment，再核当前相同 id 的 ref2。 |

最终版本的关键边界：

- 第 66–70 行精确绑定两份旧 journal 的 SHA、两次 failure 的 history、同 Study/旧 snapshot 与三次固定原键。只读实际文件确认原 journal 为一条 unlock，第二 journal 恰有 unlock/correct/review，两个 pending 均为 null；第二 failure 无该 assignment 的 lock POST，errors 为空。版本链为 3→4→5→6；correct 的 expectedRef 为原 ref1，review 的 expectedRef 为真实 ref2，答案只把 value 0→1，optional 0/false 保持。
- 第 166–178 行及其后预检重读三个原回执，核 Study/action/target/key/完整回执；当前仍须同 response、ref2、version6、approved、未锁定。原 actor/authVersion5、批准计划、H5/CSV、旧依据当前409、历史只读核对保持。旧 revision1、原完成访视的 Node 读取移至启动浏览器之前，`oldRef` 明确取自原 capture。
- 原 capture SHA `558d0e89db082c2f4051d33e8425fe5c10f21a679ce1c5e426217a785ab0481e` 中，原 fulfillment 唯一 id 为 `cmwczp6qa0019lud91awbn95k`，requirement 为 `cmwczp5mg000clud97pr1uqa4`，包含 ref1。新的定位使用这些已存事实，未根据需求名称猜 id，也未把 ref2 当旧证据。
- 第 149–163 行先在打开确认弹窗前完成 Node 来源查询与 networkidle；phase 内不再插入这些慢读。第 187 行之后只执行 lock→reverify→负导出→同批准计划新快照，不重放 unlock/correct/review。此顺序减少弹窗期间的等待；后台 quiet 检查仍可能在发请求前安全拒绝，候选不会因此自动重试。
- 新 state/目录独立，复制三次已确认历史并绑定两旧文件 SHA；pending 仍只 GET 原键后停线。保留每次 POST 的 runtime/source 守门、原键落盘/原回执核对、H5/CSV 不变、原完成日期与追加证据、旧历史不变、旧来源拒绝、负导出无新增 operation/job/file、当前三行值与缺失及新 snapshot/qualityGate 断言。终核两旧 journal SHA 后，只有全链通过才写原成功 pointer producer。

原 journal SHA `63412de39c797fc3b08b637862be3019c4a243f64cde0b2b1dd51ccf2d052366`；第二 journal SHA `7a35a2eaec80a9d902109d382b84152ca79e4f444c72e1ac09abda083af4f0d6`。本次只读对照不构成新的业务执行证据。

[独立证据目录](../../testing/evidence/research-t18-2026-11-12/after-confirmed-review-independent/)保留初版及修复版完整字节、差异、语法检查日志、实际形状 RED 与最终 [审结 JSON](../../testing/evidence/research-t18-2026-11-12/after-confirmed-review-independent/green-b1d08e81.json)（SHA `26362fd1c9a2c24f3b448921de2561fbbf0d9af47016b6a450bf8b9cc1652144`）。

建议下一项：由根执行唯一 lock 起续阶段，逐键保存真实回执；新 snapshot 成功后再对齐更正后 Methods 的真实输入。
