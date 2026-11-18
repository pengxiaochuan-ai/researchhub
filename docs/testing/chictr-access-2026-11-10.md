# ChiCTR C01 · 后端访问核准记录（未通过）

日期：2026-11-10。用户已批准设计和六步实施计划，并要求继续后端实施。当前只推进C01，不把本记录当作连接器交付或专业验收。

## 用户交接决定：保持原白名单

用户已明确选择“保持原白名单，先交接诊断结果”。本轮不放行下述两项CDN脚本、不继续条件检索或详情请求，不重复申请相同放行。诊断结论仍为：隔离有窗口入口两次可读，无头对照405；完整检索/详情及Agent执行尚未证明，C01未通过、C02–C06不启动。先前“待确认”只作过程记录，现按用户选择停止此路径；以后恢复取数需新的明确任务边界。保留全部代码、失败轨迹与截图，不删除历史、不改现有服务或权限。

## 最新对照结论：显示窗口可读，检索依赖待核准

用户指出普通浏览器可访问，并要求沿正常浏览器/隔离浏览器对照继续。本轮使用故障定位流程区分观察和原因，不再把此前一次无头405推导为所有后台浏览器都不可用。以下状态覆盖下文上一轮的“只能转官方获取渠道”结论；C01仍未通过，但已有新的可行入口证据。

| 对照 | 真实观察 | 结论边界 |
| --- | --- | --- |
| 用户普通Chrome | 新诊断标签正常打开同一检索入口，原生AX/截图读到当天真实注册清单 | 不需要先登录即可查看首页；该浏览器DOM工具报错/点击无变化不能混同源站拒绝；未完成条件搜索 |
| 隔离无头Chrome，等待完整load | UTC07:34:07–09，主文档先返回405，随后仅错误页两张`errors.aliyun.com`图片被白名单拒绝 | 本次主文档失败不是错误图片被拦造成；等待load未解决，不是只因读取DCL过早 |
| 隔离有窗口Chrome，同源策略不变 | UTC07:36:02–04，`headless=false`，HTTP200、真实题名、31项控件；原站正常执行两次200导航，脚本自然运行，不手工写Cookie | 仅改变运行模式即可成功；是模式相关的对照证据，不冒称已知道WAF内部判定或证明所有环境均稳定 |
| 同模式再次读取表单 | UTC07:37:31–36，HTTP200，无HTML form，搜索为`div#handle-search`事件控件，读取到`#topic/#study/#interven`等输入；保存真实入口截图 | 主文档可重复读取，但不是完成条件搜索/详情，更不是Agent已接通 |

证据均在本计划workspace：`browser-load-comparison.json`、`browser-visible-comparison.json`、`browser-visible-form.json`、`visible-entry.png`。只记录URL的host/path/method/status和公开控件，不记录Cookie/响应凭据/个人联系方式。不以站点在两次读取间新增注册记录的数量变化推导检索结果；所见总数仅是当时无条件首页快照。

