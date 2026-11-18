# 视频上传文件名与处理反馈 · 当前小步

2026-11-16。当前请求：上传期间显示正在上传的文件名；核对旧数据Agent上传后的实际处理，明确Hub后续可复用路径。继续当前目录串行实施，仅专用合成环境，不访问用户原视频字节，不重启旧服务或新增模型调用。

状态：文件名小步已实施，46浏览器/750纯测、5.92秒构建、双角色真实页面鉴权与受控上传验证通过；独评1项懒创建清名P2已用RED/GREEN关闭，复核无新增P1/P2。旧处理链为代码核查，不冒称新增内容理解已执行。[本轮验证](../testing/ai-video-feedback-2026-11-16.md)。

## 本片直接实施

原上传状态行显示当前选择的完整文件名＋核对/传输/归档状态。只使用本次File.name的内存状态，不保存本机路径、原名到数据库、sessionStorage或日志，不发给模型。长名称自然换行、React转义，14/22字号；切账号/真实切会话或结束上传清除，同身份暂时核验保留；首次无会话→本次懒创建保留，名称绑定目标sessionId，其他会话不得导出。恢复上传重新选文件后显示当前所选名；不改Shell、按钮、权限、接口或持久媒体元数据规则。

## 已核实的旧系统处理

| 阶段 | 当前代码事实 | Hub现状/可复用点 |
| --- | --- | --- |
| 选择课题、被试、访视 | app/server/src/sessions/upload-interaction.ts生成绑定表单，已有上下文可默认；新被试只用假名ID | 当前视频仅本人会话归档，尚未写入被试库；入库前沿已确认规则一次确认真实课题/被试关联 |
| 原件归档 | IngestService.ingestRaw/ingestStoredRaw落ModalityFile及原始状态 | Hub已复用私有存储/分片/完整SHA；不能用再次上传来冒充进一步处理 |
| 后台处理与回执 | RawProcessingService.processMediaTriage检查容器、时长、音视频流、异常，记录processingTask/result/processingStatus及执行日志 | Hub已有真实文件检查和状态，但没有完整的数据Agent处理回执/课题被试关联；可复用确定性检查、告警及下一步规则 |
| 内容/科学特征 | 当前结果明确triage_only、featuresGenerated=false、rawBytesSentToModel=false；model-data-boundary亦明确音视频仅归档 | 不是已经执行语音转写、画面理解或抑郁指标提取。历史VideoAnnotator已退役，不恢复隐式调用 |

核查重点：raw-processing.service.ts的709–811行、mediaInspectionNextAction；ingest.service.ts原始入库及会话绑定分支；model-data-boundary.ts；既有ai-video-reuse-2026-11-16.md。仅在当前app代码检索中未找到活跃ASR/Whisper/视频理解执行器，不从历史演示或旧参数推断服务可用。

## 建议的接续路径（不由本片自动实施）

先复用旧系统“确定性质量检查→用户一次确认课题/被试/访视→原始数据登记→明确处理结果回执”，避免只给上传成功。再为内容理解接通真正可执行的语音转写/时间轴或画面处理器；回答必须回链原视频版本与时间点，科学数值来自确定性程序。新增权限/数据库变更、模型费用、云/远端配置访问等仍先确认；不用文件名或时长冒充内容解析，不将真实视频送入Codex/Anthropic。

用户随后已批准“两者都要，先旧流程再接内容理解”的[具体规格及MVB01–03](../product/qiyan-ai-video-binding-2026-11-16.md)和[六步计划](../planning/qiyan-ai-video-binding-2026-11-16/implementation-plan.md)。目前VB01–VB06完成本机技术交接：两张Hub表、owner一份限定许可、两份既有原件各一份ModalityFile及原AI/被试/有权访视读取回执；没有旧处理任务或模型请求。当前事实以[四层证据](../testing/ai-video-binding-2026-11-16.md)为准，上表保留的是文件名阶段核查；内容理解仍需真实执行器，不把原件登记说成已读懂视频。
