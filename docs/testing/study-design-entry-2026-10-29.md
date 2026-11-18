# S02 Study 研究设计真实入口 · 本机合成实测

2026-10-29。本片复用原 Q02 本人研究设计草稿列表，作为有界 S02 的真实内容。无新增后端接口、数据表、角色或模型调用；不改旧服务、临床库、云或生产。

| 四层 | 本轮证据 |
| --- | --- |
| 代码 | `research-design-session` 新增 S02 精确作用域别名与去演示页头；`missing-main`只在有界真实路由挂原列表组件。契约测试先红后绿；组合回归与构建见本轮执行记录。 |
| 本机装配 | 专用合成环境 19501/19502 已启用；S02 走原 `/api/auth/me` 与 `/research-plan-drafts?limit=20`，未开启新模型调用。 |
| 实际请求 | 科研人员和管理员浏览器都收到本人方案列表 API 200；未受邀账号不发本人草稿列表请求，不显示他人草稿。 |
| 业务结果 | Chrome 四组通过：S01→S02、管理员手机、未受邀拒绝、无范围守门；桌面/手机 PNG、桌面 WebM，手机无水平溢出；S02 展示真实授权的当前 Study 名称。仅本人合成草稿，不是正式 Protocol、审批或专业验收。 |

证据：工作区根 `docs/test/evidence/2026-10-29-researchhub-s02/` 的 [result.json](../../../docs/test/evidence/2026-10-29-researchhub-s02/result.json)、[桌面图](../../../docs/test/evidence/2026-10-29-researchhub-s02/owner-desktop.png)、[手机图](../../../docs/test/evidence/2026-10-29-researchhub-s02/admin-mobile.png)、[桌面录屏](../../../docs/test/evidence/2026-10-29-researchhub-s02/owner-desktop.webm)。复跑脚本 `scripts/study-design-browser.mjs`。首轮手机沿用演示页1280px最小宽度导致溢出，局部 CSS 修复后全四组复测通过；没有把首轮失败抹成首次通过。

独立只读评审核对 S02 未发现阻断项，提出多 Study 场景应显式显示当前 Study 名称；补充后 Chrome owner 场景断言通过，并重新留存截图。限制：S02 只提供当前账号已授权 Study 内的本人草稿列表与原 Q01/S07/执行准备入口，不建立新的 Study 级正式方案记录。未受邀、跨 Study 或失权由既有认证与业务 API 拒绝；后台撤权后前端重聚焦/刷新再清空，无实时推送。专业验收与生产部署待独立检查。
