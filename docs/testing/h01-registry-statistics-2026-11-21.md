# H01临床注册统计 · 验证记录

2026-11-21。年度/疾病/研究设计/干预与来源回看，已按本轮授权完成共享重载、真实HTTP与页面四页签验收，详细结果见文末“共享窗口与真实HTTP验收完成”。仅现有19501/19502与原合成本机数据库，无新常驻环境、生产发布、DDL或模型调用。下列前轮暂不重启及回放验证保留为历史过程。

## 前轮代码与回放阶段验收（历史）

| 层次 | 当前证据 | 结论 |
| --- | --- | --- |
| 代码 | 统一server/hub/controller overview同事务增加统计；同一当前public投影供页面；11项统计/审核门/界面/指标测试通过，构建通过 | 已实现 |
| 日常环境装配 | 19502仍为原PID，未重启；真实HTTP仍不含registrationStatistics | 按用户指令待窗口 |
| 真实执行 | 新控制器在同一实际本机数据库、应用角色READ ONLY事务执行；核DB名/marker/角色/no bypass，现两项源及统计一致、Cache-Control no-store | 已验证只读服务函数，不等于运行进程HTTP新接口已启用 |
| 用户结果 | Chrome回放新控制器真实PG返回至overview，访客/管理员四维切换、来源/错误/空态/响应式及200%通过；C03详情未Mock并真实可读 | 组件集成通过；新HTTP整链及用户签收待窗口，不宣称上线 |

## 真实数据与来源

仅本Hub当前获准公开收录，现有初始来源集合不扩大。去重后2项：2023年2项、累计2；抑郁症1项、轻度认知障碍1项；原研究设计“随机平行对照”2项；各组干预原文6类各1项（含对照组，一研究可计多个）。不把轻度认知障碍自动归成抑郁，不将干预都改成针灸，不据本机两份记录推断全国。

年度不使用原站更新时间、文件保存日期或入库日期。所有分类原文精确分组；未审/撤回/过期/哈希失配的结构化分类不交付。重复注册号精确同快照只计一次，冲突列missing，不任意取旧值；缺失数量保留。前端“目录审核版本”明确是目录决定，并非结构化详情批准版本；详情重新核权/来源。

## 免费检查

- `node --test server/hub/registry-statistics.test.mjs server/hub/metrics.test.mjs tests/h01-registry-statistics-ui.test.mjs`：11/11，通过日期、去重/冲突、public范围、未审分类门、缺失、多干预/对照原文和UI不同状态；其中原生投影query使用模拟行，明确非PG业务验收。
- 本机`.tmp/h01-registry-statistics-20261121/read-pg.mjs`：新控制器真实READ ONLY绑定事务通过，结果`pg-result.json`；先验证具名wp01_test_full_baseline及marker/非bypass应用角色，无业务写。
- `pnpm build --outDir .tmp/h01-registry-statistics-build`：通过；保留既有大chunk提示。构建日志本机`final-build.log`，不替代运行期结果。
- 独立只读审查无P0/P1；提醒“审核版本”指代不准已改为“目录审核版本”。

## 浏览器证据与边界

脚本`scripts/h01-registry-statistics-browser.mjs`从只读新控制器结果回放overview；**新HTTP controller未加载**。其余详情/登录真实现有接口，访客及管理员读取同一公开统计，不扩大成员权限。

- [四维、来源、宽度与失败恢复](evidence/h01-registry-statistics-2026-11-21/d78efed6-02af-4d85-9557-04c20213bf18/result.json)：访客/管理员，2023年两来源，三分类各自正确记录，C03真实页面回看，1440/1024/720/390卡片无横向越界，切换未改变原卡片高度。PNG/WebM同目录，pageerror0。
- [原生200%、键盘及空态](evidence/h01-registry-statistics-2026-11-21/6a84c518-f9a1-4968-8a9b-aa3806537abe/result.json)：Chrome设置真实200%，DPR2/scale1；四页签Arrow/Home操作，来源访问、模拟503重试和零来源空态通过；pageerror0。
- 不拦截overview的实页已观察“注册统计暂不可用”，反映当前旧HTTP载荷缺新字段；这是用户要求不重启后的准确状态，不能用前端回放截图宣称共享入口已启用。

## 原失败保留

开始只读连接检查发现环境模板URL默认指向其他库，在任何连接前被断言阻止；随后仅将URL数据库名固定到明确target的wp01_test_full_baseline，核marker/应用角色后才执行READ ONLY查询，未连接其他业务库。

