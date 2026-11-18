# 岐研AI研究数据暂存与只读预检

日期2026-11-13。仅本机专用合成环境；原owner/admin、本人普通Hub会话、本轮新具名文件。用户批准两表及限定DML，未批准正式数据写权或Study绑定。本片技术通过不代表完整数据Agent或生产上线。

## 结构与复用

`rh_ai.research_data_uploads`保存本人上传身份/来源会话scope、随机存储位置、请求key/指纹、原件SHA、格式/字节数、检测摘要、状态与CAS版本。原件使用既有StorageService；来源scope不是导入目的地。

`rh_ai.research_data_preflights`固定1–20份upload ID/version/SHA、请求key、预检hash/解析版本、只读结构/异常摘要和状态。target在此切片必须为SQL NULL，confirmationReady必须false；只有previewed/cancelled/invalid，没有imported或确认写入端点。

两表FORCE RLS，tenant/group/project/account/session全部一致，管理员不绕本人范围；真实活动账号/租户/成员/父会话/原Agent能力每次复核，共同授权锁内提交，上传与预检精确key防重，变更只能精确version+1，身份/原件引用不可替换。应用角色仅两表SELECT/INSERT/UPDATE，无DELETE/TRUNCATE/CREATE；不会对旧public表增加业务写权限。

迁移只允许具名专用合成库：`node scripts/ai-research-data-schema.mjs --mode local-synthetic --approved-data-staging`。已执行SQL摘要`63b52261662dab0d42abd45fe328d8d65f9f0950a37785d1bd5d97eab6dc9376`。COMMENT校验与目录摘要不匹配直接拒绝，不自动修复。旧材料迁移原先哈希整个rh_ai目录，现仅检测自己拥有的session_materials及其函数/策略/索引/触发器；原结构、COMMENT与摘要`912f7d1ea2d41f247d8273ef7f576382284bf380aca24d3a082f972817b37bef`不改，新增表后旧重入仍通过。

复用旧chat-upload-inspector完整签名/容器/SHA、现有XLSX读取与classifyTabularSkill/buildTabularTriageSummary。UTF8 CSV；XLSX不执行公式，保留原工作表/行/列、0/false/null、未知单位。原旧分类保留诊断，假名编号不自动当直接身份；直接身份/非法编号行的可见样本不含原值。没有Ingest/RawProcessing实例、算法Worker、模型或知识入库。

## HTTP契约

以下路由均在`/sessions/:sessionId`，从已认证当前scope解析主体；只接受本机当前Origin，GET no-store，不接客户端路径/租户/角色/正文或自报导入许可。

| 路由 | 行为 |
| --- | --- |
| POST /research-data | multipart恰好file＋requestKey，25MiB单文件；同key同指纹重用，异指纹409；随机临时文件finally清理 |
| GET /research-data?limit=20&cursor=… | 单页1–50，稳定keyset分页；返回文件名/状态/计数等元数据，不返回样本原值 |
| GET /research-data/receipts/:key | 仅查原上传回执，不重传；同样只返回元数据 |
| POST /data-preflights | requestKey＋files[{id,version}]，1–20唯一引用；锁当前父链/源，逐件重读原件核SHA，固定批次 |
| GET /data-preflights | 当前本人预检，previewed交付前重读原件；取消/失效只返回安全摘要 |
| GET /data-preflights/receipts/:key | 查询原预检提交，不自动重发；当前源校验与脱敏规则同上 |
| POST /data-preflights/:id/cancellation | expected version，取消可重查/同原版本幂等，不删文件/历史 |

预检批总50MiB/10000行，每文件最多5个工作表/100列。超限413、签名/结构坏输入400，不能把明确拒绝当提交未知；没有静默截断。结果样本至多8行/文件、异常至多30行/文件，界面明确范围，全量行数/拒绝数来自整批扫描。未知提交保留原key，只查回执；400/413解除该待确认key，允许修正后新批次。未交付或失效结果清空可见原值，数据库历史保留。

## AI01交互与边界

原按钮自动分流PDF/DOCX/TXT/Markdown到旧私人知识链，CSV/XLSX到本片数据暂存；不用逐文件选用途。所选会话尚未核验时上传不提前开放。紧凑文件清单支持更多页；预检在原消息区，按工作表分别列名，详情折叠、窄屏表格内部滚动。重新预检使用上次固定files，不从列表前20份猜批次；新上传批次单独预检。

当前无合法导入目标，明确“尚未导入被试库”，不显示确认成功或写入按钮。本会话只要有数据暂存，commands和旧knowledge-messages在新Job/Token预留前返回DATA_ANALYSIS_UNAVAILABLE/409；文献私人分析、现有角色/模型/计费链不变。取消预检仍保留数据，不能借取消恢复对未入库数据的模型分析。

## 验证与后续

见[测试与四层状态](../testing/ai-data-preflight-2026-11-13.md)。真实两账号CSV/XLSX、7行/2异常、刷新/原回执/取消/固定批次、跨账号拒绝及零正式导入有本机证据。P05仍需明确真实Study父链与最小数据导入授权后实施一次确认及被试/访视回链；此规格不提前开data.upload/subject.create/form.fill，也不扩展共享底座或生产部署。
