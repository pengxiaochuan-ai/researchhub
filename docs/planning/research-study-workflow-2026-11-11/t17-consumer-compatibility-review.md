# T17 直接消费者只读兼容核验

2026-11-12，19501 实际实例 PID 50403（开始/结束一致），owned 合成租户。范围仅 P01/A01/A02/G01 与旧 generic Artifact 直接消费者；未改页面、后端、身份、权限或资料，未创建 fixture，未写产品 living/baseline/manual 或 Notion。

结论：本轮实际 GET 与导航未发现正式报告绕过路径；不能把未装配页面/接口写成已实现。唯一证据目录 `docs/testing/evidence/research-t17-2026-11-12/rh-t17-consumers-ro-1e8ca52f/`，含可复现 GET-only probe、result、网络状态/响应摘要、13 PNG、正文观察及 1 WebM。真实网络全部 GET，非 GET 拦截数0，页面异常0。未重新验收旧专项的编辑/派生/审批流程。

精确对象：D6 新 formal `rh-formal-report-50d2db81-1c09-49de-8965-4799de91c4f3`；原 legacy formal `rh-formal-report-73f4048d-596e-4393-ada5-dff3713f9839`。两者使用实际既有记录，不构造失效数据或修改来源。

| 消费者 | 当前装配与源码边界 | 实际只读结果 |
| --- | --- | --- |
| P01 我的科研草稿/预览 | `/api/my-research/overview` 已装配；`scripts/my-research-overview.mjs:41` 按本人/授权项目/draft 查询，并显式排除 formal ID 前缀；预览入口按受控 workspace family 投影 | 管理员110条个人草稿完整22页，两个 formal ID 均不出现。浏览器 P01 只访问 overview/directory/auth，不请求正式报告正文 |
| A01/A02 合成资产候选 | `/api/research-asset-drafts` 已装配；`scripts/local-synthetic-assets.mjs:13` 仅本人固定 scope 的 research_report/draft/自身 prefix，读取后再验 ASSET_MARKER/seal/来源 | 列表200且不含两 ID；两 ID 的详情、versions/1 共4 GET 均403 ASSET_FORBIDDEN。实际 A02 错误页无正式正文，不回退示例 |
| A01/A02 方法资产候选 | `/api/crf-method-asset-drafts` 已装配；`scripts/local-crf-method-assets.mjs:42` 仅本人固定 scope/type/draft/CRF prefix；`:58` 在读取版本前先核受限父 Artifact，之后还验目的授权、seal与原来源 | 列表200且不含两 ID；两 ID 的详情、versions/1 共4 GET 均403 CRF_ASSET_FORBIDDEN。实际 A02 清除候选内容并显示不可访问，无正式正文 |
| 旧方案草稿（P01 直接目的页） | `/api/research-plan-drafts` 已装配，受控方案草稿域 | 列表200；两 ID 的详情及versions/1均403 PLAN_FORBIDDEN；现存正常方案仍200 |
| A02 通用 assetId URL | 页面存在，当前真实路由不认 formal 报告为普通资产；`src/real-mode-route.js:39` 落 pending | 浏览器注入真实 formal assetId 后显示“此页面暂不可用…当前页面不提供研究数据或AI结果”，仅 auth GET，无产物数据请求 |
| G01 人工审查与审批 | `src/real-mode-route.js:22` 为 pending，当前没有 formal 报告审核消费者 | 两 ID 分别作为既有 outputId 路由上下文导航，均为明确不可用页，仅 auth GET，无正文/数值/审批调用。此项证明没有旁路，**不代表 G01 审批功能已启用** |
| 旧 generic Artifact / Export / File 控制器 | 主应用源码存在；当前 standalone `scripts/local-knowledge.mjs` LocalRoot controllers 没有注册它们 | base list、两 ID 的详情/版本、两实际job与file content共9 GET均返回 `404 Cannot GET …`；普通旧候选经同generic路径也404，证实是未装配。不能宣称目标环境执行了409正式边界 |

普通旧产物读取反例（均真实既有、未新建）：

- 合成资产候选 `cmvkua4hx001ylun7uq98qoe7` GET200，历史来源状态 `stale`，只证明合法历史只读仍可交付，不把它称为当前可复用。
- 方法资产候选 `cmwbh3qdr001iluv7u3t1iokb` GET200，`current`，固定 hash `b770c1edc073b37bff7b301951134e7b1952cc1f318e72df7c6b0a46dcb2a1ad`；真实 A02 详情可读。
- 普通方案 `cmvwinz460006luzuxgnqlddo` GET200，`current`，v13。未重新生成方案或调用模型。

旧主应用 generic 边界仅本轮静态窄读：`app/server/src/research-artifacts/formal-analysis-boundary.ts` 对 formal 前缀抛409 FORMAL_ANALYSIS_ROUTE_REQUIRED；Service 的 get:2369、requireArtifact:503（getVersion:2417复用）、getExport:3162、文件内容:3392 均调用；list:643 和 generic worker 候选查询排除前缀。其保护 PG/单测证据属于先前 T17，不以本轮路由404冒充真实执行。

限制：这两份 formal 实际属于 D6 执行项目，旧候选 API 固定的是其原授权项目；本轮精确 ID 403 是整个受限候选域的拒绝，不宣称已单独隔离每个 where 条件。类型、draft、owner/prefix/marker 等防线由当前源码共同确认。依授权未撤回同意、改状态或创建同 scope 伪候选；来源失效场景仍由 T17 既有保护 PG 与正式端当前检查证明。本轮没有放开或启动 G01/旧 generic 模块。