早期浏览器尝试对现有overview读取遇间歇500；后续只读HTTP再验为200，不重启、不修其他模块，也不称故障已解决。改为回放独立执行的新控制器真实READ ONLY结果，标记kind，不掩盖live未启用。一次测试依赖未解析在浏览器/DB请求前停止，改用既有测试Playwright路径，无新增依赖。

子任务误将旧external-visible.test.mjs与pure测试一起启动，5例在reviewer前置验证失败；未进入修改审核流程且事务回滚。该失败不计本轮通过、不修旧权限；新统计原生投影守门以本轮mock-query用例及READ ONLY集成分别记录。

## 前轮下一运行窗口（历史，已执行）

获得共享重启窗口后，在原进程装配同一代码并核HTTP registrationStatistics、真实页面四维及来源、失败/撤回不再交付。不得为验收重批现有资料或伪造覆盖年份；源审核负例可继续采用事务回滚测试，保存用户反馈。本轮用户步骤集中在[统一手册](../product/用户验证与操作手册.md)。

## 共享窗口与真实HTTP验收完成（2026-11-21）

本轮用户明确要求安排共享重载，覆盖前轮暂不重启限制。另一条researchhub聊天确认无本机在途任务、窗口可用，完成后已通知释放。只操作原19501/19502及其owned必要依赖，不改生产/旧服务。

- 原位82505→19313加载统计；首次live访客桌面完整通过，但管理员刷新500，原失败[10b331e1](evidence/h01-registry-statistics-live-2026-11-21/10b331e1-de12-4e8b-bc36-978e3b09ba9d/result.json)保留。PG日志确认55P03、H01显式2秒tenant shared锁等待；同服务原生核源事务持锁2–3秒。不取消授权锁或改P01。
- 仅H01等待2秒改8秒，保持statement10秒/transaction20秒；第二次原位19313→22697加载。真实READ ONLY同tenant3秒锁：修前HTTP500/2294ms，修后200/7207ms（含冷启动）；9秒锁仍8092ms明确500、不返回统计，结束释放，无无限等待/旧结果回退。独立只读复核通过，不能称消除所有长争用。
- [修后桌面管理员/科研人员](evidence/h01-registry-statistics-live-2026-11-21/d02f8424-aa32-41bf-ac84-ce800e2aeaf9/result.json)：真实HTTP200/no-store、同一public统计、每组label/count/source href与当前原始获审字段独立核对，两个C03真实GET/页面、返回刷新、四宽均通过。仅管理员隔离注入一次503，取消后真实HTTP重试200，成功数据不Mock。
- [修后三角色原生200%](evidence/h01-registry-statistics-live-2026-11-21/fbd6d1db-0e38-444d-a919-5ff4ee019f34/result.json)：访客/admin/owner真Chrome缩放、DPR2/scale1/CSS宽720、卡片672px，四页签、每个来源、详情/返回/刷新与键盘均通过；pageerror0、blocked业务写0、模型0。
- [统一验收索引](evidence/h01-registry-statistics-live-2026-11-21/verification-index.json)保留首次失败和续验。主代理另以无回放访客复验修后年度两来源/疾病展示，真实HTTP200，截图位于下列本机证据目录的root-live-year.png/root-live-disease.png。
- 重载前后账号key/ids/password/secret摘要一致；625问答/32导入/103处理/749方法状态指纹、ai-budget SHA均相同。10条running方法记录为10月/11月18历史，无实际方法服务活动连接，原样保留、不恢复不清理。没有生成新业务数据、修改源审批/角色或调用模型。

本机证据目录`.tmp/h01-registry-statistics-live-20261121/`：`preservation-receipt.json`、`first-reload-before/after.json`、`before/after.json`、`contention-500.json`（原3秒红）、`contention-200-3sec.json`、`contention-500-9sec.json`、`http-live.json`、`root-visitor.json`、`root-live-year.png`、`root-live-disease.png`、`final-preservation.log`。私密配置和凭据不上传Notion。前置脚本曾把Date对象与JSON字符串比较产生误报；stop已在已确认窗口执行，start前规范化复核任务/日期完全相同，原日志保留，没有忽略真实状态变化。

最终11项相关回归与构建通过（原大chunk提示保留）。当前四层结论更新为：代码已实现→原本机入口已加载→真实HTTP已执行→本机三角色业务流程通过。生产发布未执行，客户专业内容/范围确认与用户反馈仍单独记录。前文回放和待窗口记录是前轮历史，不作为本轮成功证据，也不删除原失败。
