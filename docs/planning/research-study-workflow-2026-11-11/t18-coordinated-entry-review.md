# T18 统一协调后入口快照独立窄审

2026-11-12。根完成跨会话共享入口/19501协调后，独立只读审查当前四处共享源对S10的影响，并核[root-current-entry-64595719](../../testing/evidence/research-t17-2026-11-12/root-current-entry-64595719/result.json)完整新窗口。**该快照未发现S10阻断，可供根在全部协调就绪后按精确源/PID守门推进。** 本轮未执行业务、浏览器、HTTP/SQL、全量或额外纯测试；测试/构建/真实RO由根一次执行。

最终[manifest](../../testing/evidence/research-t17-2026-11-12/root-current-entry-64595719/manifest.json) SHA为 `b6e02ae9e400659d94feea856fc0c663882da8689428c1d163576dc7b1b4bb8e`。独立逐项核**31来源、14证据**的当前字节长度及SHA全部一致；before/after来源数组与manifest逐项相等，runtime均PID49880/front200。505单元、隔离构建和真实RO六项均exit0，0业务POST；此完整新窗口独立于先前118c的owner401失败和3491历史窗口，不拼接为同一次运行。[独立核验结果](../../testing/evidence/research-t18-2026-11-12/root-window-6459-independent/manifest-independent.json)。

四处共享源窄审：

- `real-mode-route.js`：catalog资产详情严格A02，catalog列表严格A01，不能认领S10；已配置时formalReports仍在explicitDemo之前判断，错误参数继续进入正式严格parser受限，既有普通S10 pending/显式demo边界保留。
- `research-design-session.js`：真实身份选择增加严格A02的catalog路由，既有S10 isReportsRoute分支仍有效，残留demo偏好不能覆盖真实报告身份；其他设计函数未扩大为本轮验收。
- `research-assets-catalog-session.js`及contract依赖为纯常量/函数声明，无顶层网络/storage或业务写。catalog header函数对S10直接返回原config；不把A01/A02资产功能签为本任务已验收。
- `platform-shell.js`：新增catalog header调用在S10无效，不覆盖已应用的reportsHeader；A01操作槽修改有明确pageId守门。本轮不重新签全局Shell视觉，既有窄屏顶部重叠限制不被本审查消除。

S10 helper/hook/page/CSS四核心文件精确保持此前独审SHA。先前1d3会话增量与保存f129原文精确可比：只新增严格A01/A02安全返回及纯catalog import，S10严格reports安全返回、活动续期、原未知marker、不重放和fresh下载逻辑不变。来源/本轮可比差异的实际SHA及原件保存在[shared-source-review.json](../../testing/evidence/research-t18-2026-11-12/root-window-6459-independent/shared-source-review.json)及同目录；仅当重建字节SHA等于历史3491记录时才保存为真实diff，不编造不存在旧原文。

协调记录以根共享note及各会话实际就绪/PID为准，本审查不代替第三方确认。该结论只适用于此已验快照，根每个新POST前继续核同一源码/runtime，变化即停新写并保原journal；不会将未来源或未完成的更正/新Methods/新Report自动签入。临床、生产及用户业务最终签认仍未验收。

## 同一源码的最终66570运行时补验

第三会话在新协调前已安排的重载完成后，根补做[final-runtime-ro-4e694517](../../testing/evidence/research-t17-2026-11-12/final-runtime-ro-4e694517/result.json)真实六项RO。最终[manifest](../../testing/evidence/research-t17-2026-11-12/final-runtime-ro-4e694517/manifest.json) SHA为 `bc528630f85f9f82dad6c0d40ad8d37d2f0384f7eaddbdb28f7d22e71627e643`，实际含31来源和11证据（6459原清单含14证据，两者计数不混用）。独立逐长度/SHA全部匹配当前；31源与原6459的505单元/构建清单精确相同，最终RO前后来源及PID66570相等，六项通过、0业务POST。[最终独立JSON](../../testing/evidence/research-t18-2026-11-12/root-window-6459-independent/final-runtime-manifest-independent.json)。

证据明确分为49880的单元/构建及66570的最终RO，不称同一进程运行。可更新精确当前UIproof；根另行负责第三方协调状态和每POST前源码/PID守门，未因本补验推定第三会话已ack。独审自身没有新测试、网络、SQL、浏览器或业务写入，也不阻塞根已授权主更正执行。
