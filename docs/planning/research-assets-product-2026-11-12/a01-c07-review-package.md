# A01 C07 单次整页独立总评包

当前用户要求：推进C06五辅助区域后进行C07整页总评。仅当前A01完整范围，旧A02仅固定版只读依赖；不要评审或恢复其他任务。当前目录串行实施，不使用额外实施者。本包供一名新上下文只读Reviewer；不是已通过评审结论。

## 唯一事实与边界

- 仓库`/Users/mac/aisciencesys/researchhub`，HEAD `190f509d127b833a9380dfdf52916f20038b6f9c`、branch codex/ui-ue-validation。大量未提交及untracked文件，HEAD对比不能代表本功能；逐文件读工作树，不重置、提交、清理、切分支、改工作树或创建worktree。
- 上级和本仓AGENTS适用。只允许只读检查、现有纯单元测试；不要写PG夹具、DDL、业务请求、权限、重arm探针、重载19501、发模型或外网请求；不要自行分派代理。旧app/server只作依赖阅读，禁止编辑。
- 规格`docs/product/research-assets-a01-spec-2026-11-12.md`、计划`a01-implementation-plan.md`、授权`a01-authorizations.md`、执行台账`a01-execution-ledger.md`同目录（规格在product）。规格优先；台账Ruling项和历史事实保留，开头旧状态不是复跑指令。
- 当前新族10资产/15内容版/39成功事件及Audit/4 bound文件；原F03仅两份v2、旧10资产20版不变。原两个账号/当前Study，无付费调用。所有额外用途grant已revoked/rejected，两个固定版引用保留，trash为空；owner量表revision5、admin量表3。任何历史阶段13/24/33事件不是当前基线。
- public原hash差异已有有界精确重现+独立已批单函数证明，完整当前hash53e701e8e24717f5c8c8963978a4fee1e67311e17066849fe28eb01f3a195c91，不重置基线或按名称宽豁免。C05仅自有guard v2，C06/C07无DDL。

## 审查文件（只限本功能及装配）

全链：`scripts/local-research-assets-catalog*.mjs`、`local-research-assets-registration*.mjs`、`local-research-assets-governance.mjs`、`local-research-assets-access.mjs`、`local-research-assets-lifecycle.mjs`，对应`research-assets-{catalog-contract,catalog-views,views-contract,registration-contract,governance-contract,knowledge-sources,uploads,upload-binding,public-baseline,acceptance-probe}.mjs`，`server/research-assets/{schema,access-guards-v2}.sql`。
前端：`pages/shared/ResearchAsset{Catalog,CatalogWorkspace,CatalogReadWorkspace,CatalogDetail,Views,RegistrationDialog,GovernanceDialog,AccessDialog}.jsx`、`useAsset{Registration,Governance,Usage,Lifecycle}.jsx`、本页CSS；`src/research-assets-{catalog-session,catalog-client,registration,registration-flow,governance,usage,lifecycle,views}.js`。
最小装配：`scripts/local-knowledge-ai.mjs`/`local-knowledge.mjs`、`src/knowledge-session.js`、`pages/shared/missing-main.jsx`中的asset分支；共享文件还有别的会话改动，不扩大评审对象。
对应`tests/*research-assets*.test.mjs`、`scripts/*research-assets*.test.mjs`及`tests/fixtures/research-assets-{views-pg,views-http,c07-postflight,access-pg,access-current-http}.mjs`。可分多遍读，不因untracked而跳过。

## 当前真实证据与尚未证明

- `evidence/a01-c07/frontend-final.log`601/601；backend-final.log110/110；build-final.log5.28s（原大包告警）。后续postflight脚本初稿误写unused type字段导致Prisma选择错误，删掉后真实读取通过；非产品缺陷，未写业务。
- `pg-final.json`真实aisci_app、非superuser/BYPASSRLS、全回滚；回收/恢复/原键/CAS/审计失败/历史阻断。
- `http-final.json`原owner6/admin10；同可见图谱8/12nodes、2edges、推荐完整无重复6/10；本人贡献按actor、引用2/应用0/下载0、trash0；真实400/错Study/匿名拒绝；10/15/39、原public/role/旧对象不变。
- `access-current.json`当前用途关闭/正文拒绝、路径及用途白名单；postflight.json F03两份v2和旧KB/docs不变、原回收提交只一次、旧V1两账号各5正向+5拒绝、P01不混新资产族。
- `evidence/a01-c06/browser-observations.json`双角色真实五Tab/四预览、推荐穷尽、软回收恢复、Esc/焦点/原来源固定v2。C03–C05原位登记/治理/申请/引用/撤销/未知回执等历史真实操作见原证据，未为复验重建旧记录。
- C07受控读取503及真实提交后一次503→原键恢复→restore留证；两个探针used/ended，禁止rearm。跨Tab旧DTO导致崩溃、菜单卸载焦点丢失、故障辅助卡片假loading均RED→GREEN；最后卡片修复已原生Chrome tab-only Offline→真实失败三卡blocked→恢复网络自动重读验证。
- IAB响应实测1440×900、1366×769、1919×1200、389×843以及358×740（不是320），正文14/22、根不横溢出。前五张未实际缩放背景tab图片明确invalid，不计入验收。Native Chrome DevTools后补320×740，toolbar证据在chrome-responsive-320.png；原生菜单100→200→100，chrome-zoom-200-menu.png，图谱入口/垂直滚动有实证。native-browser-validation.json记录恢复No throttling/deviceOff/仅关闭自建临时tab。
- 严格1920/390的±1px不是精确通过；无原生录屏能力，只有逐步截图/AX，不声称已录屏。尚未用户科研专业签收/真实部署；不可仅用测试全绿替代。右栏350/gap16及原1910基线见C06截图。
- 一次鼠标点未知恢复无可观测效果，后键盘Enter真实打开恢复成功；未补新探针重新写入来伪造pointer验收。请审其实际事件处理是否存在产品问题。

## Review Focus（计划原文）

1. 内容容器draft与Hub真实资产状态是否明确分层，旧接口/扫描是否能绕过新policy；本轮不能证明生产兼容。
2. 摘要可发现但正文受限时，列表/预览/图谱/推荐/统计/引用/原回执是否泄漏私有字段。
3. 多个工作版及旧发布版并存时，许可/审核/引用/深链是否绑定同一固定版。
4. 当前管理员权限不能来自共享Role补全、邮箱或旧Token；在途当前授权失败是否阻止提交及晚响应复活。
5. 回收/上传/未知回执/Clipboard等异常是否真实可恢复，是否静默物理删除或用假成功替代整页闭环。

## 输出

按Strengths、Critical、Important、Minor、Declined to judge逐行说明、Assessment。每问题给真实file:line、可重现触发/影响、最小改法。独立检查代码，不盲信本包摘要；未读不评。只读，不写报告文件，直接回复。C07为技术评审，专业质量由用户签收。Minor留账；Critical/Important主线程只做一次RED→GREEN修补和全回归，不再发二次评审。
