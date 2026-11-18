# P7 治理整链接线与证据边界

本轮无新增API、数据库结构、角色、GRANT、旧app修改或部署。`GET /api/research-studies/protocol-decisions`继续是原P3权威，原当前授权／固定Study归属与签名分页不变。

## 总览处理结果

`loadGovernanceItems('protocols','processed')`复用parseDecisionPage，按原nextCursor读完后与来源／团队／用量统一排序；循环游标、跨页重复决定ID、畸形／失败／撤权均整类拒绝，不把半个集合或403显示为零。

pending使用study＋protocol；processed使用study＋protocol＋decision作为显示身份，以真实decision.id全集合去重。退回／批准／启用取真实kind、createdAt、actorName；不根据当前protocol.status推断原决定或根据updatedAt补造处理时间。同一版本多个实际决定独立呈现。

原总览只读列表／面板未重排。新条目从G02进入S07时只用governanceModule／governancePage返回来源，不能再混入G01的reviewTab；直接G01历史链接仍保持原reviewTab。未放宽readFormalRoute原互斥校验。原pending上下文和未保存保护保留。

## 导航

真实“管理与治理”context-nav事件中，三标签使用固定安全目的地：数据治理→原G02来源，系统配置→原G02用量，多中心→原G02 centers未提供汇总状态。不是新增多中心页／空壳签收；不再把S11成员邀请当多中心。八Tab、桌面和窄屏母版、显式演示及业务权限不改。普通actions／其他workspace事件保持原逻辑。

## 未接能力

G03当前已有合法Study发现；原旧文档“没有合法发现”已过时。总览邀请异常投影和原S11精确邀请定位仍缺，不能因当前27个Study无异常称已完成；普通待接受、注册或已停用账号都不自动变待办。

P5操作日志没有异常调查状态，P6已配置／旧检查没有故障事件ID，不构造第二套告警或扩大探活。P4新增质量工作台仍延期。

## 验证

实际只读HTTP／PG、原角色范围、两context浏览器观测／五宽／原生200%、AC证据和缺口见[验收报告](../testing/governance-p7-2026-11-13.md)。本轮没有重放历史审核／停用／成员／结算写链，相关真实原件逐项继承，不能用本轮GET冒充新业务提交。最终源码摘要与初快照分开，其他会话运行时变化不算本轮发布。
