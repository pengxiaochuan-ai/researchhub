# 舌图原件接入：接口、检查与本机升级

2026-11-19。对应[产品规格](../product/tongue-image-ingestion-2026-11-19.md)；本轮仅JPEG/PNG原件，不扩图像算法、其他模态或生产。

## 复用与契约

沿既有`/sessions/:sid/media-uploads`初始化/分片/complete、`/media/:mid/ingest-targets`、`/ingests`/confirm/原键receipt及研究侧`/research-studies/:study/subjects/:subject/session-media-ingests`/content。无新URL或第二套存储模型。

`normalizeMediaInput`接受png/jpg/jpeg与对应image/png、image/jpeg或空MIME；图片大小≤26214400字节，实际signature必须与扩展名相符。复用旧通用签名检查和完整原字节SHA。图片检查固定png_pipe/jpeg_pipe，ffprobe单流单帧、尺寸正整数、每边≤20000及总像素≤40000000，再用ffmpeg完整单帧解码到null，超时/损坏/工具不可用分别保留状态，失败不允许登记，不重编码原件。

视频DTO不变；仅图片媒体增加`modality:tongue`和`inspection.hasImage/width/height`，hasVideo/hasAudio=false，contentUnderstood=false。登记source仅图片增加modality=tongue；快照固定检查版本、尝试ID和尺寸，不接受冒充视频的图片或误标/尺寸不同的快照。ModalityFile写tongue/raw/needs_review、原SHA/字节/MIME、同Study/Subject/Visit、真实采集时间或null、登记来源；不创建ProcessingTask/Feature。

原生当前权限、精确grant/creator/期限、源会话归属、双同意/入组/方案/访视状态、current authVersion和原键CAS沿旧实现逐项核验。已登记原件保持私有/no-store/nosniff及逐次SHA、父链和当前授权；不返回公共对象地址。舌图内容问题在原admission明确告知尚无图像解读依据，不能落入视频或一般模型编造结果。

前端仅扩原上传分流和媒体区；图片绝不传AgentMediaContent。原件读取失败清图并提供重新加载/重读，失权/身份变化清除旧图及记录，未知写结果沿原键只读找回。原件尺寸不是临床质量判定。

## 唯一最小升级

`scripts/ai-session-tongue-image-schema.mjs`导入无副作用，导出精确up/down与ready断言；仅本机wp01_test_full_baseline。升级现存extension/MIME两个CHECK、同一SECURITY INVOKER登记guard及原就绪comment；不增表/ACL/角色/grant，不改旧业务行。旧视频、native/精确grant和原schema检查兼容，旧native down对image版本明确拒绝。image down有图片时拒绝，不删图来降级。

- guard摘要：`6bed268bf8b050047b2e9dd7676250df502abdb7474565fdedd7760e811fe033`
- upgrade摘要：`b1014cb8afa286a513296862a2f95d6df7d864d9908c6567e7285bda5cde8a0b`
- revision：`tongue-images.v1`
- 新media catalog：`8c605a3a73135805865cfefedb3874c993e7574aa64f641370e6e5f4f4d71019`
- 新ingest catalog：`d077449838eb064afa68632b687588a1f3b40b804297574c48a208108d6db446`

独立review与真实PG全ROLLBACK正反例后，由根在2026-11-19T07:01:12Z应用；原owned运行在19501受控重载为PID43212，七依赖就绪、182表重载前后原行hash一致。未操作RDS/云/生产。实际应用及权限/来源/下限反例见[验收](../testing/tongue-image-ingestion-2026-11-19.md)。
