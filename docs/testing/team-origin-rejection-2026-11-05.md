# 团队保存来源校验：验收故障修补

## 当前任务与边界

用户在真实Chrome验收团队维护页时保存返回403 `DIRECTORY_ORIGIN_REJECTED`，要求继续代码修复。仅修补当前本机提交链路，不改变页面、业务权限、审核、真实团队资料或其他模块来源校验；不修改浏览器扩展设置。只使用原专用合成环境，0模型调用、0新费用。

## 已观察事实

- 真实页面为 `http://127.0.0.1:19501/pages/g02/?view=directory-review`。
- 失败POST的开发者工具显示 `Origin: http://127.0.0.1`，JSON类型正常，Referer含正确19501端口，Fetch Metadata为same-origin/cors。
- 原服务端只接受完整19501 Origin，因此确定返回403。尚未证明端口由哪个环节改写，不认定某个扩展是原因。
- 原表单输入仍在。不得通过扩大Origin白名单或伪造代理请求头解决。

## 小步计划

1. 用不可能保存的空JSON请求，在实际Chrome会话对比cors与same-origin请求模式；仅对合成团队，保留真实表单。
2. 根据实际结果补RED测试；实施最小修补，不改变角色、原子提交、版本防重或未知回执恢复。
3. 跑单元、真实本机API/合成PG及浏览器保存/重读/失败恢复，保存脱敏证据和截图。
4. 一次独立总评审，同步产品、API、使用说明和结果文档；未验证前不标完成。

## 最小代码方案（实施前记录）

实际Chrome重新登录原admin后，空JSON的cors和same-origin两种请求均真实403；单改请求模式不足。实施仅团队写入的等价浏览器来源证明：

- 三个团队创建/保存/审核路由显式启用此分支，其他调用默认仍用原Origin校验。
- 原完整19501 Origin路径保留。仅对实际观察到的 `http://127.0.0.1` 无端口值，要求Fetch Metadata的site与mode均为same-origin、dest为empty、Referer解析后精确为19501来源、专用 `X-ResearchHub-Request: team-workspace-v1`，同时通过原JSON/Host/loopback/转发头/大小检查。
- 前端目录请求显式mode=same-origin；只有三类团队POST携带专用头。不修改CORS、不伪造Origin、不自动重发失败请求。
- Fetch Metadata是浏览器提供的来源证明，不把专用字符串当身份凭证。[W3C](https://www.w3.org/TR/fetch-metadata/)与[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)为依据。所有业务授权仍在原服务端执行。

## 实施结果与四层证据

1. **代码**：仅`src/directory-session.js`和`server/directory/controller.mjs`产品代码改变。上述三路由显式启用证明，其余消费者默认原校验；无JSX/CSS/页面布局/角色/数据库结构/旧源码/CORS变更。原未知结果不自动重试、CAS、审核、当前DB身份检查保持。
2. **本机启用**：只重启owned独立体验进程13789→66617，七个19501–19507服务就绪，原runtime租户/密码/签名配置保留。不接临床库，不触碰旧服务，不是真实发布。
3. **真实执行**：用户原Chrome配置未改扩展。新实际客户端对空JSON从403转为预期400；另开同浏览器G02，仅合成团队追加说明标记，真实保存成功，API读回version38/2026-11-05T07:01:54.428Z；原生刷新后重选仍读到该标记。之后原UI保存恢复原说明（version39），不回写历史、不新增审核决定。
4. **业务边界**：团队草稿保存及刷新恢复技术验证通过；未替用户保存、审核或公开真实团队，正式专业验收仍由用户完成。原真实团队DB草稿保持2026-11-04版本；为加载新脚本，先保留其未提交字段，刷新后逐项恢复原简介/方向/机构/北京省市，停在未保存表单。

## 测试与证据

- RED：7项针对测试初次4失败，分别抓到旧服务拒绝完整浏览器证明、前端缺mode/专用头和大小校验前被误拒。旧运行进程实际HTTP也403，见[原运行RED](evidence/team-origin-rejection-2026-11-05/http-5bd06709-5d43-4f2c-9684-a6c7544c161c/failure.json)。
- GREEN：221前端测试、52后端/真实合成PG测试均通过；构建通过。前端组合测试有既有Vite WebSocket端口占用警告；构建保留WikiEditor/china超500kB提示，不称零警告。
- [真实HTTP 22组](evidence/team-origin-rejection-2026-11-05/http-cbf247af-226a-4816-b0af-ec08db4352a4/result.json)：三个路由到达字段校验、缺少证明/跨站/同站不同端口/非JSON/转发头拒绝、旧非团队路径仍403、原完整Origin保持、owner403/匿名401；均无业务写入。
- 首轮新HTTP探针使用Node fetch，其Request.mode覆写手填Sec-Fetch-Mode导致测试自身403。保留[探针失败](evidence/team-origin-rejection-2026-11-05/http-36a9e49b-f9af-4a37-9fe7-dafc4ee1b45a/failure.json)，改用原生HTTP准确发送各反例头后通过，不把它记成第二产品故障。
- [11组Chrome端到端](evidence/team-maintenance-usability-2026-11-05/browser-69b57605-2bb6-4240-b484-6ba693e72d3d/result.json)：`node scripts/team-usability-browser.mjs --port-stripped-origin`，合成团队的实际POST去端口、合成PG保存/回读、409恢复、原key、五视口/原生200%、owner拒绝及原真实团队/公开投影保全；PNG/WebM同目录。原origin403与在途review503项仍明确为UI故障注入，不冒充真实拒绝；真实拒绝另由HTTP22组覆盖。
- [实际用户Chrome保存成功截图](evidence/team-origin-rejection-2026-11-05/chrome-real-save.png)。真实用户浏览器扩展自身的runtime.lastError不属于应用代码，不称该浏览器全局console零错误。
- [原表单逐项保全](evidence/team-origin-rejection-2026-11-05/user-form-preserved.json)：新脚本下原名称/简介/方向/机构/省市/说明均已恢复，仍为未提交修改；不是另存入库。最终回读合成version39已恢复，真实团队version1/2026-11-04T02:26:04.736Z不变。

## 唯一独立只读总评审

`/root/team_origin_fix_review`：0 Critical / 0 Important / 0 Minor；独立执行controller及team-workspace-session共7项通过。评审确认在标准浏览器禁止伪造Sec-Fetch-*、same-origin模式禁止跨源目标且Referer精确匹配前提下，未发现可利用的跨站/同站不同端口CSRF绕过；专用头不是身份凭证，原当前DB身份授权保持。评审当时明确运行启用及用户Chrome仍待主代理验证，以上后续证据由作者补齐，不冒称评审者进行了浏览器验收。

## 限制

只兼容此本机已观察到的端口丢失组合，未知Origin/null/缺失来源与证明不齐仍403。未证明具体哪个扩展或浏览器环节改写了Origin，不修改/停用用户扩展，不以此修补概括生产CSRF方案。

## 文档同步

本报告与产品现行规格、产品基线、变更记录、版本记录、使用说明、API及索引均已同步Notion，无警告。[本报告Notion页](https://app.notion.com/p/40f56479ab588166b6aceb589b0b335f)。本轮无云资源/远端配置访问/付费模型/旧服务改动或真实发布。
