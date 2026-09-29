# UI 与浏览器验收规范

## 必过检查

1. `pnpm run build` 成功。
2. 19 个页面各只有一个 Global Topbar、一个 Platform Sidebar。
3. P01 无 Breadcrumb；其余页面 Breadcrumb 不超过四层。
4. 一级导航只包含五个冻结工作空间，且高亮与页面上下文一致。
5. Hub、Study、治理页面的 Context Navigation 与映射表一致。
6. 右侧主内容区可上下滚动，Topbar 和 Sidebar 固定。
7. 页面无山水、书法 slogan 和旧 Page Header 残留。
8. Logo、favicon、字体、颜色、尺寸来自公共 Tokens。
9. 业务页 `main` 含 `platform-main`。有公共页头时，顶栏下沿与面包屑之间无画布缝（上内边距 64px）。P01 上内边距为 80px。
10. 页头背景贴侧栏。面包屑文字、标题卡片和正文左缘同为 24px，栏间距为 16px。
11. 工作区可见字号不小于 12px。中文筛选项、Tab、表头不在词中间换行，固定高度不裁切文字。
12. 多栏工作台各栏可独立滚动；对话输入框钉在列底，不随消息滚出视口。

## 视觉回归

- 主验收视口：1440px Desktop。
- 对照图：用户确认的 UI Foundation 和对应 `screens/` 高保真母版。
- 必须截图检查 H01、O01、O02、Q01、S01、A01、A02、AI01、G02；其余页面执行 DOM/尺寸扫描。
- P0/P1/P2 偏差修复后必须重新截图比较。

## 交互回归

- 一级导航五项均可跳转。
- Breadcrumb 中有页面映射的层级可返回。
- Context Navigation 已有页面可跳转；缺失能力只派发 `qiyan:context-nav`，不得伪造新页面。
- Primary CTA 已有目标时跳转；待接入动作派发 `qiyan:page-action`。

