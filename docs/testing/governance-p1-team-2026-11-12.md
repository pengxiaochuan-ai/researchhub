# P1团队审核：本机验证与R01依赖缺口

2026-11-12。当前目录串行＋一次独立总评。**新团队保存/联审与T01/T02已实际执行；R01依赖未接通，DG10及P1整体不得标完整完成，P2未启动。** 本机合成软件验证不代替用户专业签收或生产部署。

## 1. 批准范围与实际变更

- DG06已确认：治理审核列表只保留团队名称搜索、原五列及分页，不新增机构/省市筛选；原弹窗及T01筛选不变。
- 用户批准仅各新增1个具名合成团队、机构、负责人，本机实体额度3/3/4→4/4/5；`server/directory/controller.mjs`仅此一行配置调整。未恢复操作次数限制，未改48KiB、250KB、当前授权、来源、版本、租户隔离、审核、审计或RLS。
- 无新增API、表、字段、GRANT、角色或旧系统改动。没有付费AI、远端配置、云或发布。原团队/机构/研究者只读。

## 2. 四层事实

| 层次 | 真实证据 | 边界 |
| --- | --- | --- |
| 代码 | 仅本机`localDirectoryBudget`调整为organization4/team4/researcher5 | 不新增产品权限或通用额度服务 |
| 本机配置 | 启动前imports/runs/chats/exports无执行中；保留155历史排队聊天，原装配不启动恢复扫描；重载独立ResearchHub，PID83188 | 不重启旧服务，不认领历史任务，不是生产发布 |
| 实际请求 | 新团队创建201；真实保存、预检、审核、回执、409与角色403/公开404；新实体总计4/4/5 | 非Mock成功；只有响应丢失故障使用route.fetch后中断交付，真实数据库已提交 |
| 业务结果 | 一次审核联审机构/负责人、默认机构、回读后关窗；T01/T02同一已审对象，旧全部目录对象快照相同 | 用户专业体验待签；R01不可用，不能称整个P1完成 |

## 3. 唯一本轮夹具与保护

| 类型 | ID | 内容 |
| --- | --- | --- |
| 团队 | `rhde-05bfbbbbd5724a17bf6ba9181f81d001` | `[合成验收] P1团队联审20261112` |
| 机构 | `rhde-3fa1454c37ea4767a732d4af1f72d7f5` | `[合成验收] P1联审机构20261112（原位核对）` |
| 负责人 | `rhde-445730ab45ba414baa3fcbbd2b26fa4a` | `[合成验收] P1负责人20261112` |

三者仅租户成员展示，匿名团队详情404；本轮未接入目录AI、未创建账号、Study成员或L2/L3身份。0模型调用不作为AI检索隔离负验的证明，本轮未独立执行此项请求。本机私有manifest锁定ID与原创建键；失败显式复用同一对象，未重复新建。原3团队/3机构/4研究者的完整adminEntity及团队workspace逐项相同（workspace仅排除全目录图自然变化的currentRevision）；未清历史或修改原待审资料。

## 4. 实际验证

- 额度准入：`scripts/governance-p1-team-fixture-admission.mjs`为创建前一次性回滚探针，旧额度RED=`DIRECTORY_FIXTURE_BUDGET`，新额度GREEN每类仅允许额外1个，再建409，整体回滚。证据`evidence/governance-p1-team-write-2026-11-12/admission-1794481268535/`及`admission-1794481306609/`。正式夹具已建后不要盲目重跑此准入探针，其预期起始计数为3/3/4。
- 主链：`scripts/governance-p1-team-browser.mjs --resume`，[真实结果](evidence/governance-p1-team-write-2026-11-12/browser-1794482266246/result.json)：名称草稿私有、一次审核自动保存/联审/关窗、真实成功响应丢失后原回执无重复版本、并发保存409输入保留/显式对照继续、owner403、匿名404、T01原筛选及T02同版本展示。0 pageerror、0越界写、0付费调用。
- 补充：`scripts/governance-p1-team-details-browser.mjs`，[真实结果](evidence/governance-p1-team-write-2026-11-12/details-1794482543844/result.json)：站内移除确认Esc、明确移除仅本地、关闭取消及放弃保护；机构原位编辑与下拉名称一致，保存草稿不改变机构当前已审核版本，一次审核追加机构修订并关窗、重开一致；旧全部目录对象未变。
- 前端全量`node --test tests/*.test.mjs` **489/489**；[日志](evidence/governance-p1-team-write-2026-11-12/frontend-suite.log)。隔离`pnpm exec vite build --outDir .tmp/p1-team-build-20261112` **5.06s通过**，有既有大chunk警告，未据此扩大打包重构，[日志](evidence/governance-p1-team-write-2026-11-12/build.log)。无项目独立lint/typecheck脚本，不虚报这两项。
- 后端8文件串行`node --test --test-concurrency=1`，沿团队实施计划的7个契约/回滚PG文件及`controller.test.mjs`，**31/31**，[日志](evidence/governance-p1-team-write-2026-11-12/team-regression.log)。写测试整体回滚，不与浏览器并发争用授权锁。
- 当前新夹具`node scripts/governance-p1-team-readonly-visual.mjs --team=rhde-05bfbbbbd5724a17bf6ba9181f81d001`，1920/1440/1366/390/320及Chrome原生200%通过，[结果](evidence/governance-p1-team-visual-2026-11-12/1794482779655/result.json)。14px输入、名称搜索、弹窗无横向溢出、Tab/Esc/焦点返回与资料不变；0业务写、0pageerror。人工查看1440/320/200%截图，PNG/WebM保留。一次独立总评完成，无新增重要问题、2项脚本Minor暂缓，未标完整P1通过。
- 后续只读status观察到当前PID91477且七服务ready；不是本任务再次执行重启，不把并行工作区运行时变化冒充本任务部署。以上实际写链在本轮加载后的目标环境完成，数据与历史不清理。

