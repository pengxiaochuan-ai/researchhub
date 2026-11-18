# T17 根集成核对（2026-11-12）

范围：当前权限DTO、可信字段展示增量与新正式DOCX；不覆盖整个dirty工作区，不发布生产，不将契约fixture当真实Methods/主案例。

已逐行核对当前list/read动作位复用当前DB账号与角色权限；仅REPORT_FORBIDDEN转false，身份版本撤销继续拒绝；DOCX可用同时要求storage、worker kind与允许tenant。原普通读权限、状态/来源重验独立存在，权限位不代表可导出。根独立执行真实保护PG，`.tmp/t17-capabilities-root-independent.tap` 1/1通过（fixture含多角色、失效身份/来源、零额外audit/job断言，全回滚；存储替身仅契约）。

新展示从assertCurrent的manifest与同scope固定FormVersion重导，逐cell核schema/scoring定义摘要及字段/类型/单位；共享源锁先于Run/Artifact/Job锁。旧无presentation格式仍原三参构建，新marker必须经可信重导和完整正文/封套/来源摘要对照，不能降级或只自信任存储label。数值仍复制当前已确认Run，新模板主区与附录不计算或四舍五入。现Prisma持久化对test-only literal末位的既有差异已由作者用create返回/delegate/jsonb::text留痕；本核对不改统计或全局序列化边界，最终报告必须严格等于实际已确认Run。

仅新formal marker走新Word helper：固定A4、DXA表宽/列宽/单元格一致，受控两列表和完整路径附录；其他产物与无marker旧DOCX保留旧renderer。根使用最终独有目录`presentation/final-015d9c95/`的实际PG/MinIO下载文件（SHA 015d9c950f76b08cf2f7c5cf517bb6888b4f99929db0d85ba8db979eb2b96c70）逐页检查五页：中文名称/未声明单位/0/小数/真表格及续表头、完整复核映射和来源可读，未见裁切重叠。根另跑docx skill的OOXML schema validator，通过且未repair；图像与日志见该目录`root-visual-review.json`。默认bundled LibreOffice缺中文是本地fontconfig边界，使用任务专用系统字体配置后渲染，不改DOCX字节。

当前以上范围无未解决的阻断项。T05另作presentation独审，不复签自己caps。目标运行已被本轮之外改为42310（17:19:43）；旧cookie、固定fixture、19501与正式report新caps已只读核验；具体新模板真实HTTP/S10与主案例仍待执行，不能由此销项T17业务层。最终产品文档/版本/使用说明及Notion须随该业务层关闭同步。

冻结产品源：
- `server/research-analysis/t17-report-content.mjs`: `f5fcbaa83601db5e63f69dd54638e35eb00003b8578d3f8ff11096dd5f57ae99`
- `server/research-analysis/t17-report-presentation.mjs`: `9b1cb435765dc0fb17d968ee4c68492f8b25a6a024486cb0ee0ffc50c5cfe915`
- `server/research-analysis/t17-reports.mjs`: `d6c449c7114384a8c9693e001f24296e6ae402b41abc6ba574bc15ebb39c8d3f`
- `../app/server/src/research-artifacts/formal-report-docx.ts`: `f25e58b1ad171adbd7fa296aceacd4c85e279b494731f58aa00ca36f67efe98b`
- `../app/server/src/research-artifacts/research-artifact-export.ts`: `5c8d06d42ac87d976ce43602f75e3c6e4ed698ab9f5bfbb79b16b0076b5c26ce`
