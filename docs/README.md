# 岐研项目文档中心

本目录是产品、设计、技术与测试规则的唯一文档入口。新页面、压缩包接入和自动化修改必须先读取相关规范，不允许从某个历史页面反推新的全局规则。

## 目录

| 目录 | 作用 | 必读文档 |
| --- | --- | --- |
| `product/` | 产品架构、术语、用户旅程和页面职责 | `product-baseline.md`、`product-changes.md` |
| `ui/` | Design Tokens、Shell、页面头、布局实施和组件规范 | `demo-ui-foundation-v1.0.md`、`navigation-page-header-standard-v1.0.md`、`page-layout-practice-v1.0.md` |
| `technical/` | 工程结构、页面接入、公共模块和运行方式 | `frontend-architecture.md` |
| `testing/` | 构建、浏览器、视觉和交互验收标准 | `ui-acceptance.md` |
| `decisions/` | 不应被重复讨论或随意推翻的架构决策 | `0001-freeze-global-ui-foundation.md` |
| `reference/` | 页面编号、路由和上下文映射等查表资料 | `page-context-map.md` |

## 文档优先级

1. 用户本次明确要求。
2. `docs/decisions/` 中状态为 Accepted 的 ADR。
3. `docs/ui/` 和 `docs/product/` 的已发布版本。
4. `docs/technical/` 与 `docs/testing/`。
5. 历史页面源码和旧压缩包。

当源码与规范冲突时，应修正源码或记录例外，不能复制冲突继续扩散。

功能、业务逻辑或业务模型变化时，更新 `product/product-baseline.md` 的现行条款，并在 `product/product-changes.md` 追加记录。`product/` 中两份 Workshop 恢复文档是历史材料，不作为现行模型。

