# T15 S05 独立窄审

2026-11-12。审查当前正式分析路由、workspace、状态 hook、session 验证和真实证据；没有修改 UI 或运行环境。在本次限定范围未发现仍未解决的 P1/P2；本结论是本机通用合成软件审查，不是临床或生产验收。

后端当前能力只提供动作权限，页面另外要求已批准的当前 review、有效固定来源 preview、结构质量无阻断及原 manifestHash；后台放行时再重算。计划与快照固定 Study/plan/review/来源，0/false/null 及原修订链接不由 UI 推断；互斥 marker 防止混用旧页面。确认弹窗固化打开时 review sequence/preview hash，迟到变化由后端 CAS 拒绝。未知结果保留最小原键标记，只查回执并重读当前状态；敏感撤权清投影，普通 503 不假装注销。

原 `analysis-recovery-f3446968` 保存 receipt 200、snapshot 503 后错误宣称当前可用的真实 RED；最终 hook `acknowledged` 要求成功读取并验证当前 snapshot 才清标记。[最终恢复记录](../../testing/evidence/research-t15-2026-11-12/analysis-recovery-e8a82761/result.json)证明 receipt 200 后注入 snapshot GET 503 保留待核对、无虚假成功，再通过原 GET 恢复且没有第二次放行 POST。503/网络截断为明确注入，批准 CAS/真实 cookie、撤回和数据库回执为真实行为。[主链](../../testing/evidence/research-t15-2026-11-12/analysis-ui-8f43e324/result.json)包含真实结构疑问阻断、直接放行409和无快照，以及实际管理员/研究者/无关owner、0/false/null、固定来源回链。

独立 `node --test tests/formal-analysis-session.test.mjs` 7/7，`.tmp/t15-ui-independent-unit.tap`。目检桌面与原生200% CDP 截图（见[视觉结果](../../testing/evidence/research-t15-2026-11-12/analysis-visual-8248cab2/result.json)）；完整459单元及独立build为作者冻结证据，不重复冒称本人执行。

对 `ui-freeze/manifest.json` 逐一重算时 15/16 匹配：15项源码/测试/合同匹配，唯一不一致为 `t15-ui-checkpoint.md` 文档本身在 manifest 后变更；已通知主循环更新并再次核验。关键源码 SHA：workspace `f9821fc51d2aea9fc36c69b86db11e9b39b77796d30536682fea9d6b39de2ede`，hook `9b6bfc67a4c5ce77dc698fb14ee412a60f4e1dbb611cc049187ad4745e3e5385`，session `f31af81c3307e9871ba7601e94c7cb31aaf8f42864c13a62c873c086b901effe`。未使用或修改主样例；不把本页验收视为其他任务或撤回全链完成。
