# A02 API与存储增量

## 2026-11-14 · 本机AI接口已实际装配

- GET `/:id/versions/:version/ai-status`：本人具名案例的当前状态、真实结果/选定来源/意见；当前身份、源版/许可、目标版与结果basis均重验。
- POST `/:id/versions/:version/ai-jobs`：闭合字段`caseKey,basisHash,requestKey`，只接四个批准案例；原键恢复不创建第二任务，不自动重试模型。
- POST `/:id/versions/:version/ai-decisions`：闭合字段`caseKey,messageId,decision,reason,expectedRevision,requestKey`；decision为reference/revise/decline，当前basis/job/不可变message一致性与意见revision/CAS、原键幂等；只写本人意见审计，不自动改方案。

复用原knowledge_chat_job、Message和AuditLog，无新AI任务/正文表。payload.researchAssetDetail是服务器在native create hook同事务写入；专用会话rh-asset-detail:<case>不接受通用聊天混合意图。原位状态聚合替代另建AI详情页面/资源，四案例无需额外列表架构；若未来放开通用对象另行审接口。

当前已知权限拒绝为受控403、源/目标/意见变化409，未知故障不伪装业务拒绝。执行链为native Sessions/Queue和现有Orchestrator内固定材料适配→旧DeepSeekProvider→原Billing/WorkerPublication。实际成功HTTP与用量证据是成功前提；确定性读取标adapter/modelRequested=false，不声称OpenCode自主循环/KB或外网工具。历史trace保留，旧标签仅由侧说明更正。

四真实调用、三结果/一在途撤销无交付、全部已知费用与Token结算、慢响应/未知提交/迟到注销/403/409/原键重放的证据见[最终报告](../testing/research-assets-a02-q07-live-2026-11-14.md)。以下早期“尚未装配”保留历史。

2026-11-13｜仅本机专用合成范围实际启用，完整授权/未来用途见A02规格。所有接口沿用当前账号会话、Study父链与artifact.read/edit，不按邮箱/前端身份放行。旧回包兼容。

| 方法与路径（前缀/api/research-assets） | 契约 |
| --- | --- |
| GET /:id/versions/:version/compare?withVersion=N | 两个固定版当前正文授权均须成立；返回rh-asset-comparison.v1、身份revision、前后版及确定性差异。无模型，不给科学适用性结论 |
| GET /:id/versions/:version/activity?cursor=… | 当前固定版正文授权；返回rh-asset-activity.v1，真实事件/操作者/时间，每页20，最多24；cursor绑定对象/版本/身份/事件revision，失效409 |
| POST /:id/versions/:version/tags | 同源asset-catalog-v1、当前actor/authVersion；body仅baseVersion、expectedRevision、tags、requestKey；path/body必须同版。仅精确新族，当前拥有者或tenant_admin且可编辑。标签最多12×24、空数组清除；新建不可变草稿版+父head/registry/CAS+事件+审计同事务 |

固定版本仍1～8形式；实际cap按族：旧A01基础8，新A02基础4、新副本2，各24成功事件。新族最多16精确manifest槽位，目录允许旧10+新16。未知提交只查原operations回执；同键异输入409。无下载/AI/派生权自动授予。

D02只增rh_asset.asset_comment_event、asset_reuse_record（强制RLS，应用角色SELECT/INSERT，无UPDATE/DELETE）；两表与匹配父事件绑定，Q02写端未启用。精确新族version/key父链函数替代owned单例；旧public及角色不改。执行脚本research-assets-detail-schema默认SAVEPOINT检查回滚，显式apply审计；后续验证源hash、fingerprint与原access-v2链，不重置旧回执。迁移要求当前tenant_admin并取得共同授权锁。

实测、失败和未完成项见[Q02验证](../testing/research-assets-a02-q02-2026-11-13.md)；API可用不代表整页/AI/生产验收通过。

## Q03增量（本机实际装配和技术验证通过）

既有usage/access-requests/decisions/revocations/citations路由复用。usage新增可选allowedActions：旧族两用途，新detail族至多八用途（非protocol无apply），只授予选中项、期限≤7天且不晚于固定版摘要发布期限；八用途不等于八个执行器已交付。数据库BEFORE触发器校验真实父对象族/固定版、去重、许可依据和方案类型；原只读/角色/public不改。

固定版详情可选sourceStudy来自本次当前授权Study；bodyExpiresAt记录普通用户正文授权截止，正文读完及跨版比较返回前重验。既有preview的citations/relations投影新增reuse数组，目前仅返回真实kind/at/targetAvailable=false，未获目标当前权时不输出ID/名称；无关系须数据库返回零行才显示空态。目标B有权正向在Q06补齐。

前端推荐总数上限跟目录对齐26，原每批3条/cursor隔离不变。[Q03实际验证与后续边界](../testing/research-assets-a02-q03-2026-11-13.md)。

## Q04评论增量（本机实际启用）

