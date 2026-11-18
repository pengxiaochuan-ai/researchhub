# 本机科研身份实施与阶段验证

历史状态更正：本页保留I01–I03阶段证据。后续来源锁已获明确批准并受控启用，T01及必要T02／G02已完成本机技术闭环、UI07／真实浏览器及独立总评审；详见[后续T01报告](t01-directory-implementation-2026-11-03.md)。R01仍未实施，真实团队资料／专业验收仍独立，不再以本页历史暂停说明触发重复授权。

日期：2026-11-03。仅本轮科研身份→T01→R01计划的I01–I03阶段，目录尚未实施，不宣称总交付或专业验收通过。

## 已实施

原Account仅增researchProfile／researchProfileVersion／researchProfileEstablishedAt／researchProfileLastMutation四个可空列；旧13列原值不改，不generate旧Prisma Client。专用合成库受控迁移只运行一次并可重入，未回填L1。

本人API保存草稿与明确建立L1分开，原当前授权共同锁、本人行锁、CAS、最近一次安全回执、原子最小审计。无Study也可保存，不放宽audit SELECT。原Auth／展示名API不返回科研JSON，不增加成员／角色／Agent授权。

P004原注册卡内增选填入口，邮箱验证与登录后进入P006；原登录P01路径保留。P006原展示名表单与门户框架保留，下方新增已批准私有科研资料区；可保存草稿、填写多项任职／教育／公开证明链接、明确建立L1。没有材料上传、认证申请、L2／L3或自动公开目录。

## 实际证据

- `node --test server/research-identity/*.test.mjs`：16/16，含真实PG、迁移重入／租户RLS、原旧值保全、当前authVersion、事务故障回滚、最近回执／CAS。
- `node --test tests/*.test.mjs`：180/180（本次执行时）；旧后端build与Hub build通过，仍有既有大chunk提示，不视作新性能验收。
- [真实HTTP结果](evidence/research-identity-directory-implementation-2026-11-03/identity-api/result.json)：5组，原两个账号本人隔离、同键／异体／旧版409、字段／来源／未登录拒绝、48KiB局部解析、原DTO／原旧字段保全。
- [真实Chrome结果](evidence/research-identity-directory-implementation-2026-11-03/identity-browser-68cbc929-1b33-46fb-959a-bb5b29dd0115/result.json)：11组，真实登录回P006、422焦点保输入、L0草稿／明确L1、刷新、同账号重新核验保草稿、真实并发冲突、提交已成功但连接中断后的原key回执恢复、实际Cookie切换后迟到200不可回填、退出清私有表单。
- 1440／1366／1920／390／320实测，无文档横向溢出，门户输入16/24；原生Chrome200%记录dpr=2和真实窗口／CSS视口／scale，不用缩视口冒充缩放。截图和录屏与结果同目录。主代理已查看实际1440像素；200%／手机等仍按用户体验另评，不声称全站已验。

## 保全与剩余门禁

### 后续样式／已有值回归

将新增“重新加载／经历增删／回执核对”按钮统一复用原ls-secondary样式。已有科研简介再次打开时，真实Chrome暴露嵌套textarea的内容混入label文本，导致精确标签定位失效；失败截图和网络保留在`identity-browser-59a1a25f-d5fe-4f53-a65d-12ff9ef78a93`。修正为显式for/id关联、标签与输入同一字段块分离，间距保持8px；没有改变表单区域或交互路径。

[修补后全11组真实Chrome复验](evidence/research-identity-directory-implementation-2026-11-03/identity-browser-1a94b0b3-4bc4-4f8b-9b35-6b81f7aa0c15/result.json)通过，包含已有值重开、5视口及原生200%。此前初次运行证明L0→L1，后续复验保留L1与已有经历，不清库重造测试成功。12组功能含前述独立L0注册链；无新模型或外发邮件。

[具名L0注册Chrome结果](evidence/research-identity-directory-implementation-2026-11-03/identity-registration/result.json)：只创建1个本轮具名账号，走真实注册→本机SMTP捕获→邮箱验证→不填资料登录P01，随后本人P006仍L0／version0／空资料；普通科研角色、零私有Study、原席位配额不变。没有外发邮件或新增授权。凭证仅本机私有文件，不进入证据或Notion。

只在wp01_test_full_baseline及原合成租户操作本人新列。重启的是本轮具名本机runtime，前先确认本租户无queued／running导入和问答；其他租户历史queued记录未触碰，旧服务未停止／重启。0付费模型／外发邮件／新云／真实发布。

独立代码总评审保留至T01／R01全链完成，只做一次；本阶段非独立总评审结论。原用户注册不填资料、具名L0账号及最新样式回归记录继续追加。真实团队／人物非空专业核对仍待资料，不能用本机合成科研姓名或机构充当真实目录。

## 停线前最新免费回归

`node --test server/research-identity/*.test.mjs server/directory/*.test.mjs tests/*.test.mjs`实际203/203；Hub build成功（既有chunk提示保留），目录schema重入created=false。真实PG目录预演首轮发现多表触发器CASE引用不属于该表的NEW字段（42703），事务全回滚；改为按表名IF分支后，实际app-role正向插入、矩阵23514／不可覆盖42501和跨tenant／hub隔离通过，随后才进行受控首次迁移。

本机7服务ready。T01／R01源文件SHA256与设计阶段相同，未为接线改母版：T01=`5ce2fc0de5ca25db4b35ba14fe40c0f402ef6b276a6273e614d5b5ac2fedef04`；R01=`c9b323d6434d2f36293dce70611ad069fc0ec8ad21488a5be364d8e3e4b21f18`。目录函数执行新授权尚未写DDL／GRANT；不通过普通SELECT降级绕过来源提交门禁。
