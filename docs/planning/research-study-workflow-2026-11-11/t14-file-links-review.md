# T14 文件来源独审与窄修复记录

2026-11-12。初始任务仅独立窄审 T14 文件服务、现有预处理导入和访视完成依据；不执行 DDL、不重载、不发信、不写主三人 benchmark。发现下列两项 Important 后，主循环明确授权本审查者转为这两项修复的实现者。因此文末验证是实现者自验，**不是修复后独立批准**；最终须主循环/原作者另审，T14 HTTP/UI/业务四层尚未完成。

## 初始 Important 与实际反例

1. 旧 `IngestService.parseFeatureFile` 在 JSON 用 Number(value)、CSV 用 Number(raw)。正式入口未经额外守门直接调用，JSON 空字符串/布尔/数组实际写入 Feature 0/1/0；CSV `1e-9999`→0、`9007199254740993`→9007199254740992；文件读回状态还可为 verified，不能用存储完整性替代科学值解析完整性。初审 Ingest SHA `3085ff10a517a9e244dacacb8c974180121ed0ad7cbdd293670b0e8a5dc10088`。
2. 旧 `visitCompletionIntegrity` 接受任一历史文件 ref。真实 PG 复现完成 A→改变 B→显式重核 B→恢复历史 A 后直接返回 current，不再要求显式复核；旧完成事实复活。初审 evidence SHA `0591f9ec316d935a811c655e785cb723c7435c44940e697b7825b0162fbb76b7`。

`.tmp/t14-independent-probes.test.mjs` 与保留的 `t14-independent-probes.tap` 是两条真实保护库反例，外层全部回滚；2/2 意义是确认缺陷，不是修复通过。后续 `t14-latest-file-ref-red.tap` 为先加真实预期回归后实际失败的证据。

## 授权修复

`app/server/src/ingest/formal-feature-parser.ts` 仅在 `ingestPreprocessed` 的可信 formal 分支使用。数值在原始 JSON token 阶段先做十进制 identity / finite / safe integer 校验，再 JSON.parse；类型校验不把 false、空字符串、数组、数字字符串变成科学值。CSV 有界状态解码引号、转义、列数与行号，未知/重复 header、坏行不会静默丢弃。JSON 拒绝重复 key、歧义 alias 和未知结构。整批错误 400 `FORMAL_FEATURE_INVALID`，只含 rowNumber/fieldKey 和通用提示，不回显输入。0、明确 null/未记录原意保留，既有 processing_status 为 missing 留痕；confidence 同样不强制数值化。标准 Number 的十进制 roundtrip 可保真子集为支持范围，不宣称任意精度。

新 parserVersion 记录为 parseFormalFeatureFile-v1，并绑定 formal importKey / 操作 hash；旧未带 formal 的 API 未改。有效同源正式重试仍共享一个 task/file/Feature，原 key 恢复仍由持久 operation 读取；不同解析语义不会借旧导入结果冒充严格解析。首次解析失败在对象 put、文件、任务、Feature 和 operation 之前拒绝。前置鉴权/执行日志仍可能发生，不把“零入库”误写成零 HTTP/零日志。

`visit-file-evidence.ts` 新 ref 明确 modality，重核新 ref 另固定 visitRequirementId。`formal-visit-evidence.ts:32–51` 只选该要求/模态最新追加依据并锁文件后重读精确 subject/visit、live 文件、摘要与存储验证事实。历史 A 即使再次匹配也不能替代最新 B；最新文件删除后也不能退回恢复的旧文件。最新依据无固定摘要为 legacy_unversioned。历史证据数组和原完成时间保持，不改旧事实或自动复核。

## 其余已审边界

- 真实 Study transaction 与当前正式权限/参与同意守门在上传前、发布事务和验证事务重复执行；固定真实 visit/enrollment/protocol/subject，不接受客户端自行提供存储键或主体。失权优先于原回执。
- operation 与文件/实际同步导入 task/双来源 Feature 同事务；相同 key/同内容重放，异内容冲突。actor/Study/visit/action/target 均核对。Feature 实际有文件与任务双来源，预处理 task 代表字段导入，不代表音视频或科学算子运行，没有调用退休处理器。
- 存储必须实际读取字节重算 sha256 才是 verified。摘要不一致、不可读/超时状态明确；GET receipt 只查原动作和当前对象，不写新业务导入，不把 404 自动解释为失败并重发。
- 对象 put 与 PG 非原子；明确拒绝/复用时只清理本次唯一新对象，提交结果未知保留对象，进程中断/清理失败可能留孤儿。存储 verified 标记是某时刻核验事实；后续读取仍须重验，不保证存储永不可变。ScaleResult 仍无精确 visit 支持，未冒称已接通。
- 文件列表精确显式 visit 绑定、同范围 task 与匹配 file/task 的 Feature，值、存储键、联系人不输出。签名游标绑定当前身份/Study/visit，数量有界。该源摘要是读取比较，未提供任意客户端引用授权能力。

