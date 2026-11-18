# A02长报告阅读区：A方案本机验证

2026-11-16｜用户已同意A方案，实现、真实浏览器及单次独评集中补齐完成，本机技术交接。仅本机专用合成环境，0资产业务写/模型/费用/权限变更/数据库迁移/重载；专业可读性及正式环境不代用户签收。

[已批准规格](../product/research-assets-a02-reading-2026-11-16.md) · [四步实施计划](../planning/research-assets-a02-reading-2026-11-16/implementation-plan.md) · [原始证据](../planning/research-assets-a02-reading-2026-11-16/evidence/) · [可体验报告资产](http://127.0.0.1:19501/pages/a02/?researchAssetId=rh-report-asset-20261116-admin&assetCatalog=1&assetVersion=2&studyGroupId=rh-kb-local-b0e2af9d-group&researchProjectId=cmwczp5hk0003lud9lsla5b75&assetReturnTo=%2Fpages%2Fa01%2F)

## 已观察结果

| 浏览器宽度 | 改前正文净宽 | 改后正文净宽 | 排布 |
| --- | --- | --- | --- |
| 1280 | 152px | 448px | 正文独占预览区，核心信息/摘要在后 |
| 1440 | 286px | 582px | 同上 |
| 1920 | 736px | 736px | 保留原双栏 |

外侧辅助栏实际保持500px，正文16/28，来源/用途/限制14/22，正文盒宽上限48rem。按卡宽而非窗口/字数切换，839/839.5px单列、840/840.5px双列；重要说明全文在正文前，不折叠、截断或重复。剩余核心信息与摘要完整保留。

只改正式资产A02预览分支：抽取AssetContentPreview，无接口调用/业务状态副作用；effect仅给已有表格滚动容器加可聚焦region和序号标签。CSS限定asset-preview-container，不修改旧只读族、全局layout-overrides、共享Markdown、全局Token、其他页面或Tab。保留图片禁用及不可信Markdown外链禁用规则。

## 验证证据

- RED→GREEN：`unit-red.log`3失败（待实现组件），`unit-green.log`3通过，包含真实五类型枚举、用途/限制不重复且先于正文、2000字以内长限制、受限不输出正文、来源回链/禁图片和不可信外链。`browser-width-red.log`针对原真实Chrome152px断言失败，`native.json`证明已达448px。
- `native.json`14组真实页面：同报告三宽、原7Tab往返、owner/admin各自五类既有资产当前固定版。均使用原生API/数据库内容，无新夹具、版本或审核；截图已观察阅读列拓宽、右栏及母版保留。
- `faults.json`4组受控场景：14列合成表格仅在浏览器响应注入；滚动容器client448/scroll1839、表格14/22、tabIndex0、ArrowRight可滚、页面仍1280宽，无额外纵滚。长用途1200字/限制1680字完整；503私有区清除后真实重读恢复；实际注销后释放已捕获原200不显示。表格/长说明与503明确为UI注入，不冒称新增正式资产或真实后端故障；实际200与注销链原生。
- `zoom-boundary.json`：四个卡宽边界；来源链接14/22；1024/390继承Shell约束单列；隔离Chrome配置页实际200%（DPR2/visualViewport.scale1，outer1440/inner720），同时保留viewport和CDP整窗PNG及录屏，未用CSS缩放或窄viewport冒充。
- 184相关后端、781全量前端、最后来源链接字号修补后构建4.77秒通过，106项定向前端绿。已有chunk-size警告保留，未为此扩大打包改造。
- `protection-before/after.json`：原32对象（旧26资产＋4B草稿＋来源报告＋本次既有报告资产）、27registry及6类资产事实/角色/旧只读保护hash一致；共享启动两文件、全局layout-overrides、共享Markdown、费用账本保持。保护检查只读，无DDL/事务回滚写探针。
- `video-integrity.json`：实际各段视频经ffprobe可解码、有时长。服务未重启、旧服务未操作。

## 明确限制与失败原件

原Shell最小1280宽未改：1024/390及原生200%下documentWidth仍1280，整页需横向移动。局部正文重排和字号通过不等于全站窄屏/放大无溢出，不销该历史限制。

第一次故障脚本等待注入原句，但既有researchAssetReadMessage有意映射为统一错误文案，导致测试超时；按实际503与可见alert/隐藏正文核对后通过，未修改错误策略。首次字号实测发现来源链接受既有后代规则压为12px，局部p/a显式14/22修补后通过。对应`faults-attempt1-failure.json`和`zoom-boundary-attempt1-failure.json`永久保留。Shell裁切不通过改全局样式掩盖。

共享统计profiling期间明确暂停全部API/PG/Chrome及热改，收到解除后才继续；不将并行任务性能结论当本轮证据。新增资产业务事件/角色/模型/费用为0，只有隔离测试登录会话与注销。

## 单次独评与最终收口

唯一独评未发现实现级Critical/Important，发现1项Important验收缺口：403与摘要受限分支缺本轮浏览器证据。集中补齐access.json：原owner请求具名报告资产真实403，页面无私密元信息、正文或表格；admin已显示正文时，受控将下一次原生200投影降为restricted并移除contentMd，旧正文/表格/图片/正文外链从DOM清除，恢复原生投影后可读。原生拒绝与受控投影分别留证，没有改权限迎合测试。

原件见independent-review.md，重要验收缺口关闭，没有第二轮总评。最终构建4.77秒、保护AFTER及录像有效；代码、目标本机启用、实际读取、可观察阅读结果分层有证，不代用户专业签收或生产部署。