## 5. 失败与未隐瞒项

1. 首次主链创建实际201，因验收脚本沿用旧成功文案等待超时；截图显示现文案“草稿已保存，尚未审核展示”。仅修测试定位，保留原新ID和创建键，未重建或改产品文案。证据`browser-1794481513344`。
2. 第二次打开该草稿GET503，未保存机构或人员；直接同服务app角色175ms读成功，后续pg_stat_activity无其他活动锁。原因未稳定复现，不能把它无据归为产品或锁争用；未放宽超时/保护，保留`browser-1794481833490`。脚本支持用户明确点“重新读取团队资料”，不自动重发写入；最终主链全程读取200。
3. 首次移除确认用“包含标题的dialog”定位，嵌套弹窗匹配父子两层；无业务写。仅改成精确可访问名称定位，后续通过；保留`details-1794482510265`。
4. 之前只读阶段PG并行锁超时与503记录仍在[准入报告](governance-p1-team-admission-2026-11-12.md)，本轮回滚PG仅串行执行，不清理或放宽旧保护。

## 6. R01真实缺口与下一步确认

`src/real-mode-route.js`将R01/R02列为PENDING；`src/page-linking.js`真实模式显示“此页面暂不可用”，目录controller目前只有团队列表/详情/关系API，没有研究者检索/详情API。R01原前端仍是受gate隐藏的演示母版；**不是已有接口换参数即可接通的投影**。

已在owner真实浏览器进入R01并截图`browser-1794482266246/r01-existing-pending-gate.png`。不打开演示分支、不以目录底层已有researcher实体或T02成员名单冒称R01完成。DG10保留原验收项，不静默删除或延期；当前是依赖阻断，不是P1完整交接。

建议取得用户确认后，沿既有[科研身份/T01/R01规格](../product/research-identity-team-researcher-spec-2026-11-03.md)集中完成R01整页及必要R02只读详情，复用现目录实体/事实/决定/当前来源及权限；不重建表、不扩认证/AI/Study权限或共享底座。完成后再销项DG10并收口P1，不直接切P2。本轮不擅自跨页开发。

## 7. 独立总评与作者裁定（覆盖上文评审进行中）

一次只读Codex总评完成：无新增Critical/Important，允许交接本机新团队写链与已验证T01/T02部分，**不允许标DG10/P1整体完成**。评审未访问业务接口或写文件/DB；本轮无提交/合并/发布。[完整记录与作者判断](../planning/governance-module-2026-11-12/p1-team-independent-review.md)。

两项Minor暂缓（均不否定已保存证据）：主浏览器脚本首次联审后极窄中断窗口缺失机构/负责人ID时，恢复会安全失败而非补齐；机构细节脚本虽然拦截越界写并记录所有writes，但未另断言unexpectedWrites为空，未来可能弱化测试判断。本次确实只有两笔获准保存/审核，原对象快照不变；不据此扩大修补，后续复用验收脚本时完善。

保留判断：GET503根因仍未定位；专业/临床与生产未验，R01未接；未独立执行目录AI检索负验；局部配置与浏览器证据不代表历史全分支审查或母版逐像素对比。以上均不得由测试通过覆盖。文档尾注/Notion同步完成后单独登记，不以评审暂态文档缺漏冒充交付完成。

## 8. 文档同步及收尾

本地PRD/清单、基线/变更/版本/使用说明、技术兼容说明、文档索引、团队计划/进度/任务/分期/倒排及本报告/独审记录已更新。Notion复用原页增量更新，新增本报告`41656479ab5881fa824de4dee006a6db`及本次独审`41656479ab588145914df062e8e92183`，ID映射见`docs/planning/governance-module-2026-11-12/notion-sync.json`；无重复建旧页或替换无关内容。报告页已展示。

本轮5份关键Markdown相对链接0缺失，四个脚本`node --check`及限定路径`git diff --check`通过。保留共享脏工作区与历史，不自动提交/合并/删除夹具；本机继续运行，专业签收/生产未验。下一项仅建议处理R01依赖，需用户确认后继续，不自动执行跨页开发。
