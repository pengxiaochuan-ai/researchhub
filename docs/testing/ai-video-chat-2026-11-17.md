# 视频聊天追问验证台账

2026-11-17，本机专用合成环境技术交接完成。仅原owner/admin、当前Study及前片两份视频；无临床、旧系统修改、云资源或生产发布。

## 四层验收

| 层 | 实证 |
| --- | --- |
| 代码 | 固定来源/当前授权/队列编辑/结构化输出/历史投影/回放均接通，独立复核无未解决P1/P2 |
| 目标配置 | 专用wp01_test_full_baseline、原两账号/两视频许可、既有OpenCode＋DeepSeek/Token；不补权限或额度 |
| 真实执行 | owner/admin各1次，真实media_content_read与OpenCode/Provider轨迹，987＋1022＝2009 Token，两笔预留settled；8次实际来源seek |
| 业务结果 | 原文研究意向、红A/绿B/蓝C及文字对应正确，明确自动转写/视觉AI描述和合成局限，不得推为疗效；独立专业复核通过；用户临床/生产签收另验 |

本次为双账号各单轮。admin问题含“进一步”不等于连续两轮；同账号多轮尚未真实验收。最后后处理修补只免费重放上述真实输出并复验历史显示，没有第三次模型调用。

## 实际运行与费用

| 账号 | Job | Provider Token | 预留结算 |
| --- | --- | ---: | --- |
| owner | cmwk6yb17000lluw7z1bb11rn | 987 | settled，实际987 |
| admin | cmwk78yuj0005lu6xrpcj8ech | 1022 | settled，实际1022 |

每次先按既有业务规则预留12288 Token，完成按真实用量结算并释放差额；没有充值/补额/自动重试。原视频未送文本Provider，只送已有文字片段与确定性时间。历史未知用量、旧预留不动。

## 验收操作

1. 对应体验账号登录，打开本人视频会话：[owner](http://127.0.0.1:19501/pages/ai01/?sessionId=cmwjzr7aw0003lukcm8qgb40o)、[admin](http://127.0.0.1:19501/pages/ai01/?sessionId=cmwjzrc010009lukcdi50a8g3)。
2. 阅读已有回答；展开“核对视频来源与时间”，区分自动转写与抽样画面AI描述。
3. 点0:05.8等来源按钮，原播放器自动进入可视区域并从真实时间回放；ASR标为近似，仍需回听。
4. 刷新，回答/来源/版本保留，不新增任务或模型调用。跨账号不可读他人会话；来源撤回或版本不符时屏蔽原回答/来源和播放器。
5. 可按业务Token规则继续提问；本轮自动化验收只发送了已批准2次，没有产品开发费用守门。新增自动化付费任务另按用户授权。

## 验证结果

- 新契约/队列/数值/历史17项纯测试；真实PG整体回滚1/1，涵盖两账号、Study授权、工具审计、固定包、提交/历史、跨账号和篡改新job。PG对象存储是元数据桩；目标HTTP和真实问答另实际复核原对象。
- 原路由/数据/媒体回归通过；五宽Chrome组件12/12，断网保留、终止性失效清除、切身份/会话迟到拒绝、先播放后失效关闭。
- 真实HTTP6负例；两账号1440/390四例，正文无Skill占位、无pageerror、播放器点击后入视口。8个实际seek偏差均在播放启动正常范围，目标来自整数微秒。
- 构建通过；独立纯复核17/17、最后证据/源码复核无阻断。后续引用滚动只改新chat动作，不改变旧视频时间控件或布局。
- protected-after.changed为空；原两job/message整行哈希保持，未用当前投影覆盖存储。

## 发现与修补（保留失败证据）

- 内部pack泄漏、编辑队列旧选择、时点输入缺失、业务错误变500、来源失效仍留正文/player均已加回归修补。
- 首owner的正确5.8秒及admin的混合三色句曾被通用数值遮罩；修为定位句式＋所引模态/精确时间，反应时/睡眠潜伏期秒值、负号、小数/数值尾部均不能借用时间。旧结果先验原receipt再仅做当前显示清理，保留定性颜色/文字，具体时间由来源按钮准确给出。
- 窄屏最初点击后播放器在屏外；只对聊天来源动作滚动原播放器，四例复验全可见。旧失败图/原始Provider响应保留。
- 曾HTTP登录503；直接原Auth回滚成功，未绕过认证。PID50868→58397时进程守门阻止重载；AQ02释放62071后原生登录通过。本轮未改认证，不把现象冒称根因已修。受控修补重载71529、75320，始终先验owned进程及无本轮在途。

## 证据与复现

证据根`.tmp/ai-video-chat-2026-11-17/`：final-summary、actual-usage、final-visual、original-answers-preserved、protected-after、both-free-output-replay、原失败截图/状态与最后截图/WebM。原Provider文件在私有ai-traces，仅本机工程审查，不含API密钥。

```sh
node --test --test-concurrency=1 tests/video-chat-contract.test.mjs tests/video-chat-session.test.mjs tests/video-chat-numeric.test.mjs
node --test --test-concurrency=1 tests/video-chat-pg.test.mjs
node scripts/ai-video-chat-live.mjs verify --synthetic-staging --approved-two-text-only
node scripts/ai-video-chat-visual.mjs
pnpm build
```

只读verify不会新增模型；owner/admin发送模式保留已启动键，禁止为复验重置或重发。共享窗口已释放PID75320，不据此自动使用后续窗口。
