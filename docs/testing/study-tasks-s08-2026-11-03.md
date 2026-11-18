# S08整页技术交接 · 2026-11-03

## 结论和边界

01–11约定实现及本机合成技术验证已收口；一次独立总评审发现2项Important，作者已修补并完成实际浏览器回归，无第二次独立复签。**不需要用户重复批准剩余实施步骤。** AC10专业用户体验未代签，真实发布未执行；S10仍暂停，已批准的B02纯词表/QueryPlan不需要另行等待页面签认。

产品基线/变更/版本/说明、API/前端架构、测试、规划台账及Notion已同步；[Notion交接](https://app.notion.com/p/40d56479ab5881278af0c3051d8251d7)、[API](https://app.notion.com/p/40d56479ab5881668c45f96e33e35a12)、[独立评审与作者裁定](https://app.notion.com/p/40d56479ab58812ba582f39634949838)。未替换其他会话的身份目录设计或其待批范围。

环境仅`wp01_test_full_baseline`；run=`rh-s08-1c6165b1`，原两个账号、主Study和一个具名未入组辅助Study，8/8任务。所有复测复用现有任务，无第9条。owner/admin当前authVersion均5，管理员标记已恢复；须重新登录。未接临床库，不停旧服务，不调用模型、发邮件、变更云或发布。原AI账本摘要不变。

## 四层状态

| 层级 | 实际结果 |
| --- | --- |
| 代码 | F01–F12与批准UI01–06实现，旧Task同事务核心及Hub有界适配；两张扩展表，没有新调度服务 |
| 本机配置 | 两克隆角色、S08 feature、同库RLS与受控Schema已启用；原共享角色不改，普通owner不因组角色扩到其他Study |
| 真实执行 | 两账号HTTP/PG、Chrome全状态链、提醒收件、关联、并发/撤权/失败恢复执行；证据下列 |
| 业务效果 | 技术路径可用；AC10由用户实际体验确认，未代签。不是生产验收、正式临床采集或一期全站完成 |

## AC覆盖

| 标准 | 证据/结果 |
| --- | --- |
| AC01–03 身份、角色、创建/编辑/关系 | 01–07台账；真实app角色RLS、旧会话失效、两账号/未入组admin、同key回执/冲突及关系循环拒绝 |
| AC04 状态/验收 | `browser-final-514c56a2-569a-4c2e-94c8-7eb5a38a8468/result.json`真实开始→受阻→恢复→提交→退回→重提→接受；后续重跑是同任务只读结果核对，不冒充重新执行 |
| AC05 提醒 | `reminders-api-ba101c6e-3e12-47c7-9e4a-3936e64c0af5.json`及`browser-reminders-fac52cf1-6daa-4764-9ff8-27a09a9eb1f9/result.json`；冻结有效收件人、同key幂等、60秒频率与故障回滚；原Notification记recorded，不冒充送达/已读 |
| AC06 关联 | `links-api-f07413dc-ffc5-4ba7-be77-d924c7da925e.json`及`browser-links-f365cde1-2ed1-4908-b89c-27f103425a46/result.json`；创建时可选/关联/换绑/解除、当前父链/hash/版本重验；原件只读 |
| AC07 原子/当前授权 | `final-api-0cf5a0f7-5f7e-45d1-9a43-fe75c6a74b12.json`；两账号同版本一200一409，真实HTTP已在租户授权锁等待后撤销admin，实际403无Task/Operation提交；CAS恢复后新登录可用，终态重开409 |
| AC08 原位UI/恢复 | 四视口1440/1280/390/320、14px操作、键盘与Chrome原生200%；截图逐张查看，手机标题不得挤成单字竖列。版本冲突/重复选择/在途输入回归见下节 |
| AC09 回归/保全/独立评审 | Hub235、旧StudyOperations138、旧新事务核心12项及两端构建通过；一轮独立只读评审＋作者修补，无二次复签。原件/旧任务/角色/账本摘要保全 |
| AC10 用户体验 | 待用户真实体验反馈，不自动签认；这不是新开发授权申请，不阻断已批B02纯后端工作 |

证据前缀：`docs/testing/evidence/study-tasks-s08-2026-11-02/rh-s08-1c6165b1/`。早期失败、截图和录屏原样保留；不把只读复验算新的状态写入。

最终代码对应：`browser-final-7bd81af3-6349-46a8-bd7e-96d1cec7cac6/result.json`（9组实际检查，0新任务，PNG/WebM，320/原生200%截图已查看）；`preservation-3afde9e9-b027-4f44-b755-70e405492620.json`（原件/旧数据/角色/费用一致）。完整免费门禁证据另位于同一S08证据根下`free-gates-d6ad4e02-ca76-41e3-adc4-25ae55882c05/result.json`，235/138/12、两端构建及diff检查退出0。

## 独立总评审与作者修补

完整原评审及作者裁定见[评审结论](../planning/study-tasks-s08-2026-11-02/final-review.md)。原结论With fixes，Critical0、Important2：

1. 并发409后编辑对象仍旧版本，刷新不能保留草稿恢复提交。现保留待提交内容，读取当前任务，显示当前版本/信息与保留修改；用户明确确认后才换新requestKey、按最新expectedVersion提交。再变仍409，不静默覆盖或自动重试。
2. 同ID“查看详情”及在途GET可以重新挂载草稿。现同ID也需显式放弃确认；实际读取期间产生新编辑，则拒绝应用迟到结果，保留草稿并提示。轮询仍重验当前授权/来源，不把旧响应盖回新版本。

真实双账号回归`draft-recovery-45b06d47-1ec2-465e-8d61-eae6733ee156/result.json`三项通过，录屏/截图保留；原有任务标题/优先级在finally按CAS恢复。新增2项纯草稿守门测试通过。失败记录：首次驱动误传tenantId到受限URL导致setup拒绝，修正测试URL；之后移除恢复分支的反证实际409且缺确认入口（`draft-recovery-5713c644-*`）；修补后首轮因新挂载回调误报编辑覆盖成功反馈（`draft-recovery-acd9cd97-*`），限定实际dirty变化后重跑通过。

截图复核另发现手机列表标题被状态/按钮挤成单字竖列（此前“无横向溢出”断言不充分），新增真实几何断言后RED=`browser-final-6fc75731-*`，仅S08标题区窄屏占整行、不缩字、不改Shell。原生200%截图现在等待真实详情加载且滚至表单，不拿初始化骨架证明加载完成。

## 明确限制与未作事项

- 现有目标采集页不支持固定历史版本URL；按已批规格只显示固定版本摘要和限制，**没有假回链**；正式访视`allowFormal=false`，不声称临床流程已启用。
- 公共Shell在320和原生200%的品牌/搜索/身份及Study导航仍拥挤，非S08局部内容问题。本轮未擅自全站改版；不能称全站移动端体验验收通过。
- 新任务8/8已满；达限不续额。可对已有本轮新任务按当前权限体验执行/提醒，终态不可重开。旧D01和前序科研资料只读。
- Hub已有大chunk提示和测试WebSocket端口告警保留；无新增依赖/模型开关/底座专项。0模型调用，不验证新的AI能力。
- 实际工时不能由自动化执行时间倒推；原4日＋1缓冲是计划估算。11/04、11/06全一期余量复估及2026年11月中旬目标保持，未以本页替代全站交付。

## 复验命令

```sh
node scripts/study-tasks-draft-recovery-browser.mjs
node scripts/study-tasks-final-browser.mjs
node scripts/study-tasks-preservation.mjs --mode local-synthetic
node scripts/study-tasks-final-gates.mjs --mode local-synthetic
```

前三项只对原具名合成范围；浏览器复测可能调整现有本轮任务/记录提醒，不是全只读。完整API撤权驱动会使admin旧会话失效，不应在用户正在操作时无谓反复运行。所有证据无口令/会话正文；界面中的合成名字不是临床资料。
