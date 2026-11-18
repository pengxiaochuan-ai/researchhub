# ResearchHub统一会话 · 本机技术交接

日期2026-11-06。依据[正式规则](../product/session-policy-2026-11-06.md)和[串行计划](../planning/session-policy-implementation-2026-11-06.md)，仅专用合成环境；无真实团队审核、业务保存、模型调用、云或发布。原布局/旧系统不改。

## 实现与验证

- 后端Hub独立认证适配复用旧账号验证和audit_log，12h JWT/Cookie同截止，活动renew同sid滚动，GET不续期，当前账号/租户/authVersion及PG退出记录控制续期与读取。旧无sid凭证需重登；不改账号权限、表或旧系统会话。
- 单元假时钟先RED后GREEN验证12h、失效/撤销和503；真实PG回滚验证账号停用、租户suspended、密码版本变更、仅本sid退出。作者自查追加“授权锁等待期间过期”反例，先复现错误续期，再锁后重验，RED→GREEN。
- 前端安全回跳/活动/iframe、身份迟到请求等测试通过。首轮真实Chrome发现断网改变status导致原DirectoryIdentity身份epoch变化并隐藏表单；作者补单元反例，改为保留authenticated状态/epoch、独立sessionHealth，未改团队页。后续双账号Chrome断网保留输入/重连/过期刷新与原页返回通过。
- 初次新增iframe验收脚本误选不存在的`.kb-page`，超时已保留失败证据，改用真实`.knowledge-frame`；不是接口失败或靠删失败记录过关。

最终回归：247项前端通过；70项认证/目录/字典后端含真实PG通过；构建通过，保留既有大于500kB分包警告。中间前端242项曾有两项同目录新增的非会话文案测试失败；本轮未擅自修其文案/删测试，后续同期文件更新后恢复通过，再追加会话回跳反例后最终247项通过，不把同期文案修复归于本任务。22项真实同源HTTP回归通过，证据`evidence/team-origin-rejection-2026-11-05/http-8447fd87-56e4-41a9-89e3-711caa2aaeb7/result.json`。

已完成的双账号Chrome核心证据：`evidence/session-policy-2026-11-06/698d5bf7-31e8-4c6f-93f2-a4a38016fda2/result.json`，含PNG/WebM、43200秒Cookie/JWT核对、真实点击续期、后台me读取不发Cookie、跨源403、人工签发仅测试用已过期凭证后的刷新回登录/原页、退出与迟到renew401、公开T01匿名访问、未保存团队输入断网保留。旧失败`0ba4878e-1bd7-476b-adc8-db4289a8d816`及iframe脚本失败`1e7d25d4-b14e-4010-9d63-a6502d743cfb`保留。没有修改电脑时钟或缩短正式12h，也没有等候真实12h后冒称已测；时长边界由真实签名和假时钟测试覆盖。

最终完整Chrome补验：`evidence/session-policy-2026-11-06/b64d0d44-b225-40d0-9887-da45c8b56d85/result.json`（双账号核心流程＋知识iframe实际操作续期＋P006原页、K01治理mode、S08 Study上下文三条过期/重新登录回跳）；前一份iframe补验`8af4ce0e-7f84-4c57-aae2-0784526b75d7`也保留。两份均保存PNG/WebM/请求状态与控制台，pageErrors为空；console中ERR_INTERNET_DISCONNECTED及401属于主动离线/过期/注销负例，不冒称控制台全程零错误。所有测试不输出密码、JWT、Cookie或私有配置，未提交任何业务表单。未改正式时长，最终7个本机服务ready。

## 单次独立总评审

无Critical/Important；独立实跑37项聚焦测试通过，确认同源iframe可信事件、持久撤销和授权锁、Cookie/同源/回跳/状态区分；不代表生产发布。作者锁后过期反例的修补另有RED→GREEN，不发起重复评审。

Deferred minor：成功路径已有60秒节流，失败侧连续真实输入可能逐次请求renew；无自动后台重试，后续可按发起时间加失败侧节流。本轮按非阻断建议登记，不扩大范围。

## 交付边界

本机独立环境启用并真实验证；正式部署/HTTPS环境装配尚未执行，不宣称正式域名生效。新模块及[API/装配文档](../technical/session-api-2026-11-06.md)作为ResearchHub正式产品代码；其他页面和权限不重设计。用户仍需实际体验登录/续期与回跳；未保存草稿不承诺跨过期登录恢复，回跳不自动重放业务动作。

产品基线/变更、使用说明/版本、ADR、前端架构/索引及规则/计划/API/本报告已同步Notion，历史和失败证据不覆盖。Notion[交接](https://app.notion.com/p/41056479ab588159a374feb13421b18b)、[API装配](https://app.notion.com/p/41056479ab5881c39c1ec19461b02429)、[计划](https://app.notion.com/p/41056479ab5881b78825ecfb791f3f38)。本机7服务继续运行，旧凭证持有人需重新登录一次。
