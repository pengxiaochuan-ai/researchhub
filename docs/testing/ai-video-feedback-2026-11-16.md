# 视频上传文件名与旧处理链核查 · 本机验证

2026-11-16。当前范围仅为上传期间显示文件名，以及核实旧Data Agent的视频处理链。保留原页面布局、上传/续传及权限规则；不恢复退役检测，不新增被试写入、模型调用或云资源。[实施范围与旧链复用](../technical/ai-video-feedback-2026-11-16.md)。

## 结果及四层边界

| 层次 | 证据与限制 |
| --- | --- |
| 代码 | 当前File.name仅进入绑定目标sessionId的React内存状态，原状态行显示；React转义、长名换行、14/22，不加入数据库、sessionStorage、日志或模型输入 |
| 目标启用 | 本机19501沿原Vite加载新UI，无需重载；本轮最终验证不要求装配新后端。独立19613用于组件回归 |
| 真实执行 | owner/admin真实登录、本人已具名合成会话/媒体读取；上传初始化在浏览器拦截并等待，观察完整文件名后受控返回503，验证清除及错误恢复。该503不是后端真实故障，0媒体写请求转发、0新原件、0模型请求 |
| 用户可用性 | 1440实际工作区双角色截图/录屏，组件390长名自然换行与HTML样式字符纯文本；真实原视频上传、内容解析及用户专业签收不由本次UI验证替代 |

## 回归及独评

- 新浏览器契约先RED：旧代码没有文件名元素；最初GREEN后，独评发现首次懒创建会话可能清名。补延迟null→created-session的真实组件RED，修补为名称绑定目标会话、仅真切篇清理，最终该场景GREEN。
- 新5项（含父用例）与原41项浏览器回归全部通过，覆盖完成清除、同身份核验暂停/恢复、切账号/切篇迟到结果、懒创建、断点续传、原操作恢复、历史加载及Excel选文件焦点核验。
- 750项现行纯测试与5.92秒隔离构建通过；未修改API/DB/服务端，未为UI补名运行会写历史夹具的旧队列测试，也不重复原件入库。
- 独立只读评审：初次1项P2已复现并关闭，复核未发现新增P1/P2；未把静态核查等同于旧系统真实内容理解执行。

## 旧Data Agent核查结论

`app/server/src/sessions/upload-interaction.ts`提供课题/被试/访视绑定；`IngestService.ingestRaw/ingestStoredRaw`负责原件归档和被试关联；`RawProcessingService.processMediaTriage`产容器、时长、音视频流和异常结果及下一步，状态`needs_review`。结果明确`triage_only`、`featuresGenerated=false`、`rawBytesSentToModel=false`。`model-data-boundary.ts`及`skill-visibility-policy.ts`亦不把归档当内容理解，不允许退役VideoAnnotator路径被旧装备重新激活。

Hub现已复用归档、真实SHA/ffprobe检查、状态和私有播放；尚未自动走被试关联或生成转写、画面摘要。受查现行代码未发现可直接执行的ASR/视频理解器，不据此否定用户曾使用过的历史能力。后续优先补清楚的处理结果回执，再按已确认规则一次确认课题/被试关联；真正内容理解须明确有效执行器与时间来源，不能从文件名或时长生成伪解析。

## 证据与复验

私有目录`.tmp/ai-video-feedback-2026-11-16/`：`red-name.log`、`red-lazy-name.log`、`name-green-final.log`、`browser-final.log`、`pure-final.log`、`build-final.log`；`browser-*/`包含组件PNG/WebM，`live/result.json`及双角色PNG/WebM包含目标页面验证。`scripts/ai-video-filename-live.mjs --synthetic-staging --filename-only`强制已有合成原件checkpoint、同源请求、拦截上传和阻止其他业务写入，避免验证文件名时再建原件。

用户刷新岐研AI后沿原“上传文件”选择视频，核对原状态行的当前文件名与进度；回到原会话继续上传时重新选择原件后显示当前选定名。原件归档后仍以假名媒体记录呈现，不承诺刷新后恢复原始姓名文件名；“文件检查通过”也不代表内容理解完成。
