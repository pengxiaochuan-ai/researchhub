# Hub Token最小闭环 · 本机技术交接

日期：2026-11-11。范围：B01–B06及已确认G02局部UI。仅`wp01_test_full_baseline`，0付费模型调用，不充值/增额、访问远端配置、操作云或真实发布；不修改旧源码、角色、原15笔及未知第12笔。

## 四层交付证据

| 层次 | 本轮事实与边界 |
|---|---|
| 代码 | 持久调用保护/回执/封口/不一致守门、原成功一次入账、失败已知按实结算、未知保留、租户内API和G02列表弹窗 |
| 本机装配 | 仅自有19501–19507独立环境安全重载；此前当前Hub processing=0，不启动旧AppModule/历史恢复扫描 |
| 实际请求 | 原admin/owner真实登录/API读取；独立新合成租户受控HTTP＋真实PG写入及并发。写夹具显式替换测试principal，不冒充原体验账号模型链写验收 |
| 业务结果 | 管理员可找记录、核对任务/调用依据、一次提交、丢响应关闭/刷新后原键恢复、查看处理人。未知不能假释放；专业及视觉最终验收由用户完成 |

新付费模型/全AI分支模型效果、供应商现金账单、生产发布未验证，不宣称所有历史未知已闭环。

## 新鲜验证

- 专项`node --test server/billing/*.test.mjs scripts/business-ai-provider.test.mjs scripts/business-ai-quota.test.mjs`：**34/34**，[日志](evidence/hub-token-accounting-2026-11-11/billing-regression.log)。其中10项实际PG回滚、3项持久独立租户PG；保留10项Provider/业务quota基线。
- 原BillingService/Token policy：**13/13**，命令`TS_NODE_PROJECT=tsconfig.json node -r ts-node/register/transpile-only --test src/billing/billing.service.spec.ts src/billing/token-quota-policy.spec.ts`，只读旧源码、不构建或重启旧服务。
- 前端`node --test tests/*.test.mjs`：**350/350**，[日志](evidence/hub-token-accounting-2026-11-11/frontend-regression.log)。
- `pnpm run build`通过，[日志](evidence/hub-token-accounting-2026-11-11/build.log)。既有WikiEditor/地图大chunk告警保留，不扩为拆包改造。
- 原admin/owner Chrome **6组检查**：真实登录/列表/已处理/未知只读、系统配置高亮、Tab/Esc与焦点返回、1366/1440/1920、390/320弹窗、原生200%独立profile（DPR2/scale1）、owner列表403但本人quota200。[回执](evidence/hub-token-accounting-2026-11-11/browser/result.json)，同目录截图及video/zoom-video。
- 独立新合成租户Chrome **6组检查**：真实HTTP＋PG一次结算、提交后丢响应不自动重试、关闭/刷新恢复原键、409保对象重核对、未知/live禁结算、撤权清私有内容；调用依据summary键盘可达。两笔合成消费各120，实际两条UsageRecord共240，不影响体验租户。[最终回执](evidence/hub-token-accounting-2026-11-11/fixture-browser/234ffa11-4a14-4973-84f1-41adf9126b2e/result.json)，同目录截图/录屏。早先失败夹具/证据完整保留。

## 关键反例

1. 持久开始与quota使用同名锁；真实两连接跨原到期竞争，原reserve仍因额度不足返回429，不能借旧MVCC过期容量再预留。9999 active保护仍兼容原成功CAS。
2. 必须有全部attempt及外层封口；500、网络、缺用量、冲突、不一致不退款。成功比较顶层及各模型Token/calls/主模型，不重算cost。
3. 撤权后已知消费22000即使超过12288预留仍按实记账，有效余额0；无助手成功消息，任务仍failed。
4. 审计故障使整笔用量/预留全回滚；不同键并发只有一条消费/审计，同键丢响应恢复不重复扣。
5. 当前role、flag、authVersion、账号状态/租户重验；普通账号403、其他租户目标404、请求体注入tenantId422。角色变化只在新独立夹具，不动原账号。
6. 独立总评原3 Important、2 Minor；作者依实际影响升级两项操作/核验缺口后一次反例修补，均先失败再通过。另修summary焦点圈遗漏。[原结论及作者修补](../planning/hub-token-accounting-2026-11-11/code-review.md)。未取得第二次独立复签，不改写原“不通过”。

## 保全、失败及边界

- [前指纹](evidence/hub-token-accounting-2026-11-11/preservation-before.json)与[后回读](evidence/hub-token-accounting-2026-11-11/preservation-after.json)：原16笔（已结15＋未知12）、关联用量/审计、原两账号角色/状态/版本、原Grant、旧Billing/Sessions/DeepSeek源码和旧金额账本未变。
- 初次冷加载曾一次503，[原截图](evidence/hub-token-accounting-2026-11-11/browser/failure.png)保留；后续新登录及最新重载后整套读取成功。首次瞬时失败根因未确定，不将重测通过说成从未失败；UI显示不可用而非假零值，可显式刷新恢复。
- 0原体验账号新模型消费。新独立夹具记账不是实际Provider消费证明，后续付费真实模型另确认。
- 历史未知第12笔及其他未知不处理；供应商/外部用量凭据导入另行，不开放任意手填Token或一键清空。
- 当前目录串行、保留他人未提交内容，不批量提交/部署。具名新合成账留存，不进入体验租户额度或公开来源目录。
- 本地产品基线/说明/版本、API/规格/评审与Notion已同步；同页更新清单见[进度](../planning/hub-token-accounting-2026-11-11/progress.md)，无历史子页删除或重复建页。

验收入口：[G02 AI用量与对账](http://127.0.0.1:19501/pages/g02/?view=token-reconciliation)。原账本轮仅查看；新页面不等于未知账已具备结清依据。
