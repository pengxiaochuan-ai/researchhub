# P06数据概览、质控与AI解释 · 本机验证

2026-11-13。当前用户已要求实施P06首片；[实施范围](../planning/qiyan-ai-file-data-2026-11-12/p06-overview-quality-implementation.md) · [技术契约](../technical/ai-research-data-analysis-2026-11-13.md)。**本片本机技术交接：原owner/admin各一次真实解释均完成，2/2 Provider请求、2328 Token均按真实用量结算；固定来源、历史恢复与账户隔离已核对。免费核心/真实PG/HTTP与Chrome通过，唯一独审1Important及真实入口RLS问题已修补。** 不宣称整个数据Agent、生产或用户专业验收完成。下文保留早期失败和阶段证据，当前结论以本段和“真实解释封口”为准。

## 边界与复用

仅wp01_test_full_baseline、原owner/admin、P05当前Study及本人原数据会话/已导入对象。没有DDL/GRANT/角色/许可期限/额度/旧app源码改动，不接临床库或旧服务，不增加云资源/远端配置访问/真实发布。

强READ ONLY发现本租户data Agent实例0；不将旧源码中的分类/算子当已启用。复用旧真实Study resolver、当前file.read/原导入result.read、固定Form/Revision读取及答案类型/范围校验、会话队列/OpenCode/DeepSeek与原业务Token机制。体检报告Skill不适用于科研数据，本片使用版本化hub-research-data适配，skill=null、策略hash＋结果hash绑定，九项默认Skill与其他路由保持。

已导入P05记录只读：每账号2Subject/2Visit/2CRF，程序结果为观察值0和4、均值2；布尔是1/否1，实际完成访视0。0/false不是缺失，字段“已完成”不代表访视状态。仅检查已列必填/类型/已配置范围与选项，未配置范围、医学合理性/跨时点/疗效另列未评估，不能称研究整体质控合格。

源原件SHA/预检版本/真实父链/当前授权和固定答卷修订重验，概览GET不建任务；入队固定本人结果选择，认领/Provider前/提交/历史读取均验证。复用原连接并finally恢复来源GUC，避免租户锁内另启事务自等；原生答卷读取有行锁，业务只读不冒称数据库强READ ONLY。

AI只收到聚合结果，不含逐行答案/被试编号/存储路径；引用R1指完整确定性结果，D1等底层记录用于用户回查，模型不冒充逐行已读或把均值归给单个对象。事实后端渲染，AI解释/局限/建议分开。研究数据来源存在时智能搜索不与数据解释同时执行；混合私有资料/数据范围不明须澄清，不默送其他模型分支。

## 已观察证据

目录前缀`.tmp/ai-file-data-2026-11-12/`；短日志在`.tmp/`。未上传凭证/DSN/环境文件。

| 项目 | 证据 | 结果与限制 |
| --- | --- | --- |
| 准入 | p06-preflight-1794561735463 | app强READ ONLY，4CRF/2字段/实际配置，业务写0/模型0 |
| 核心 | p06-analysis-red.log→p06-analysis-green.log；p06-output-red.log→p06-output-green.log；p06-session-red.log→p06-session-green.log | 0/false/缺失、原生类型/范围、无记录未评估、版本/父链、聚合去身份、伪引用、原问题/来源变化拒绝；受控Provider只证明契约 |
| 原生与队列 | p06-queue-pg-green-final.log | 2真实PG通过：双账号原生答卷读取/来源GUC恢复/跨账号拒绝；实际command→message→stage→job固定选择贯通，新增消息/任务全回滚、未调Provider |
| 路由 | p06-core-route-green-final.log | 38纯契约通过，含旧单篇/文献/智能搜索和新数据上下文；后续R1调整另14通过见p06-result-source-green.log，各组有重合不累加 |
| 前端与构建 | p06-frontend-green.log；p06-build-integration.log | 当时626前端通过，隔离构建4.65秒/退出0；最新补丁后须再验，既有大包告警未扩修 |
| 组件Chrome | p06-ui-1794563078096 | 当前概览、断网清旧/阻提问、GET显式恢复、切身份迟到丢弃，PNG/WebM，模型0 |
| 浏览器发现并修补 | p06-browser-1794563134503、p06-browser-1794563280328；p06-transport-red.log→p06-transport-green.log | 真实后端200但前端allowlist漏analysis路径；只增加精确GET，写/任意Study query/export仍拒绝。两个早期失败保留，不涂成成功 |
| 真HTTP/Chrome | p06-browser-1794563404833 | 16实际接口通过；双账号六宽＋owner原生200%共13视图，14/22、0页面异常/0越界写；填问题不发送、智能搜索互斥；原生PNG/WebM |
| 保留基线 | p05-facts-1794562990744、p05-facts-1794563481023 | 4Subject/4Enrollment/4Visit/4CRF、4P05文件/6计划、原许可active v6/原expiry、旧资料与角色保持；源会话jobs0/原预留152，模型0 |

阶段owned13672→30378受控重载，七服务ready；不是旧服务停线或生产发布。当时尚无本轮真实AI回答；后续最终装载和实际结果见下，不覆盖或删除早期证据。

### 最终装载及入队入口补查

