# P04数据只读预检 · 核心验证

日期：2026-11-13。当前：**P04新增暂存/只读预检切片本机技术交接**；原两账号、本人新会话/具名文件，专用合成库。不是P05正式导入、全部数据Agent或生产验收。来源：已批准文件/数据规格、P01–P08计划与两表精确授权。

## 当前四层状态

| 层次 | 证据与实际范围 |
| --- | --- |
| 代码 | 原生预检/两表隔离/真实应用身份回滚/旧材料兼容/前端transport联合64/64；原会话/输入/材料UI23/23，私人资料与隔离OpenCode免费回归28/28；分组重叠不累加。 |
| 环境 | wp01_test_full_baseline已实际建两表，限定DML/FORCE RLS/CAS；本轮完整验收PID42580。随后其他获批会话重载至48382，本轮未抢占重启；`final-1794550053523/result.json`两账号仅GET/真实Chrome/刷新复查通过，零新增上传/预检/模型。无旧服务/云/发布；当前Study导入目标仍为空，角色未开data.upload。 |
| 真实执行 | owner/admin各CSV＋XLSX1份、每批7行/2异常；共4份暂存、最初2批取消＋再预检2批。成功响应丢失后GET原key恢复、刷新无POST、取消保文件、400坏签名/引用、数据问答409及管理员不能读owner均有实际HTTP/Chrome证据。 |
| 业务结果 | 保留0/false/null、未知单位、工作表/行/列与异常；暂不导入如实可见。原资料问答历史/引用/Token账本复查不变。专业用户签收、实际目标选择/正式导入及完整数据能力仍待P05–P08。 |

## 本轮证据

- 真实上传/恢复/取消：`.tmp/ai-file-data-2026-11-12/p04-browser-1794548481673/result.json`（passed）；最终新代码目标复查`final-1794549436807/result.json`，两账号均通过，pageerror/blocked=0，新增上传/模型=0。原脚本失败/视频保留，不重传已暂存文件；重复展示检查不是额外上传。
- READ ONLY最终对照：同目录`final-db.json`；当前范围Subject/Enrollment/Visit/Feature/ProcessingTask/Job均0→0，原两账号Token预留数量152→152；4个ready暂存文件、2个cancelled及2个previewed计划，target全SQL NULL。这里只证明本轮命名scope，不能声称其他并行模块全库零变化。
- 受控真实组件Chrome：`p04-ui-1794549435736/result.json`，8项；上传等会话核验、切身份/会话不闪旧值、失效/源改变不显示旧值、sheet列名、容量恢复新批及21份分页/固定批次。受控数据不冒充真实后端21份压力验收。
- 视觉最终：`p04-visual-1794549772918/result.json`，1440/1280/1024/768/390/320及Chrome设置200%（DPR2、visualViewport.scale1），14/22，移动新操作>=44px，无横向页面溢出；PNG/WebM与操作区截图均留存。原生200%操作区使用Chrome真实捕获，未以DPR模拟缩放。窄屏保留原“历史在上、对话在下”布局，向下滚动到对话、内部滚动查看预检，不擅改导航；这验证可达性，不将原窄屏长历史的操作成本称为已经优化。
- 旧真实资料/账本回归：`p03-real-approved-2026-11-13/history-1794549192261/result.json`，两账号原结果、固定来源、原Message/用量/单次尝试不变，新增模型0。
- 最后隔离构建：`p04-build-1794549773995.log`退出0、4.48秒，含最终局部样式/异常行提示；既有两个>500kB资源告警保留。较早`p04-build-1794549301005`4.37秒也保留，不覆盖其他构建产物。
- 重载前后7类活动/近期Job0；155历史queued及`5025831f77b0ff3bfa1b76b342752a4f69f598a843e4f996efbc3a2f01047c5c`保持。共享P2短窗口已登记入口稳定，42580后不再改入口/停止/重载19501。

## 一次独评与集中修补

0Critical/4Important/1Minor，独评只读，不运行模型/PG；作者分别测试先行核对后修补，没有让评审代理并行写实现。

