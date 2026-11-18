# T17 专业可读性增量实施与验证

范围来自本轮 T17 授权：新报告可信变量展示封套、历史模板双分支、仅新正式报告真实 Word 表格。未改 UI、运行进程、权限模型、Worker、数值算法、DDL 或既有业务记录；所有保护 PG 验证均为全新独立合成作用域，事务回滚，MinIO 对象清理。主三例未触碰。

## 实现

- `t17-report-content.mjs` 三参数调用仍生成原模板，旧完整产物 golden 为 `35ec0b62c2bfbb6188e7bb23077db3e16b610b1fbb53c0a926862f47d877a8ce`；正文、block、两项来源及各摘要未变。第四参数明确选择 `formal-report-presentation-v1`；非法/未知/缺项封套不降级。
- 新建报告只用 `analysis.assertCurrent` 已验证的批准计划 manifest，从精确 scope、已发布/锁定的固定 FormVersion 再导 label/type/unit/field。每个 manifest cell 的 formVersionId/fieldKey/formDefinitionHash 必须与真实固定表单及 `{schema, scoring ?? null}` canonical hash 一致。不接受请求中的标签。未声明单位保留 null。
- 新封套同时封存在 `contentBlocks[0].presentation` 和 data_snapshot 来源的 snapshot.presentation，参与 sourceSnapshotHash。当前读取/审核/发布/导出先走原授权、同意、计划、质量与来源重验，再导可信封套并重建、比较完整正文、block、两项来源及各 hash。历史无封套只走原模板。FormVersion SHARE 锁位于 Run/Artifact/Job 锁之前；list cache 按 Run + 新旧模板模式区分。
- 新主表只显示中文变量名、单位、指标与固定原值。所有变量别名/字段/类型/表单版本/定义摘要、固定 JSON 路径、Run/算子/快照/依据摘要保留在附录。数值仅复制已确认持久 Run，不重算、补值或舍入。科学符号 `< > |`、反引号、`&` 安全转义后保留原义。
- 新专用 `formal-report-docx.ts` 只处理 analysis_report 的新 formal presentation 标记；固定受控两列表生成真实 Word table，A4、表宽 9026 DXA、两列各 4513、每个单元格匹配，重复表头与不拆单行。使用当前环境可用 Hiragino Sans GB（包含东亚字体设置），复用既有标题/页眉/页脚。其他产物及无标记旧报告继续原 paragraph renderer。未增加依赖。
- 原 `t17-reports.mjs` capabilities/当前权限/availability 代码保留。

## RED 与验证证据

1. `.tmp/t17-presentation-red.tap`：先增加契约测试，新封套、受控表格及可信派生 5 项如期失败；旧完整 golden 与旧 renderer 2 项通过。
2. `.tmp/t17-presentation-punctuation-red.tap`：科学符号保持 2 项先失败；修复只作用新展示分支。
3. `.tmp/t17-presentation-green.tap`：17 项通过，含原模板数值证据拒绝、来源改变阻断、失联回执/重复渲染防护、legacy golden、新 alias/label/unit、重复标签、篡改/缺项/未知标记、真表/A4/DXA、科学符号与其他 artifact 旧 renderer。
4. `.tmp/t17-presentation-existing-pg.tap`：原真实 aisci_app PG 全流程 1/1，通过创建/幂等/审核/发布/真实 renderer、权限、回执、失联与同意撤回阻断；该回归的存储是显式 double。
5. `.tmp/t17-presentation-pg.tap`：新增真实 aisci_app PG + MinIO put/读回 + DOCX 1/1，16.4 秒内通过现有 20 秒 fixture guard，未放宽保护。别名 v1/v2/v3 与真实中文表单字段/空单位一致；新插入的自洽伪标签/正文/来源/摘要仍被可信重导拒绝；null/unknown 标记拒绝；旧无封套记录正文/来源 hash 不变；真正数据库版本 UPDATE 也由 immutable guard 拒绝，无绕过触发器。下载 Word 主表每格均与实际持久 Run `String(value)` 严格相等，来源 outputs/numericEvidence 与该 Run 严格一致。
6. `.tmp/t17-legacy-renderer-regression.tap`：用独立 `.tmp/t17-presentation-renderer-dist` 完整编译产物运行原 exporter 4/4，通过普通 DOCX、实际 PDF Worker、Markdown、协议数值来源及文件名回归。未覆盖共享 dist。
7. `.tmp/t17-presentation-tsc.txt`：完整 server tsc --noEmit 通过（空输出）。

