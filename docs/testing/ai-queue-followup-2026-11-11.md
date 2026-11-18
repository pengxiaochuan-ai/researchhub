# 岐研AI连续发送修补验证

## 范围与证据

对应[本轮规格](../product/ai-queue-followup-2026-11-11.md)。科研与管理员共用AI01的AgentCommandComposer，普通Hub和固定文章分支共用；不改角色、额度、旧系统、共享表或母版。输入和按钮沿原14/22、2行自动增高，无CSS变更。

1. RED：真实PG新回归证明，澄清后新的明确问题没有创建queued任务；Chrome新回归证明仍有“加入队列”。均先失败再修补。
2. GREEN：`node --test tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`，402/402，84.5秒。包括真实PG、旧Worker确定性合成执行、完成后再次新增、澄清编辑恢复、未知旧暂停不自动恢复、额度/授权与真实失败屏障。
3. `node --test --test-concurrency=1 scripts/ai-command-ui.test.mjs scripts/ai-conversation-ui.test.mjs`，13/13，39.7秒。真实Chrome/React，受控接口覆盖忙时发送、编辑删除、乱序/断网/撤权/历史切换、Enter一次、Shift+Enter、中文composition及229、空输入。受控响应不冒充真实Provider。
4. `npm run build`通过，4.24秒；仍有既有>500kB分包提示，未为本次修补扩展打包改造。
5. 在途非夹具任务0后，仅重载本机自有运行进程至PID92793，7服务ready。只读复验原完成任务未重跑，之后两条均为HUB_SKILL_CLARIFICATION，无新job，原waiting已不再静默滞留。没有临床库/旧服务/云/发布变动。
6. `node scripts/ai-queue-followup-live.mjs`双账号真实HTTP/DB/Chrome验证通过。owner按现有业务Token不足暂停，可删除，不补额；admin连续两条澄清分别被处理，不相互阻塞，界面“待补充问题”，均可删除。两账号Enter真实发送、正常按钮、1440×1000与390×844截图录屏，0 pageerror，0新模型任务/调用。首轮脚本要求owner必须澄清而失败，实际原因是正常额度不足；后明确区分两类验收，不掩盖为模型成功。

## 证据位置与边界

- `.tmp/ai-conversation-acceptance-2026-11-10/followup-suite.log`、`followup-browser.log`、`followup-build.log`；浏览器录像位于该目录video。
- `.tmp/ai-queue-followup-2026-11-11/results.json`、owner/admin的desktop/390 PNG、video内WebM。
- 一次独立只读评审确认typed澄清可跳过、未知/授权/额度/失败屏障保留；按意见补充旧未知成功仍暂停及编辑恢复回归。

未发起付费模型验证、未代签专业回答质量；旧Worker执行器只验证任务机制。没有调整任何账号额度；owner正常业务额度不足仍存在。390px沿既有长历史先行布局，需要滚到输入区，不将本次修补称为移动布局重设计或原生200%/全站无障碍验收。原固定文章消费者由共享组件、契约和前序测试回归，本轮新的真实接口键盘链为普通Hub两账号。
