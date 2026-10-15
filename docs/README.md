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

## 灵枢心域整合入口

- [开发基准](technical/integration-baseline.md)：唯一工程、页面入口与快照边界。
- [门户功能设计V1.1](product/lingshu-portal-design-v1.1.md)：注册、登录、学术发起、帮助中心；尚未实现项标为设计建议。
- [原始附件与首页母版](reference/lingshu-v1/README.md)：原始V1.0资料保留不改写。

## 页面链路与补缺审查

- [功能补缺方案V1.0](planning/lingshu-page-gaps-v1.0/页面链路与功能补缺方案_V1.0.md)：32个现有页面、八步验证与六批补缺顺序。
- [页面串联地图](planning/lingshu-page-gaps-v1.0/page-chain-map.html)：打开现有入口、分类筛选与本次截图。浏览器打开可使用；预览服务地址可在地图中修改。

这些材料是审查与拟定实施方案，不代表新增业务功能已实现。

## 前端补缺实施状态

当前50个登记页面，新增18个门户与科研流程入口。本机演示的实现与验证见 [实施记录](testing/frontend-gap-implementation-v1.0.md)，原补缺审查地图保留为32页历史快照。真实服务接入边界与待完成能力在实施记录中列明。

## 灵枢心域用户路径与产品重定义 V2（2026-10-14）

用户已确认岐研多机构/多Hub及Hub跨机构共建；首期仍以灵枢心域领域体验为主。

- [产品需求PRD V2](product/lingshu-product-prd-v2.0.md)：对象、身份/权限、数据增量、治理与首期范围。
- [四类用户路径与页面功能 V2](product/lingshu-user-journeys-pages-v2.0.md)：四条路径、全部50页映射、7个拟定缺口职责与验收。
- [开发路线 V2](planning/lingshu-development-roadmap-v2.0.md)：通用底座、首个Hub、研究闭环与后续多Hub运营。

V2为后续目标方案，不是正式后端上线记录。原Hub创建无审批资料与V1.1门户建议保留为历史来源，与V2冲突时以后者目标为准；具体政策需评审后实施。

### V2.0专业材料修订R1

三份V2.0已按教授资料和“无EDC需建设采集”的确认更新。[专业材料分析与待确认事项](product/lingshu-professional-review-v2.0.md)记录2页PPT、文献表规模/质量、检索范围差异、代表注册研究核实结果及所需输入。原PPT/XLSX保持不变；未把资料分析当成科学去重或患者数据上线。

## 既有项目功能复用评估

[aisciencesys → 灵枢心域复用评估](planning/aisciencesys-reuse-assessment-v1.0.md)：基于eadac11源码，区分研究执行/表单/量表/质量/知识/产物可复用能力与身份/Hub/Study/完整EDC缺口；12项纯算子测试通过，不代表生产验收。未修改业务代码或实施迁移。

[首期范围与复用决策补充](product/lingshu-scope-decisions-2026-10-14.md)：确认旧研究基础与公开活动栏目，列出配置资料需求及第2–4项推荐策略。

[三角色、数据更正与旧库核查确认](product/lingshu-data-policy-and-database-check-2026-10-14.md)：用户确认的最新规则；实际数据库备份在当前旧仓库main未找到，待提供配置导出位置。
