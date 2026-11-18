# P3／G01内部方案审核：本机技术交接

2026-11-13。用户批准PR01–05及G01局部正文、一个具名新Study／最多两个版本；当前目录串行实施＋一次独立只读总评。**本机技术闭环完成，可提交用户体验验收；不是专业签收、临床或生产发布。**

## 逐项结果

| 清单 | 已验证结果 |
| --- | --- |
| PR01真实待审版本 | G01真实API、当前可管理Study、固定版本和分页；一新Study的v2保留待审，已处理v1不混入待审列表 |
| PR02固定核对 | 从同一条目进入S07同Study／Protocol，设计、固定访视／CRF及原政策可核对；未复制编辑器 |
| PR03真实决定 | 同一新v1经真实浏览器退回（原理由保留）、再提交、批准、单独启用；批准阶段真实回读仍为approved，不自动executing；保留原权限、政策／引用／检查、审计与幂等 |
| PR04决定历史 | 仅读旧核心真实审计，退回／批准／启用各1条，真实决定时间与人员；排除Hub封套双计。历史批准回执保持approved，当前v1为executing；不由更新时间猜历史 |
| PR05进入与恢复 | G01直接登录、安全返回；S07按钮及面包屑保持合法页签；刷新恢复原批准结果只GET，迟到旧身份结果被丢弃；401刷新回登录并保留processed返回 |

## 最终测试和原件

- **31/31**相关测试（包含2项真实PG/RLS）；**590/590**前端测试；隔离构建**8.02秒**，既有大包告警保留。相关集含前端纯测试，不重复累加为独立测试总数。
- [真实准备](evidence/governance-p3-2026-11-13/prepare.json)：原两账号真实HTTP，一新课题／Study，两份方案通过真实政策保存、检查和提交进入pending_review；不是直接改状态伪造审核。
- [主链Chrome](evidence/governance-p3-2026-11-13/browser-1794552204615/result.json)：续同一已退回版本，实际重提／批准／单独启用及三条决定。批准真实提交成功后注入503并刷新，只GET找原回执，approve POST总数1。PNG／WebM同目录。
- [前序浏览器定位失败](evidence/governance-p3-2026-11-13/browser-1794552139319/result.json)：退回已真实成功，脚本把返回按钮误当链接而超时。失败、截图／录屏保留；后续从同一draft继续，不重建或重复退回。
- [恢复及身份迟到Chrome](evidence/governance-p3-2026-11-13/recovery-1794552603659/result.json)：新v2检查请求发送前中断，GET未找到不重发；明确重试才发同一key，v2仍pending_review。真实admin结果延迟交付，切换真实owner Cookie并重核，最终严格等于owner合法集合（8条）。未假装普通用户一律无管理权。
- [五宽与角色／集合变化](evidence/governance-p3-2026-11-13/visual-1794552558942/result.json)：1440／1366／1920／390／320、14/22；320／390固定详情和返回、移动导航Esc、键盘切Tab可达；网络503清旧行且明确GET重读。保持相同actor/authVersion、受控过滤真实GET集合后焦点重读不残留旧行；此浏览器手段不冒称真实角色变更。
- [原生200%动作截图](evidence/governance-p3-2026-11-13/native-action/result.json)：Chrome设置200%，DPR2、scale1，真实可见“查看方案”命中及返回。原完整视口截图仅显示内部滚动上部，未用它冒称全长内容；另存实际滚动后的目标截图。
- [初次窄屏失败](evidence/governance-p3-2026-11-13/visual-1794552439210/result.json)：G01继承1280px根最小宽度，仅本页复用既有根宽重置后复测；不缩字，不改桌面Shell或其他页面。
- [固定阅读最终浏览器](evidence/governance-p3-2026-11-13/fixed-reading-1794553239333/result.json)：S07“查看研究方案”继续带同一Protocol ID进入S02，v1不会切到其他草稿；[修补前真实RED](evidence/governance-p3-2026-11-13/fixed-reading-1794553220285/result.json)保留，0业务写。最终590前端／8.02秒构建针对本次最后链接修补重新验证。
- [最终源码／业务快照](evidence/governance-p3-2026-11-13/final-snapshot.json)：当前本机服务、源码摘要、原两账号状态／角色／authVersion和新Study归属。所有命令日志复制至该证据根`commands/`，失败保留。
- [交接时当前运行态复核](evidence/governance-p3-2026-11-13/current-runtime.json)：文档收尾期间共享服务由其他会话重载，PID63681→72139；未再抢占重启／申请冻结。15份相关源码摘要完全保持，当前真实HTTP仍返回3条决定、v1执行中、只读回执端点可用，七服务ready；不把浏览器验证时PID当永久冻结。

真实PG额外证明同一owner/account/authVersion、仅新Study负责人关系暂时disabled后，当前历史集合和回执资格拒绝；整事务强制回滚，确认关系恢复active/project_manager。未改原账号／组角色或历史Study，未新增权限。测试源为`server/research-execution/review-history-pg.test.mjs`。

## 独审与修补

一次独立只读总评无Critical、1 Important：焦点／可见变化未重新核集合，继续翻页可能merge旧无权行。作者集中补焦点重读、全范围替换、失权／读取失败清旧集合、游标和epoch守门；纯测试RED→GREEN，真实PG、浏览器受控集合变化和真实身份迟到均验证。未发起第二轮评审或无限扩大范围。[裁定记录](../planning/governance-module-2026-11-12/p3-independent-review.md)。

## 四层交付及限制

1. 代码：G01、S07回流、当前管理范围历史及本人只读回执已实现。
2. 配置：当前本机专用合成环境已装配，两次受控重载仅本机独立运行入口，不涉及旧服务。
3. 实际执行：新具名Study和固定版本在真实PG／HTTP／Chrome实际退回、批准及独立启用，非Mock业务决定。
4. 合成业务结果：v1执行中、v2待审，真实三条决定与来源时间／人员一致，当前用户体验待本人签收；未验真实临床政策、外部伦理、专业科学方案或生产。

只用`wp01_test_full_baseline`，0模型调用／新增费用／充值；无新账号、角色、表、DDL／GRANT、云资源、远端配置、临床库或真实发布。原两账号active、角色和authVersion5保持；原历史任务不修复／重试／排空／清理。未提交或合并共享dirty工作区。产品更新页／正式发布批次不适用：尚未真实发布，不修改旧产品更新中心。

建议下一项为P4研究质量准入：先对照同期S05已交付能力核对QL01–14与治理入口缺口，优先复用现有疑问／审阅／放行，避免重做整条研究链；新增AI费用、权限或导出另确认。此建议不作为自动执行授权。
