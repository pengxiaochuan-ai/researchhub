# 九项 Skill 与 PubMed MCP · 第一批准备层验证

2026-11-07 更新：用户已将产品规则改为所有现有/未来 Hub 账号默认装备；本机默认装备已完成，见[新记录](qiyan-default-skills-2026-11-07.md)。本文末尾两账号18条“待确认”差异属于11月6日历史提案，已被明确替代，不应据此重复请求确认。

日期：2026-11-06。用户批准 [全量规格及 T01–T15](../planning/qiyan-ai-nine-skills-2026-11-06.md) 后串行实施。本记录只覆盖 T01–T03 的准备层，不宣称九项能力上线或专业验收完成。

## 实现与复用

| 项目 | 当前证据 | 未证明的能力 |
| --- | --- | --- |
| T01 | 9 个原包全部资源的 SHA256 快照、依赖及 36 条正反样例；拒绝符号链接和身份错配 | 样例尚未用于实际自动路由，账号未装备 |
| T02 | 复用旧编译 OpencodeClient，真实 OpenCode 1.18.27；独立部署/租户/XDG 目录、SQLite、端口及进程关闭 | 仅假密钥/不可用模型端点预检，非真实模型任务 |
| T03 | 固定 PubMed MCP 2.11.1、SDK 1.32.2，真实 tools/list、公开查询及读链；11 操作合同发现 | 未逐一真实执行全部 11 操作，未完成 Agent 模型自主调用 |

原包许可未发现 LICENSE/COPYING，状态保持 `unverified`，不打包为获准商业发行。OpenCode 与 SDK 两种 MCP 启动都由 launcher 重建最小环境；出站仅核准 HTTPS 来源，逐跳验证，零自动重试、并发一。不继承模型/数据库密钥，不创建 Codex MCP 配置。

`authorize` 必须显式返回 true；启动、调用和交付重验。独立 SDK 集成验证了实际在途撤权与取消：取消会关闭本任务 MCP 进程，记录期间取消也不能迟到交付。此回调合同尚待 T04/T05 接到真实 Hub 当前授权，不能用预检固定公开查询的授权代替业务鉴权。

## 测试与回归

- `node --test server/ai-agent/*.test.mjs integrations/pubmed-mcp/egress.test.mjs`：21/21，包括 14 项纯测试、7 项真实集成；零跳过。
- 旧编译组件三组 Node 测试：`opencode-client.spec.js`、`selected-skill-policy.spec.js`、`effective-skills-policy.spec.js`，22/22；不是旧系统全量测试。
- `pnpm build` 通过，保留既有 bundle 大小警告。
- 独立依赖 `npm audit --omit=dev --json`：0 个已知漏洞；不代表不存在任何风险。
- `git diff --check` 通过；既有未提交内容保留，未提交或暂存用户其他修改。

原始日志位于本地忽略目录 `.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/` 下 `new-tests.log`、`legacy-reuse-tests.log`、`build.log`。新集成进程测试后均关闭；既有七个本地服务 19501–19507 健康，原服务进程未重启。

## 真实公开来源读链

运行 `node scripts/qiyan-skills-preflight.mjs`，证据目录：

`.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/evidence/134a8a0e-f33c-49dd-9f16-9615a729c27a/`

查询 `(acupuncture[Title/Abstract]) AND (depression[Title/Abstract])`，当次结果总数 1914，仅取 1 条，不表示穷尽检索。实际链：PubMed 查询 → PMID `35168522` 题录 → 标识转换 → PMCID `PMC9878952` 正文读取，DOI `10.2174/1570159X19666210609162809`。真实工具输入、输出及出站时间/状态保留在私有证据目录。

正文此次只返回 11999/42308 字符，省略 8 节及 1 个图资源，明确为截断读取，不是全文完整性交付。安装包版本 2.11.1 与实际握手框架版本 0.13.19 分开记录。本轮零真实模型调用、零模型费用、新增 Token 额度或充值，未将实时结果自动入库/审核/公开。

## 合成库及浏览器回归

只读核对专用 `wp01_test_full_baseline`：原 admin 为 active tenant_admin，owner 为 active researcher；当前科研配置 `skillsEnabled:[]`、工具仅 `knowledge.search`。既有装备计数 2，不等于九项已装备。没有创建 Skill、装备、发布、角色、Study 成员关系或数据库权限。

通过真实浏览器用原 owner 体验账号登录 AI01，刷新后本人历史可见、发送按钮可用、该次检查无 pageerror。没有发送模型问题。仅作原页面回归，不是新九项界面或管理员角色验收；两账号全链浏览器验证仍在 T14。

![原 owner 的既有 AI01 会话回归，非九项启用证明](qiyan-nine-skills-2026-11-06/ai01-existing-owner.png)

## 独立评审及修补

新鲜只读独立评审发现两项 Important：原生 OpenCode 启动 MCP 与 SDK 的环境不一致；交付授权/记录期间取消仍可能返回结果。均先补失败测试再修补；统一 launcher 最小环境，交付前二次取消检查，并关闭任务专属 MCP。复核未遗留 Critical/Important；最终 21 项测试包含真实在途取消关闭与撤权不交付。

后续仍需验证长期运行、异常退出、账本逐次对应、全部 11 项操作、九项专业产物、完整翻译及订阅。当前截图、Mock、Schema 或启动日志不替代这些验收。

## T04 待确认的精确最小授权差异

当前 Agent 没有装备这九项；计划批准不隐式变更账号权限。申请仅专用合成租户、原 owner/admin 两账号、当前 Study 和本人本轮新对象：

1. 创建九项租户自定义、版本化的 Hub 适配 Skill；复用原审核/发布/审计流程，适配就绪后逐项装备原两账号，最多 18 条装备，不对全租户默认开通。不伪造管理员审核或提前宣称发布成功。
2. 在本机当前科研 Agent 范围保留 `knowledge.search`，最小加入旧系统已有 `skill.invoke`、`file.read`。后者仍只读当前授权文章/本人附件，不授予全盘文件或 shell。PubMed 仅上述 11 项公开只读操作。
3. 不增加角色/Study 成员/数据库全局权限，不开放共享、审批、锁库、发布科研产物、导出或充值。Skill 配置发布与科研产物发布不是同一权限；原包商业许可仍未核验。

用户批准该精确差异后继续 T04–T05；无需重新确认已批准的“九项全部接入”目标。若实施需要新增表/迁移、共享内核、其他权限、UI 布局或来源扩大，再单列差异，不夹带扩展。
