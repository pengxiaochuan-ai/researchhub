# C01来源更新时间 · 本机验证

2026-11-11。[规格](../product/c01-source-dates-2026-11-11.md)。当前目录串行＋独立只读核验及总评，仅专用合成环境。

## 事实与交付

| 来源 | 注册日期 | 来源最近更新 |
| --- | --- | --- |
| ChiCTR2300073486 / 200293.mhtml | 2023-07-12 | 2023-09-10 |
| ChiCTR2300077209 / 202558.mhtml | 2023-11-01 | 2024-05-14 |

两份解码HTML均注册为表1/行3/格2/113行33列、更新为表1/行2/格2/106行33列。MIME保存2026-10-30非更新时间，首次公示无可靠原字段。source_updated_on原已在v1库/admin预览，只投影获准书目字段；注册只用当前详情SourceField。空值/漂移不回填常量。原第10列两行标注，明确快照不等于官网今日状态。

## 验证结果

| 项目 | 本轮证据 |
| --- | --- |
| TDD | 新UI4、新真实PG2实际RED→GREEN；聚焦含原行/控件/筛选12/12，日期PG＋原摘要4/4 |
| 完整前端 | 354/354串行，无跳过；数量含当前目录已有测试，不全算本轮新增 |
| 相关后端 | 13/13含日期、摘要、display-only/AI、overview当前门禁/统计；非全旧后端回归 |
| 实际HTTP | 三身份public一致；两账号member同值；注册SourceField等于同ID C03；原admin预览更新与C01一致。另2/2原overview/C03真HTTP回归 |
| 保全 | 源/版本/提取/书目审核/详情审核/授权聚合hash、AI片段逐字、80原queued逐行保持；不写源/提取/审核/角色/Schema，0模型/费用 |
| 构建 | pnpm run build成功4.72s，原>500k chunk警告保留；无lint/typecheck脚本，不称已运行 |
| 科研人员Chrome | 默认两日期→抑郁症1条→同ID C03展开快照来源，注册2023-07-12与保存时间独立→原返回；最终恢复owner桌面日期视图 |
| 管理员Chrome | 轻度认知障碍1条→键盘Tab来源网站带动宽表横滚→同ID C03注册2023-11-01→原返回；冲突干预0、重置2 |
| 布局/字号 | 1421×1419工具栏x/y/width/height差0，原12列仅第10表头语义变化；日期14/22。表宽1585.49→1618.53px自然+33.03px，原横滚保持、main无外溢；非全几何不变 |
| 窄屏/键盘 | 实际389×1260/DPR约0.67，原工具栏换行、日期不缩字；Tab末列可达，横滚后日期格完整在容器内：x92.47–259.83，容器32.74–334.42，两条日期完整可读 |
| 控制台 | 全部历史开发记录保留；最终完整重载后0新增warn/error，不冒称全程无警告 |
| 独立总评 | 无Critical/Important/必改Minor；独立两个SSR6/6，不代PG/浏览器/专业验收。旧schema1额外专测搁置，原兼容分支/legacy UI缺失保持，不迁移旧提取 |

确认80queued无认领/租约、无导入在途后，本轮重载owned实例32851→39647。最终观察41552，非本轮发起的第二次重载；实际日期/原队列保全仍通过，不将共享环境PID变化当本轮产品修补。旧服务/临床库/远端配置/云及发布未触碰。

## 未测与边界

没有访问官网当前网页，不称所存快照今日最新。没有真实撤回/批准/改日期，PG反例全回滚。未做网络故障/在途乱序/未知身份浏览器注入、320px或原生200%。浏览器工具仅有截图/视口能力，无录屏接口；本轮PNG和真实操作/DOM证据，不冒称有视频。无表单/提交/AI动作，对应UE不适用。最终专业/视觉验收与生产发布独立。

## 证据目录

docs/testing/evidence/c01-source-dates-2026-11-11/：source-verification.md、independent-review.md；ui-red.log/pg-red.log/focused.log/pg-green.log；frontend.log/backend.log/build.log/http-final.log/http-regression.log；before-api.json/api-verification.json；before-layout.json/after-layout.json和前后PNG；owner-filtered.json/owner-c03.txt、admin-filtered.json/admin-c03.txt和双角色日期PNG；narrow-layout.json/narrow-date-readable.json及PNG；final-owner.png/txt和console-all/fresh.json。

建议下一项：先核对C01研究/招募状态的可靠来源和缺失规则，再决定接线；不以计划日期或“预注册”推断实际进度，本轮不自动实施。