| 发现 | 修补与验证 |
| --- | --- |
| 当前源409仍保留旧UI原值 | 任意读取/预检/取消失败均撤下旧plan；真实组件反例RED→GREEN，文件历史仍保留。 |
| 取消/失效、列表/回执直出未重验样本 | 列表/上传回执只元数据；取消/失效plan去原值；previewed交付重验原件。真实app回滚PG和目标HTTP通过。 |
| 6000＋6000行合批返回409锁住pending | 容量明确413、坏结构/签名400；确定拒绝清pending，新批次新key；原生两文件与组件反例RED→GREEN。 |
| 超20份清单丢nextCursor、重新预检猜前20 | 分页合并，固定plan.files重预检；21份受控组件有完整清单且提交原批引用。 |
| files:[null]误503、原签名错误误服务故障 | 先验元素再去重；native错误按类型转换400/413；PG/原生及真实HTTP400通过。 |

额外真实路径：所选会话核验完成前上传按钮提前可用，已补守门；plain admission错误原500改局部HttpException409，在Job/Token之前停止。初次回归一组因本机重载断连而失败，保留原输出；服务稳定后串行重跑23/23通过，未删测试或放宽断言。PG隔离夹具原先假设admin表全空，真实owner/admin上传后改为只查本轮owner fixture ID，仍验证RLS拒绝，不删真实合成记录。

## 历史核心阶段（下列未装配/待批仅指当时）

2026-11-13本轮增量：新两表FORCE RLS/本人父链/CAS、原材料表重入兼容；native预检＋服务真实应用身份回滚＋前端transport联合30/30。Chrome受控5项通过：所选会话加载前上传不可用、切会话/身份不闪现旧预检、失效预检不显示旧值、多sheet各自列名。真实目标浏览器已创建owner本轮新会话、CSV/XLSX各1及1批预检，并人为丢失成功响应后只查原回执恢复；后续页面/取消/双账号检查尚在执行。零模型/正式导入，不把受控UI当真实后端验收。

- 新`research-data-preflight.mjs`与native适配复用旧签名/SHA/容器检查、XLSX库及分类/triage；不实例化Ingest/RawProcessing、存储、模型或数据库客户端。
- 首8项：模块不存在RED→7/8，中文CSV缺省编码导致姓名列漏识别；独立小样对照确认UTF8解码后8/8，未改旧解析器。
- 一次只读独评4个P04 Important：不完整表头误提升数据行、错Study行污染重复集合、异常跨sheet积累、原分类误把假名编号当直接身份导致下一步矛盾。新增4反例RED→12/12；原分类保留诊断，当前有效身份判断与下一步一致。源行列及0/false/null不填补、不计算。
- 最新联合命令：`node --test server/ai-agent/private-material-output.test.mjs server/ai-agent/private-material-session.test.mjs server/ai-agent/private-material-selection.test.mjs server/ai-agent/private-materials.test.mjs server/ai-agent/research-data-preflight.test.mjs server/ai-agent/private-materials-pg.test.mjs`，40/40通过，包含真实应用身份回滚PG和2例隔离OpenCode受控响应；不累加前序重叠分组，不是新增真实付费模型。
- `node scripts/ai-material-p04-preflight-check.mjs`：原两账号，真实aisci_app身份、强制READ ONLY，原CSV和XLSX合成Buffer各1，零模型/算子/正式写。证据`.tmp/ai-file-data-2026-11-12/p04-readonly-1794532572259/result.json`，Subject/Enrollment/Visit/Feature/ProcessingTask/Job/Token预留计数前后相同；只证明本事务和范围，不声明并行其他任务全库静止。
- 实际权限：原两账号当前角色均无data.upload；原合成执行项目Study绑定0，不强行把它转换成产品Study。预检当前不能确认导入，未知单位保持未知；单/多Study选择规则只具名内部测试，不冒充目标页面已启用。

本片授权见[隔离暂存授权](../planning/qiyan-ai-file-data-2026-11-12/authorization-p04-staging.md)，已批准，不再作为等待项。正式数据导入权与Study关联仍留P05，不提前放开。