后续重复 PG 测试仅写唯一目录 `docs/testing/evidence/research-t17-2026-11-12/presentation/runs/<fixturePrefix>/`，不覆盖已经 QA 的证据。最终视觉样本另只读封存到 `docs/testing/evidence/research-t17-2026-11-12/presentation/final-015d9c95/`：DOCX SHA `015d9c950f76b08cf2f7c5cf517bb6888b4f99929db0d85ba8db979eb2b96c70`、同名 PDF、page-1…5.png、storage contract、Word XML 验证。XML 确认 6 个真实表格（3 主表/3 附录表）和完整标签、单位/固定路径/来源摘要。

实际转换使用 bundled soffice + Poppler，任务专用 FONTCONFIG_FILE `.tmp/t17-docx-fonts/fonts.conf` 指向系统中文字体；不修改旧 DOCX 文件或全局字体设置。默认转换环境曾中文缺字，根已用同一旧文件字节证明是渲染环境配置，不能据此改旧模板。根之前逐页 QA 的 0c3b10…1179b 属于前一次独立 fixture；最终 015d9c95 文件/图像单独保留，须以相应最终 root review 记录为准。

## 数值持久化边界（不在本次修改范围）

本地 test-only Run 声明的样本标准差 JS literal 为 `2.8284271247461903`。同一合成 fixture 实测：Prisma create 返回、delegate 再读、保护 SQL `artifactRefs::text` 的 jsonb 数值 lexeme、`numericEvidence::text` 和 delegate 全部已经是 `2.82842712474619`。差异在现 Prisma 写入/持久化边界已存在，早于报告 builder/renderer；本次不修改统计、Prisma 或已存结果。

报告来源快照与每个 Word 主表单元格严格复制实际持久 Run 与 numericEvidence。测试保存该原始差异（presentation-storage-contract.json 的 transportBoundary），不以 JS fixture 声明冒充数据库读回事实，不在报告层舍入或补回位数。独立 Worker/Python 数值验收仍由主流程按其预定契约进行，不能用本次合成 completed Run 代替。

## 冻结和交接

产品源码 SHA256：

| 文件 | SHA256 |
| --- | --- |
| server/research-analysis/t17-report-content.mjs | f5fcbaa83601db5e63f69dd54638e35eb00003b8578d3f8ff11096dd5f57ae99 |
| server/research-analysis/t17-report-presentation.mjs | 9b1cb435765dc0fb17d968ee4c68492f8b25a6a024486cb0ee0ffc50c5cfe915 |
| server/research-analysis/t17-reports.mjs | d6c449c7114384a8c9693e001f24296e6ae402b41abc6ba574bc15ebb39c8d3f |
| app/server/src/research-artifacts/formal-report-docx.ts | f25e58b1ad171adbd7fa296aceacd4c85e279b494731f58aa00ca36f67efe98b |
| app/server/src/research-artifacts/research-artifact-export.ts | 5c8d06d42ac87d976ce43602f75e3c6e4ed698ab9f5bfbb79b16b0076b5c26ce |

T05 接独立窄审；根接最终文件逐页 QA、合并 living spec/版本/使用说明及 Notion、受控重载、目标 HTTP 与主案例 S10 验收。本次证明代码与保护环境服务契约/真实文件存储，不宣称生产启用或主案例真实 Worker/专业报告业务验收已完成。

## 目标 HTTP 增量验收（根审阅与明确执行信号后）

2026-11-12，实际实例 PID 47879，19501。同一 D6 非主三人合成队列：批准依据 `rh-t15-http-d6e26d6a`，真实 Methods/Worker 接口证据 `rh-t16-http-37fe04a1`，Run `cmwd5ueyg002alu4etltfv96b`。三个 subject 与主三例显式无交集。没有重跑 Worker、改答案、改身份或发送邮件。

