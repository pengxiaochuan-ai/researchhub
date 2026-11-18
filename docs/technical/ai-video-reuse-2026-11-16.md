## 2026-11-16 · 真正缺片续传增量

在Hub增加session-media-snapshot只读原生v1 manifest/part适配，拒绝非正规文件、符号链接、维度/绑定/父链变动；GET不续TTL或清理对象。新fileIdentity为1MiB分片SHA清单的schema化摘要，绑定既有request_fingerprint，完成重算；source_sha256仍来自真实完整原件，不增DDL/GRANT，不改旧Chunk类。快照与归档竞争经当前权限/版本及完整身份守门；旧无内容身份任务安全整传。

当前契约、真实执行与压力边界见[规则](../product/qiyan-ai-resumable-2026-11-16.md)和[证据](../testing/ai-resumable-2026-11-16.md)。

# 岐研AI视频接入 · 复用核查与合成探针

日期：2026-11-16。范围：当前工作区只读代码/历史核查及离线合成文件探针；未启用Hub视频API、前端、媒体数据库或模型。

## 1. 当前可复用源码

| 位置（相对aisciencesys根） | 核实结果 |
| --- | --- |
| app/server/src/sessions/chat-chunk-upload.ts | ChatChunkUploadStore初始化/逐片/完成、清理与完成缓存；原缓存回放必须外加当前Hub授权及PG原件核验 |
| app/server/src/sessions/chat-upload-inspector.ts | inspectChatUploadFile流式SHA、保留有限签名前缀、假名文件名；不会把500MiB完整留堆内存 |
| app/server/src/sessions/chat-upload-signature.ts / chat-upload-policy.ts | 会话支持mp4/mov/webm与500MiB上限；raw-skill-router虽有mkv但会话不可据此默认扩格式 |
| app/server/src/storage/storage.service.ts | 私有putFile/read/Range基础；同一存储不等于不同owner可读 |
| app/server/src/sessions/sessions.service.ts | saveAttachments保留元信息，attachmentContent当前授权/版本/流关闭；内容字节不直接进LLM |
| app/server/src/ingest/media-inspection.ts | inspectMediaFile真实ffprobe＋parseFfprobeOutput/classifyFfprobeFailure，时长和流类别；不执行ASR/画面理解/科学特征 |
| app/server/src/ingest/raw-processing.service.ts:768附近 | processMediaTriage结果明确triage_only/featuresGenerated=false/rawBytesSentToModel=false、needs_review；不能把100%当内容分析通过 |
| app/server/src/common/skill-visibility-policy.ts | 旧raw-video-orchestration/raw-audio-orchestration明确退役；陈旧数据库装备不能恢复 |

历史提交0cbb72813036b70cc21c5bd203be087e15e3b3ec，2026-08-02，移除旧multimodal/video-annotator.client.ts、video-prep.ts、canonical-signals.ts等。它证明历史存在视频检测/准备链，并不证明当前仍有可复用通用摘要/转写。旧.env.example保留端点参数只是历史示例，不能据此访问/启用远端服务；本轮没有读取真实服务密钥或远端配置。

## 2. 离线真实检查证据

执行：`node scripts/ai-video-reuse-probe.mjs --generated-only`。

脚本只接固定的本机生成视频，不接受用户文件，使用已安装ffmpeg生成1秒蓝色画面＋合成正弦音。有效MP4进入真实原签名检查、流式SHA和ffprobe；另截取该合成文件前40字节形成损坏容器，真实检查返回corrupt，而不是假定扩展名有视频。

结果：有效样本video/audio=true、容器valid、时长1秒；损坏样本unavailable/corrupt、hasVideo/hasAudio=false；原退役video Skill仍被拒绝。源SHA独立重算一致。

证据：`.tmp/ai-video-2026-11-16/reuse-probe/result.json`及两份generated文件。没有HTTP、PG、Provider、共享服务重载或用户原始媒体；该证据**不证明Hub已可上传/播放，不是内容理解或用户验收**。

原测试：`TS_NODE_PROJECT=tsconfig.json node -r ts-node/register/transpile-only --test src/ingest/media-inspection.spec.ts src/sessions/chat-upload-inspector.spec.ts src/sessions/chat-upload-policy.spec.ts`，cwd app/server。实际12项通过、0失败；涵盖格式/流式hash、损坏/无流/异常JSON、工具缺失/超时等。没有修改或安装旧系统代码/依赖。

## 3. 当前接线缺口与最小方案

- AgentMaterials只接文献和CSV/XLSX，不能仅改accept后发旧文献接口；后端真实格式/状态契约会拒绝。
- 原分片完成缓存是临时磁盘回执，不能代替Hub持久归档/列表/当前权限；不把状态塞历史消息来冒充可恢复实体。
- 原inspectMediaFile没有明确协议白名单；面向新不可信容器接入时应加Hub有界本地协议/固定格式适配并复用原纯解析/失败分类，旧源码不改。
- 本轮没有新表/GRANT；拟增一张rh_ai.session_media_uploads。完整字段、状态、API、MV01–MV03与四层验收见[产品规格](../product/qiyan-ai-video-ingestion-2026-11-16.md)。
- 原件和视频内容不是KnowledgeDoc；首片不伪建可检索正文。后续真实转写/时间轴派生可成为私有知识来源，须先找到有效执行链。

## 4. 本轮边界

只新增核查规格/计划和离线探针；既有AI01上传、布局、角色、数据库、模型和旧服务未改。数据库集成/真实Hub浏览器/容量压力/用户体验均待后续获批实施，不能把native探针当这些验收。当前必须确认项只有规格MV01–MV03的新表最小增量；内容理解不以恢复已退役检测来完成。

## 5. 一次独立规格评审

独立只读评审原结论：0 Critical、2 Important；不代表实现或验收完成。两项均已由主实施在本稿/规格/计划集中修订，无第二次独评签收。

1. 完整SHA必须在首次PUT前冻结：原生分片允许替换同序号，固定路径不足以防未知完成后换源覆盖。规格现明确先服务端完整校验→CAS固定SHA并确认提交→允许PUT，SHA提交未知时PUT=0，后续重写不同内容拒绝；V02须先写对应RED再实现。
2. uploadId绑定未知不能按未绑定清理：原cancel会删除pending清单。规格现区分绑定明确失败且确认未绑定、绑定已提交、结果未知三态；未知先原key核清，不能cancel，无法确认保留至原TTL。V02已补“真实提交后丢响应，cancel=0”测试落点。

这些是实施前合同修订，尚无新Hub代码/PG故障注入证据，不把文字修订说成运行时问题已修复。
## 2026-11-16 · 后续实施结果

MV01–MV03已批准并实施。本机19501两账号共6份新具名合成视频真实上传、私有归档、ffprobe、Chrome播放/拖动、SHA/Range、刷新与跨账号拒绝通过；原实现均按下述核查复用，没有恢复退役检测或调用Provider。[真实执行与门禁报告](../testing/ai-video-2026-11-16.md) · [现行接口/字段契约](../product/qiyan-ai-video-ingestion-2026-11-16.md)。本文件以下保留实施前复用探针事实；不能将旧分析历史或容器检查解释为当前内容理解已可用。

