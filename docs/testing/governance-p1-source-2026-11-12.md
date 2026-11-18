# P1数据治理 · 来源审核阶段验证及停线

后续覆盖：用户已批准最小读取并完成本机来源页技术闭环，见[最终恢复验收](governance-p1-recovery-2026-11-12.md)。本文保留批准前失败实证，不再是当前阻断状态；P1团队页仍随后实施。

日期：2026-11-12。**局部修补已验证，P1尚未完成。** 当前目录串行，专用合成库`wp01_test_full_baseline`，前端19501。没有改变确认布局、业务授权、来源放行记录、旧系统或部署；无模型调用/新增费用。

## 1. 需求与改动

依据获批[治理PRD](../product/governance-module-prd-2026-11-12.md) DG01–10，来源页先于团队页。

- `HubSourceWorkbench.jsx`：同一真实账号及authVersion的身份重核只重读队列，不清空选择；新账号/授权版本仍清除受限内容。工作簿范围暂时重验保留草稿，真实对象/范围/指纹变化重置。
- `source-review-queue.js`的身份key仅控制前端编辑会话，不作权限授予或后端鉴权。
- 没改CSS、文字、Shell、控件次序及审核服务。详情外层`key={selected.key}`沿用原样；仅决定控件从每次snapshot重挂载改为受控snapshot状态。既有单行row对象刷新观察留待来源页完整验收，不借此切其他模块。
- 原提交恢复候选`review-receipt.mjs`及测试未注册到Controller，未向前端启用任何新回执路由。原接口继续原行为。

## 2. 验证证据

原始截图/结果/视频位于[evidence目录](evidence/governance-p1-source-2026-11-12/)。所有失败尝试保留，不覆盖为成功结论。

| 层次 | 命令或证据 | 实际结果 |
| --- | --- | --- |
| 前端全量 | `node --test tests/*.test.mjs`；`frontend-tests.log` | 459/459通过 |
| 相关契约 | source-review-session、source-review-queue、review-decision-actions及review-receipt四文件 | 13/13通过，其中回执候选4项仅单元 |
| 构建 | `npm run build -- --outDir .tmp/governance-p1-build`；`build.log` | exit0，4.88s；既有大chunk警告保留，不覆盖运行dist |
| 外部/PMC/工作簿真实Chrome | `node scripts/governance-p1-source-browser.mjs green`、`green-pmc`、`green-workbook` | 三份结果passed=true；同身份focus保留、1440/1366/1920/390/320无横溢出，原生select14px/高≥32，共享Button14/22 |
| 动态范围 | `green-workbook-result.json` | 批次→单行、单行→批次读取真实范围后重置为已保存值；同单行focus保留未提交值 |
| 原生200% | `node scripts/governance-p1-source-native-zoom.mjs` | passed=true，dpr2/visualViewport.scale1，CSS视口720px、scroll720px、select14px/44px高；`native200-full.png`为CDP完整截图，常规截图在原生缩放下只截局部，不能单凭该局部图判布局裁切 |
| 真实身份 | 三份GREEN结果 | 实际切owner登录清管理员详情/选择；来源队列owner403、匿名401，未扩大具名审核权限 |
| 业务数据保护 | 三份GREEN结果 | 0来源/目录写请求；62项队列前后hash均`3f0278177db78f1c6f6981a7260a05c402ab3adedc866343061ee4c4b85156f5` |
| 真实PG候选 | `node --test server/hub-sources/review-receipt-pg.test.mjs`；`receipt-pg-blocked.log` | **1失败，HUB_SOURCE_RECEIPT_NOT_FOUND**，不当作验收通过；app角色受原RLS隐藏Hub回执，事务回滚 |

已查看1440、390及原生缩放截图；原左队列/右详情与移动返回路径保持，无本轮重排。pageerror为空不等于已断言所有console信息；401/403为刻意角色反例。截图/录屏无登录凭证。

RED→GREEN：外部来源focus从tenant丢至空；工作簿从tenant丢回已保存范围，修后保留。动态补测首版在范围请求完成前读取旧select，改为等待真实行/批次响应及渲染状态，未改UI迎合断言。此前把原生select计算行高normal当22px导致脚本失败，已区分native与共享Button；相关prior结果及失败截图均保留。

## 3. 权限阻断及未交付部分

`aisci_app`虽有audit_log SELECT/INSERT，原`audit_project_select`只读当前Study且必须有project上下文；Hub回执project=null可插入但不可读。不能伪造Study归属、放宽旧RLS或改高权限GET绕过。最初“无需GRANT”的表权限判断已被真实PG推翻。

建议[单一受控读取函数方案](../planning/governance-module-2026-11-12/p1-source-receipt-contract.md)：应用仅EXECUTE，校验事务tenant与服务器principal、当前授权，只返回本人当前Hub精确一笔审核回执。函数owner/schema不可由应用替换、精确签名GRANT及跨租户/账号/失权反例列为批准后验证门。**未授权前不创建函数/GRANT、不启用候选、不切团队/P2。**

PG测试只在本轮新事务夹具演练，异常整体回滚，不删历史任务/来源；序列可正常消耗，不声称零物理影响。最初测试用app角色写来源导致42501，已按旧Controller既有direct写/app读拆分；当前真正阻断是回执RLS。读取失败后面的并发/失权/回滚原子性断言尚未全跑到，不用候选单元代替真实证明。

## 4. 独立总评与四层结论

独立只读评审`governance_p1_source_review`：本次局部修补无Critical/Important，独立9项通过；建议补动态范围及最小函数身份绑定，均已补验证/契约。尚未实测内容指纹A→B的动态清草稿、完整新具名审核提交、未知结果恢复与前台/AI可得性，列入权限批准后来源页验收，不标DG全完成。

四层仅对“选择保留”成立：代码已改→Vite本机实际加载→真实focus/账号/范围请求→选择保留及权限清除可观察。完整P1/回执恢复未满足四层，用户专业验收、团队页、P2、临床/生产均未完成；不能称模块已发布或全测试绿。
