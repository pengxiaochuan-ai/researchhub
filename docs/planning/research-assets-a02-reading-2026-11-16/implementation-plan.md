# A02局部阅读优化实施计划

> For agentic workers: use superpowers:executing-plans task-by-task; current directory serial implementation, one final independent review.

**Goal:** 真实报告在1280/1440可持续阅读，1920保留双栏，重要使用条件可见。
**Architecture:** 仅抽取现有预览片段为无状态AssetContentPreview；容器查询按卡宽840px切单列，复用现有Markdown/源数据/权限分支。
**Tech Stack:** React/Vite/现有CSS Token、Chrome/Playwright。
**Spec:** ../../product/research-assets-a02-reading-2026-11-16.md（用户已同意A方案）。

## Global Constraints

保持当前目录/所有既有改动，不提交/清理/换worktree；不改API、DB、共享Markdown/全局样式、500px侧栏或七Tab。仅专用合成库与原两账号，0模型/费用/业务写/新夹具。原报告与全部资产事实/角色/账本只读。

## Review Focus

- 正文未授权/403/迟到响应：不因视觉重排泄露正文。
- 2000字用途/限制、缺字段：完整换行，布局不变窄，不补造来源。
- 多列含单位/长数值表格：自身横滚，可键盘操作且不撑页面。
- 卡宽阈值两侧、1920宽屏：不误变成全站/其他Tab重排。
- 内容持续长与Markdown图片/外链：自然增高，不额外纵滚、不放开渲染信任。

## Tasks

- [x] R01 准入与RED：保存受控源文件/真实报告三宽基线；新组件SSR五类型/受限/风险完整测试及浏览器净宽断言先失败；目标库与原资产/角色/账本基线只读。
- [x] R02 最小实现：新增pages/shared/AssetContentPreview.jsx，ResearchAssetCatalogDetail仅替换原片段；research-assets-detail.css私有容器查询与局部表格；定向测试GREEN。
- [x] R03 真实验证：同报告三宽、两账号五类型/七Tab只读、局部表格横滚/键盘、权限及503/迟到响应；必要长表格仅浏览器受控渲染，不写DB。PG前后指纹、相关后端/全量前端/build。原生200%与Shell局限实测单列。
- [x] R04 一次独评与交付：仅一次只读总评，集中修补重要项并验证；同步living spec/使用说明/版本/README/验收与Notion。保留全部失败原件，不以纯测试代专业签收。

实现门禁承接本轮已批准A方案及长期“无需确认自动推进”授权，不重复请求计划/目录/执行方式批准；新增布局范围、费用、权限或发布再确认。
