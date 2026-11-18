# 岐研AI四项验收修补验证 · 2026-11-10

## 边界及结论

专用合成库wp01_test_full_baseline、本机19501/19502、原owner/admin和当前Study；固定文章为当前获准PMC13672493。当前目录串行实施＋一次独立总评审。无临床库、旧服务/旧源码/表结构/角色权限/Token额度改动，无云资源、发布或模型费用。新增具名测试会话、等待记录、软取消及审计全部保留，原科研资料/历史账本不改。

代码和本机装配已启用，真实PG/原Worker/页面执行有据；真实AI连续回答及用户专业验收尚未完成：两个账号业务Token额度不足，等待项正常暂停，未擅自补额。免费Worker测试明确标“合成队列机制检查，不是模型回答或科研结果”，不以该产物代替AI专业结果。

## 结果

| 验证 | 结果及范围 |
|---|---|
| 原话与真实Hub检索 | 原话从clarify改为ready/hub-only；两账号真实PG各返回6条当前获准PMC来源，外部/模型调用0。未知排除/医学限定仍澄清；只用Hub且不含“已审核”也保持不联网 |
| 原PubMed 50/3核查 | 实际已完成任务原输入明确指定3篇，快照requested/returned/selected均3，unavailable空；改说明，不扩大请求或假装读取50篇 |
| 单元/契约/集成 | node --test tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs：397/397，零失败，77.7秒 |
| 真PG持久状态 | FIFO、同键幂等、当前授权、账号隔离、版本竞争唯一胜出、等待编辑/软取消、服务对象重新建立后恢复、失败暂停/显式继续、原失败不重试 |
| 原Worker真实执行 | 原KnowledgeChatQueueService实际认领、当前授权、成功原子提交和下一项自动执行；确定性合成执行器不调用Provider，第二项绑定已完成第一项；失败暂停后续，手动继续不重放失败项，2/2。短任务未实际触发15秒心跳，不将既有心跳代码冒称本轮已实测 |
| 扫描公平 | 游标分页前进，不被暂停/撤权旧会话占满；实际PG 201条、三会话跨过前200条仍扫描到第三会话；不同consumer隔离免费夹具与产品交互，未启动历史任务 |
| 真实React/Chrome受控 | 12/12：正文精简、执行中输入、晚提交不清新输入、编辑删除/刷新、GET确认后迟到POST错误、首次ensure超时重试、撤权停止、状态变化安全CAS恢复、跨窗口改文不静默删除；另5项原新建/历史/分页/滚动回归在该12项内 |
| 真实本机HTTP/PG/Chrome | 两账号Hub队列实际保存、编辑、刷新恢复、软取消、跨账号404；owner文章固定版本队列暂停/删除且原jobs不增加；无pageerror、无新模型任务。实际Token不足保留，不绕过计费 |
| 构建 | npm run build成功，4.11秒；原大于500kB包提示保留，不扩大重构 |

## 独立总评审及负例

一次只读总评审：0 Critical、3 Important、1 Minor。Important全部先复现再修复：

1. GET已确认提交后迟到POST错误/刷新失败锁住发送：按本次原请求身份判断，不再复活uncertain；受控浏览器RED/GREEN。
2. 最早200记录扫描饿死新会话：固定游标轮转到空页才回头，单会话失败继续推进；函数回归及201条真实PG RED/GREEN。
3. 首次文章ensure超时重试误发/sessions/null：保留原会话resolver和command requestKey，先恢复真实会话；浏览器RED/GREEN。

另外补齐：新建时输入草稿立即清空但身份核验保留；撤权清等待列表/暂停输入并重验正文；明确只用Hub不联网。现场实际出现后台暂停导致版本变动、取消409；对正文/请求键相同且仍waiting/paused的本次明确编辑/删除只读核对后最多重试一次，不重试模型、不覆盖并发改文，两个方向都有浏览器验证。初次全量389/390的旧SSR“必须显示已删除固定说明”断言已按批准范围更新，最终397/397。

Minor暂缓：文章默认问题在异步初始加载后未预填，可手动输入；不扩大本轮修补。评审未判断真实模型质量/付费/生产和文档同步，以上分别标明证据与未验收，不以技术绿代替专业验收。不做第二轮评审。

撤权负例使用受控授权回调/HTTP403，未改真实账号或角色；两账号真实接口另验了跨账号404，不冒称已执行真实角色撤销演练。规格、实施计划、验证、产品基线/变更、AI Living Spec、版本及使用说明已同步Notion；验证页回读确认397、12项和Token限制说明。

## 截图与操作

目录.tmp/ai-conversation-acceptance-2026-11-10/，关键证据：query-red.log、output-red.log、query-output-green.log、commands-red.log、commands-final.log、review-scanner-red/green.log、scanner-pg-red/green.log、review-ui-red/green.log、scope-red.log、new-draft-red.log、revocation-red-corrected.log、pause-delete-red.log、browser-release.log、suite-release.log、worker.log、build-release.log、hub-query-live.log、live-release.log、live-commands-result.json；桌面owner/admin-live-queue.png、article-live-queue.png，390px截图及video/live-video录屏。截图已观察：原三栏保留、新会话正文无固定说明、队列在输入框上方，窄屏沿用历史在前的长页面，需滚动到对话区，未擅自重排。

用户复验：刷新AI01→新建→输入原Hub-only问题→发送或加入队列→输入下一项，检查输入不中断→编辑/删除等待项→刷新恢复。Token不足时看暂停原因，处理业务额度后显式继续；上一项失败不自动重试。真实AI成功后自动执行下一项及其专业质量，应在额度就绪后再由用户验收。
