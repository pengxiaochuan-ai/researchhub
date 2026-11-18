# T14 显式对象重新核验增量独审

2026-11-12。本轮仅审 `file-links.mjs` 的当前上传能力投影、`file-upload.mjs` 的原回执恢复/显式 reverify 和 controller 的 verify 路由；不改产品实现、DDL、运行配置、既有三人贯通样例或运行时。先审稳定快照，再补独立测试与证据。先前 T14 严格解析/访视完成依据另由对应报告负责，本报告不替代其冻结审核。

验证范围：同 actor 原回执、当前身份/scope/data.upload/参与用途、对象原 SHA 读回、GET 不登记、未知与跨 actor 回执 404 零写、损坏后恢复仅重新读回和登记、不再 Ingest 或重建文件/任务/特征、真实 MinIO 与受保护 PG。单一外层整体回滚 fixture 可证明这些服务与持久边界，不证明独立提交并发、目标 HTTP 或 UI 业务验收。

实现者稳定快照已独立跑单元、普通/严格上传 PG 和真实 MinIO 读回 8/8 通过，证据 `docs/testing/evidence/research-t14-2026-11-12/reverify-independent/regression.tap`。新增专属反例仍在验证，最终结论随后追加。

## 本次重新核验冻结结论

`file-upload.mjs` 与 controller 本次指定增量未见未解 Critical / Important 阻断。上传能力投影在下方指定旧快照无阻断；**列表作者随后解除 file-links 冻结并开始文件内分页，当前结论不覆盖尚未冻结的新分页版本**。单元/PG 通过不替代运行时挂载、实际 HTTP 和 S09 UI 业务验收。

- `file-upload.mjs:34–37` 从当前 tenant + actor + 原 requestKey 查 operation，核对 file.preprocessed 动作、Study/visit/receipt/文件/任务引用及实际同 scope task。未知或另一 actor 即使有本研究权限，仍返回 FILE_RECEIPT_NOT_FOUND，不查询对象或登记事实。
- `:15–32,44–45` 回执解析后，存储核验进入第二次正式 Study 事务，重新检查当前账号/authVersion/Study 读权、实际 data.upload、访视真实父链和当前研究/数据用途参与条件。先按授权→参与父链→file 的顺序加锁，file 行锁后重新读取，才读取保存对象核对原 sourceSha256。重新核验不接受新字节、actor/file/task/sourceSHA body，不调用 Ingest。
- verified 且原登记摘要一致才登记 storageVerifiedSha256/At；mismatch 显式核验会撤销旧核验标记。两类变更均在该事务写含原 requestKey 的审计。GET 只读回并返回当前 status + 既有 recorded，不登记或清除事实；unknown 可以保留某时刻已登记的标记，不能单看 recorded=true 宣称当前字节可确认，调用方须同时核对 status=verified。
- 对象读回流式重算 SHA，不依赖对象 metadata；超过 128 KiB、5 秒、缺失或无法读取返回 unknown。对象存储与数据库不能原子，读回匹配仅证明该次读取；不保证对象此后永不变化。
- controller 将 verify 作为受统一同源 JSON 写保护的 POST，body 必须为空对象；服务未装配返回明确 503。原始 key 沿路径进入校验，不接受新操作身份或任意来源定位。
- 原 file-links 快照在同授权/参与事务内调用实际 authorizeIngest，仅普通 403 将 canUploadPreprocessed 置 false 并保留合法列表读取，503 等错误继续失败；available/unavailable 指实际依赖装配状态，不是存储永久可用保证，实际写端仍独立授权与读回。

## 独立验证与边界

证据目录：[reverify-independent](../../testing/evidence/research-t14-2026-11-12/reverify-independent/README.md)。原五组 8/8；新增 `file-upload-reverify-authority.test.mjs` 2/2，用替身验证回执解析与存储核验之间权限或 file 来源变化会在对象 I/O/任何写入/Ingest 前拒绝，此处不是实际双连接并发或提交证明。

新增 `file-upload-reverify-independent-pg.test.mjs` 1/1 使用受保护 wp01_test_full_baseline、实际 SET LOCAL ROLE aisci_app、真实 StudiesService 当前身份/权限查询、真实 core authorizeIngest/参与守门与实际 MinIO。仅使用新独立合成租户/普通 researcher 角色与成员，不改全局角色；所有 DB fixture 外层整体回滚，唯一对象 finally 删除。Prisma 事务入口适配到同一外层 tx，不伪称独立提交并发。

该 PG/MinIO 验证实际覆盖：当前普通 researcher 上传正例；unknown key/另一有研究权限 actor 原 key 均 404 且文件/任务/Feature/operation/audit/对象读取计数不变；写入受控损坏字节后 mismatch 清标记并审计原键；恢复原存储对象后 GET verified+recorded=false 且不写；显式 reverify 后 verified+recorded=true 且审计原键；文件/任务/Feature/operation 仍各 1，实际 Ingest 与 storage.put 各仅调用 1 次。撤 data.upload 后列表仍可看、能力 false，reverify 403；过期 authVersion 401、入组 withdrawn 拒绝，均无对象读取及新业务/审计事实。

首跑独立 fixture 因测试新账号遗漏必填 displayName 失败，尚未调用上传，已修测试并保留 `actual-minio-authority-fixture-error.tap`；不是产品 RED。最终业务源码三个 hash 与初始稳定快照相同。未独立执行真实双事务 reverify 竞争、故障审计回滚、目标 API/浏览器或重新构建/重载；这些不由本次外层回滚或源码推断替代。

| 指定快照 | SHA-256 |
|---|---|
| server/research-capture/file-upload.mjs | `4e27dd4e11bc1c4f2ec9f6d60935688fdaf60bb1790243ac0ee785ff1053773f` |
| server/research-studies/controller.mjs | `90633df8542c20b8561bc75d7d0cad51a366d1645ca8c339f7af4960a93be301` |
| server/research-capture/file-links.mjs（已解除冻结，仅指此前能力投影） | `d365212d4c963c5b7a21e2844e5bf736314d0e089d70b86519c9e32f4724b101` |

建议下一项：待新的文件内分页版本冻结后增量复审，再由主循环装配实际 API，使 S09 完成原回执恢复与显式核验交互验收。
