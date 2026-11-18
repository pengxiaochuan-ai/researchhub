# T18 已确认解锁后的续阶段独立窄审

2026-11-12。结论：已审候选无阻断。范围仅验收脚本的续阶段差异与原键恢复，未执行或导入候选，未发 API、SQL、浏览器请求，未修改产品、原 journal 或主三例。`node --check` 通过。本结论不代表更正或新快照已实际成功。

审阅版本：`scripts/research-t18-after-confirmed-unlock.mjs` SHA-256 `af6bb116cbf79cc5b6bffabd8003cfb6d1a2bcc26d2e64ba569605d97c30b64f`；对比原 correction `9d49bb1eeb8ece028d47f99a6a5e50c8208e4e225d2cc756277fd78ebbebd252`。合同 SHA-256 `46d8d177a8aa134c2b9e8102fbdaaa759323650bb599193772f32830620490ff`。`assertBlockedRunMetadata` 所在 guards 文件为 `aaa971a25224d7a3f7139aab1586629b9fabf214964a3852d804fc2d1afd6730`。

已逐行核实：

- 第 66–70 行把唯一原 unlock 键、原失败 history、Study/action/target/ref1、请求 version3 与已确认 version4/未锁定逐项绑定；原 journal SHA 仅供只读校验，新 state 路径独立。实际原文件仍为一条 unlock、pending=null，SHA `63412de39c797fc3b08b637862be3019c4a243f64cde0b2b1dd51ccf2d052366`，与原失败 history 精确相同。
- 第 164–177 行重新验证原 actor/authVersion5、原 GET 回执、当前父链/ref1/答案/version4、原完成日期及 visit.version、原批准计划。失效详情按当前 409 核验；历史 Run、snapshot、report/job/file/source 只经精确 scope 的 READ ONLY 读取，不尝试恢复失效来源。`dbBefore` 如实取自已解锁之后。
- 第 166–170 行对任何 pending 只查询原键并停线；存在其他已确认部分步骤也停线交根审，不自动重放。第 182–185 行没有 unlock 动作，从 correct 开始，限制唯一差异为 ONSITE value 0→1。
- 第 79–90、186–206 行保留 H5/CSV 原父链、当前与历史 ref、答案、版本、原导入回执及完成日期核对；保留更正后 review/lock/reverify、旧 ref1、完成 evidenceRefs、旧来源拒绝、负导出无新增 operation/job/file、同一 approved plan 新 snapshot 的断言。
- 第 137–156、207–209 行保留每次写前 runtime/source 守门、原键落盘后再守门、原回执核对；只有全链断言通过才写成功结果/pointer，最终再核原 journal SHA 未变。

`assertBlockedRunMetadata` 只接受 blocked/basis-invalid/ANALYSIS_BASIS_STALE 与受限字段；新增的 `outputs={}`、三个空数组及 `idempotent=false` 均精确校验，未放开任意字段。真实 DTO 与六项纯测试为根的既有证据，本次没有重复执行业务验证。

先发送无阻断结论后，根移除了唯一 sentinel 行。独审落盘时当前为 `6698007436847225fa074c817827d8147ffba8addb423e80dcf397e390a49aaa`；插回该行逐字还原已审 `af6bb116`，没有其他差异。原审版本保留 sentinel，本 reviewer 没有移除它或运行候选。

[独立证据](../../testing/evidence/research-t18-2026-11-12/after-confirmed-unlock-independent-af6bb116/review.json)（SHA-256 `4adef1fd8bccabaf70b3ebba74c4029fadf0b5edede87e216eab213d8d67e695`）同时保存审阅原文、根移除 sentinel 后原文、完整差异、语法检查日志及只读原 journal 对照。

建议下一项：由根继续唯一续阶段链，保留每个原键的真实回执，再核实际新 snapshot 与后续 Methods 输入；出现未知继续 GET-only 停线。
