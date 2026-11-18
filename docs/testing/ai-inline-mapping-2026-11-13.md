# 原位字段映射 · 验收记录

## 2026-11-14 · 最终规则已加载，双账号真实页面验证

共享19501协调窗口明确解除后，仅继续本任务。真实探测已变为HTTP201原成功回执＋409/DATA_IMPORT_MAPPING_CHANGED，证明最新“先指纹后解码”已加载；本会话没有执行重载，也未将解除协调理解为新增重载或业务权限。早前等待本会话重载的事项现已无须执行。

owner CSV与admin XLSX各新增一份具名合成暂存文件及一个预检（共2上传/2预检），原两来源/Study/角色不扩。真实AI01显示“本次读数(g)”待核对列，选择体重kg后请求携带原列/目标字段/真实mappingHash。该Study原4份答卷已提交，服务端正确返回DATA_IMPORT_INVALID_ROWS而不覆盖；两账号确定409后GET核对/刷新均保留weight选择，刷新无POST，跨账号403/404。原成功回执仍可读且逐项相同。

真实页面1440/1024/390截图与WebM、请求/状态记录在`.tmp/ai-file-data-2026-11-12/general-unit/inline-mapping-live-20261114/`。两账号均passed，pageerror/阻断请求/模型调用/新增业务对象0；列名14/22、原生select高度及页面宽度检查通过，已查看owner桌面和admin390实际图。390原AI01历史列表占用较多高度的既有限制保留，不将本片局部验证称为全页移动UX改版或验收。

初次脚本在页面授权就绪前触发隐藏文件输入，30秒等待超时；真实GET和READ ONLY PG证明无上传HTTP结果/无该具名上传行后才重试，未盲目重传。原失败log/截图保留；green结果中的旧failure字段为首次历史失败，两账号最终passed与facts.json单列，不删除旧失败冒称首次全绿。

`inline-mapping-live-facts-20261114.log`与facts.json强READ ONLY核对两个原件SHA/版本/预检、原0/2500值、该两预检下导入计划0；新被试/访视/答卷0。`inline-mapping-unit-facts-20261114.log`仍4被试/4入组/4访视/4答卷/4修订及4来源；`inline-mapping-baseline-20261114.log`证明原旧4例、角色/grant及原152笔预留不变。无Provider/Token操作、临床、云、远端配置或发布。

**验收边界：**本机映射选择及当前授权下的实际拒绝/恢复路径已验证，原生成功计划/2.5kg写入此前已在真实PG全回滚验证。共享页面“新空白访视→成功计划→正式新答卷”未执行，不以本轮拒绝或回滚证据冒称持久成功；需要另备获准空白合成目标，旧4份答卷继续只读。专业用户最终签收仍待实际体验。下方待加载描述为2026-11-13历史阶段，不覆盖本节。

2026-11-13。用户明确要求减少改表头/重传，按[计划](../planning/qiyan-ai-file-data-2026-11-12/inline-mapping-implementation.md)串行实施。本页持续记录本轮事实，不恢复其他专项。[API/恢复契约](../technical/ai-inline-mapping-2026-11-13.md)。

## 2026-11-13 四层状态（阶段历史）

- 代码：原prepare返回无写入字段选择描述，按固定指纹和explicit mapping准备；原AI01按需选列、保输入/刷新/失联回执与切身份隔离已实现。唯一独评0C/2I/1M均已集中修补；无复签。
- 目标配置：共享本机服务重载窗口已向用户提出确认，尚未获回答。本轮没有改共享启动入口或重载。真实HTTP只读回执重放证明运行服务已加载早期mappingHash参数；顺序探测仍返回MAPPING_REQUIRED，最新“先指纹后解码”尚未加载，不能宣称最终启用。
- 真实执行：最终28核心、5真实PG（新记录全回滚）、708前端及独立构建4.94秒通过；Chrome组件六子项/六宽、键盘、恢复有证。目标页面正链待最终装配和实测。
- 业务签收：用户体验/专业签收尚未取得；不代签。

## 已有证据

