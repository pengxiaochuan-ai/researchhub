# C01三列已审核字段 · 本机验证

日期2026-11-11；[规格](../product/c01-reviewed-study-fields-2026-11-11.md)。当前目录串行实施＋独立总评，仅wp01_test_full_baseline。未改旧系统、角色、Schema、源/提取/审核数据、AI或计费。

## 结果

原clinical-registries接口增加最小studySummary；同SQL复用C03当前registryProjection，仅有效当前公开书目＋最新源/提取/hash/详情审核/同ref时返回。内容只有研究类型SourceField、原顺序分组干预SourceField、schema2负责单位及提取/hash/审核标识；设计/结局/全文不进新列表DTO，不新增AI用途。C01原12列仅填三列，其他四缺失项保持未提供，不把注册日期、预注册混入其他日期/状态。

实际两条研究类型均干预性研究，分别4/2组干预原文、负责单位中国中医科学院针灸研究所。匿名/owner/admin完全一致，与同ID C03逐字段/提取hash/审核版本一致。68个本轮前queued逐行保持，源/版本/提取/审核/授权聚合哈希和两条原AI片段不变；0模型调用、0新增费用、无发布。

## 验证结果

| 层级 | 证据与限制 |
| --- | --- |
| 后端TDD | 新studySummary缺失RED；初始新头反例重复payload/hash触发约束，修正合成反例并保留日志，2/2真PG全强制回滚 |
| 独立评审修补 | Important为故障测试相互污染。先加每故障approved前置出现pending!=approved的RED；再保存点独立故障/ROLLBACK恢复approved。撤销、过期、错ref、坏hash(unavailable)、未审新头(pending)、nonpublic、源2换头分别验证，不由另一个门禁遮蔽。最终PG通过 |
| 前端TDD | 缺纯行组件RED→2/2，验证12单元格、完整干预、原链接、旧响应/未批准不泄漏、不填其他字段 |
| 完整前端 | 341/341，node --test --test-concurrency=1 tests/*.test.mjs，无跳过 |
| 相关后端/真PG/真HTTP | 最终29/29，含C01新投影、H01摘要、仅展示审核、指标/论文和契约；非旧系统全部历史测试 |
| 实际接口 | c01-reviewed-study-fields-check.mjs verify三身份/两篇详情/原68queued/源审核与AI哈希保全通过，无业务写入 |
| 构建 | pnpm run build成功4.41s，原大chunk警告保留；无lint/typecheck脚本，未宣称已运行 |
| 浏览器 | 两账号C01→首/次C03→原返回列表；owner注册号搜索、无结果、重置正常。1045×1194及389×1260实测，原横滚下末列Tab可达，14/22字号保持，主内容clientWidth=scrollWidth |
| 布局 | 原12列/顺序/工具栏与外容器坐标保持；内容自然增宽1219.47→1585.49px，首行90.75→112.76px，未改CSS/缩字/截断或重组。不是逐列宽度或行高完全相同 |
| 控制台 | 留存1次开发HMR的重复createRoot警告；完整重新加载后0新增warn/error，不把历史警告删掉冒充从无警告 |

独立评审未发现产品静态阻断；唯一Important已一轮RED→GREEN修补并重跑相关套件，没有假称独立二次复审。Set-aside的旧HTTPS引用兼容按既有共享契约保留，不扩改权限底座；实际角色/窄屏/布局判断由上述浏览器回答。

未做浏览器网络故障注入、320px或200%缩放，不冒称通过；未开放高级筛选、导出、地图、趋势，也不是整个C01所有功能完成。本机技术交接不等于专业验收或生产发布。

## 证据

目录`docs/testing/evidence/c01-reviewed-study-fields-2026-11-11/`。

- before-api.json、api-verification.json、http.log/http-final.log：只读基线、三身份/同篇和全保全。
- pg-red.log、pg.log、independent-fault-red.log、pg-independent.log：RED/错误反例/独立故障GREEN均保留。
- ui-red.log、ui.log、frontend.log、backend.log/backend-final.log、build.log：341/29/构建与修补。
- before-layout.json/before.png、after-owner/admin-layout.json及截图、layout-verification.json：实际自然尺寸差异。
- owner-search.txt、owner-no-result.txt、owner/admin-c03-first/second.txt与截图：真实流程。
- narrow-left/right.png、narrow.json、medium-layout.json/medium.png：真实有效视口及末列焦点可达。
- final-owner.png/txt、console.json、console-fresh-load.json：最终科研人员入口及警告区分。

下一项建议：在原C01筛选区接通研究类型、疾病与干预筛选，仅按已审核字段；其他缺失状态不推断，需另行授权实施。
