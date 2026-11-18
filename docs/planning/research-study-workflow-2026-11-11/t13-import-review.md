# T13 CSV 导入后端独立审查

日期：2026-11-12。范围：`server/research-capture/import-csv.mjs`、`imports.mjs`、对应单元/PG及合成 fixture、T13合同，追踪实际 controller 装配和被调用的现有授权/锁/正式修订函数。未修改产品实现、DDL、配置，未重载或部署。S09 UI 不在本轮范围。

## 当前结论

**冻结后本轮范围内无剩余 Critical / Important 阻断。** 两项发现均已修复并独立复验：最终单测 **6/6**、正式 PG **1/1**、补充 PG 探针 **1/1** 通过。以下保留发现历史；源码及PG通过不代表最新增量已在目标HTTP运行或T13业务验收完成。

1. **P2，已修复并定向复验：CSV 非零值/不安全整数被静默改变。** 初审 `import-csv.mjs:35` 仅有限值及 integer 安全整数判断。独立复现 `1e-999`→0、number字段 `9007199254740993`→9007199254740992，均 errors=[]。前者与真实观测零无法区分，后者丢失输入精度。主循环已新增 decimalIdentity 最短十进制等价检查、所有不安全整数拒绝及反例；源码已读，独立6项单测和11个额外数值边界探针通过：包括正负下溢、危险整数/小数拒绝，正负0、零的大指数、尾0、科学计数和最小可表达正数保留。修复不引入自动舍入或任意精度运算，真实0/false/null及等价尾0/指数应保留。
2. **P2，已修复并独立PG复验：必填/范围错误缺少字段定位。** 初审 `imports.mjs:45–48` 将 normalizeAnswers/score 错误收敛为 rowNumber+通用code，min/max越界及必填缺失无fieldKey；这与合同“精确行号/字段定位”不一致，复杂表单不能准确纠错。数字/boolean/select解码错误已有fieldKey。当前 `imports.mjs:16–21` 按固定schema收集required/min/max的行号与fieldKey；已有parser字段错误不再被重复报为伪缺失，仍保留共同normalize/score为最终守门（字段有错时该行不进入可提交计划）。独立最终PG明确断言第2行value必填缺失、第3行value越界，预检仍零分配。没有猜测额外规则。

## 已复核机制

- CSV有256KiB/100数据行/64列上限，严格引号状态，支持引号内换行、双引号转义、CRLF/BOM及物理起始行号。额外/缺失/重复列、重复被试访视行均拒绝，不静默跳行；字段类型取固定FormVersion，不推断单位。
- production controller 使用既有 withResearchStudyTransaction：当前tenant授权锁、账户authVersion、租户状态和Study可见性先于导入。导入再核当前form.fill、feature、项目/组/角色；Hub owner不因此自动获采集权。
- 预检仅查询及锁，不创建分配、响应或revision。先解析所有绑定，再统一 project→排序protocol→排序subject，随后校验enrollment/visit；旧writer锁能重入。当前同意、执行/已替代旧方案、pending_anchor、固定表单requirement、researcher渠道都经旧核心重验。
- 仅空白draft或新分配可导入；非空已有草稿、H5分配、提交答卷及重复assignment拒绝。计划hash绑定Study/scope/actor/authVersion、表单schema/scoring、原CSV SHA和每行目标/版本，commit同事务重新计划再比较；来源变化不使用陈旧预检结果。
- 每行通过原assign/write入口创建正式revision；整批结果仅保存CSV SHA、行号和固定ref，不存CSV正文。CSV审计、所有revision和actor-bound operation receipt同事务。成功同键回放先核请求hash及当前授权，再按批父链锁和历史revision完整性校验；不把历史receipt当最新答卷。
- 回执repository按tenant/actor/key读取，并再次核action/Study/target/key；源assignment在当前scope，历史ref经过正式revision envelope哈希与批准policy父链校验。当前失权/同意撤回先拒绝，再谈恢复。

## 独立执行与证据边界

- `docs/testing/evidence/research-t13-2026-11-12/imports-independent-unit.tap`：原5项单测通过。严格解析、0/false/null/多行引号、重复行及预检无写路径。
- `imports-independent-numeric-unit.tap`：数值修复后6/6单测通过。
- `imports-independent-final-unit.tap`：冻结后最终6/6单测通过。
- `imports-independent-final-pg.tap`：冻结后实际PG 1/1通过，包括新增required/range字段定位。此前 `imports-independent-pg.tap` 保留。预检零分配、两行正式revision、第二行写后故障SAVEPOINT回滚（assignment/revision/operation皆零）、同键恢复、固定来源、已提交不覆盖、模式拒绝、参与撤回后回执拒绝。
- `imports-independent-frozen-probes-pg.tap`：冻结后独立扩展PG 1/1通过；此前 `imports-independent-probes-final-pg.tap` 保留。错误previewHash零分配；真实已有0/false草稿保持原值且整批拒绝；另一真实同租户管理员取本人以外回执404，跨Study404，authVersion失效和feature关闭拒绝。脚本为 `.tmp/t13-independent-probes.test.mjs`，复用原fixture与核心，未改产品源码。
- 上述独立PG均通过fixture guard校验 `wp01_test_full_baseline`，创建唯一合成范围，外层故意抛出回滚标记，全部回滚。包含的批准政策/同意是软件合成数据。Study事务包装在PG测试中为替身，因此实际controller当前Study授权主要是源码复核，不把此PG称作HTTP/RLS端到端验收。
- 原 `imports-pg-fixture-red.tap` 与 `imports-pg-pending-anchor-red.tap` 保留。最终通过不删除早期fixture错误。
- 本轮未独立执行真实双事务同键/反序批次竞争、服务HTTP或S09浏览器。主循环已另报告此前HTTP同键一批、不同键同预检200/409（`rh-t13-http-bc3c5bc3/result.json`）；本评审未执行该HTTP，且最新数值/字段定位增量尚待主循环统一重载后的真实HTTP复验。未覆盖反序多subject批次的双事务竞争，也未穷尽所有失败阶段。


## 最终冻结 SHA-256

以下均相对 ResearchHub 根目录；controller只审T13装配，不覆盖其中其他任务。

| 文件 | SHA-256 |
|---|---|
| server/research-capture/import-csv.mjs | `a7168d80c030217d86739f325024cf2f2204b6590088ff7422199d6a843c84bb` |
| server/research-capture/imports.mjs | `7eb9441af079b06b6f5c165cd58795937e850a6598acb9b19a22fc320f6b827d` |
| server/research-capture/import-csv.test.mjs | `b621fa2c94b70f7e509bbfc1e0de5213a16cdfb9c84bbc3960fba07ca194fafe` |
| server/research-capture/imports.test.mjs | `2fa5e04a9faad2714b79ec88625b077004134fbed11e8635aa6dfbd4d582671b` |
| server/research-capture/imports-pg.test.mjs | `524c925b89dbc8b478541e1ee94fd377fb69332d9c7fe540be37c27fc7570cea` |
| server/research-capture/synthetic-capture-fixture.mjs | `07d22617f07060b51e8d5b5745ba2a8213580b733427303d408c964a1717b296` |
| server/research-studies/controller.mjs | `548f5888d7ec9cee1e4e67305a003456f5b72010141870418528d6c9300290f8` |

建议下一项：主循环复验最新数值/字段定位增量的实际HTTP，再继续S09模板→预检→确认→回读及未知结果恢复的真实角色验收；不提前标T13完成。
