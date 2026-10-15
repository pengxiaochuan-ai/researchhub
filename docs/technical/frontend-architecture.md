# 前端架构与页面接入

## 工程模型

每个高保真页面保留独立入口 `pages/<page-id>/`，避免不同压缩包中的同名文件覆盖。公共能力位于 `src/`：

- `design-tokens.css`：Foundation 与 Layout Tokens。
- `platform-header.js/css`：L0 Global Topbar 和用户信息入口。
- `platform-user.js`：独立用户状态适配层。
- `platform-shell.js/css`：统一 Sidebar、Breadcrumb、Page Header、Context Navigation。
- `platform-navigation.js`：页面路由与一级导航映射。
- `page-linking.js`：跨压缩包页面链接、公共 Shell 挂载和交互装饰。

## 接入新页面

1. 使用 `scripts/Add-Page.ps1`，页面编号必须唯一。
2. 在 `platform-pages.json` 登记路由、母版和来源压缩包校验值。
3. 在 `platform-shell.js` 增加页面上下文映射，不得在业务页面复制 Shell。
4. 在 `page-linking.js` 增加页面内可点击关系。
5. 运行 `pnpm run build` 并按测试规范完成浏览器验收。

业务页的 `<main>` 必须带 `class="platform-main"`，并按 `docs/ui/page-layout-practice-v1.0.md` 处理顶栏偏移、24px 页边距和滚动。历史样式里的 `main { padding-top: 70px }` 对应已废弃的 70px 页头，不能继续生效。

## 扩展用户身份

认证系统通过 `setPlatformUser()` 或初始化 `window.__QIYAN_USER__` 对接。业务页面不得自行绘制另一套用户区域。

## 已知兼容策略

历史压缩包可能在 React 首次渲染时覆盖公共 Shell。`page-linking.js` 使用受控 MutationObserver 在首次渲染完成后重新挂载；不要删除该时序保护。

## 灵枢心域与工程基准

本仓库采用React18/Vite多页面工程，是唯一开发基准。P002开放门户无需工作区Shell，独立CSS不注入其他页面。P002的动态素材路径由既有Vite构建插件复制到dist/pages/p002/assets，源素材仅在pages/p002/assets维护。其他业务页面仍使用公共Shell。六份外部附件的原文归档在docs/reference/lingshu-v1；Vue建议不触发技术栈迁移。


## 本机演示适配层

`src/route-context.js`控制允许的跨页标识与站内返回；`src/demo-research-store.js`统一本机读写、版本和复用来源；`src/platform-frontend.js`消费公共搜索/通知/菜单事件。PublicPages独立门户布局，WorkflowPages复用公共Shell。既有详情在有自定义研究上下文时展示对应本机对象，没有对象上下文时保留历史示例。真实服务需要独立认证、授权与数据接口，不能把localStorage视为后端或安全边界。
