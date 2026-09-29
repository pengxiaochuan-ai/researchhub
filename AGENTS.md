# 岐研项目 AI 开发规则

任何 AI 编程工具修改本项目之前必须按顺序读取：

1. `README.md`
2. `docs/product/product-baseline.md`
3. `docs/product/product-changes.md`
4. `docs/ui/demo-ui-foundation-v1.0.md`
5. `docs/ui/navigation-page-header-standard-v1.0.md`
6. `docs/ui/page-layout-practice-v1.0.md`
7. `docs/technical/frontend-architecture.md`
8. `docs/testing/ui-acceptance.md`
9. `docs/decisions/` 中所有 Accepted ADR

不可违反的规则：

- 高保真图是业务内容视觉母版，不重组页面正文。
- 平台一级导航只能是“我的科研、领域研究、岐研 AI、科研资产、管理与治理”。
- 新页面复用公共 Shell，不复制 Topbar、Sidebar、Breadcrumb 或 Page Header。
- 不允许业务页面自行定义全局字体、颜色、Shell 尺寸和用户身份区。
- 同名压缩包文件不得覆盖其他页面；使用唯一页面编号接入。
- 完成修改后必须构建并在真实浏览器中验收。
- 功能、业务逻辑、业务模型、对象层级或页面职责有变化时，同一轮更新 `docs/product/product-baseline.md`，并在 `docs/product/product-changes.md` 最上方追加记录。现行产品模型以产品基线为准。

## UI reproduction rules

When recreating a UI from a screenshot, PNG, Figma frame, or mockup:

- Treat the supplied visual as the source of truth.
- Reproduce it; do not redesign or improve it.
- Record the source viewport dimensions before implementation.
- Measure layout, spacing, typography, colors, borders, shadows,
  radii, image crops, and alignment.
- Use supplied assets and fonts whenever available.
- Never substitute visible assets with emoji or generic placeholders.
- Match the reference viewport before adding responsiveness.
- Run the application in a real browser.
- Capture a screenshot at the same viewport as the reference.
- Compare the implementation screenshot against the reference.
- Fix visual differences and repeat the comparison.
- Build success is not visual verification.
- Do not report completion until visual comparison has passed.
