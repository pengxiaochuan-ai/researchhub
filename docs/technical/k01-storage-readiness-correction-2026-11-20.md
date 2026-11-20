# K01 对象存储启动顺序修补及导入阻断

## 已观察的生产事实

bridge同版发布7590091已完成，v2准确准入与累计账本已激活，模型/knowledge-chat继续ON，knowledge-import只认领下列两个新ID。原623条历史任务hash、原两笔失败问答与账务记录保持；仍仅有原2次真实Provider请求，费用上界0.05454元，本轮新增模型调用0。

| 账号 | 新私有库 | PDF任务 | 实际失败 |
|---|---|---|---|
| admin | cmwogc60l0003nq0764rrwb8h | cmwogdsd60011nq0786q4foiy | 2026-11-20T04:09:11.190Z，IMPORT_FAILED，进度25，`对象存储不可用`，docId=null |
| owner | cmwogdump0015nq07gkdim17h | cmwogdwe10022nq07s1xoo7zq | 2026-11-20T04:09:11.193Z，同上，docId=null |

两份原文件通过原页面真实上传，后台sourceFile SHA与批准材料一致。当前只有4份MD/未审核草稿；不能把两个失败的PDF说成已成功入库。没有执行手工正文替代、任务状态重置或付费问答。

## 根因及已验证修补

Nest在同模块中并发执行provider的onModuleInit。原RuntimeStorage在异步HeadBucket期间ready=false；KnowledgeImportService在自己的onModuleInit立即resumePending，任务到statObject时存储仍未就绪。随后存储已就绪、HTTP可用，因此晚到的HeadBucket检查为true并不能否定早先的启动竞态。

已在独立本机容器以**真实Nest生命周期＋真实既有MinIO HeadBucket**复现：旧顺序consumer观察ready=false；新顺序ready=true，最终均可连接。对象读写、数据库连接、Provider调用均0。证据：`.tmp/k01-production-20261120/storage-order-native.log`。

仅改Hub自有RuntimeStorage与foundation：先await存储就绪，再装配任何Worker；初始化去重且已就绪时不重新置false，Nest后续回调复用同一实例。保持旧项目源码/服务、存储配置、文件IO、角色、用途及累计账本不变，不新增解析服务/依赖/权限/费用。配套将原区域上传提示由“正在解析”改为“等待处理”，不把queued说成已执行；非OCR解析进度不再固定显示OCR。未获AI用途的可读库只显示问答尚未开放，不误报整体阅读授权丢失；实际阅读撤权仍403。

发布沿用同core55与准确v2准入SHA6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492，前后端同版；数据库结构/权限无变化。失败任务不因发布自动重跑。

## 仍待确认的数据修复动作（不得自动执行）

原生接口没有失败导入的重试入口。重跑需要将**原两条失败任务**重新入队，属于新的具名数据修复操作，原stage/activate操作员批准为数据库直接写入0，不能据此自动执行重置。

建议准确范围：仅上述2个任务各重跑1次、不新建任务/源文件/文档替代；重新核对当前账号/真实KB/Study、原始SHA、failed+docId=null、原失败时间/错误和无在途认领；同一事务先追加2条包含完整原失败快照的系统审计，再CAS重新入队，原生Worker复用原对象存储文件重新执行，仍只按原两个ID认领。任何归属、状态、SHA或CAS差异即全回滚并停。成功各生成1文档后总文档仍最多6，每份最多3版；不扩账号/角色/Token，不对账，不触历史任务或其他库。原2次新模型请求/最多4新问答任务/累计1元上限不变，重跑本身不调用模型、不发邮件、不增云资源。

确认前可继续免费代码、回归和发布就绪验证；**暂不消费新Provider请求、不把K01验收标为通过、不切E02**。一次性修复脚本须预先准备、免费验证并独立评审，提交用户确认后才执行重跑及原页面两角色验收。