## 验证、源冻结与剩余工作

证据目录 `docs/testing/evidence/research-t14-2026-11-12/`：

- `t14-fixes-unit-final.tap`：19/19，strict parser、精确文件证据、当前 ingest 权限及旧入口回归。
- `t14-fixes-pg-final-v2.tap`：6/6，原来源 PG、原 key/去重/篡改/不可读/撤回 PG、新严格 aisci_app PG、真实 MinIO 写入读回，以及最新单文件摘要/多文件依据。均为全新最终回滚 fixture，真实存储对象清理。
- `t14-strict-upload-final-v3.tap`：1/1，修正测试旧入口返回值假设，按实际持久 legacy task 追踪双来源；明确旧宽松 parser 与正式严格 parser 的同字节输入不共享错误科学事实。正例 0 入库，null 留 processing_status；false/true/字符串/数组/对象/精度错误与坏 CSV 整批拒绝且文件/task/Feature/operation/object 不增加。
- `t14-fixes-tsc-final-v3.log`：完整 server noEmit exit 0；`fix-freeze.json` 保存执行边界和全部源 SHA。
- `t14-fixes-pg-final.tap` 保留最初 5/6：原测试把 Infinity 当 missing；严格正式合同要求整批错误，已改为 400 且不写 operation。没有放宽实现以迁就旧用例。

未执行新的双连接持久 fixture、HTTP、真实浏览器、生产、SMTP、DDL 或运行时重载。现有作者双连接证据只作为先前范围参考，不能冒充本实现者重跑；原 key 与更正源码需由下一位独审者复核，再在 19501 完成实际 HTTP/页面失权、未知结果和业务链。当前不得使用“T14 已完成/上线/业务验收通过”。

建议下一项：主循环安排原作者针对 strict parser、parserVersion 去重与最新完成文件依据独立复核，通过后装配 19501 的实际 HTTP 和页面链。

## 原作者独立复审（2026-11-12）

对 `fix-freeze.json` 逐项 SHA-256 重算一致；独立复跑 `app/server/.tmp/t14-independent-review-unit.tap` 17/17（SHA-256 `b15e0ccd4fb5fac4fbffcd79846160329311e1f802439d79368b96d061c36a98`）、`researchhub/.tmp/t14-independent-review-pg.tap` 8/8（`5e2f1bc993a0a9844bcc85c0d2664aecb7a1d40a2927b30412cec5c3567779ba`，含受保护 PostgreSQL、真实本机 MinIO 与两个方向等待及同键竞争），全 server `tsc --noEmit --incremental false` exit 0（空日志 SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`）。本次合成 fixture 受守门限制；HTTP、浏览器、临床及生产均未验证。

已核对严格解析在对象写入前执行，拒绝静默值转换、精度丢失和歧义字段；当前严格首版与旧宽松路径去重命名空间隔离。同一要求最新固定文件依据决定当前性，旧版本不会在重核后复活。两项此前 Important 的当前 v1 反例已由测试覆盖。

本机装配复核：三个路由复用同一个 `createResearchStudiesService`、存储实例与当前授权；JSON 256 KiB 上限容纳允许的 128 KiB base64 文件；`IngestService` 的有限依赖占位只适用于此处已存在被试、buffer、预处理的正式路径；其他旧路径不得复用该占位实例。当前运行进程尚未加载修复，不能据源码和测试宣称目标路由生效。

一个尚待主循环定夺的版本契约差异：操作哈希包含 `parserVersion`；去重键仅使用写死的 `preprocessed-formal-v1:` 前缀，并未引用 `parserVersion` 本身，也未在复用任务时比较 `result.parser`。当前 v1 与 legacy 已隔离，未复现当前错误写入；未来只改 parserVersion 而未同步改前缀会复用旧语义，与本轮“parserVersion 进入 importKey”明确要求不完全一致。建议直接把版本值纳入去重键并核对原任务版本，再做定向回归；在该差异确认前不以无保留的 no-blockers 结论代替契约核对。

### parser 版本去重微修

主循环确认当前文件无并发 owner 后授权原作者处理上述契约差异：正式去重键直接包含 `parserVersion`，且复用任务前检查 `result.parser` 与当前版本一致；旧未 formal 分支沿用旧 key/行为。受限 `aisci_app` 定向 PG 复测 1/1，检查版本前缀、篡改旧任务版本后拒绝、同源不同解析路径不互相复用；`.tmp/t14-parser-version-independent.tap` SHA-256 `af99d2e3b1c98c2c6fa3232206b9d39c40cd85c5a5fd290bed4e53998474d`。该小补丁由本次独审者本人实施，须主循环另作窄审；此前两个 Important 当前反例独立复测通过的结论不受影响。