前缀`/api/research-assets/:id/versions/:version`：GET `/comments?cursor=…`每页4、cursor绑定当前身份/固定版/asset revision；POST `/comments`发表或回复；POST `/comments/:commentId/revisions`修订/撤回/管理员管理；GET `/comments/:commentId/history`仅当前管理员且有正文权。动作严格create/edit/withdraw/moderate，当前read_body+comment同时成立，作者仅本人修改，管理必须理由，终止状态不可修订。正文纯文本≤2000，当前撤回正文为空。

所有写入绑定expectedRevision/identityRevision/contentHash/policyHash/requestKey；修订还须expectedCommentRevision。服务端分配精确manifest slot，外部commentId为不可猜内部key的SHA256截取，不向页面暴露slot。最高3条不可变事实/评论，8评论/24事实且占各asset24操作额度。registry CAS、asset_event、comment_event和审计原子提交；同key同输入原回执、异输入409，回执无正文。按event_revision而非时间/UUID取当前状态。旧族不支持该写端，不放宽既有审核Comment。

Q04追加owned slot函数/约束和comment_changed，迁移回执在D02/Q03链后验真，原SQL不改。实际4评论9事实、原两账号HTTP/Chrome/PG及失败恢复见[Q04证据](../testing/research-assets-a02-q04-2026-11-13.md)。

## Q05固定附件和Markdown（本机实际启用）

GET `/:id/versions/:v/files`返回rh-asset-files.v1/当前identityRevision/canExport及真实文件id/名/大小/hash/MIME/canDownload；没有别版复用。GET/HEAD `/:id/versions/:v/files/:fileId/content`及`/:id/versions/:v/markdown`；GET携requestKey、自定义asset-catalog-v1和当前actor/authVersion，Origin/Sec-Fetch-Site存在时只许同源。HEAD包括框架自动GET回退，始终按HEAD只读处理，不增业务事件。原POST来源校验不变。

正文+download/export按独立用途核对，附件实际版本/file父链/manifest/hash/存储key一致。响应private,no-store/nosniff/attachment/UTF8 filename/Content-Length/X-Content-SHA256；Range保留旧单范围算法，Hub映射非法/越界416，合法206/Content-Range；取消或当前权/源hash变化关闭未交付流。<=1MiB字节全校验后内存流，消除二次存储读取TOCTOU。

GET按actor/固定绑定/用途/Range幂等CAS追加file_accessed或markdown_exported，phase=authorized，仅表示获准读取，不表示已保存；同key异Range409，旧回执不覆盖当前授权。四附件绑定使用attachment_bound和精确owned函数；不改旧public结构/角色、不启动ExportJob。Markdown复用旧纯渲染器，固定生成时间/来源/许可/水印，不支持其他格式。

追加独立owned用途参数修正：detail_actor_can_use中改用$3而非与列同名的purpose；已批准正文不隐含其他用途，原执行SQL/hash不重写。真实PG中目的字符串read_body也不能逃逸；实际撤销grant在最终交付检查拒绝。完整迁移/失败/HTTP/浏览器证据见[Q05报告](../testing/research-assets-a02-q05-2026-11-13.md)。

## Q06复制与B应用（本机实际启用）

固定版GET reuse-options、POST reuse-previews（无写）、POST reuses、GET reuse-result?requestKey=…；源固定v1、当前read_body+derive/apply及源hash/CAS必验。六copy slot/四apply slot由具名manifest限定，预览映射hash写前重算。创建/复用事实/源事件/审计同事务，原键回执仅最小摘要，目标信息另经当前源/目标授权返回；不继承共享、审批、附件或科学确认。

A02控制器独立资源GET /applied-drafts?limit=20、GET /applied-drafts/:id/design、GET /applied-drafts/:id/versions/:version、GET /applied-drafts/:id/guidance-citations?versionNo=…、POST /applied-drafts/:id/versions。传输使用源A身份上下文并在服务端独立核验精确B当前权限/真实归属；现有s07/q02逻辑目标仍B。管理员按当前tenant_admin授权、不伪造成员；普通用户仅本人目标。第二版可保存、第三版409；同键同输入重放、异输入409。源失效显示真实状态，不继续新复用/编辑、不删除历史。

旧ResearchArtifactsService.create/createVersion真实复用，Hub精确app-role事务适配器只接受具名tenant/group/B。未改旧guard、启动入口或Auth/me成员投影；真实空指南不伪造继承绑定，PICO/确认均null。usage将asset_apply计入applied，不把file_accessed授权当成功downloaded。原七Tab/500px布局及sourceA默认保持。详见[Q06证据](../testing/research-assets-a02-q06-2026-11-13.md)。

## 2026-11-14 Q07实现状态（尚未实际装配）

新增case/current/queue/execution适配模块，精确白名单只允许已批四案例。原生Queue.create hook同事务加入researchAssetDetail（caseKey、intent、requestKey、requestHash、basisHash），当前原始父会话必须rh-asset-detail:<case>，调用前/结果解析及提交前重验同一basis与实时认领，不能绑定到其他账号/目标。实际PG仅完整外事务回滚，不产生持久任务/模型。拟定ai-jobs/decisions接口及原页尚未装配，本段不是接口已启用公告。详见Q07 2026-11-14阶段测试报告。
