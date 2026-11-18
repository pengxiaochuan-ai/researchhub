# H06 指南与研究标准真实只读接线实测

日期：2026-10-31。仅本机专用合成环境 `127.0.0.1:19501`；无付费模型、旧服务、临床库、云资源或生产发布变更。

- 代码/API：`GET /api/hub-sources/guidance-documents` 复用首批五份的当前 v1、文件哈希、具名初始身份和最新有效公开书目展示批准门禁，仅返回两份 `research_standard` 与一份 `clinical_guideline` 的获准字段。回滚 PG 夹具中，批准三条非临床来源后 H06 投影为 3 条，C01 仍为 0；另对一份标准验证批准→撤回→重新批准→导入新版本后不可见，所有操作回滚，持久数据库不写决定。真实 HTTP 返回 200、`Cache-Control: no-store`、`items:[]`。
- 页面：H06 真实模式不再显示守门或固定示例；无批准为空态，搜索只作用于获准列表；无已核验教材，原 PDF 无链接/下载，正文和 AI 不提供。显式演示模式保持。
- Chrome：桌面 1440×900、手机 390×844/320×700、原生 200% 共 4 项真实接口空态与视觉检查，API 均 200、无横向溢出，手机平台导航可操作；另 2 项拦截式合成契约检查 503→重试、两类卡片、搜索、无原件链接和原生 200% 非空回流。该拦截数据不能证明真实权利审核。PNG/WebM/结果：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-guidance-source/browser-c2dfd39b/`。第一次扩展脚本因把合成拦截响应计入 4 条真实响应而红灯，已用响应标记区分后复跑通过；不记为产品故障。
- `node --test tests/real-mode-route.test.mjs tests/clinical-registry-ui.test.mjs server/hub-sources/external-visible.test.mjs server/hub-sources/review-controller.test.mjs` 合计 18/18；`npm run build` 通过，既有大 chunk 提示不影响构建。H01/H05 手机 Shell 17 项与当前 52 页桌面 Shell 冒烟再次通过，证据 `/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-h0-mobile-shell/browser-6cdadab3/`，不代表 52 页业务接线。

独立只读评审原结论为 0 阻断实现问题，指出两项 P2 验证缺口：标准/指南撤回与换版直测、失败重试和非空 200% 布局。作者已按上文补测；未做第二次独立复签。

未完成：三份初始标准/指南的具名管理员权利与内容审核；暂无非空真实来源业务体验，也未交付正文、教材、指南详情或 AI 解读。此切片仅技术接线，专业用户与生产均未验收。
