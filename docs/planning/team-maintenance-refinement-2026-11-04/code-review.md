# 一次独立总评审与作者修补

2026-11-04，独立评审只读，不改代码/工作树/权限/持久数据/服务，不用浏览器，不派生子Agent。原结论With fixes（暂不可交接）：0 Critical、1 Important、0 Minor；独立运行23项纯函数/客户端/专用合成PG回滚或只读测试通过。保留此原结论，不冒称二次独立签认。

## Important及RED→GREEN

reference-divisions-schema旧v1只收表/Schema ACL，遗漏pg_attribute.attacl与有效列写权限。即使当前aisci_app全部列UPDATE=false，未来单列误授权仍可能通过旧指纹。

作者新增schema-fingerprint.test.mjs，先因缺少评估器失败；实现完整列ACL/授权选项/有效列SELECT与INSERT/UPDATE/REFERENCES指纹和只读拒绝，纯负例验证列授权/继承写权限漂移拒绝。旧v1精确匹配且当前只读才允许追加v2收据；v1不覆盖，无新GRANT/重导数据。真实PG逐列8列只读检查和写入拒绝通过；没有通过实际GRANT制造负例。

## 浏览器发现与作者修补

- 原生Chrome select计算行高为normal，字号14px/高度44px；测试改为对原生select接受normal，不为满足字符串断言改变原生下拉交互，普通正文/控件仍14/22。首次失败证据保留。
- 320窄屏原空操作容器仍占页头高度，加入真实浏览器高度断言先RED；仅在G02当前团队维护叶子用:empty隐藏空操作容器，Frozen Token不改，最新五视口/200%通过。
- 新代码对象与PG JSONB键序不同会假报未保存：sameTeamDraft先RED，按对象键规范序比较、数组顺序仍有意义，GREEN；实际数据/字段变更仍算未保存，省市保存试跑显式修改具名合成备注，不靠键序差异制造保存成功。

## Declined-to-judge的作者处理

- T01/T02与其他页布局：不扩范围，原文件hash不变；T01/T02额外真实Chrome4组回归、G02总览/来源审核原提示/返回保留已验。B08等其他专项不恢复不代签。
- 浏览器五视口、原生200%、异步迟到/恢复：由主实施新8组Chrome、实际IAB保存刷新预览以及截图/录屏举证，不据代码评审认定体验。
- 构建/启用/迁移：主实施50项后端、212项前端及构建通过；七服务ready，reference v2/base/team-draft均existing。
- 其他dirty内容归属：不提交/重置、不审其他专项，也不将整个工作树diff归为本轮。

原唯一Important经作者修补/测试关闭，无延后Minor。用户对页面的最终体验仍待确认。详见[本轮测试报告](../../testing/team-maintenance-refinement-2026-11-04.md)。
