# ADR-0009：Hub资产治理状态与固定版本用途扩展

## 状态

Accepted，2026-11-12。用户针对[A01规格](../product/research-assets-a01-spec-2026-11-12.md)及其D01/A-W/I/F最小增量回复“确认，”。Accepted不等于已创建表、授权或启用新业务；执行仍受专用合成目标及本轮具名上限约束，不自动部署到旧系统或生产。

## 背景

现有ResearchArtifact/Version已提供稳定内容、追加式历史、来源、文件、审核及审计。直接复制另一套资料/正文/文件表违背复用目标。但原产物单线生命周期/硬删方法，不支持资产“发布v1仍可用、v2单独待审”、按固定版用途申请/限期/撤销及回收保留。A02 V1只允许具名本人合成draft，不能扩大它来冒称正式资产治理。

## 建议决策

在同一PG同库，仅ResearchHub-owned rh_asset schema增加asset_registry、version_policy、access_request、asset_event四张业务扩展表。内容/版本/来源/附件/具名内容Review/通用Audit仍复用既有表。旧ResearchArtifact作为draft内容容器，与Hub资产真实工作态/发布态分层；前端只以Hub经过验证的资产投影呈现，不把容器draft说成已审核。

registry管理稳定身份、双版本指针和CAS；policy保存不可覆写的版本元数据/上游许可依据；access管理指定接收人固定版申请及限期用途许可；event保存不可覆写的处理/引用事实与原提交幂等回执。新表强制RLS、父链校验、追加式保留；只有新表所需最小GRANT，不改旧schema/旧RLS/旧权限/旧代码，不引新服务或通用IAM。

## 替代方案

1. 只接原Artifact接口：复用度高，但硬删/发布并存/用途许可语义不满足本页，不能无损完成。
2. 所有状态/授权都塞Audit或contentBlocks：不增表，但难以对固定版本、请求去重、许可到期与分页可见性建立可验证约束，不建议。
3. 重建全套资产正文/文件/知识库：边界独立，但重复储存/解析/鉴权/版本，与当前复用和工期目标冲突。

## 后果与限制

### 2026-11-13 C05自有约束实现记录

原C01 `schema.sql`及首次迁移Audit保持不变。C05增量只替换rh_asset现存registry parent/event两guard，允许具名接收人的requested/cited仅推进revision；复用现存event函数追加access_request的deferred constraint trigger，绑定真实父链、决定人、固定版及对应事件。没有新表/函数/GRANT或public定义变更。候选先在SAVEPOINT预测/回滚指纹，再精确应用并另记升级Audit；C01核验只识别原baseline及精确升级源hash/实际schema hash，未知漂移拒绝。18项真实aisci_app全回滚和实际9笔用途/引用提交通过；部署仍只限当前专用合成环境。实现、当前hash与证据见[A01报告](../testing/research-assets-a01-c01-c02-2026-11-12.md)，不是共享底座或旧系统改造授权。

需要测试内容容器/Hub状态分层、所有投影的同源可见谓词、事务/CAS/原键恢复和旧族隔离。旧服务/生产扫描兼容不能用本机只读检查或Mock冒称已验。具体表约束、API、最小试验范围和工时以本次A01规格为准；不能借本提案部署到临床/线上、修改共享底座、开放AI/跨Study/公开/导出。用户可拒绝或修订该方案，未获批前只做设计及免费只读准入。
