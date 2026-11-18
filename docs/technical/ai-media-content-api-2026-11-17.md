# 岐研AI视频内容：本机接口、存储与执行

2026-11-17。依据[已批准规格](../product/qiyan-ai-media-first-slice-2026-11-17.md)MC01–MC03/P01–P05，仅专用合成环境。旧系统、公共schema、旧Worker及账本不改。

## 数据与授权

- `rh_ai.session_media_content_runs`：第0次prepared行承载管理员具名对象许可，限定tenant/account/session/media/Study/源版本/配置；7日内到期、可撤销。首次执行一次绑定requestKey/hash；后续attempt保留origin和原键。
- `rh_ai.session_media_content_evidence`：不可变转写/帧证据，保存真实PTS/timeBase、微秒坐标、estimated、原件指纹及私有派生对象键；对外不返回对象键。
- 两表FORCE RLS。应用角色仅runs SELECT/INSERT/UPDATE、evidence SELECT/INSERT；无DELETE/TRUNCATE。启动只检schema receipt及catalog，不建表/迁移。
- 源权限复用`createLocalMaterialAccess`；同一tenant授权锁和事务内以现有`resolveResearchStudyInTransaction`重验目标Study read，再恢复源GUC。保留tenant_admin、Hub负责人及组/项目读取语义，MC许可不代替当前Study权限，也不借MVB登记许可。
- 创建、认领、心跳、发布、读取和工具均核对当前主体、真实父链、源版本/指纹及根许可。撤销不依赖源仍然可用；原始数据不迁移或复制到被试库。

## 接口

路径前缀`/api/sessions/:sid/media/:mid`，Cookie认证、原精确scope及POST来源校验。正文严格白名单，不接客户端路径、URL或prompt。

| 方法/后缀 | 输入或结果 |
| --- | --- |
| POST `content-runs` | `requestKey,expectedMediaVersion`；永久找回该键原attempt，同键异参409 |
| GET `content-runs/current`或`content-runs/:rid` | 当前授权的通道状态、实际范围与证据；隐藏租约token/对象键 |
| GET `content-receipts/:requestKey` | `found`及该键原attempt，不指向后来的新结果 |
| POST `content-runs/:rid/retries` | `requestKey,expectedVersion,channel`；只允许最新attempt明确失败、已知用量且无另一通道在途 |
| GET `content-runs/:rid/evidence/:eid` | 当前有权证据与后端坐标；不存在、跨源或伪造引用拒绝 |
| GET `content-runs/:rid/evidence/:eid/image` | 原生img Cookie请求，固定本机scope；私有PNG限2MiB、SHA核验、交付前重验，no-store |

原件仍用既有授权`content`接口与Range。图片独立原生Controller不要求浏览器无法附加的scope头；当前账号/本人会话/源和Study权限仍逐次重验。来源丢失或指纹变化返回410，前端清证据及播放器；短暂断网保留已读结果和恢复动作。

## 独立执行与恢复

音频/视觉各并发1；API不等待推理，不持PG锁调用模型。每通道90秒租约、20秒心跳；每次真实本机推理前，经父进程握手重验当前授权、租约和源。发布以共同run锁及分通道CAS，在一笔事务中写证据、终态和审计；另一通道成功结果不能被覆盖。

本机新表轮询不扫描旧public任务。queued登录版本变化明确终止为未执行、请求数0；过期running以当前合法主体收束`interrupted_unknown`，不重跑模型。已知失败的视觉重试只复制源/配置/帧指纹一致的成功窗口checkpoint，重试缺失窗口；未知结果或用量不自动重试。原键可恢复，原attempt及实际用量保留。

私有原件从既有存储读取，下载与发布前后复核；派生帧写既有私有桶的本人run前缀。未提交的对象不交付。Python工作目录位于前端源码根之外的既有`.tmp/researchhub-knowledge-local/media-content-private/`，仅迁移本轮两run，权限0700；不以文件权限代替HTTP边界。下载原件处理后删除，本机日志/原识别/窗口回执保留。共享窗口释放后已实际验证两份原识别路径均HTTP403、旧位置不含转写，未修改共享Vite规则。实例仅卸载本轮具名LM Studio模型；其他实例忙时明确失败，不驱逐或回退云端。

## 执行器与时间契约

- 独立Python3.12运行环境，离线复制34个已验证依赖包，保留版本/METADATA锁；运行sys.path不依赖旧venv。Whisper small及视觉GGUF/mmproj SHA冻结，只读使用，不下载。
- 有音轨先做Silero VAD；无语音不调用ASR，避免静音补造领域prompt。保留完整音频时间域，不拼接删除静音；实际首解码音帧偏移加回转写估计坐标。
- FFmpeg/ffprobe禁网络及外部dref；首片仅已验证零起点、连续MP4和晚音轨。非零PTS、VFR、MOV/WebM及复杂时间映射未验证，明确不支持内容定位，上传/播放保留。
- 全片最多10分钟、均匀抽样最多32帧；超过范围不静默截取。32帧是离散观察，不能声称逐帧审阅。
- 模型只返回实际frameId的描述；PTS、timeBase和回放坐标由程序生成，并严格验证`floor(pts × numerator × 1,000,000 / denominator)`。不允许模型改写时间或科学数值。
- LM Studio本机原生`/api/v1/chat`按请求`reasoning:off,store:false`，不修改共享设置。最初OpenAI兼容路径空正文、native单次JSON围栏失败均留痕；仅规范化完整JSON围栏，帧ID、字段与源仍严格校验。[官方请求契约](https://lmstudio.ai/docs/developer/rest/chat)。

## 只读工具及交付边界

`media_content_read`受控适配器只接受当前会话media/run/真实evidenceIds（1–12），每段最多800字并明确截取，后台生成时间与引用；原文指令视为材料。已有真实PG执行及当前两对象的有权读取/伪造引用验证。**首片未把该适配器接成自然语言视频问答或综合推论**；不把工具代码/测试冒称Agent问答已上线。未来接入须另验真实执行链及模型业务计费。

本轮无付费Provider调用、充值或额度修改；本机资源用量不伪造Provider账单。正式环境的独立依赖分发、持久工作目录、吞吐及专业用户验收另列，不由本机两份合成材料推定。
