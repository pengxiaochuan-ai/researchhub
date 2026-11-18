# P3一次独立总评及裁定

2026-11-13，评审任务`p3_protocol_final_review`。只读源码＋21项当时相关纯Node测试，未写PG、改代码、重启或调用外部服务，不把评审者纯测称为真实业务验收。

发现：Critical 0，Important 1。G01原实现缺focus／visibility当前集合重读，同账号/authVersion失去Study管理权后旧集合残留，后续分页还会merge。

裁定：接受Important。作者集中一次修补：重新获得焦点／可见时从头读取；继续读取重建已打开范围，替换旧集合；错误撤下旧行；保留请求epoch和渲染身份守门，不加新授权引擎／表／权限。`protocol-review-range.test.mjs`先RED再GREEN。

实证：`review-history-pg.test.mjs`仅新Study负责人关系变更、全事务回滚，真实app/RLS拒绝旧集合和回执；Chrome同身份受控过滤真实GET集合证明焦点替换，另以真实Cookie切换和迟到admin响应验证新身份集合不被覆盖。原owner与admin不改账号／角色；新关系已回滚恢复。

最终31相关、590前端及构建通过；主链和五宽／原生200%原件见[交接报告](../../testing/governance-p3-2026-11-13.md)。Important已用对应反例和真实结果验证，未开第二轮复评。用户体验与专业／生产验收仍独立待验。

最终固定版本补充：S07“查看研究方案”携带当前Protocol ID进入S02，不默认选择其他草稿。真实浏览器先RED（缺protocolId）再GREEN（同一v1），无业务写；最后590前端及8.02秒隔离构建通过，既有大包告警保留。
