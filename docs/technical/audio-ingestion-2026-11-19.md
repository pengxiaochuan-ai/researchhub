# 语音原件接入：接口、解码与本机升级

2026-11-19。对应[语音规格](../product/audio-ingestion-2026-11-19.md)，本轮仅原件上传/归档/播放/访视记录，非ASR或特征提取。

## 接口和事实

复用原`/sessions/:sid/media-uploads`初始化/分片/complete、`/media/:mid/ingest-targets`、`/ingests`/confirm/receipt及研究侧`/research-studies/:study/subjects/:subject/session-media-ingests`/content。无新URL/数据表/角色/授权。当前Study/受试者/访视来自原页面校验及当前可用目标，既有pending/current意图优先；URL不授予权限。

WAV（PCM16/24）、MP3、M4A（AAC）≤209715200字节，MIME规范化支持原生别名，实际签名、固定demuxer/protocol、单纯音轨和完整解码必须通过。含视频/封面图/多音轨、PCM32浮点或其他编码不可登记；未将原文件转码为支持格式。原字节、SHA、内容身份与原key保持。

仅新audio DTO/source声明`modality:audio`，inspection为hasAudio=true/hasVideo=false/hasImage=false、durationSeconds>0、sampleRateHz正整数≤768000、channels正整数≤32、codec及bitDepth。WAV16/24分别保存真实16/24，MP3/AAC位深为null；不从解码sample_fmt推断录音位深。pending/unavailable不造测量结果。旧舌图/视频公共形状保持，原件ModalityFile为audio/raw/needs_review，保原父链/采集时间或null/登记来源，零ProcessingTask/Feature。

音频单独probe30秒、完整decode60秒、lease120秒；旧舌图/视频45秒不变。超时/服务不可用状态明确，原件保留而登记阻断；旧key查原结果，显式重检，禁止自动重放未知写入。200MiB完整负载性能未由短样例验收代替。

原件读取沿Cookie和当前源/目标双授权、native当前角色/成员/authVersion或精确grant/期限、同意/入组/方案/访视状态、逐次SHA/父链；private/no-store、nosniff及Range保留。音频在前端不传AgentMediaContent，后端视频内容服务也按真实扩展与流拒绝音频；没有实际ASR/声学结果时admission明确阻断内容分析，不产生模型账单或伪结果。

`OriginalAudio`复用两侧播放器：effect捕获实际DOM节点，切源/unmount/错误时pause、移除src并load；以src为key防清理旧源误清新源。失权/切号/来源失败清播放器，重试读取同一受控src，不做上传、确认或模型请求。

## 精确升级与本机装配

新增`scripts/ai-session-audio-schema.mjs`及`server/ai-agent/session-audio-guard.sql`，导入无DDL。仅图片版prior的两个CHECK、原SECURITY INVOKER ingest guard及就绪comments，保所有原native/grant/不可变/源父链/回执/审计与ACL。精确up/down，存在任何audio行拒绝down；两个旧helper拒绝越版降级并委托精确audioReady。

- revision：`audio-originals.v1`
- guard：`93521e7ef7dbdb510cc6af3a54784bafea161f5b1d3cdb7bfce3757c9ca0bf82`
- upgrade：`c8d38d08e0092ea75e51b26c55d96d95833bd044bb57002eb7e4e7175412bcbc`
- media catalog：`016a9b55f1e587d87686ab1b2eec8bb3a5ecea144e23b83c8df2fccba2a92180`
- ingest catalog：`e58edf4f5f714873f62dd83167851fa8a21f2dd67867821817727906a586946a`

独立复评和全ROLLBACK PG后，由根在2026-11-19T07:38:20Z仅对wp01_test_full_baseline应用；owned 19501重载PID60752、七服务ready、182表重载前后原行hash一致。未运行RDS/云/生产迁移，不改旧系统或新增角色/ACL/Worker。完整证据见[验收记录](../testing/audio-ingestion-2026-11-19.md)。
