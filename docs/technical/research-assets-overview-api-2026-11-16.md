# A01 全部可访问资产只读总览 API

仅本机专用合成环境实施；用户确认默认全部、研究可选及登记归属最小交互。不改变角色、原单研究接口守门、Schema或旧系统。

## 入口和参数

`GET /api/research-assets/overview`，Cookie认证、原 `asset-catalog-v1` actor/authVersion头、no-store。只有此方法覆盖 `requireStudyGroup=false`；控制器原类级Study/Project/menu/read要求及所有详情/写操作不变。服务端先重建当前账号与租户状态，继而在同一tenant/official授权锁及事务内逐Study调用原授权校验，不另开嵌套锁事务。

沿原catalog语法接收q、kind、domain、status、scope、source、sort、direction、page、pageSize；另有tab（list/graph/contributions/collaborations/trash）、collaborationView（all/sent/received/requested/pending）、studyGroupId与researchProjectId成对可选、selectedAssetId与selectedVersion成对可选、推荐cursor。重复键、额外键、非字符串、半范围和非法版本拒绝400。

## 返回及完整性

`rh-asset-overview.v1`：complete、tenantId/accountId/identityRevision、studyFilter、scopes/creationScopes、catalog（stats/filterOptions/total/page/pageSize/items）、mainView、recommendations、trend、contexts。每资产行附assetScope及scopeIdentityRevision；contexts只含已核对可操作对象的ID/父研究/身份修订，不含正文。推荐每次3份，cursor绑定账号、授权、筛选、固定选择及可见候选快照。

先按原目录规则验证真实可见对象，再跨Study统一排序和分页。图谱只保留当前全局页资产及其关联节点；贡献以当前账号事件计数；共享在当前权限范围合并完整申请集再分页；趋势为上海时间30日真实事件合计。当前已装配原Study26份与报告Study1份，不把27作为正式产品上限；单适配器既有容量和两账号授权仍保留，新增Study目录接入需明确实施边界。

已注册却未装配的范围返回409 `ASSET_CATALOG_OVERVIEW_SCOPE_UNAVAILABLE`，数据损坏/源核对/运行失败继续报错；只排除明确的当前无研究权限或原报告范围拒绝，不吞未知错误。错租户/未授权403，过期账号401，不存在或当前不可见固定选择404，游标或完整性失效409。所选历史版经过同源/可见性检查，推荐使用该版元数据。

## 前端与写入边界

裸入口不恢复单Study；研究是筛选，错误状态不交付旧私有快照或伪造0。响应校验覆盖原catalog字段和各主Tab渲染必需数据，保留新的聚合数量范围，不再套用旧单研究26上限。详情/预览/资料链接及原写客户端使用验证后的真实父研究；聚合身份不能冒充单研究身份。

登记原弹窗内选择creationScopes允许的研究，一个时默认；修订锁定父研究。同一未保存操作重开沿原流程恢复，异资产/范围/操作先保护原输入，再切换客户端；未知提交结果仍只沿原请求键查询。当前真实验证未提交资产业务写操作，不据此宣称重新验过全部审核、删除、恢复、共享或导出。

实现：`scripts/research-assets-overview*.mjs`、`src/research-assets-overview.js`及原A01组件。装配复用 `local-research-assets-catalog.mjs` 工厂，未修改共享启动入口。[产品规则](../product/research-assets-home-all-studies-2026-11-16.md) · [验证与限制](../testing/research-assets-overview-2026-11-16.md)。
