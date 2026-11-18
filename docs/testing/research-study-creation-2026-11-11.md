# 科研课题创建首批 · 本机技术验收

日期2026-11-11。用户已授权补充复用调用方式并开始代码；实施边界为T00–T03创建切片，剩余采集/问卷/分析任务未据此完成。仅合成科研材料，0模型/计算Worker/触达渠道调用，不含真实受试者数据。

## 后续统一入口

用户后续要求接入19501。当前已完成同账号装配并在19501真实PG/HTTP/Chrome验证；原19611/19612实例已停止。见[19501接入实测](research-study-19501-2026-11-11.md)。下文独立运行/PID和“不重启19501”为首批历史阶段，不代表当前部署方式。

## 首批独立阶段证据（保留历史）

本机独立运行19611/19612；本任务未启动或停止旧19501/19502。收尾观察既有runtime PID由46505变为84821，原因未核实，七个既有服务当前均ready；不声称整个并发工作区未重启，也不为恢复旧PID触碰其他任务。两份约定不改的RealStudyOverview/route-context源码摘要与初始基线相同。最终合成运行标识rh-create-39ca8c05，失败尝试及修补轨迹保留。

| 检查 | 结果与依据 |
| --- | --- |
| 纯测试与Nest HTTP策略 | [47项通过](evidence/research-creation-2026-11-11/rh-create-39ca8c05/checks/unit.log)；覆盖新模块、独立runtime、路由与会话适配；长度修补含约180KiB有效中文与257KiB拒绝 |
| 旧项目核心回归 | 2项通过；旧事务/返回行为与新共享核心写入契约 |
| 构建 | Nest及ResearchHub Vite通过；Vite既有大chunk提示保留，不视作新运行错误 |
| 真实API | [8组](evidence/research-creation-2026-11-11/rh-create-39ca8c05/api-84998562/result.json)：当前创建范围、显式Hubowner、持久草稿/隔离、并发CAS、默认研究原子创建、父级成员、撤权重放拒绝、真实Cookie吊销 |
| 真实PG | [6组](evidence/research-creation-2026-11-11/rh-create-39ca8c05/pg-cbec7608-42eb-4473-ac84-50d40816e0e5/result.json)：四表强制RLS、错父链、跨租户审计、可信作用域交接及旧核心执行后全回滚 |
| 主流程Chrome | [11组](evidence/research-creation-2026-11-11/rh-create-39ca8c05/browser-abaae878/result.json)：残留demo、真实空白创建/刷新/重登、迟到GET、丢失响应原键重试、真实CAS、建立研究、管理员、撤权及换Cookie迟到响应；1440/1280/390/320截图与WebM |
| 补充Chrome | [7组通过](evidence/research-creation-2026-11-11/rh-create-39ca8c05/browser-extra-724321cd/result.json)：23条合成分页/范围、背景撤权、约180KiB长中文、无组草稿、管理员多组、Q01字号/窄屏与原生200% |

## 发现与修补

真实PG首先暴露审计INSERT RETURNING与SELECT RLS冲突；已改预分配审计ID、不RETURNING写入及正确执行项目作用域，无schema降级。初始失败证据位于rh-create-1195ed18/api-9b2b4de8；其余本轮新对象与失败记录保留。

独立评审原Request changes：演示残留回退、迟到GET覆盖新保存内容、48KiB与字段长度冲突；修补后独立复核确认解决。复核另发现轮询丢弃展开分页，已修补并获最终窄复核“已解决，可关闭”，无新增必须修复项。原评审与修补分列，见[代码评审记录](../planning/research-study-workflow-2026-11-11/creation-code-review.md)。

浏览器前两次中止是测试等待问题（显式核对后未等异步读取；自动跳转后才读Playwright响应体）；修正测试等待后主链11组通过，原failure.json和录屏保留，不将其伪称产品问题或删除。

补充实测修复Q01新路由导航高亮被共享归一化覆盖、输入继承13px及窄屏固定宽度，限定新路由/新组件，桌面Shell几何保持。Q01独立[390/320/1440键盘与截图](evidence/research-creation-2026-11-11/rh-create-39ca8c05/q01-mobile-fcb94f0f/result.json)通过。原生select计算line-height为normal，实际14px/40px高；其他字段14/22。最初DPR模拟未通过原生缩放判据，最终使用独立Chrome设置页200%，[实际outer1440/inner720/dpr2/visualScale1/scroll720](evidence/research-creation-2026-11-11/rh-create-39ca8c05/native200-722946e7/result.json)，未把模拟DPR当缩放通过。

## 四层状态与限制

1. 代码：首批课题意图、受控创建与默认绑定、列表/编辑/概览、统一read/configure交接已实现。
2. 目标配置：首批为本机专用合成PG和独立运行入口；后续已接入19501并停止独立实例，见上方记录。正式环境未配置迁移/代理或发布。
3. 实际执行：保存/回读/并发/撤权/回滚均有真实PG、HTTP、Chrome请求及产物，不以Mock替代。
4. 业务结果：技术任务链可用性由上述角色实测支撑；用户专业体验与正式研究材料验收待用户完成。未建立真实临床研究，未批准方案、启用采集、问卷或分析。

本轮不能称科研全流程、正式上线或临床专业验收通过。后续按T04–T18继续，Protocol/访视/CRF/知情同意/SAP等正式输入仍待校准。
