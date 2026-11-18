# P1来源审核：原提交恢复与页面交接

2026-11-12。**DG01–05来源页已完成本机合成技术闭环，用户专业签收/生产启用未完成；P1团队页随后实施。** 当前获批范围内实现，不包含P2、旧系统改造、临床、模型调用、云或发布。

## 实际交付

- 原按篇PMC、外部、工作簿审核继续原服务和原事务角色。统一界面提交前保留本账号/authVersion的原操作元数据；不保存凭证或来源正文，不自动重发。
- 审核与现有AuditLog中的原回执同事务。同键同内容重放原结果；同键换内容409。受控只读函数仅精确读取当前有效具名审核人在本租户/Hub的本人回执；不扩旧审计RLS或SELECT，不加表列。
- 提交响应未知后，刷新/“重新核对”只GET原回执，匹配原参数再回读队列才确认成功。404不假称没提交，原工具栏切为“重试上次保存”，须用户明确点击，重用原键/原内容；不会把当前另一篇的选择拿去重试。
- 待核对提示注明原题名，切换队列仍保留；其余新保存暂禁用。409展示未保存的原选择并读取当前范围，不静默覆盖。既有左队列/右阅读、窄屏列表返回、颜色/字号和控件位置未重排，不新增弹窗或确认步骤。

## 验收矩阵

| 项 | 当前证据/结论 |
| --- | --- |
| DG01列表/定位/查找 | 三类真实队列、搜索/范围筛选、深链接、同身份focus、账号切换；五宽通过。保留原分页与30行加载路径 |
| DG02阅读/来源 | 原PMC/外部结构化原文、工作簿原始行/摘要/错误行；真实新夹具缺题名行保留但不放行。无补造页码/正文 |
| DG03审核范围 | 新具名合成工作簿公开、仅租户、暂不放行均真实生效；原五份/旧PMC/历史决定未做持久修改。旧外部/PMC服务回滚PG验证保持能力 |
| DG04恢复/版本/历史 | 真POST201提交后丢响应→刷新GET原回执200且POST仍1次；503未到服务端→回执404→显式原键原内容重试；真实并发决定导致409不覆盖；PG原子/重放/权限/失败回滚通过 |
| DG05前台/AI | 公开publication HTTP200；租户内容匿名404/owner member200；未审与错误行404。真实SQL检索只返回获准范围，撤回后移出，0模型请求 |

## 新鲜验证与证据

- `node --test tests/*.test.mjs`：**469/469**，`evidence/governance-p1-source-2026-11-12/recovery-frontend-final.log`。
- `node --test server/hub-sources/review-receipt.test.mjs server/hub-sources/review-receipt-pg.test.mjs server/hub-sources/object-review.test.mjs server/hub-sources/object-review-pg.test.mjs`：**14/14**，同目录`recovery-backend-final.log`。包含PMC使用未提升的app角色真实审核/回执/重放；原对象改动均回滚。
- `npm run build -- --outDir .tmp/governance-p1-recovery-final`：exit0，5.99s，既有大chunk警告保留；未覆盖运行dist。
- `scripts/governance-p1-recovery-browser.mjs`最终结果：[p1-recovery-249ce593/result.json](evidence/p1-recovery-249ce593/result.json)，passed=true、3组业务断言、4次页面POST（含注入失败与409），原对象逐项hash不变、pageerror为空；PNG/WebM留存。使用新批次/具名来源，全部本轮夹具最终暂不放行，历史/错误行保留，不删除。
- 真实Chrome外部/工作簿/PMC三份GREEN及原生200%均通过，五宽1440/1366/1920/390/320；最终只读队列73项、hash `31f238fb4af2e58aa52f985483644b22b260ebea0ef3441824f0c12d740b33d6`。62→73为具名合成测试来源增加，不是原来源被改写。截图人工检查沿原布局。

## 失败与修补留痕

1. 初版读回执被旧RLS隐藏，已按用户批准仅增加受控读取EXECUTE；SQL本身只投影kind/input/review。所有者aisci_owner，app无schema CREATE/owner成员权，PUBLIC无EXECUTE，参数租户匹配事务上下文，账号版本/有效租户/当前具名grant重验并持锁。
2. PMC补测暴露ORM的INSERT RETURNING触发原SELECT RLS。改为不含RETURNING的参数化INSERT，Hub事务明确无Study上下文；原INSERT权限已经允许，未新增写函数、GRANT或伪造Study。真实PMC回滚PG RED→GREEN。
3. 旧object-review-pg的authVersion=0已不符合当前账号，4失败保留`recovery-backend-tests.log`；仅将测试读取当前版本，未改账号/权限。其首个失败遗留新夹具`rhsb-4d5bc41e18b35afdd40c15237fffaef44f272070`经创建时间、精确题名/ID核对后只对该本轮夹具追加暂不放行，未删除原始行/历史。
4. 浏览器首个`p1-recovery-7711a2af`恢复主流程通过，但窄屏已回列表导致等待隐藏详情；并行旧测试新增来源使“整集合hash”变化。后改按已存原对象逐项核对，并按原移动路径进入详情，不弱化业务保护。`4708aaf7`通过；`609e4157`为独审提示丢失的真实RED；修后`249ce593`通过。
5. 独审发现切对象会清恢复提示；按实际无法解释禁用/可能误解原对象的影响，作者将其作为DG04必要恢复修补，保留题名提示，不改布局。独立总评Critical/Important=0、Minor=1，作者该项浏览器RED→GREEN，未重复派审。
6. 只读hash回归曾与本轮写夹具同时运行，正确检出集合变化；失败prior JSON保留，最终三种只读回归在写测试结束后重跑通过，不把并行测试冲突说成业务成功。

## 环境与四层边界

仅重启本机独立ResearchHub环境加载代码；启动前核对无running/processing的聊天/导入/Agent/导出，155条历史queued聊天未认领、排空或修改。最终本机PID50403、七服务ready。若之后其他会话重启以实时status为准；旧服务未动。

四层证据：代码→受控函数已配置/后端已加载→真实提交/回执/权限/检索请求→原操作成功且无重复审核、未审内容不可得。证明本机通用合成技术路径，不等同生产部署或专业业务签收。审核人的当前source.review原授权未改变，其他管理员不自动获此权限。

独立只读评审：`p1_receipt_final_review`，7纯内存测试独立通过；未代验实时数据库/生产/视觉。上述实际PG/Chrome/截图由主实现验证。当前产品UI/技术/API/基线/版本同步后，按已批准顺序进入团队页，不启动P2。
