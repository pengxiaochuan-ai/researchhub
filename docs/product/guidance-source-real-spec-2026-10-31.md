# H06 指南与研究标准真实只读接线规格

2026-10-31当前增量：H06原卡片增加独立摘录批准下的12条关键条款与原始页码；三份精确提取已由原admin经G02本机批准。下文“只有书目／不展示正文”是前序首切片边界；现行摘录、双审核、API和局部存储以[关键条款规格](guidance-clauses-spec-2026-10-31.md)及[实测](../testing/guidance-clauses-2026-10-31.md)为准。整本下载、教材、AI用途及生产范围未开放。

日期：2026-10-31。仅本机专用合成环境。H06 复用首批五份外部来源中的两份 `research_standard` 与一份 `clinical_guideline`；暂无教材来源，页面不得冒称教材已入库。

当前执行更新：已依用户明确指令，经原admin审核入口批准这三份v1书目展示，H06真实接口现返回3条。正文容器与页头对齐、手机底部导航留独立区域；长题名、编号与原始疾病经两账号四视口真实非空验收。原文0条状态属于批准前检查点；本轮未批准正文/AI用途。[本轮记录](../testing/initial-five-display-2026-10-31.md)。

- `GET /api/hub-sources/guidance-documents` 为公开只读类型化投影，只返回当前 v1 文件 SHA 与初始具名身份匹配、最新未过期 `bibliographic/display=approve/public` 的标准或指南。响应 `{items:[{documentId,documentType,externalKey,title,sourceTargetCondition,hubTopic,sourceName,sourceUrl,reviewVersion}]}`，`Cache-Control: no-store`。不得返回原文件、受控内容 JSON、审核人/依据或未提取的正文。
- H06 真实模式按当前接口展示类型、题名、编号、原始疾病、来源与审核版本。空态、错误/重试、无匹配区分；本地搜索仅筛当前可见项。没有获准 HTTPS URL 时不显示原件链接；原始 PDF 不提供下载。C01 两条临床注册不得混入。
- 未审核、撤回、换版、服务失败都不回退演示条目。显式演示模式保留；不新增角色/审核权、Study 授权、数据库表、付费模型、云资源或发布。
- 验收为回滚 PG 批准/撤回/换版与类型过滤、真实 HTTP 空态、桌面/320/390px/原生 200% 浏览器截图录屏、非空合成契约渲染，及现有 Shell 回归。当前持久合成库 0 条具名审核决定，非空真实业务结果必须等管理员核实权利后复测，不能用拦截数据销项。
