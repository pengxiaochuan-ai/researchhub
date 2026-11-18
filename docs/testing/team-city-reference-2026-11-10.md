# T01三城市参考点 · 本机验证

日期：2026-11-10。范围仅本轮获批北京、上海、大连参考点，不恢复旧计划，不做正式发布。

## 结果与分层

| 层级 | 已观察证据 | 边界 |
| --- | --- | --- |
| 代码 | 先观察旧map仅省级无法满足城市点/UI说明的RED，再最小GREEN；三原件固定版本/SHA/声明/父链校验；城市参考仅只读DTO | 不增加可写profile坐标类型、表或角色 |
| 本机启用 | 专用合成库`wp01_test_full_baseline`；原具名独立runtime PID8700按身份核验停止，PID38493启动，7服务均ready；停止前合成导入/问答queued/running均0 | 不接临床库，不操作旧服务/云/远端配置 |
| 实际执行 | 真实管理员/科研人员GET均3城市、mapped3/unmapped0/regions0；匿名2城市，不含tenant-only北京；辽宁筛选1个大连、无匹配0标记；三份entity/workspace哈希和dataRevision前后完全一致 | 登录POST外无业务写入，无外部地图API/模型调用与新增费用；不更改团队资料/草稿/审核 |
| 用户业务验收 | 浏览器实际看到北京/大连/上海及“城市参考点不代表团队精确地址”；详情返回保留地图和辽宁条件；刷新、空态均验证 | 专业资料正确性、最终视觉签收仍由用户确认，不代签，不声称生产已部署 |

## 测试与独立总评审

- `node --test --test-concurrency=1 tests/*.test.mjs`：295/295通过，约12.1秒。
- `node --test --test-concurrency=1 server/directory/*.test.mjs server/reference/*.test.mjs`：92/92通过，约92.3秒，含真实PG回滚、来源/身份门禁及新城市/原省级回归。
- 定点17项通过（已包含在上述集合，非另算新增17）：坏原件/哈希/版本/声明/CRS/父级503、城市优先、同城显式来源不混挂、未知城市省级兜底、分页全集和空态、来源失效与权限/UI文案等。
- `pnpm run build`：退出0，4.21秒；既有WikiEditor/china大于500kB分块警告保留，不借本轮扩大构建优化。
- `/root/city_reference_review`先做独立来源核对，再读取本轮代码、原件和controller异常映射，独立重跑17项。未发现Critical/Important。代码结论不替代真实请求或用户验收。

## 浏览器与布局

使用真实浏览器及其Playwright locator驱动，不用SSR/静态截图冒充运行结果。桌面实际CSS视口1421×1419，同视口前后SVG边界完全一致：x268.7383/y416.4296/width745.0326/height547.8078；标记由北京/辽宁/上海更新为北京/大连/上海，未改CSS、字号、筛选、Shell或详情交互。控制台warn/error为0。

实走：全部3团队 → 地区辽宁（大连1）→ 团队详情只读 → 返回原地图/条件/锚点 → 清除 → 无匹配搜索（0标记）→ 清除 → 窄屏 → 恢复原视口 → 刷新（3标记）。

窄屏实际CSS宽389/358，三点及完整HTML团队名可见，说明14px/22px、地图纵排保留。358时document/body宽均358；389时document390/body389，记录1px页面级溢出，不冒称所有宽度无溢出。原SVG文字随viewBox缩小，窄屏注记仍偏小；未越权改字号/布局，用原下方完整城市与团队名辅助。未验证实际320或原生200%，未录视频。截图与本轮任务路径覆盖不等于全站/全无障碍验收。

## 来源与限制

[来源目录](../reference/city-map-2026-11-10/README.md)保存原JSON、固定版本、SHA、CC0及官方P625 WGS84依据。大连原precision1/60度、references0完整保留；precision不是误差半径。底图未声明CRS，只作全国近似参考点，不是质心、精确地址、导航或测绘级配准。大连MIIT链接独立直连404，不能声称官方实时核验完整。

## 证据

全部本轮证据在`docs/testing/evidence/team-city-reference-2026-11-10/`；前轮省级恢复证据目录保持不动。

- `before-api.json`、`after-api.json`：真实请求、源版本和原资料不变指纹，不存Cookie/密码。
- `before.png`、`after.png`、`final.png`：同视口地图对比及最终画面。
- `filter-liaoning.png`、`detail-readonly.png`、`return-map.png`、`empty.png`：真实任务路径。
- `narrow-389.png/json`、`narrow-389-widths.json`、`narrow-358.png/json`、`browser-result.json`：实际视口/度量、边界和控制台；widths文件补存独立评审要求的389视口/document390/body389原始度量。
- `frontend-tests.log`、`directory-reference-tests.log`、`build.log`：原始回归结果。

Notion已同步三份新规格/来源/验证及六份既有产品/API文档，全部读回核对；[本轮验证副本](https://app.notion.com/p/41456479ab588176a647d75ce496ef8c)。独立终评提出的宽度证据与“外部地图API”表述均已补齐，不涉及代码再改。

![本机三城市参考点](evidence/team-city-reference-2026-11-10/final.png)