owned30378→39827已装载R1/数值修补，`p06-browser-1794564621867`再次16HTTP/13视图通过，`p06-ui-1794564623038`恢复/身份迟到通过。owner首次Enter在入队前409；`p06-real-approved-2026-11-13/owner-admission-diagnosis.json`强READ ONLY确认新消息0/任务0、预留152、Provider0，未消耗两次调用授权。原失败/armed记录保留，不称AI失败或结算成功。

定位为capture首次查私有表前漏设account RLS上下文，原PG测试已预设账户故而未暴露；`p06-admission-rls-red.log`用空account上下文真实app复现，`p06-admission-rls-green.log`修补后3项PG通过，纯核心另10通过，原152笔账本指纹仍一致。只设置已认证当前账号GUC，不改权限/角色/策略。随后经用户授权的共享本机短窗口由另一任务装载PID46020、七服务健康，P06不重载或修改共享入口。最初拒绝的checkpoint和失败证据独立保留；只有明确证明入队/任务/Provider均0才重新开启首次实际请求，不对未知请求重发。

## 独审与最终免费验证

- 唯一独立总评审`p06_final_review`已完成：0Critical/1Important/0Minor。重要项为数字虽出现于源结果但均值/最大值/完成/缺失归属可互换。作者一次集中修补：程序事实与所有数值后端渲染，AI只作定性解释；剔除混合句中的具体数值转述、保留零值/false术语与可独立建议，不把全部回答一刀切拒绝。R1来源继续严格核验，历史复验执行同一守门。
- `p06-review-numeric-red.log`复现；`p06-review-numeric-green-final.log`涵盖均值/最大值/完成数/缺失数错配、零值误指均值、中文数字/百分比、英文数字、混合句保留和旧错误历史拒绝。另`research-data-numeric-native.test.mjs`复用实际装配的旧两个过滤函数，证实数字均在程序事实中也不能被错配接收。没有二次独立总评审。
- 最终627前端、56相关核心、2真实PG回滚通过（p06-frontend-final.log、p06-core-final.log、p06-pg-final.log）；隔离Vite构建7.58秒（p06-build-final.log）。已创建强只读旧账本152行不可变指纹`p06-accounting-baseline.json`；不是旧未知用量对账，不改旧预留。

## 真实解释封口

用户批准的上限2请求全部且仅使用一次，无模型自动重试、充值、补额度或旧未知用量对账。证据目录`p06-real-approved-2026-11-13/`：双账号checkpoint/result/state/billing/provider及PNG/WebM，完整Provider轨迹另存本机私有ai-traces；不把凭证、原始行或被试编号发给模型。

| 账号 | 原任务 | 实际输入／输出／总Token | 业务结算 |
| --- | --- | --- | --- |
| owner | cmwety9ns0006luic6opgieev | 849／301／1150 | completed，settled，usedMock=false，1次已知尝试 |
| admin | cmweu3ovq000rluicm3ka8mnm | 839／339／1178 | completed，settled，usedMock=false，1次已知尝试 |

两份均实际执行hub-opencode、受控`research_data_result_read`和DeepSeek-v4-pro（HTTP200/finish stop）；R1/packHash、真实固定CRF来源及实际Token用量相符，没有unknown/inconsistent事件。`owner/admin-refreshed.png`为已完成回答；较早的`*-result.png`采于UI轮询刷新前，不把准备中画面当成最终答案。来源展开进入S09固定修订，刷新原回答不新建任务；跨账号私有历史404（允许403或404）均未交付。owner最初因验收脚本仅接受403而误报失败，改为合法拒绝状态后只读复查原成功任务，没有再次提交或调用。

专业语境核对：程序块均为2被试/2访视/2表单、完成访视0，观察值0和4/均值2、布尔真1假1、缺失与异常0；AI均保留零值/false有效、已列规则与未评估项、不能据此判断疗效。程序事实与AI建议分开，无插补或新的科学计算。owner剔除数字子句后首句指代偏弱；两份仍有BASELINE/completed/checks-passed术语，admin“未关联”只应理解为状态不自动等同，不能据此推断数据库对象没有关联。这些表达质量作为后续精修项，保留原回答，不改历史或为润色再收费；用户专业体验不代签。

`p06-final-facts-1794565879064/result.json`强READ ONLY：4Subject/4Enrollment/4Visit/4CRF及逐条答案/修订hash与P05前置快照一致；4文件/6计划/原许可active v6与原expiry/角色authVersion均保持，Feature/Processing新增0。只有上述2个新completed Job/2笔新settled预留；原152笔预留逐行指纹一致。`ai-research-data-p06-accounting-baseline.mjs`再次通过，未对旧账本结算或释放。最终只读脚本曾有语法与BigInt输出序列化错误，证据保留，修正后结果与退出码通过；这些不是模型或业务数据失败。

## 四层交接与保留项

代码契约、PID46020目标本机装配、两次真实执行及本批结果一致性均有上述证据。仅本片技术交接；完整D01–D12模态/算子、P07–P08联调、正式部署和用户专业验收未销项。不恢复延期的全Study质量工作台/SDV或质量专报。产品、使用说明、版本、技术及规划同步本片当前事实，Notion按原有章节更新；不扩大共享底座或新增业务权限。