系统代理设置只读检查显示HTTP/HTTPS/SOCKS代理启用；Node没有相关代理环境变量。该事实提示两条传输配置不能直接等同，但**未测实际出口IP，也未更改代理**；不能断言IP封禁或代理是根因。Playwright显示/无头及代理配置背景参考[官方浏览器文档](https://playwright.dev/docs/browsers#headless-mode)和[网络文档](https://playwright.dev/docs/network#http-proxy)，不是以文档代替本机实际网络证据。

### 需新增确认的唯一取数前置：原站静态依赖

真实响应发起了两项原站脚本加载，但当前固定ChiCTR出站策略拒绝它们：

- `https://g.alicdn.com/frontend-lib/frontend-lib/2.3.74/antidom.js`
- `https://o.alicdn.com/frontend-lib/common-lib/jquery.min.js`

只发现页面真实请求，不臆测脚本内部作用；无原生form且搜索由脚本事件驱动，资源未齐备前不能证明检索按钮可工作。建议仅按精确HTTPS host/path、默认端口、GET、无userinfo/查询参数/跳转放行这两项，拒绝整个CDN域名或其他路径，保留其余同源策略、沙箱、临时会话和关闭纪律。用户确认前**不修改白名单或请求脚本，不执行条件搜索**。不复制用户Cookie、禁用webdriver、伪造UA、切代理或绕验证码。该确认是新增静态资源范围，不是重复批准浏览器运行或申请业务权限。

`withChictrBrowser`只新增`headless`诊断参数（默认true），以相同隔离规则比较真实运行模式；对应红测`true !== false`后最小修补通过。诊断专项6项、相关回归39项通过；项目套件295项中294通过、1失败：`tests/team-map-ui.test.mjs:9`城市参考点文案断言`html.includes('城市参考点')`，属于本轮未修改的团队地图组件/测试，不跨范围修补或隐瞒。构建exit0/4.03秒，原大包警告保留；完整日志`browser-visible-{red,green}.log`及`browser-comparison-{regression,project,build}.log`。未做新PG/Agent模型/业务UI全链验收；C02–C06仍未启动，保持无费用、业务写、角色、旧系统和云资源变化。

## 真实观察

| 路径 | 时间/结果 | 能证明什么 |
| --- | --- | --- |
| 正常IAB浏览器 | 当天检索首页DOM可读，含真实结果及showproj链接；后续展开表单调用超时45秒 | 首页可读；没有实际条件检索、详情或产品后端执行证据 |
| 本机Node原生fetch，普通GET，无凭据/自定义头/重试/重定向 | 北京时间13:36:34–13:36:35，HTTP200、text/html、17136字节，SHA256 `c0e2db23a81857d4bfc3e4221b91a85c05ee76da50a171f78213c5ff71ce8176` | 返回含写Cookie和重新加载逻辑的JS页，不是注册结果 |
| 新探针`node scripts/qiyan-chictr-probe.mjs --live` | 北京时间13:42:46，HTTP200、17136字节，SHA256 `a4ae2f0aa345e110ac2181c1e751d38b196d25a9b853e856978f7254f2e78370`；`classification=javascript-access-check`、`c01Passed=false`、exit3 | 可重复定位当前后端直读障碍；不证明正常浏览器不可用，也不能将校验页记为0条 |

第二次请求的实际UTC时间、指纹及分类留在`.superpowers/sdd/2026-11-10-chictr-agent/entry-live.json`，不保留/上传校验Cookie或脚本正文。没有运行原站返回的脚本、计算或仿造Cookie、轮换代理、导出用户浏览器Cookie，亦未尝试未核准API或枚举ID。

本轮未取得经核实的正式API或明确允许的自动获取条款；搜索索引里出现其他研究中的“爬虫/API”不能当作ChiCTR对本项目的获取依据。不能从技术校验推导“全部自动读取被禁止”，也不能把普通浏览器可读推导为后台采集许可。

## 已实现的最小后端准备

只新增独立只读入口探针和测试，**未写C02客户端/解析器、C03路由或C04会话接线**。探针固定唯一官方入口、15秒超时、8MiB流式上限、无重试/无跳转；只输出状态、指纹、字节数和分类，不返回原文、Cookie、响应头凭据或异常中的敏感信息。普通调用没有`--live`则exit2，不联网；即便入口是普通HTML也只标`unverified-html`，不会凭入口宣称搜索/详情门槛已通过。

测试先行：首6项在实现前全部明确失败（函数缺失/CLI未实现），实现后通过；最终补齐错误脱敏和非HTML关闭，共8项。`probe-red.log`保留初次失败，`probe-green.log`为首6项绿色，最终8项包含在下述回归中。两个新增边界测试是既有行为补验，不冒称也经过独立RED。

## 本轮验证与未测范围

- 相关回归：`node --test tests/chictr-probe.test.mjs tests/literature-source-links.test.mjs server/ai-agent/skill-routing.test.mjs server/ai-agent/session-skill-routing.test.mjs server/ai-agent/literature-query.test.mjs server/ai-agent/literature-retrieval.test.mjs server/ai-agent/literature-session.test.mjs`：33/33，0失败/跳过。
- 项目`tests/`套件：`node --test tests/*.test.mjs`：285/285，0失败/跳过。与上项有重叠，不将二者相加成唯一测试数；不是全部后端/数据库测试。
- `pnpm build`：exit0，3.98秒；既有大于500kB包警告仍在，不扩范围重构。`node --check scripts/qiyan-chictr-probe.mjs`、`git diff --check`通过。
- 日志均在本计划私有workspace：`c01-regression.log`、`project-tests.log`、`c01-build.log`。
- 无新模型请求、费用、业务对象、数据库/权限/旧账本修改，未改页面布局或旧服务。没有运行真实PG测试，因为当前没有DB接线或授权变更；没有完成新Agent业务界面/录屏验收，不用旧首页DOM冒充。
- 一次独立代码总评审留在C06；此前只有设计builder check。探针准备完成不等于C01门槛通过。

## 隔离浏览器调整与实际验证

### 后续批准：本机隔离浏览器验证

用户随后回复“批准”，允许本机、仅ChiCTR、按需启动且结束销毁的隔离浏览器读取验证。先使用本机已安装Playwright与Chrome，不下载新依赖、不修改旧项目；全新非持久化上下文，无用户存储状态/登录态、无代理/指纹伪装、无验证码绕过，仅允许固定官方HTTPS域名的页面资源。验证通过才继续原C01核准和C02后端接线；出现访问限制如实停止。下文“待确认”保留为此前提出调整的历史，不再重复索要该项批准。

### 真实执行：源站返回405，停止后续读取

新增本机诊断脚本`scripts/qiyan-chictr-browser-probe.mjs`，复用已安装Playwright 1.63.0与Chrome。`withChictrBrowser`启用浏览器沙箱，创建非持久上下文；不传入storageState、不读Cookie/凭据，禁Service Worker/下载/WebSocket；页面请求仅允许`https://www.chictr.org.cn`默认端口GET及检索表单路径POST。这是页面请求层约束，不冒称操作系统级网络隔离或正式部署方案。完成/异常/取消均关闭上下文及浏览器。依赖路径仅供本机诊断，不装配到产品、不修改旧项目；正式运行依赖须在可用路径核准后独立管理。

首轮执行因已安装Playwright仅通过default导出Chromium而在导入绑定处失败，未启动浏览器/发站点请求；已定位并补红→绿测试修正。随后真实运行开始UTC `2026-11-10T05:59:31.962Z`，结束`05:59:33.420Z`（北京时间13:59:31–33）。最终URL仍为官方检索入口，HTTP **405**、title为`405`、表单控件为空；原站明确显示“您的访问被阻断”，没有获得条件搜索或详情。返回结果前finally关闭已完成，未保留站点登录态或启动常驻服务。

实测原始脱敏结果保留`browser-entry-live-2.json`；当时分类器遗漏中文阻断提示，输出了`unverified-browser-html`，但`status=405`/`c01Passed=false`始终保留，未当作成功。已补红→绿测试，将405/403/401/429及验证码/阻断提示统一归为`access-restricted`；对原结果离线重分类记录为`browser-entry-assessed.json`，**没有为修正标签再访问网站**。此前导入失败记录`browser-entry-live.json`同样保留，不伪装成功或删除失败。

本轮5项浏览器诊断测试、38项相关回归均通过；项目`tests/*.test.mjs`共293项通过（与相关回归重叠，当前工作区含其他任务测试），构建exit0/3.84秒，既有大包警告保留。3项初始RED见`browser-red.log`，导入绑定和405分类分别有独立RED→GREEN日志；最终`browser-regression.log`、`browser-project-tests.log`、`browser-build.log`留在本计划workspace。没有业务UI变化、截图/录屏或真实Agent端到端成功验收，不用测试数代替能力交付。

公开规则补核：当天可读取[官方注册指南](https://www.chictr.org.cn/guide.html)，其中提醒爬虫搜集研究者信息及网站负载风险；未提供本次可核实的自动检索API授权。只据此排除联系方式、保持有界访问，不把提醒扩大解释为全部自动读取禁止。浏览器生命周期参考[Playwright Browser](https://playwright.dev/docs/api/class-browser#browser-new-context)与[BrowserContext](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)官方文档。

**当前停止点：C01仍未通过，C02–C06未开始。** 已批准的浏览器验证实际执行完毕但不可用，不再要求重复批准同一方案；不尝试改UA、代理、指纹、校验Cookie或验证码规避。后续先核准官方API/获准访问渠道；未取得可用路径不启用Agent、不拿离线旧快照冒充实时能力。无新增依赖安装、模型调用、数据库/权限/计费/旧服务/云资源或发布变更。独立代码总评审仍留在实际实施完毕的C06。

### 此前调整提议（历史）

按已批准计划，C01必须取得真实条件搜索＋有效详情＋产品后端可执行方式；当前未满足，C02–C06不得继续伪装完成。

建议先批准一个**仅本机、仅ChiCTR、按需启动并在结束销毁的隔离浏览器读取验证**：正常执行站点页面，不复制用户登录态、不手工求解/仿造校验、不绕验证码或访问控制；只送公开主题，保留原单次范围和串行限速，无常驻服务、云资源、付费检索商或发布。若能合法取得条件搜索和详情，再将该最小传输方案写入核准协议并接现有Agent；若仍受限则停止，改走官方获取渠道，不借实现绕过。

该调整会增加产品后端的浏览器依赖、进程生命周期/网络隔离和资源占用，不是Codex浏览器直接给产品代跑，亦不是已批准设计中的纯HTTP后端读取已经成功。正式部署需要另验浏览器运行环境，本轮不处理。用户确认前不安装/启动产品浏览器、不修改现有运行时或工具授权。
