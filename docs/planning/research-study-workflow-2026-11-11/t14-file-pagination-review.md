# T14 文件内来源分页独立审查

2026-11-12，本次仅审 `file-links.mjs` 的文件→任务→特征有界分页，以及 root 控制器两个新增 GET 路由的参数转交。不是旧 parser、核验写命令或 T14 整体能力的再次审查。**指定源码范围未发现 P1/P2，可进入 root 后续 HTTP/UI 集成验证。** 本审查未改产品实现、运行时或 DDL，未触主三人 benchmark，未发信。

## 审查结论

`file-links.mjs` SHA-256：`58d490f03d39f7e521e74c7422c1c592cec4c1e51f8cb6e68a9450bdebf7666a`。

- `:16–19` 所有页通过实际 Study 事务、当前 readVisit 权威与精确 enrollment/protocol 校验、requireCurrentConsent=true 的 capture parent lock，再锁并重读当前 live file；scope 来自 Study binding。读取不会仅凭客户端 file/task ID 或旧 cursor 取得权限。
- `:20–24,30–31` task 查询固定 tenant/group/project/subject/file，feature 查询同时固定 tenant/subject/source file/source task；listFeatures 先确认 task 真属于该 file。错父链、另一访视文件、删除文件不能借分页出现。
- `:16,25,29–31` HMAC cursor 绑定当前 tenant/actor/authVersion/Study/kind，filter 进一步绑定 visit/file/特征时 task；1–100、默认 20，按 ID 排序并以实际最后一项继续，完整父范围 count 不随 afterId 缩成剩余条数。嵌入父页与后续子页使用同一签名绑定，能直接接续。
- `:23–29` 保留 t14-source-v1 fingerprint 的原字段与 canonical 算法。文件验证事实不足时 sourceRef=null，不伪造已有来源；task/feature 页不输出科学值、存储 key、结果 JSON、联系方式或答案。taskCount / featureCount 查询真实对应记录，不把 task.result 的声称数量当当前总数。
- `controller.mjs:120,179–180` 两个新增只读路由按 Study/visit/file/processingTaskId/query 转交上述实际服务，沿当前全局认证与 no-store 处理；未增加写操作或隐式启动算子。该项为代码接线检查，尚未在运行时验证新 GET 路由。

分页明确是当前读取，不是多次 HTTP 请求间不可变快照。测试不承诺并发插入/删除后的全局快照遍历；发生来源变化须重新核对，正式消费者仍须固定 source ref/hash 并重验。现有有界嵌入存在逐父查询，本次未发现会使 501/1000 合法单文件读失败的问题，没有因审查而做查询重构。

## 实际验证

证据目录：`docs/testing/evidence/research-t14-2026-11-12/pagination-review/`。

1. `author-rerun.tap`：本审查者实际重跑作者专属分页 PG、入口存在单元及既有 list 单元，5/5 通过。作者 PG 使用新 fixture / aisci_app，实际遍历 501、1000 feature 和 26 task，不是仅依单测对象替身推断。
2. 新增 `server/research-capture/file-links-pagination-review-pg.test.mjs`；`independent-actual-study-pg.tap`：2/2。采用真实 `createResearchStudiesService` 的 Study binding / 当前账户事务 wrapper、现有 readFormalVisit / lockCaptureBinding、真实 aisci_app RLS。两个全新 tenant fixture 均在唯一保护库 `wp01_test_full_baseline` 外层最终整体回滚。

新增 PG 明确检查：

- 501 / 1000 个真实 feature ID 全量有序、无漏、无重；每页 total 正确，父页默认只嵌入 20 个；嵌入首 20、首子页及续游标完全一致，原 source ref/hash 保持。
- 文件 26 task 的嵌入 20 + 后续 7 续页正好覆盖全体，没有再次包含原前 20 或丢末尾。科学值改变时对应 feature hash 改变，撤销文件存储验证事实时 ref 变 null。
- 有效第二管理员无 cursor 可读，但不能借原 actor cursor；跨 Study、visit/file/task、kind、authVersion 及实际签名篡改拒绝。另一有效 file/task 的空父范围 total=0，source file 与 source task 交叉不一致的 Feature 不混入任一合法组合。
- 不带 cursor 的错父链/不存在 Study/删除 file 同样拒绝；真实账户 authVersion 改变后拒绝当前读取；追加真实当前 data_use_consent withdrawn 事实后，文件根页、任务页、特征页及原 cursor 均拒绝。
- 所有返回对象递归断言没有 value/storageKey/meta/result/answers/address/email，固定 source hash 并未被原数据正文替代。

首次额外 PG 有 1 项夹具失败，保留 `fixture-context-failure.tap`：故意读取不存在 Study 后，真实 wrapper 在同一保留测试事务中已把 local scope 清空，下一次测试直接修改 fixture 文件因 RLS 无记录。真实请求各自拥有事务，本测试复用外层 fixture 事务须在人工 fixture 修改前恢复 context。已只修测试上下文后重新 2/2；未改实现或放宽权限。此外签名篡改探针改为固定修改 tag 首字节，避免 base64 尾部 padding 的等价表示造成偶然假失败。

全部源码冻结值及边界见 `review-freeze.json`。这些 PG 为直接创建合成来源记录后验证读取分页，不代表实际上传、科研特征计算或 HTTP/浏览器已验收；本轮未启动 Worker、存储读取或新 runtime。

建议下一项：root 在正式 19501 本机运行装配新 GET 路由，用 501/1000 来源文件验证展开及继续加载、当前失权和失败恢复，随后关闭本分页增量。

## 父来源 DTO 微增量独立复核

最新 `file-links.mjs` SHA `9dc2f77cc36e9ec497ce6efd7ec6df1508a45200a3582685a4230311fb2ddb3f`，**本微增量未发现 P1/P2**，可继续 root 运行时/页面集成。

本次只补 `:23` 共用 taskRef、`:26` 既有 taskView 使用相同 helper、`:31` listTasks 顶层 fileSourceRef、`:32` listFeatures 顶层 fileSourceRef/taskSourceRef。逐字撤去这些微改即可精确重建此前已审 `58d490f03d39f7e521e74c7422c1c592cec4c1e51f8cb6e68a9450bdebf7666a`，`parent-ref-microdiff.json` 保存新旧完整哈希相等验证；没有其他授权、锁、父链、分页或查询变化。新的父 ref 使用当前同事务已锁后重读的 file 与已验证精确父链 task，算法及 t14-source-v1 不变，验证事实不足仍返回 null，不回传值或存储 key，也不把 sourceRef 当授权凭证。

本审查者实际复跑作者新增单元及保护库 PG：`parent-ref-independent-rerun.tap` **3/3**。真实 aisci_app 下 501/1000 分页中，子页父 file/task ref 与同态嵌入相同；人为改变该全新 fixture 文件摘要/验证事实和任务 result 后，以原 cursor 续读返回新的父引用，与刷新嵌入一致，而非带回旧父引用。消费者须据此发现旧父展示和新子页的来源差异，不能静默拼接；这项 UI 行为仍由 root 后续真实浏览器验证。全部 fixture 外层回滚，未改实现、运行时、DDL或主三人；不再次复审旧 parser，也不以本微审代替 HTTP/UI 验收。
