# 岐研AI新建与历史切换验证 · 2026-11-10

## 环境和边界

仅本机19501/19502、wp01_test_full_baseline专用合成环境，原owner/admin及当前Study。无临床库、旧服务、模型请求、费用、额度/角色/权限变化或发布；新建空会话和审计记录全部保留，不清理历史。因第一次实测在历史计数断言停止，之后强化加载完成等待再复测；三轮合计创建10个空会话，无消息或模型任务。

## 结果与证据

- 后端RED后GREEN：12/12（新键独立/同键幂等/非法键/撤权/旧兼容及历史投影）。原旧服务未改，现有调用继续授权/审计。
- 最终单元/契约：node --test tests/*.test.mjs scripts/hub-agent-contract.test.mjs，311/311，零失败。
- 受控Chrome真实React：scripts/ai-conversation-ui.test.mjs，5/5。新建在延迟响应前清空旧消息；历史切换保留document、列表不重读；新建后切回A恢复A；分页请求在途切换后按钮可用；底部点选保持滚动。阻止所有模型POST，pageerror为空。
- 实际HTTP/数据库/Chrome：scripts/ai-conversation-live-check.mjs，两账号各新建2个空会话（最终轮共4个），同键重放仍相同ID，state消息/任务为空；history包含新旧会话；刷新恢复空会话；历史切换同文档且不新增列表请求；跨账号读取404；模型POST数0，pageerror为空，桌面1440和窄屏390截图/录屏已留存并观察。
- npm run build成功（4.25秒）；既有大于500kB包提示保留，未扩大重构。
- 独立总评审发现3项Important：新建URL与根路由不一致、在途分页loading遗留、滚动位置丢失。三项先RED复现后GREEN，未二次评审。真实库最后加强等待“查看状态”及网络闲置，避免把授权加载中截图当最终空态；修正跨显式reload的文档计数测量，不放松真实切换断言。

证据目录：.tmp/ai-conversation-switch-2026-11-10/。关键文件：backend-red.log、backend-green.log、review-ui-red-all.log、review-ui-green.log、project-tests-final.log、build-final.log、live-final.log、live-result.json、owner/admin-new.png、owner/admin-history.png、owner/admin-390.png、video/、live-video/。记录不包含密码/Cookie/模型密钥。

## 用户复验

刷新岐研AI → 进入有内容的历史 → 新建 → 确认旧内容消失 → 再点原历史确认恢复 → 连续切换并确认左栏稳定 → 刷新确认当前会话恢复。新建不发送问题；若Token不足，保留正常业务提示，不以本轮修复擅自补额。

代码、目标环境启用、真实执行三层已举证；最终体验由用户签收。本轮不重新验收联网检索/模型解读，不恢复ChiCTR；正式环境未发布。
