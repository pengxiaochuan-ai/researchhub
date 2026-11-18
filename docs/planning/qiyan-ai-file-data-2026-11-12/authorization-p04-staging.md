# P04页面接线最小新增授权（已批准，本机技术交接）

2026-11-13用户在解释两表职责后明确“批准”。执行仅下列两表及限定DML、原入口上传/只读预检/刷新恢复；不再重复请求相同确认。D01结构与隔离→D02暂存/API及原件hash重验→D03原AI01紧凑清单与消息区预检摘要→D04真实合成/浏览器/一次独评均完成本机技术验证。见[当前验收](../../testing/ai-data-preflight-2026-11-13.md)；不等于正式Study导入或完整数据Agent。

接口落点：`/sessions/:id/research-data`（POST单文件/GET有界列表）、`/research-data/receipts/:key`（GET原上传回执）、`/data-preflights`（POST固定文件引用批次/GET当前摘要）、`/data-preflights/:id/cancellation`（POST仅本人取消）。客户端不传路径、租户/账号、正文或自报导入能力。本片没有confirm/import端点；请求Study目标必须由当前resolver给出，本机当前可导入目标为空，不能借新增表造Study。

UI/UE：保持AI01两栏、原上传按钮与原文件清单位置；CSV/XLSX自动识别，无逐文件用途选择；上传后一次批次预检，摘要放原消息区（不挤占输入），默认只显示文件/行数、异常及实际下一步，原始行列详情折叠。每份25MiB、批20份且批总字节50MiB，预检每文件至多5工作表/100列、批总10000行，超限明确拒绝，不静默截断。操作14/22、原回答16/28；取消只取消预检，不删除文件，不自动重传/重试；无导入资格时明确不可导入，仍可查看识别异常。科研人员/管理员各管本人会话，管理员不读取他人私有数据。知识上传和真实问答原规则不变，数据暂存绝不误入知识库或模型。

2026-11-13。当前原owner/admin两次真实问答各一次、原Token自动结算4653已完成；P04无副作用核心已实现。实际应用身份强制READ ONLY核对：两个账号均无data.upload，当前合成执行项目没有rh_research.study_binding。不能把AI01首项目或普通可读项目伪作有权导入Study，也不能创建正式被试后再询问。

## 本次只申请隔离暂存，不申请正式数据权

仅在`wp01_test_full_baseline`新增下列两表及必要约束/索引、CAS、父链校验、FORCE RLS与现有应用角色对这两表的SELECT/INSERT/UPDATE。原两个账号、本人会话、本轮具名合成文件；不物理删除、改旧public表、改session_materials用途或改角色/Agent工具。

| 对象 | 最小字段与约束 |
| --- | --- |
| `rh_ai.research_data_uploads` | id、tenant/account/session及来源会话group/project上下文；请求key/fingerprint、原件SHA/字节数/已核格式；本人随机隔离存储key；真实检测阶段、version及时间。唯一tenant/account/session/request_key；原始身份和源hash不可更换；存储路径不接受客户端任意指定、不返回模型。上下文项目不是已确认导入目的地。 |
| `rh_ai.research_data_preflights` | id、tenant/account/session、固定upload ID/version/hash引用（至多20）、预检版本与hash、解析契约版本、结构/异常摘要及必要只读映射。本片target必须SQL NULL；P05要支持目标时须保存统一解析后的真实父链和当前权限事实，另评迁移，不只存裸ID。唯一请求key；变更资料/目标必须新版本；本片状态只允许预检/失效/取消，不提供导入提交状态。 |

两表仅本人作用域；管理员不绕过私人文件，读旧session/账号/源状态均须实时重验，失效不交付正文。父链使用历史引用＋当前核验，不阻挡旧会话/数据生命周期。预检结果不保存直接身份值到可见摘要；原件仅合成、本人隔离，保留/撤销沿既有存储规则，不自动清理历史。

授权后：先迁移/应用身份正反例、旧定义/角色零变化，再接AI01原上传位置的CSV/XLSX识别、真实暂存/刷新回执与内联预检摘要，保持布局。无合法导入目标时明确不可确认导入，不给“成功”假态。可识别资料先显示异常；不要求逐行或逐文件重复确认。

## 明确不包含

不授data.upload/subject.create/form.fill，不建立Study绑定/新执行项目，不启用正式采集，不调用Ingest/Worker/算子/模型，不新增费用，不改旧服务、云或发布。P05前再针对原当前执行项目的真实Study关联及数据导入权列精确差异；当前不提前授予。

本文件原申请已获批准并执行；不重新询问已批准业务规则、原file.read、P03费用或串行顺序。DDL脚本`ai-research-data-schema.mjs --mode local-synthetic --approved-data-staging`已建立两表，SQL摘要`63b52261662dab0d42abd45fe328d8d65f9f0950a37785d1bd5d97eab6dc9376`。旧材料表目录校验限定到其自有对象，原COMMENT/结构与旧目录摘要`912f7d1ea2d41f247d8273ef7f576382284bf380aca24d3a082f972817b37bef`保持。下一新增授权仅P05真实Study绑定及正式数据导入最小权限，本片不提前执行。