执行脚本 `scripts/research-t17-presentation-http.mjs` 最终 SHA256 `afefb989edf331f4e1a7cb0434b89fb21e49980acb496f23f782d2cac712a49d`。原私有 journal 跨次保留，同一 campaign；未知只 GET 原回执并停线，不自动重复 POST、不恢复队列。只有最后通过的这一轮进行了业务写入。

保留的先前证据：`rh-t17-presentation-http-c9bd36a6/failure.json` 为旧 owner 列表403预期已过时；READ ONLY DB 证明 owner 现有 group 范围 artifact.read/create，详情仍受数据权守门。`current-role-readonly.json` 保存完整当前菜单/按钮/Study身份与 uninvited 无成员证据；进一步只读请求曾遇共享服务 ECONNREFUSED，没有自行重启。`rh-t17-presentation-http-4fb6253e/failure.json` 为 owner 实际403但外层精确 code 是 RESEARCH_FORBIDDEN，脚本原限定 ANALYSIS_FORBIDDEN；两轮均 **0 POST、pending=null**。根逐项核准后只修 harness 预期，未改权限或放宽为任意失败。该目录 `role-status-readonly.json` 也实证 uninvited 404/RESEARCH_NOT_FOUND。

最终成功证据唯一目录：`docs/testing/evidence/research-t17-2026-11-12/rh-t17-presentation-http-7b2f86c6/`。

- `result.json`：passed=true，全部真实 HTTP 路径、状态、原 requestKey、回执、当前来源/封套、Word 逐格值与 paths。8 次 POST：管理员 create/review/release/export 各一次200，只读研究者四项写各一次403 REPORT_FORBIDDEN；无 POST 重放，journal.pending=null。
- 管理员 list/read 四位全 true；t17-reader-session list/read 四位全 false。owner list200、canCreate=true/其余三位false，旧报告元数据 blocked，无正文/原值；old/new详情403 RESEARCH_FORBIDDEN。真正 uninvited list/old/new详情404 RESEARCH_NOT_FOUND。未知报告/任务/回执404。
- 旧报告 `rh-formal-report-73f4048d-596e-4393-ada5-dff3713f9839` 的正文、完整 legacy 重建、两项来源与摘要、固定 Artifact/Version/Source/File/Job 行均不变；下载前后原 DOCX 与 2a6c2f05 文件逐字节相等，SHA256 `d5ea2fce939bd6234e67556520b96361d5fdf74e8c5da809d17c766f66815ffd`。受控 GET 下载按原治理追加审计，不修改固定报告记录。
- 唯一新报告 `rh-formal-report-50d2db81-1c09-49de-8965-4799de91c4f3`，导出任务 `cmwdcu46n003fluxzm08ehq6y` ready。批准前先从当前可信表单重导封套并比较正文/两项来源/全部 hash，之后才进行人工审核、发布和导出。
- 实际受控 StorageService/MinIO 路径下载 `new-presentation.docx`，SHA256 `20d7ecc2ca3c6c22a34f1244149bdf7705aa30c080041337eb879b874595db1e`，12601 bytes；API 文件摘要、下载头和实际字节一致。6 个 Word 表格、A4/DXA 全部验证，所有主表单元格严格等于实际持久 Run 的 String(value)，未重算/舍入；完整固定 JSON 路径及字段/表单/摘要附录保留。
- 同目录 `new-content.md`、`new-pre-review.json`、`legacy-read.json`、`role-metadata.json` 保存核对依据；`new-presentation.pdf`、`page-1.png`…`page-5.png` 为该最终 DOCX 的任务专用中文 fontconfig / soffice / Poppler 渲染，5页 A4，供根最终图像与业务输入核验。两份渲染日志同目录。

新 `.tmp/researchhub-workflow/t17-presentation-http-current.json` 只在通过后写入，旧 `t17-http-current.json` 仍指向2a6c2f05。产品五文件源码 SHA 与上表完全一致。该轮已证明非主三人真实既有 Methods Run → 目标 HTTP 报告/审核/发布 → 实际私有文件存储/下载与专业表格结构；S10 浏览器、主案例与临床/生产验收仍分别记录，不由这一轮代替。新增本节及最终图像记录由根统一合并产品文档与 Notion。
