# H01首次加载性能专项

2026-11-18用户要求核查首次整体数据渲染过慢。只用本机专用合成环境、原页面/权限/来源可见性；不改旧数据库/索引/角色、不缓存授权结论、不恢复历史任务。

基线：四组匿名/管理员真实Chrome，overview约3.57–3.66s；直接HTTP约3.49–3.55s。external-documents约37–51ms。实际app只读事务分段：metrics1746ms、sources1680ms、registries4.9ms；其中同类论文可见SQL两次各约1.63–1.65s。JIT on/off对照1.73/1.68s，否定JIT为主因。

EXPLAIN ANALYZE：canonical_publication复合唯一索引(tenant_id,hub_key,source_record_id)的内表扫描2269次、共享块735154次；实际Index Cond只有tenant_id和source_record_id，遗漏中间hub_key键，单次0.665ms被重复放大。拟最小修补在原JOIN补齐tenant/hub真实归属等式，保持原审核/字段许可/RLS及结果顺序，随后逐项比较内容与耗时。前端Promise.all还会把各区域一起等待；先修真实SQL瓶颈，不以加载占位掩盖后端慢，不重组页面。是否还需前端分块由修后实测决定。

## 修补与验证结果

唯一运行源码变更为visible-repository原canonical_publication JOIN显式补tenant/hub两列等式，零迁移/新索引/角色/缓存/前端改动。原表三列FK已convalidated=true。独立只读评审未发现必要风险。

真实app同一只读事务旧/新查询完整DTO hash一致、ID顺序与总数2267一致；旧1719.7ms，新169.0ms，三次独立新查询166–188ms。无变更统计口径、人工审核、RLS、字段许可或过期判断；JIT对照否定其为主因，未更改JIT配置。

受控owned重载68621→84668，原部署与七服务保持。623条聊天任务、29条知识导入任务、749条方法运行逐ID全行hash一致，无processing聊天，未恢复旧任务。脚本h01-performance-reload.mjs及reload.json保留证据。

真实HTTP：匿名overview 3553→590ms，管理员3493→548ms，约减少83–84%；响应体8409字节保持。四组真实Chrome修前接口3575–3656ms，修后618–658ms。修后从导航到总览数据呈现746–923ms，截图保留原布局。管理员浏览器网络空闲约1.49–1.63s；匿名网络空闲仍约15.6–15.8s，与总览数据已显示不同，不能称整页所有资源1秒完成。该残余请求尚未归因，不把它归为已修复。

13项Hub/论文口径相关测试通过，生产构建4.88秒。另执行现有visible-repository合成PG测试，因旧夹具未满足当前审核身份门禁HUB_SOURCE_REVIEW_AUTH_REQUIRED失败并回滚，未放宽权限或改夹具；不称全部PG回归绿。实际等价验证另用现行app身份只读完成。无业务POST（本轮仅自建认证登录/退出）、无模型/云资源或真实发布。共享窗口已明确释放，后续目标操作另协调。

前端Promise.all、目录和地图仍原布局/行为，本轮已从后端消除主要等待，不添加可能过期的公共缓存。后续应单独追踪匿名残余资源及分区完成时刻，而不是以networkidle直接代表用户能看到数据的时间。

本地产品基线/变更/版本、用户验证手册及Notion对应原页已同步。Notion专项：https://app.notion.com/p/41c56479ab58815e9ca0c4758103056b 。技术结论不代签用户主观复验。
