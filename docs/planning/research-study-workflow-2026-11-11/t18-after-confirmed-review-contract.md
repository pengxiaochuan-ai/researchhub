# T18 主更正：已确认修订和审核后的续阶段合同

2026-11-12。`after-confirmed-unlock-98f8e105` 已实际完成并核对原 unlock、correct、review；锁定确认时客户端后台只读核验占用导致未发送 POST，实际网络和 pending 均无 lock。不得把该事件当未知提交，也不得重发 correct/review。保留前两份私有 journal 和两次 failure，候选保持独立 fail-closed sentinel，审核前不发任何请求。

独立入口 `--local-synthetic --execute-after-confirmed-review --report-proof <path>`。同一 Study/snapshot，逐项绑定原 correction journal 和 after-unlock journal 原文件 SHA；后者 pending=null 且history恰有三个成功动作，对应原 unlock `73a01ef4-7fb0-457d-a038-574dadd14435`、correct `9329dc95-3b23-476b-b801-0b6446b7a40c`、review `62dc9701-dc04-400d-a867-3b629217a1ab`，与原两个 failure 的确认历史吻合。重新 GET 三个原回执核 action/key/Study/target、版本4/5/6、ref1/ref2与 approved；当前账号仍原 admin/authVersion 5。当前同一 response 为ref2/version6/approved/unlocked、value=1、optional=0、completed=false；原ref1和历史答案从原 capture 取值、精确回读，不把 ref2 误当旧版。两旧 journal 只读，独立新 state 复制已确认历史，最终再次核两个旧文件 SHA 不变。

沿用原合成基线报告及原方法、受保护 READ ONLY 旧 snapshot/Run/报告/job/file/来源与已批准原 plan 校验，H5/CSV原响应版本、父链、答案、日期、历史和导入来源不变；原完成访视仍 completed、requires_review，原 SubjectVisit 完成依据仍有 ref1。旧 snapshot/Run/报告当前读取来源失效准确409，阻断metadata严格检查，不能要求旧正文200或删除历史。

完成上述 API、原来源和护栏预检后打开 S09；等待页面自然 networkidle，再执行唯一 lock→reverify→旧依据409/负导出零operation、job、file→同plan新snapshot。每个确认先完成 Node 只读来源核查，再打开 dialog 并紧接确认，不在 dialog 打开后等待其他来源查询；浏览器侧照旧核请求body、原键持久化、runtime和UI source冻结。每次显式点击单次，不因超时或网络错误重派。若后台quiet reader再次让客户端在发请求前拒绝，只有证据证明**没有POST且没有pending**、且状态/版本仍原样后，才可由根明确授权下一次单独UI意图；任何实际POST或不明结果只按原键 GET 并停线。

完成后保持原完成时间，SubjectVisit evidenceRefs 旧prefix+ref2/responseVersion，新批准snapshot/qualityGate同原plan并准确绑定三个当前行、0/false/missing；新state及证据目录独立，成功仍写原 `t18-main-correction-current` 供已审后续执行器消费，包含 `phase=correction-and-new-basis-only` 与原capture/basis/method/report SHA。此为代码准备，不代表真实续验、临床或生产通过。
