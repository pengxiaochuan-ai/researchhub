# 匿名残余等待与E01论文性能

用户2026-11-18要求继续定位H01匿名约15秒网络残余，并优化E01。仅专用合成环境只读HTTP/PG/Chrome；不改变页面布局、检索/统计/审核/RLS或权限，不新增数据库对象、不启用模型。

基线分段：E01原listVisible(includeFacets)约354ms（列表184、facets166），visibleCounts约1534ms，其中统计查询1525ms。统计内canonical_publication仍只有source_record_id关联，遗漏复合索引tenant/hub中间键；拟按上轮已验证FK/唯一键补齐真实tenant/hub等式，再以同事务完整DTO比较、HTTP及真实浏览器复验。匿名残余另外捕获所有资源的response/finish/failure，不再只统计成功API。

## 匿名15秒尾部的实际原因与修补

新增trace捕获所有资源的response/finish/failure，确认H01/E01匿名`/api/auth/me`分别仅1–9ms收到401响应头，但未消费/关闭的流一直挂到15000ms AbortSignal超时，ERR_ABORTED后才networkidle。不是H01仍在等待数据库15秒，也不是地图外网资源（地图使用本地China JSON）。旧代码已立即返回null并显示公开数据，本轮修复的是残留网络尾部，不冒称旧首屏空白15秒。

仅在auth-session.js既有me/401分支取消无需读取的body并return null；已关闭/锁定异常忽略，不改登录、403、网络失败、续期和权限。新增2个测试先RED再GREEN；auth-only前端隔离：H01数据959ms、networkidle1271ms；E01旧后端仍数据2423ms/networkidle2742ms，证实未靠后端变更解释匿名尾部消失。

## E01后端及最终证据

visibleCounts原统计JOIN补tenant/hub，保留前轮approvedRows修补。实际app同事务旧1652.8ms、新46.0ms；完整counts（暂存15748、公开展示2267、AI检索2267）一致。无索引/DDL/缓存/可见范围变化。

受控owned重载84668→99513，原key/身份及7服务保持，623 knowledge_chat_job/29 knowledge_import_task/749 research_method_run逐ID全行hash一致，0旧任务恢复。独立只读评审通过。

| 场景 | 修前 | 修后 |
| --- | --- | --- |
| 匿名H01数据呈现 | 931ms | 1132ms |
| 匿名H01 networkidle | 15640ms | 1431ms |
| 匿名E01数据呈现 | 2417ms | 898ms |
| 匿名E01 networkidle | 15637ms | 1148ms |
| 管理员E01数据呈现 | 2911ms | 1389ms |
| 匿名论文首页HTTP | 2057ms | 536ms |
| 管理员论文首页HTTP | 2109ms | 643ms |
| 匿名论文第二页HTTP | 2084ms | 660ms |
| 管理员论文第二页HTTP | 2271ms | 773ms |
| 匿名关键词HTTP | 1957ms | 491ms |
| 管理员关键词HTTP | 2057ms | 617ms |

均为本机开发服务观察值，不是生产SLA。匿名H01数据原本约1秒已显示，本轮未让该数据时刻更快；网络尾部和E01是真实改善。所有6组HTTP的status、items数量、counts、facets及第二页ID均修前修后相同，equivalence.json留证。匿名me现在1秒以内已关闭，不再等15秒。

40项认证/会话/筛选/索引相关回归通过，构建4.79秒，独立新增认证2测试通过。页面、布局、排序/筛选、分页契约、原角色及会话期限未改。本轮0业务写/模型/云或真实发布；仅自建登录/退出。所有Chrome/context/认证会话关闭，窗口已明确释放。截图、WebM、请求瀑布、DB分段、同事务等价和reload保护位于同名目录；原H01第一轮证据保持未覆盖。

产品基线/变更/版本及用户手册已同步Notion原页。专项：https://app.notion.com/p/41c56479ab588110b727ee6a275aaf60 。用户体验复验待反馈。
