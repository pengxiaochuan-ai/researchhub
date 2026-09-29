# ADR-001：冻结 Global UI Foundation 与公共 Shell

## Status

Accepted

## Date

2026-09-23

## Context

不同页面来自独立压缩包，各自实现 Topbar、Sidebar、Breadcrumb、Header 和 Tabs，导致 Logo、坐标、字体、页面高度和信息架构持续漂移。逐页修图无法防止下一次接入重新引入差异。

## Decision

采用“固定 Foundation + 固定 Shell + 固定 Components + 不同业务内容”的架构：

- Design Tokens 集中在 `src/design-tokens.css`。
- Global Topbar、用户信息、Sidebar、Breadcrumb、Page Header 和 Context Navigation 由 `src/` 公共模块统一挂载。
- 历史页面的 Shell 结构在运行时隐藏或替换，业务 Content 保留。
- 页面上下文由集中映射声明，不允许业务页面自定义平台一级导航。

## Alternatives Considered

### 继续逐页调整 CSS

拒绝：修改成本随页面数量线性增长，且无法阻止新压缩包复制旧偏差。

### 立即重写所有业务页面

拒绝：会改变高保真母版对应的页面结构和内容，风险过高。

## Consequences

- 新页面必须登记上下文映射才能进入平台。
- 修改全局尺寸或 Token 需要新 ADR、版本升级和 19 页回归。
- 历史页面仍可保留独立源码，但不能覆盖公共 Shell。

