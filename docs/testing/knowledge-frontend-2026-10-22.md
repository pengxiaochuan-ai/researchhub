# 知识资料前端接入验证 · 2026-10-22

结论：本机专用合成环境通过，未发布、未专业签认。入口 `科研资产 → 知识资料（K01）`，管理员在同页进入“知识库治理”；管理与治理页也提供入口。旧 Shell 未带入，一级导航/字号 tokens 不变。

真实导入样例为新建合成HTML材料。此次没有穷举PDF/DOCX/扫描中文OCR质量、全部版本回滚分支或大文件并发压测，不能把前端接通等同解析服务全格式/全性能验收。

## 验证范围

- 20 份旧 UI/编辑器/对话框/纯函数受控复用；旧 AuthController、KnowledgeController、JwtAuthGuard、RolesGuard、StudyGroupGuard 和领域服务不改写。
- 真实 Chrome → 新 Vite 同源代理 → 实际 Nest controllers/guards → 专用合成 PG；真实 Storage/具名本机 MinIO bucket、独立本机 Parser/Embedding、真实 KnowledgeImportService enqueue/schedule。未启动恢复扫描，仅处理当次新任务。
- 新科研人员：建私有库、真实文件上传/解析/向量入库、刷新恢复同一任务、预览、审核、真实向量结果、503 后重试、保存重审、版本、软删除/恢复、未保存导航取消、409 保留草稿、撤权拒绝。
- 新管理员：同一复用组件治理租户共享库；只读成员写动作禁用且原 HTTP 403；未邀请账号真实空态且伪造组/项目头仍 403。所有权限依据旧规则，没有额外授予新业务权限。
- 1366×768、1440×900、1920×1200 和 768 宽工作区检查；能力区无横向溢出，操作正文 14px/22px，阅读 16px/28px、48rem 上限。
- Chrome 设置页真实选择 200%，外窗1440、innerWidth720、devicePixelRatio2、visualViewport.scale1；实际新建/编辑/保存。窗口 resize 或页面 scale 不作为本项证据。模态按 iframe 可见区域定位；不声称全站 Frozen Shell/门户窄屏通过。

## 测试与失败留痕

- `node --test researchhub/tests/*.test.mjs`：64/64，知识客户端10。初始缺模块只算开发失败，不算安全反例；在途重复提交实际2≠1、编辑授权最小实现false≠true均先失败，再实现后通过。
- 首轮真实浏览器发现 Tiptap 切换预览触发 update，错误置 dirty、禁用审核；副本传 emitUpdate=false 后相同路径通过。200% 首轮一项选择器误用“文档标题”而非“文章标题”，随后发现 iframe 模态确有提交按钮落到可见区域外；前者是测试错误，后者修复可见区域定位后通过。
- 中间一轮测试在实现期间被 Vite 热更新打断，后续使用稳定源码全新夹具重跑；不将中间失败隐藏，也不视为后端授权漏洞。
- 完整后端：828/58/16/41/84/85/23/2/2 各组 0 失败/跳过；不同组可重叠，不汇总去重总数。Hub 构建通过；旧地图大 chunk 和新增惰性 WikiEditor 约575KB（gzip约200KB）警告保留，没有隐藏阈值或全站预加载编辑器。
- 真实浏览器15项业务检查、0 pageerror；预期401/403/409/503网络控制台记录单列，不声称“零控制台错误”。成功路径不是 Mock API；HTTP503仅错误恢复故障注入。
- `pnpm audit --prod` 本轮返回 low/moderate/high/critical 均0（220个运行时依赖项统计）；`pnpm peers check` 无peer问题。不是旧系统或开发依赖的全面漏洞结论，也不代替发布前复核。

## 证据与边界

证据根：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-22-researchhub-knowledge-frontend/`。各次运行独立目录，成功和失败均保留；最终收据与完整摘要以本目录最终封存清单为准。

最终稳定运行 `rh-kb-ui-8dc14c90`：15检查、14PNG、6WebM、66条API响应记录、0pageerror、8条预期HTTP控制台错误；阅读16/28、操作14/22实测，真实200%通过Chrome设置与layout指标交叉核对。缩放截图使用CDP fromSurface=false保存完整可见窗口，避免自动化默认截屏在运行时DPR改变后只截到左半画面；不以裁切图判断可用性。

每次连接逐事务核验 wp01_test_full_baseline 及 synthetic 标记。旧20份源组件/相关后端/.env指纹、8个既有进程身份、非本轮知识导入任务摘要不变；新 bucket/夹具留存用于审计，不删除历史。测试密码/JWT/S3密钥不出服务端、不入证据/Notion/前端构建。

本轮模型费用0、云操作0、真实发布0；旧服务不重启、临床库不连接。临时后端/解析/向量/Vite/浏览器随测试退出。`VITE_AUTH_TENANT_SLUG` 和同源 API 反代仍须在获准的目标环境配置；不因测试壳成功就宣称常驻环境/生产已启用。当前真实身份以功能区 me 为准，顶栏仍明确标记演示身份，不冒充真实账号。

作者五轴自检已落实：权限不提升、并发不重复提交、异步不跨对象、失败不抹草稿、独立构建不依赖旧仓库。未派新评审 Agent、不更改 WP01 原独立评审 No；不是整体平台放行。
