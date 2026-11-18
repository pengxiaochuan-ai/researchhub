# A01整页实施前：只读准入与规格复核

2026-11-12。本轮请求是继续已确认的资产串行计划；已进入A01整页准入，未开始C01～C07业务实现。新增权限/用途、数据扩展和局部交互按原停点提交一次确认，不借A02只读授权扩权。

## 实际执行

| 层次 | 事实与证据 | 不代表什么 |
| --- | --- | --- |
| 源码/模型核对 | 旧ResearchArtifact/Version/Source/Review/File、create/createVersion/submitReview/review/release/removeDraft及A01 RealEntryLayouts实际阅读；removeDraft会硬删，单线状态不等同双版本资产治理 | 不称旧资产生命周期可直接满足完整Hub资产 |
| 专用PG | 既有loadFixtureInput→assertFixtureTarget→withFixtureTransaction(app,readOnly:true)，事务SHOW transaction_read_only=on；set_config固定原tenant/group/project；两账号真实role/成员permission及精确前缀10资产/20版计数、版本数/status/deletedAt核对；rh_asset尚不存在。[JSON](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/readonly-pg.json) | 未运行DDL/GRANT/初始化/写入/角色修改，未读临床库；计数和状态不是全历史正文hash比对 |
| KB目标元数据 | 同一专用READ ONLY事务，固定当前tenant/group/project、tenant可见且owner为空的KB，最多10项，实际4项；选定F03目标cmvjf87kz003eluf55ej04q7f，由原admin创建。未读取文档正文或修改旧KB/资料。[JSON](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/knowledge-target.json) | DB元数据可见不等于旧KnowledgeService对两账号的当前读/编辑校验已通过；F03创建前仍须原服务验证，失败不赋新权 |
| 真实浏览器 | IAB当前owner，A01六卡、五主Tab、五筛选、九列、四预览及推荐/趋势观察，五Tab逐个点击无业务提交；1910×1075/DPR1.34、左右1206.08/350px/间距16px、根无横溢。[图](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/a01-real-before.png)/[几何](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/a01-layout-before.json)/[页签](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/a01-tabs-before.json) | 仍是原真实入口未接目录的状态，不是新页面功能验收或布局修改；没有本轮录屏/多视口/故障注入 |
| 既有只读回归 | 定向新旧只读资产/当前授权/来源准入/fixture guard35/35，0失败/跳过，[日志](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/existing-read-contracts.log) | 不是A01新目录/登记/共享功能测试；未复用上轮491前端作为本轮新能力证据 |
| 文档检查 | 初次24个本地链接有效，C01～C07完整、D01/A-W/F/I停点与额度明确；最终新增链接/JSON/工时再核验 | 不代替用户确认或功能实现 |

本轮没有运行代码/UI变更，所以未执行新的Vite构建或宣称功能界面回归；使用说明不加入未交付操作。旧服务/运行配置/云/模型/额度不动。

## 独立规格复核与修订

独立只读评审首次：Critical0、Important4，另有两项Minor契约细化，结论需修订。原意见均保留在本节，不以修完后的0隐藏。

1. 目录按角色选working/released固定版、发布v2不自动撤v1、私有工作版字段不得命中接收人搜索：已补§5与C01测试。
2. 摘要受众持久上界/当前集合、收窄同事务撤请求/许可、不自动复活：已补policy与版级事件契约。
3. AS-02缺合法KB正向样例：只读核对既有共享合成库，将F03最多2份原创新知识资料×3版及仅这两份审核/撤审加入本次最小确认，不改旧文档、不补造旧源权利、不以新资产互引替代KB来源。
4. 只声明detail.v2缺实际端点/客户端：已明确独立GET /catalog/:id[/versions/:version]、assetCatalog=1/assetReturnTo白名单与v2校验，V1旧守门不变。
5. Minor：固定来源合法v1与仅源v2新增分开；旧KB缺历史版有效审核证据时阻断，不猜仍有效。
6. Minor：本机私有暂存manifest的owner/authVersion/24h/一次绑定/原键恢复/取消与孤儿清单；不调用KB import或新建通用上传体系，不自动清理文件。

同一独立评审针对修订复核结论：**可提交用户评审，原Important/Minor规格缺口闭合，无残余规格阻断**。这不是运行权限验证、功能验收、生产或用户专业签收。

## 当前停点

[整页规格](../product/research-assets-a01-spec-2026-11-12.md)、[最小授权](../planning/research-assets-product-2026-11-12/a01-authorizations.md)、[七步计划](../planning/research-assets-product-2026-11-12/a01-implementation-plan.md)、[Proposed ADR](../decisions/0009-hub-asset-governance-extension.md)形成一次评审包。D01/A-W01～03/F01～03/I01～04尚未批准；旧10份/20版只读授权仍有效，A01新业务不启用。

获批后集中C01～C07，不逐任务再次询问；新增费用/权限/临床目标/旧系统/云/远端配置/真实服务发布再停。完整资产96～132h＋16h缓冲不因本报告自动改变，A01专项28～38h＋4h是其中分摊，不是叠加或余下几天交付全部60项的承诺。

## 文档与同步收口

最终7份本轮文档36个本地链接有效，C01～C07合计28～38h＋4h缓冲、F03和四表提案边界校验通过；git diff --check对本轮living修改通过。仅检查/文档变更，没有运行代码改动，不运行新功能构建或冒称A01测试全绿。本机原具名进程未重启，frontend/api/parser/embed/quality/smtp/inbox七服务仍ready。

Notion按原章节创建并回读5份新页：[规格](https://app.notion.com/p/41656479ab58811db392cbc005669e23)、[最小授权](https://app.notion.com/p/41656479ab5881c9826aeb90ac374884)、[七步计划](https://app.notion.com/p/41656479ab5881aaafa5f9ec60dcaf6f)、[ADR提案](https://app.notion.com/p/41656479ab5881dbba27e2fc20da53bf)、[准入复核报告](https://app.notion.com/p/41656479ab58810cbb51ef22912010b6)。原PRD/60项/分期同页更新；基线/变更/版本/索引与原任务记录只追加本轮章节，保留其他会话内容/子页。一次fetch瞬态失败后单页重读成功，未重复建页；Notion提及会自动换成页面标题，最终按新spec页面ID和当前状态语句回读，不把标签规范化误判丢内容。

本轮使用说明无新增用户操作，因此未改。同步和只读复核不构成D01/A-W/F/I已批准或A01已交付。
