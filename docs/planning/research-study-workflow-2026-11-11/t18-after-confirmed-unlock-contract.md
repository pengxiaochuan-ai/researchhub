# T18 主更正：已确认解锁后的续阶段合同

2026-11-12。首轮 `main-correction-33c9a4e8` 在实际 unlock 已确认后因验收脚本未识别 Methods blocked metadata 的空默认字段停线；该失败不表示产品泄漏。原私有 state、原失败目录及原审计/回执均保留，不整体重跑、重新解锁或清理。此候选仅准备，不执行请求；保留独立 fail-closed sentinel，根与独审核准后才运行。

前提：新 CLI `--local-synthetic --execute-after-confirmed-unlock --report-proof <path>`；从唯一原 `t18-main-correction-state.json` 只读验证同 Study、原 snapshot、pending=null，history **仅一条** `form.unlock`，原键 `73a01ef4-7fb0-457d-a038-574dadd14435`、目标原 ONSITE assignment、旧version=3/ref1、返回version=4/locked=false、原回执 Study/action/target/key一致；原文件本身 SHA 保存并绑定新的独立续阶段 state/journal，永不覆盖原 journal。当前真实 admin 的 accountId 与 report proof 的四原操作 actor 全一致，admin authVersion=5；当前运行 PID/ready/ids、已批准 S10 freeze及每次业务 POST 前/原key落盘后的源码和runtime守门保留。

真正继续前 GET 原 unlock 回执并逐项核对，当前 ONSITE assignment 父链、相同 response/ref1/答案、version4、unlocked 及已完成原访视日期；不得第二次 unlock。H5/CSV 当前原响应/版本/父链/日期及 H5 历史、CSV 导入回执按原合同逐项只读核对。原 approved plan 的定义/hash/批准id/sequence保持；原快照、Run和报告此时已经失效，不能再要求其HTTP详情200。原基线已签收报告 proof/下载SHA、方法 result/fixed-run 与输入摘要为历史基线；受保护 PG READ ONLY 精确按scope读原 snapshot/Run/报告版本/来源/job/file并与原proof比对，不恢复原来源、不写它们。capture 的 SubjectVisit 原完成 evidenceRefs、精确form fulfillment、原完成日期在 `dbBefore` 读回；旧 snapshot/Run/报告及文件按当前失效源的准确409核验，列表只留受限元数据。

从 S09 当前表单的 correct 开始，原合同的单行diff、同响应ref2、review/lock/reverify、原完成记录追加新证据、原固定ref1可读、其他两人不变、负导出409且operation/job/file零新增、同一批准plan放行新快照均逐项保留。任何结果未知只查原键并停线，不重派；新续阶段 state、证据目录及最终成功pointer独立。旧原 journal 的确认条目可以复制进新journal并标注来源，保留原文件 SHA；续阶段若已有任何自身history或pending，默认只读核原回执后交根审，不自动跳过重放。

blocked Run metadata 必须由独立 `assertBlockedRunMetadata` 验当前 blocked、basis-invalid、ANALYSIS_BASIS_STALE，有限白名单及 `outputs={}`, `limitations=[]`, `nextActions=[]`, `reviews=[]`, `idempotent=false` 的精确默认值，其他敏感字段递归阻断；不能笼统放行任意字段。保护库/浏览器/真实Worker仅允许根审核通过后执行；本准备不代表更正、重新发布或临床生产已通过。
