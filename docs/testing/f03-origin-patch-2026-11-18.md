# F03合成活动保存：本机来源校验修复

2026-11-18用户反馈：更新“F03合成验收活动（虚构，非真实安排）”后出现“请从当前站点操作登录会话”。原图完整保留于`evidence/f03-origin-patch-2026-11-18/reported.png`；不把此403当成账号丧失管理员资格。

## 根因与边界

既有本机端口剥离Origin兼容仅接受POST，F03保存为PATCH；完整本机请求证明具备时仍被拒绝。截图未附请求头，无法追溯该次请求的全部字段；排查时IAB带正常Origin的保存也能成功，不能称所有IAB保存均失败。已用剥端口请求复现旧服务403，并对该精确分支补修。

仅F03固定本机Origin、固定Hub管理/:id草稿PATCH且无query，向原校验传POST方法副本，原请求仍以PATCH执行。loopback连接、Host、完整同源Referer、Fetch Metadata、原请求标记、JSON、代理头限制全部复用；全局auth/session、生产HTTPS同源及当前身份/准入/管理员要求不变。未改布局或共享启动文件。

## 四层证据

- 代码：新增失败契约先RED后GREEN；26项包含真实PG回滚、原会话及F03输入/版本/角色/路由回归通过。缺证明头、坏Referer/Origin/Host、代理头、非本机、错路径/方法/query及生产范围都有拒绝用例，正常HTTPS PATCH仍可用。
- 配置：接手时PID60957；受控重载后PID68621，同一部署，7项本机依赖恢复。未覆盖WF12历史保护快照或增量。
- 实际请求：剥端口来源的原生活动PATCH成功200；坏Referer403且revision不变；原键重试同回执、无额外revision（`target.json`）。最初Node fetch自动改Fetch Mode导致测试请求403，改用原生HTTP准确发送浏览器证明头后通过；此为测试器差异，不以宽松校验绕过。
- 业务结果：用户原IAB页实际显示“草稿已保存”；Chrome回读原活动及截图/录屏留证。用标题尾部空格触发合成保存，服务端规范化回原标题，全部draft/正文/日程hash及publishedVersionId保持；未替用户发布、撤下或新建内容。原生请求revision5→6，IAB复验后revision7，均为同内容保存审计；不假称业务写0。

构建5.04秒，保留原chunk提示；`saved-editor.png`是Chrome保存后回读，IAB成功提示由当前页实际观察核定。26项日志、原图、目标请求及回读证明同目录。用户操作反馈仍待本人复验，生产未部署。