| 项目 | 日志与观察 |
| --- | --- |
| RED→GREEN | .tmp/inline-mapping-core-red.log：原explicit仍运行自动歧义、没有描述/重复源守门；core-green及core-client-green通过，15映射/单位＋4客户端契约 |
| 客户端契约 | client-red→green，严格绑定来源/版本/Study，缺必填/重复目标/外来字段拒绝 |
| 真实PG | inline-mapping-pg.log及pg-final.log：双账号原件预检/无写入选择、重复请求描述一致/回执不存在、旧指纹/重复列拒绝；owner原已提交访视仍拒绝覆盖。admin仅事务内建具名新被试/入组/访视，真实原生提交2.5kg/false、固定来源/分析/回执重放，整事务回滚，新增持久对象0 |
| 原兼容 | pg-final共5项：新链、旧general-tabular、旧/新scope路由隔离、已接受4份固定答卷只读核对，全部通过；无配置故障注入或改旧答卷 |
| Chrome组件 | inline-mapping-ui.log保留测试脚本Playwright导入错误；ui-green保留原生select computed line-height normal误作失败。修正测试取真实列名14/22及原生控件高度，ui-final全5项通过，无pageerror。真实hook覆盖六宽、键盘、刷新无POST、断网选择保留、成功响应丢失只GET恢复、旧目标重核和迟到身份隔离 |
| 构建/回归 | inline-mapping-build.log：4.59秒隔离构建通过，既有大chunk提示保留；frontend.log当期707/707，无fail/skip。后续独评集中修补另记，不以初次全绿代替最终验证 |

组件PNG/WebM目录.tmp/inline-mapping-browser-1794583947700，1440/1280/1024/768/390/320已查看桌面/320截图；不把组件替身当真实HTTP或用户结果验收。原生200%和目标页面实际截图在后续窗口单列，不宣称本片已完成。

## 唯一独评与最终作者回归

inline_mapping_final_review：0Critical/2Important/1Minor。确定409后删除标记、状态GET让编辑器消失；先解码再核指纹误报表单变化；同名目标在确认摘要再次失去区别。review-red真实复现前两项，summary-red复现第三项；集中修补后review-green为7/7（含PG及浏览器父项），未二次评审。

最终final-core为28/28，final-pg-green为5/5，final-frontend为708/708，均无skip/fail；保留final-pg原测试脚本把同步400当异步断言的失败，改为async包装后通过，不删除失败。字段删除/单位改变以真实PG原生目标读取加受控metadata变更模拟，不改已发布Form；实际写入/来源/回执仍为真实原生事务并全回滚。

final-build命令误将双横线传给Vite，生成默认dist，保留事实且不清理/覆盖其他用户内容；改用pnpm exec vite build --outDir .tmp/inline-mapping-isolated-build，4.94秒真正独立构建通过，既有大chunk提示保留。最终Chrome证据目录.tmp/inline-mapping-browser-1794584388175，已查看桌面/320及同名摘要截图，无pageerror。最终baseline/facts均强只读通过：旧4例及本轮已接受4份答卷/4修订、角色/grant、原152预留逐条保持，模型0。

## 2026-11-13 目标启用与待确认边界（阶段历史）

ai-inline-mapping-live-probe.mjs --existing-receipt-only：仅重放已有成功prepare的原key/映射，多传mappingHash读原committed回执；另发必然失败的旧指纹/不存在字段探测，无新增计划或业务对象。HTTP201＋409/MAPPING_REQUIRED说明目标是较早版，最终应409/MAPPING_CHANGED。私有记录general-unit/inline-mapping-live-probe.json，未打印登录凭证，未发Provider。既有成功回执可读不等于本片最终规则已启用。

获准安全窗口后加载最终代码，重走目标实际HTTP/两账号页面及固定计划/失败恢复；在此之前I04/I05不销项。当前组件和回滚证据不代替目标环境正链或用户专业签收。本轮0模型、无云/临床/远端配置/真实发布，原布局与现有权限保持；安全重载问题保持待用户回答，不以时间推定允许。
