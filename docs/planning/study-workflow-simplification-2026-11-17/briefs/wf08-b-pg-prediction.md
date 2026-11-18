# WF08 B · 原生围栏真实PG回滚预测边界

2026-11-18，设计预备，尚未执行。须Native与consumer core最终冻结、独评后，由根具名脚本在同一专用库执行；不提前迁移提交、启动19501 consumer或调用真实Worker。A闭环及四失败保持。

## 资源及事实边界

只用A成功的纯合成ordinary Study722、固定snapshot、admin authVersion5与实际descriptive agent/skill v1。逻辑Scope4必须显式投影为Native Scope3，原actor/version从当前DB核，不按名字兜底。最多3个事务内临时Job/3个Native Run、1份取消operation；复用既有workbench Session，不改/删/软删旧Session去凑创建分支。若实际需新Session只能新增并整体回滚，不能改旧对象。无新课题/被试/原数据/旧授权/配额变更。

真实DB用aisci_app；仅DDL阶段owner，强制RLS不关。原A迁移V5按21块同事务应用；所有Job/Run/audit/role/函数及必要新Session由sentinel整体回滚，之后新连接strict+seven/591/155/scienceWord及schema/新对象核零持久增量。

Worker使用有据标记的可控spy，不产生可交付数值，不把spy/同连接调度当真实HTTP、CPU或跨进程恢复。Native派发/围栏/计数/绑定/CAS/失败结算是真实PG，数值与真实服务重启留D。若同一物理事务包住多个原生短事务以便整体回滚，必须明确该限制，不声称已证明生产跨连接隔离。

## 三个必要场景

1. 原子prepare：接纳→claim→实际Native prepare，固定Run key/inputHash/marker与Job target一一匹配，重复prepare不新建Run/Session/audit；同scope假cap/复制marker反例拒绝。只读权限/固定OperatorRef沿真实Native验证。
2. 取消及旧代失败：dispatch至可控Worker挂起，原A cancel同键接纳（当前有权人、确切operation、generation失效），新settle代安全取消已绑定未发布Run、不派发新Run；再释放旧spy，旧publish及两个独立failure cleanup均0写。原cancel key重读不能重复递增generation。未创建目标不造Run。
3. 计算额度与runtime-failure：在本轮新临时Job上模拟租约到期与新generation，最多3次真正dispatch；用确定性Job+generation audit证实同代重复检查/后续批不加attempt、回滚计数不留。第4次无Worker/无新Run；以runtime-failure purpose结算为failed而非cancelled、不造取消receipt。第三次在途仍可接受合法cancel的边界由第2场景/对应纯测试交叉说明，不能把不同case说成同一Job实际两种终态。

每例需保存实际新ID、原键/hash、scope/actor/version、DB角色与backend/tx stamp、原生metadata/audit/Job checkpoint、Worker spy次数及禁止写明细。临时修改只限本轮新Job/Run的租约/标记等测试对象，旧Source和任何旧行保持。证明fakecap拒绝、旧代不写时，应比较反例开始前/后的真实行与audit，不只看函数抛错。

## 门禁

先离线guard/源码冻结与独评，再根一次执行；若失败定向捕获安全错误码、阶段、模型/方法/静态字段，不打印凭证、SQL参数或原值。保存失败原件与外保护，不用单元绿色顶替实际。通过此步仍只是B技术PG门禁，C/full、D实际Worker/重启/UI/四层及文档未完成。
