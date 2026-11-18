# 团队维护精简与省市选择 · 本机技术交接

日期：2026-11-04（北京时间）。用户批准八项方案，第8项限定当前团队维护页；仅专用合成库wp01_test_full_baseline、原admin/owner，不触碰临床库/旧服务，不付费、不访问远端配置/云、不真实发布。

## 交付与四层证据

1. **代码实现**：数据治理选中态、面包屑、移除当前叶子提示/返回/总览操作、短搜索、状态分列团队列表、机构下拉/新增条件输入、共用省市组件/API/PG字典、旧文字无损、草稿/预览/高级append代码校验。独立评审1 Important已由作者RED→GREEN修补，不冒称独立二次批准。
2. **本机启用**：七个独立服务ready；原目录三表/team-draft与新reference v2均existing。民政部2024官方原件3213行、34省，固定SHA/版本；应用只有字典SELECT、无表或列写权限。原v1收据仍保留，v2只追加完整ACL检查收据，无新授权或重导。
3. **真实执行**：原管理员在IAB完成列表→合成团队→河北/石家庄→保存→刷新恢复→预览；原Playwright/实际Chrome补充8组API/交互/错误/视口/200%/切身份，留PNG/WebM。不是仅Mock或单元测试。
4. **用户结果**：主实施已目视核对最新桌面与320列表、省市、操作及原生200%截图，可读不裁切；仍由用户体验确认。真实项目团队未批准、未编造负责人/成员，不代表真实资料或生产验收。

入口：http://127.0.0.1:19501/pages/g02/?view=directory-review 。省市数据明确2024版本，不称2026最新；组件只在当前页接入，不自动改变其他页面。

## 实际测试结果

| 检查 | 结果 |
| --- | --- |
| node --test --test-concurrency=1 server/directory/*.test.mjs server/reference/*.test.mjs | 50/50通过；真实PG回滚/只读，含旧目录授权/原子性、新父子/名称/版本、advanced bypass拒绝、列级ACL纯负例 |
| node --test --test-concurrency=1 tests/*.test.mjs | 最终212/212通过，含客户端/SSR/JSONB键序无假dirty；不与其他组合测试重复计总数 |
| pnpm run build | 通过；既有WikiEditor/china >500kB警告保留，不扩成全局打包改造 |
| node scripts/team-refinement-browser.mjs | 最终8组通过，见下方唯一新目录；0付费、0新审核决定 |
| node scripts/directory-layout.mjs | 4组通过：T01/T02五视口、窄屏焦点/详情Tab/返回、原生200%、地图实际滚动锚点 |

Chrome8组包括：匿名字典401/owner字典200而管理403；未知/重复/非省父码400；机构下拉只读/新增输入；港澳省级/河南济源/河北石家庄/北京真实代码与换省清市；保存刷新；UI-only503失败重试保输入；真实并发PG409→版本对照→手动保存；1440/1366/1920/390/320；原生Chrome200%（独立临时profile，DPR2/visualViewport.scale1，非CSS transform）；G02总览/来源审核原提示/返回未变；真实另一页退出/owner登录后迟到旧admin200不回填。

原生select采用14px、至少44px高，Chrome计算行高normal；普通文字/按钮/输入14/22。IAB viewport能力一次返回的实际CSS宽477/DPR0.67，不把该截图冒充320验收，已恢复其视口；严格五CSS宽及200%以Chrome真实metrics为准。错误503是明确UI故障注入，不冒称PG503；409为实际并发提交，迟到旧200为真实服务响应。

## 证据及失败留痕

根目录：[本轮证据](evidence/team-maintenance-layout-review-2026-11-04/)。

- 最新完整8组：[result.json](evidence/team-maintenance-layout-review-2026-11-04/browser-f8b8f74d-1ca3-48d5-a2e1-8067a23710c7/result.json)；同目录list-1440/list-320/province-320/actions-320/native200等PNG和video/zoom-video WebM。
- IAB本轮前后：01-current-top、02-current-form-bottom、03-refined-list-desktop、04-refined-province-preview，根目录下；前两张是修改前。
- T01/T02：[新建回归目录](evidence/research-identity-directory-implementation-2026-11-03/t01-layout-26a639e9-3e62-4e88-8892-a6847b5b801a/result.json)，未覆盖旧截图或旧final-state。
- backend-tests.log/frontend-tests.log/build.log为实际最终输出。browser-302e111f失败为原生select行高断言；browser-f6fa1e91失败为窄屏空操作容器真实RED；browser-f91ac482为修补前一次8组通过，均保留，不以早期成功覆盖最新验证。

## 保全与限制

T01 SHA仍7776d32dc02b6412c15bc958d0f85fe70238abe0ae8a731cfd68f277aebeb6a8；T02仍7af21f59fe082201dd7616b560d9b3d0a39fa4ce3bb7c0d2a51dac11c37831d4；R01仍c9b323d6434d2f36293dce70611ad069fc0ec8ad21488a5be364d8e3e4b21f18；design-tokens仍89a85bd55aaeee7f608d36a70c91b59130079d9f02b8f609b3c3ee3ed2009a60。Shell只按已批准范围改G02当前叶子，不宣称全文件未改。

合成团队仅追加私有草稿/审计及回执，不批准、不删除历史；脚本多轮失败/重跑不回滚历史版本或账本。旧目录5主体、19事实、17决定不变，原两账号非密码/非科研扩展字段hash仍11fa3cbaf43107e510abf21daeb78c36。真实团队候选草稿未改。共用字典不存临床/身份资料。

新增表/列引用的真实部署迁移仍需单独确认；本轮不增加角色/Study权限、费用、模型调用或第三方地图服务。其他dirty改动保留，不提交/重置。技术契约及操作文档已更新；Notion同步回执在实施计划登记。

文档同步成功：ResearchHub产品/技术/规划/测试对应目录已建立本轮页，原living spec和操作说明已追加增量，均无warnings。新测试页40e56479ab588189ac47d4f5c34d29e6，完整回执见[计划](../planning/team-maintenance-refinement-2026-11-04/implementation-plan.md#notion成功回执)。用户IAB视口已恢复，最终当前身份仍为原合成管理员，停留团队列表，可直接体验。
