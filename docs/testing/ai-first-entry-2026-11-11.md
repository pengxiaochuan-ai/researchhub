# 岐研AI首次可输入 · 本机验收

对应[修补规格](../product/ai-first-entry-2026-11-11.md)。用户报告首次进入不可编辑；真实Chrome RED已复现输入isEnabled=false。根因是工作台的`!session`禁用及resolver依赖既有session，而不是Token、模型或本次右栏CSS。

## 四层结果

1. **代码**：无session且账号/Agent/Study核验就绪时允许输入；`ensureQueueSession`只在明确发送时用原幂等POST建立会话，再发原commands。已有历史`selectedId&&!session`仍等待归属核验；403不另建会话。首次创建用内部instanceKey保留输入组件，URL仍真实sessionId，排队确认不吞掉后写草稿。历史点选/显式新建仍按原实例切换。
2. **本机启用**：使用既有本机环境，前端热更新实际生效；收尾查询PID46505、19501–19507七服务ready（起始查询为62019，工作区并行期间运行时PID变化）。本任务未执行API/Worker/配置重启，未操作旧服务或临床库。
3. **真实执行**：owner/admin各从无参数AI01进入、直接输入“解读报告”、按Enter，仅各创建1条本人新会话及1条指令；刷新保留真实会话/首问标题且输入可编辑。DB核对当前合成租户/本人、一个user消息、0模型job/UsageRecord。owner正常Token不足暂停，admin为明确科学澄清；只软取消本轮这两条未执行指令。未补额度/权限或发付费请求。
4. **使用路径**：真实Chrome双账号桌面及390px截图/录屏，0 pageerror；另以受控延迟建立验证双Enter只创建/提交一次、创建期间可继续写草稿并在URL更新后保留；创建未知结果保留原问题、只显式同键重试。已有历史等待核验及拒绝后禁用不回退新建。最终视觉及科研回答质量不由本轮免费测试替代。

## 免费验证与独立评审

- `scripts/ai-first-entry-ui.test.mjs`：3/3 GREEN，8.79秒，首项修补前RED为false!=true；另外两项为未知创建恢复、历史授权否定。不调用真实模型。
- 原会话/队列/时间分组/首问/分页滚动及按需证据栏浏览器：19/19，77.2秒；合计本轮22项浏览器用例，另有双账号真实读写验证。
- `node --test --test-concurrency=1 tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`：当前工作树419/419，107.6秒，无失败/跳过。
- `npm run build`：4.50秒通过，保留既有大包提示。无新依赖、DDL或后端更改。
- 一次独立只读总评审通过，无Critical/Important；核对lazy创建/同键重试/原始指令、preserveComposer草稿稳定、历史403和active/epoch隔离及3项浏览器证据。未改文件、写库或调用模型。

## 证据与边界

`.tmp/ai-first-entry-2026-11-11/`：red/green、real、interaction、suite、build日志，real-results.json，双账号first-entry/refreshed/390 PNG、first-send-preserved.png及video/WebM。首次shell日志重定向因尚未创建证据目录未启动测试；建目录后得到真实RED，不以shell失败当功能RED。

真实新会话：owner `cmwbs0wmc0029luuryade5tml`，admin `cmwbs155j002lluuri543xuow`，只合成数据/本轮对象。密码/DSN不进入文档或Notion。不在访问页面时自动建空记录，也不替用户发问；身份检查或服务错误仍显示真实受限状态。无新费用、权限、云资源、远端配置或发布。当前会话建立后正常模型执行仍沿原业务Token/并发预留/用量结算；本轮0模型不冒称新一轮付费AI验收。
