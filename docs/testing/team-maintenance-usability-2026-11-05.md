# 团队维护减负 · 本机技术交接

日期：2026-11-05。仅G02团队维护、原admin/owner、专用合成库wp01_test_full_baseline。无新权限/表/付费调用/云/远端配置/真实发布，真实团队草稿与原展示投影不变。按[批准规格](../product/team-maintenance-usability-2026-11-05.md)一次精简，不自动改其他页。

## 四层状态

1. 代码：原列表/三分区、双动作/一次审核框、机构不重复、人物可选复用、资料直接添加、帮助分层、冲突恢复及更多操作已实现。减负规则写入AGENTS/UI-UE/验收与本轮用户明确授权的独立记忆更新note。
2. 本机启用：原七服务19501–19507 ready，前端热更新；无需改后端配置、PG或旧服务，账号仍原角色。当前登录入口仍回P01。
3. 实际执行：原管理员在真实Chrome/IAB读取；合成草稿实际保存/回读和真实409恢复。11组Chrome＋4组科研侧T01/T02回归、五视口/原生200%有PNG/WebM。真实PG回滚验证组合审核/来源撤回/中途故障原子性；没有给真实团队或原合成团队新增持久审核决定。
4. 用户结果：主实施目视核对；用户实际操作负担和专业认可仍待体验，不从测试数量推断满意或效率百分比，不称生产交付。

## 验证结果

| 项目 | 实际结果 |
| --- | --- |
| 新流程/SSR/错误映射RED→GREEN | 初轮9项通过，缺模块/旧控件/误报无权真实RED留在证据根目录`initial-red.log` |
| `node --test --test-concurrency=1 tests/*.test.mjs` | 最终220/220通过，0跳过 |
| `node --test --test-concurrency=1 server/directory/*.test.mjs server/reference/*.test.mjs` | 50/50通过，含实际合成PG事务回滚，不修改持久审核 |
| `pnpm run build` | 通过；既有WikiEditor/china大chunk警告保留，不扩成打包重构 |
| `node scripts/team-usability-browser.mjs` | 最终11组通过，真实原账号/PG读取保存，原草稿数据恢复，0模型调用 |
| `node scripts/directory-layout.mjs` | 4组通过：五视口、窄屏导航/焦点/详情返回、原生200%、地图真实锚点 |
| 独立总评审 | 0 Critical/1 Important/1 Minor，作者一次修补并RED→GREEN；[完整记录](../planning/team-maintenance-usability-2026-11-05/code-review.md)，无独立二次复签 |

## 浏览器任务链与证据

[证据根目录](evidence/team-maintenance-usability-2026-11-05/)，backend-tests/frontend-tests/build.log为最终命令原文。

最终：[11组result.json](evidence/team-maintenance-usability-2026-11-05/browser-66c11556-7c3d-428f-8067-9f35741472c3/result.json)。追加严格等待所有既有依据真实题名恢复后再验收，避免把暂时核对中的早期截图当作完整加载结果；核心代码未变，前一次328b8477的Important GREEN仍保留。

- 列表→合成团队原三区→新增人员默认直填/可选已有→资料搜索直接添加/移除→审核框默认租户、选择公开重新核验、理由/明确确认，无额外勾选→Esc/归焦。
- UI-only来源403：不转发服务端、明确请求来源而非角色不足，保留输入；不是实际鉴权绕过。
- 审核入口有dirty时真实POST草稿→GET回读→GET预览，不要求额外手动保存；无隐式审核。
- 真实并发PG保存制造409→错误旁查看最新资料→输入不丢→明确保留输入→手动恢复原说明保存。
- 独立评审负例：UI-only扣住reviews POST，不转发；注入刷新事件后真实auth/me200，checking中旧预览失效、原回执恢复仍在、普通审核不能新发。被扣请求迟到503不回填；真实回执404不冒称从未提交。此路径不是实际持久审核成功，也不是原生focus事件端到端，只证明共用刷新/checking分支；focus触发同分支代码已核实。
- 1440/1366/1920/390/320精确CSS视口：操作14px、主控件至少44px、表单与审核框不横溢；Chrome独立profile设置2倍真实缩放（DPR2），不是窄屏或CSS transform冒充。PNG/WebM/metrics留存。
- owner真实管理403而无管理表单；真实团队workspace前后完整响应一致、合成draft.data恢复、原公开投影一致。合成草稿操作/审计历史只追加不删除。

科研侧回归：[result.json](evidence/research-identity-directory-implementation-2026-11-03/t01-layout-81a6002c-81a8-4fdd-8881-e753f38f0128/result.json)。其他页面及Frozen Token未改，仅Shell该叶子说明文案更新。

失败保留：`browser-273d2430...`是Esc归焦RED；`browser-f9b2e0ed...`为评审在途checking RED；`browser-78039...`为修补前10组成功，不能代替最终11组。IAB最终实际题名/双动作/审核框另存`iab-final-actions.png`及`iab-final-review.png`。最新证据中的源资料/数值仅合成/已获准公开材料，无凭证或患者信息。

## 已知限制和用户工作保全

本轮开始时IAB会话已过期，页面没有表单DOM；不能声称取回了上一轮全部未保存输入，也未依据旧截图擅自重填/提交真实团队。真实草稿原保存时间与内容保持。本轮浏览器仅改具名合成团队并恢复其data，保留新增历史版本/审计。

未运行全站无障碍认证或其他业务页重设计；不宣称正式资料已齐全/获批。新流程省去可逆重复操作，不绕过真实负责人、原文依据、当前授权、版本与审计。Notion同步回执在实施计划登记。
