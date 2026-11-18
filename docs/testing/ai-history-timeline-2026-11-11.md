# 岐研AI历史时间分组与标题 · 本机验收

对应[实施规格](../product/ai-history-timeline-2026-11-11.md)。仅左侧本人历史列表及其真实标题/活动时间，不改变中栏、右栏、权限、额度、旧系统或正式部署。

## 四层证据

1. **代码已实现**：今天、昨天、7天内、30天内和更早YYYY-MM互斥分组；按浏览器本地日历日和最后活动时间。标题取首次原始问题前12个可见Unicode字符，不拆组合Emoji，14/22单行；完整问题可悬停/辅助技术读取和打开会话查看。后端读取最早本人user消息，`originalText`优先，消息内容/meta不透传。首问确定后不随后续问题或排队编辑变化。活动时间随新消息同事务提交，重复发送编号不重触。
2. **本机已启用**：确认专用合成租户无非夹具在途任务后，仅重载自有本机运行时，最终PID62019、19501–19507七服务ready。没有触碰旧服务、临床库、云或远端配置，不是正式发布。
3. **真实请求实际执行**：owner/admin各核对首批20条现有会话与数据库最早用户输入；各创建一条本人新会话、发送明确科研歧义“解读报告”，标题原位更新，刷新后仍处今天且时间等于真实Message创建时间。owner按现有Token不足暂停，admin按既有澄清处理；都无新job/模型调用。只删除本轮这两条未执行指令，历史不回写。此前两次脚本因非唯一DOM断言退出，均为免费测试定位问题；其自建会话/暂停记录保留，不自动重跑或触碰历史。
4. **业务体验技术验收**：双账号真实Chrome1440×1000及390×844截图/录屏，0 pageerror；受控数据验证全部日期组、长标题、首次发送、迟到旧列表、切会话、已加载分页与滚动保持。已目视检查桌面和窄屏截图，原三栏与左栏宽度不改。最终用户视觉偏好仍由用户确认。

## 测试与独立评审

- 日期/Unicode/标题投影先RED；新消息活动时间真实PG先RED（旧9月日期未变），修补后GREEN，覆盖原始首问、排队编辑、幂等重发、另账号隔离和无job。
- `node --test tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`：414/414通过，84.7秒。首轮413/414，发现旧新建会话投影断言未包含新增`hasPrompt:false`；补齐契约后完整重跑通过，无跳过。
- `node --test --test-concurrency=1 scripts/ai-conversation-ui.test.mjs scripts/ai-command-ui.test.mjs`：16/16通过，48.6秒。首次标题测试以真实身份核对结束后的请求基线验证不重取，不把初始身份校验触发的读取误作消息更新请求。
- `npm run build`：7.28秒通过；保留已有大包告警，没有扩展打包改造。
- 一次独立只读总评审发现“旧会话发送后刷新时间回退”Important，最小修补及真实PG复核后无剩余Critical/Important；评审者另跑6项聚焦测试。该评审不代替真实浏览器或用户验收。

## 保留边界与证据

未调用模型/联网检索，无新费用、充值、扩额或权限。更早月份标题有边界单元与受控Chrome证明，未伪造生产历史。390px沿用既有纵向堆叠，不声称移动母版重排或原生200%缩放验收。闲置跨午夜后的标签会在下一次渲染时更新，本轮未加定时器或全局焦点改造。

`.tmp/ai-history-timeline-2026-11-11/`：unit-red、update-red、ui-red、activity-red/green、suite/suite-final、browser-final、build-final、real/real-final/real-passed日志，real-results.json，grouped-desktop/390、owner/admin-real-desktop/390 PNG，video/WebM。受控浏览器沿用`.tmp/ai-conversation-switch-2026-11-10/video/`留录屏。不向Notion同步密码、DSN或原始私有请求。
