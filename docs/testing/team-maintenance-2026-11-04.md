# 一页式团队资料维护 · 本机技术交接

日期：2026-11-04。范围为用户批准的G02团队维护简化＋一个私有草稿字段/该列UPDATE权限。仅专用合成库 `wp01_test_full_baseline` 和原admin/owner，不涉及临床库、旧服务、AI/付费、云、远端配置或真实发布。

## 结果与使用路径

管理员从管理与治理进入“团队资料维护”，同页填写基本资料、负责人和成员、资料依据；保存私有草稿→预览→显式确认全部变更并填审核理由。已接真实数据库，刷新恢复。高级细粒度维护折叠保留，T01/T02及公共Shell未改。入口：`http://127.0.0.1:19501/pages/g02/?view=directory-review`。

真实“灵枢心域项目研究团队（名称待确认）”仍是未批准候选；没有编造正式名称/负责人/成员。合成团队继续明确标注，不能作为真实团队。表单可先存名称或未填完引用；无有效依据/必要资料不可审核展示。本轮只选择既有获准来源，尚无新增上传/资料入库功能。团队成员展示资料不创建账号/邀请/Study权限，也不开放L2/L3。

## 四层证据

1. **代码**：下列测试/构建与一次独立总评审；5 Important经作者修补并回归，保留原Request changes，不冒充独立第二次签认。
2. **环境**：本机七服务ready；原目录/来源锁/草稿v2检查均`existing`。唯一新授权是已批准的`UPDATE(team_draft)`；v2仅增强完整ACL检查、追加收据，不追加授权。
3. **真实执行**：真实HTTP登录/PG读写、Chrome保存/刷新/预览/管理员批准/owner只读与403、故障恢复和跨页换身份实际执行；PNG/WebM如下。不是仅Mock/UI演示。
4. **业务可用性**：技术路径与样式门禁通过；真实团队资料待管理员补齐，用户对简化交互的专业体验尚待确认。未宣称生产发布或真实团队内容验收。

## 自动化与故障验证

| 检查 | 实际结果 |
| --- | --- |
| `node --test --test-concurrency=1 server/directory/*.test.mjs tests/directory-session.test.mjs tests/directory-presentation.test.mjs tests/team-workspace-session.test.mjs tests/team-workspace-ui.test.mjs` | 47/47通过，真实PG测试事务回滚，不留额外实体/授权 |
| `node --test --test-concurrency=1 tests/*.test.mjs` | 最终207/207通过（前一轮206，当前工作树其他任务增加1项）；与上行部分重叠，不将二者相加冒充不同测试 |
| `pnpm run build` | 通过；既有WikiEditor/china大于500kB分包警告保留，未因本轮扩成全局性能改造 |
| `node scripts/team-workspace-browser.mjs` | 9组通过：管理员完整链、owner、未知响应回执、真实409基准对照、离开保护、五视口与原生200% |
| `node scripts/team-workspace-final-browser.mjs` | 最新运行时5组通过：无意义再审核消除、503旧预览清除/恢复、三分区布局/键盘、原生200%、真实跨页切身份后迟到旧200不回填 |
| `node scripts/directory-layout.mjs` | T01/T02布局/详情/返回4组通过，五视口及原生200%，原桌面四列/窄屏导航焦点和地图锚点保持 |

PG负例覆盖：私有部分草稿、草稿CAS/同键幂等/当前授权、引用不完整/来源撤回、第二次新机构替换、public→tenant精确收窄但共享档案不改、无关来源过期不阻断本次团队、中途限额错误整个组合回滚。ACL漂移为纯指纹负例，**没有临时向PUBLIC或其他角色授予权限**。

浏览器回执未知为服务器实际提交后拦截响应，409为真实API并发保存；503是明确UI层故障注入，不能冒充真实数据库故障。迟到响应来自真实旧admin GET，真实另一页退出并用owner表单登录再释放。200%为Chrome原生缩放、DPR2/visualViewport.scale1，不是CSS transform。

## 截图、录屏与失败记录

证据根目录：[本轮日志](evidence/team-maintenance-2026-11-04/)。

- [首轮完整链9组](evidence/team-maintenance-2026-11-04/browser-d2182284-5563-47b5-ad7f-e2718143ff26/result.json)：同目录PNG及video/zoom-video WebM。
- [最终5组](evidence/team-maintenance-2026-11-04/final-browser-06a174f8-182b-4360-9064-bfd9f7a870c9/result.json)：基本资料/成员/依据在1440/1366/1920/390/320均截图，原生200%和换账号截图/录屏。主实施已目视核对桌面、320成员/依据和200%截图：14/22正文、44px主控件、无页面横向溢出、无单字窄列/末行遮挡。
- [T01/T02回归](evidence/research-identity-directory-implementation-2026-11-03/t01-layout-62cdbe84-01d4-4440-b6b3-ed68d4d6d200/result.json)：此次新建唯一目录，不覆盖原布局截图。
- `directory-tests.log`、`frontend-tests.log`、`build.log`保存实际命令输出。早期失败目录保留，不抹除失败：隐式label名称不稳定已加显式aria-label；503旧预览真实RED后清除；首轮运行时未重载元数据已重新启动本机独立环境；44px测试误用80px和闭合details未绘制子项测量问题修正了测试，不以此改已确认高级页面。

## 数据、文件和历史证据保全

最终只读核对：2机构/2团队/1研究者，19事实/17决定，原具名来源2行；相比前序16事实/14决定，本轮浏览器对合成团队只追加3事实/3决定，历史不删除。原两账号非科研扩展、非密码字段hash仍`11fa3cbaf43107e510abf21daeb78c36`，R01未改。T01/T02及tokens/shell SHA256与开工记录相同：

```
pages/t01/src/main.jsx 7776d32dc02b6412c15bc958d0f85fe70238abe0ae8a731cfd68f277aebeb6a8
pages/t02/src/main.jsx 7af21f59fe082201dd7616b560d9b3d0a39fa4ce3bb7c0d2a51dac11c37831d4
src/design-tokens.css 89a85bd55aaeee7f608d36a70c91b59130079d9f02b8f609b3c3ee3ed2009a60
src/platform-shell.js 36fabd692eacaf5ee27ff68eba7fa04b17f9a98c1ff62e7a1717001b9a8337d3
```

**证据重跑事故，明确留痕**：作者误运行旧`directory-final-state.mjs`（只读PG），其固定输出覆盖了11-03证据目录`final-state/result.json`，现在其中是11-04 02:45 UTC的重跑结果，不再是原始11-03 JSON。未修改用户数据或旧事实，原11-03文字报告和截图仍保留；未伪造旧JSON恢复。该旧脚本不作为今后最终验收入口，本轮后续状态核对改为只读内联查询且不写旧证据路径。

当前工作树含大量其他任务未提交内容，本轮不代为提交/回滚/整理；Notion同步只覆盖/追加本轮相关文档，不覆盖其他专项。

## 文档同步

产品、技术、计划、评审、测试已同步到Notion「项目研发文档→ResearchHub」对应目录，已有living spec/使用说明/基线/更新记录已追加本轮段落。成功回执和页面ID见[实施计划](../planning/team-maintenance-2026-11-04/implementation-plan.md#notion同步回执)。原评审Request changes及作者修补、用户专业体验待确认和旧证据重跑事故均保留，不用文档同步代替验收。
