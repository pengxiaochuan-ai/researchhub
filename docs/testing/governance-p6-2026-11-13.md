# P6 系统配置本机验证与技术交接 · 2026-11-13

当前：P6代码与本机装配、真实请求及浏览器任务路径已验证，文档／Notion完成同步收束，本机技术交接完成。用户专业签收和生产部署独立待验，不自动启动P7。范围见[实施台账](../planning/governance-module-2026-11-12/p6-system-implementation.md)、[API及状态来源](../technical/governance-system-2026-11-13.md)。

## 实际执行

- `node --test server/governance-system/service.test.mjs tests/governance-system-session.test.mjs server/billing/controller.test.mjs server/billing/attempts.test.mjs server/billing/runtime.test.mjs tests/hub-billing-session.test.mjs`：24通过，包括10项新增契约。
- `node --test tests/*.test.mjs`：当次652通过，包含并行会话已有测试，不把全部测试数算作本轮新增。
- `pnpm build --outDir .tmp/p6-final-build`：6.35秒通过；原大包告警保留，不扩大为打包改造。
- `node scripts/governance-p6-pg.mjs --local-synthetic`：真实READ ONLY PG及实际Nest Controller六类核对；管理员200，owner／stale／cross-tenant／forged-role拒绝，秘密字段不投影，query拒绝和状态源故障503有证。原两账号154笔预留记录为当时只读基线；未重跑会创建新合成租户并提交的旧PG结算脚本。
- `node scripts/governance-p6-browser.mjs --local-synthetic`：真实Chrome九组路径通过，pageErrors空，业务写入0、模型调用0。账号登录／既有会话续期属于正常认证，不作为计费写入。

## 浏览器与视觉

1. 管理员直接G05→原G02系统配置，原八Tab当前项、原列表／弹窗不变；真实状态五项、no-store、不含端点／秘密。
2. 原两笔待核实记录仍不可结算；读取既有已结算记录的实际回执，确认按钮禁用，Esc归焦；本轮无结算POST，不把只读复核称为新结算演练。
3. 状态503（受控）清除旧行、隐藏技术诊断，账本仍可用；重试回真实后端。
4. 非JSON403（受控）明确无权，不误判为网络故障或注销；恢复真实接口可读。
5. 网络故障（受控）不注销；空列表（受控）显示真实空态语义，随后恢复实际列表。以上故障注入不冒充实际服务停机。
6. 1440／1366／1920／390／320：根无横溢出，原桌面侧栏220px／容器保留，14px操作字体／22px工作区行高，原生select computed行高normal、实际高度40px，未改原生控件样式凑断言。窄屏表格容器可横滚，无缩字或正文被侧栏遮盖。
7. 实际admin200响应暂缓交付→实际登录owner→身份重核→释放旧响应；无旧状态泄露，当前owner后端403。
8. Chrome设置实际200%：DPR2、visualViewport.scale1、CSS视口720×456.5。输入命中无遮挡、原Tab全项可达、状态表可读。完整CDP截图已人工查看，未以CSS缩放代替。

[浏览器结果](evidence/governance-p6-2026-11-13/browser/result.json) · [320状态表](evidence/governance-p6-2026-11-13/browser/services-320.png) · [原生200%状态表](evidence/governance-p6-2026-11-13/browser/native200-services.png) · [原生200%完整页](evidence/governance-p6-2026-11-13/browser/native200-full.png) · [只读PG](evidence/governance-p6-2026-11-13/readonly-pg.json)。录像在同级browser/video，原母版截图before-billing-1440.png、before-g05-1440.png保留。

## RED→GREEN及唯一独评

- 初8契约缺失状态投影／路由／客户端，RED→GREEN；后续畸形状态响应接受空／重复服务的RED也已修补。
- 首次浏览器脚本切换筛选后过早点击旧行而超时；受控延迟确认真实缺陷`STALE_BILLING_ROW_STILL_ACTIONABLE`，再加入加载期间按钮／open阻断，后续完整链通过。失败JSON保留。
- 原生select computed line-height为normal；脚本改核对实际工作区22px／控件高度和视觉，而非修改页面样式迎合测试。对应失败JSON保留。
- 唯一独立总评：Critical0／Important1／Minor0。Important为HTTP401／403空或非JSON正文误归503；补回归先RED，再先处理非2xx状态、仅对成功响应解析／严格校验，24相关及全量／Chrome重新通过。独评已核查原8组浏览器结果；修补后第九组非JSON403由作者实测，不冒称第二次独评。

## 装配与协调事实

本轮仅owned本机host62994→69691重载一次，19501–19507健康，无旧服务／临床库／云／生产操作。协调工具把另一会话呈为failed/systemError，我误将其当作执行结束而提前重载；对方后续确认仍在执行四访视。已明确承认、通知按原journal回执核对恢复并停止后续主动重载。不能声称对方验收完成或未受中断；其合并修补若再重载，仅由对方在明确边界推进。

本机验证不新增业务授权、DDL、角色、云费用、模型请求或计费操作。邮件／AI未探测，显示“未检查”符合真实状态；本轮没有证明公网投递／供应商在线／模型回答质量。P4增量仍延期，不把这张状态表当作研究质量或全系统SLA验收。

## 最新共享运行版本复核

对方按明确V1边界的合并重载到74367后，实际服务又由其他会话重载到75250（不是P6操作）。本轮已告知对方不再重载。最新75250前后PID一致的实际GET200／G05真实归一／五项状态与1440截图通过；不以瞬时连接或failed快照替代协调确认。见[最新运行复核](evidence/governance-p6-2026-11-13/latest-runtime.json)。
