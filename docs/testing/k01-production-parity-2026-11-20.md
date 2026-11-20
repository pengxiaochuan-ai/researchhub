# K01共同运行：生产合成主链路技术交接（2026-11-20）

结论：本次原创合成资料的主链路技术验证通过；不是全部AI入口、全部授权组合、真实科研业务或整页体验验收。1440×1000时问答历史区被既有操作区挤窄，局部高度/滚动优化已提请用户确认，未擅改布局。

## 已发布版本与边界

- PR：https://github.com/pengxiaochuan-ai/researchhub/pull/3 。main业务提交095b6f39f2ad28072634db4b89982eaa37bcc3fd。
- 同版发布：https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44724477247 。tag为hub-runtime-095b6f39-44724477247001，自动公开浏览器检查及finalize成功。
- 本次只收敛K01共同知识模块、正常问答、原生队列/授权/计费、独立解析/向量及发布回滚。原本机19501/19502继续可用，未创建替代API/PG或验证环境。静态候选源码副本和封包清单测试不启动服务。
- 生产仅researchhub库，DDL/迁移执行0；旧aisci库、旧源码/服务和官网未修改或重启。6个旧服务的镜像/运行状态逐项保持；发布期间另有原生baseline保护。
- 正常问答不再受验收账号/KB/文件/次数白名单限制，仍遵守原生租户、真实父对象、成员/管理员、Agent、工具、审核、来源版本、Token、计费与审计。模型及knowledge-chat/knowledge-import保持开启，不在验收后关闭。

## 代码、配置、执行与业务产物

1. 固定core55及共同K01服务图/入队围栏；本机保留其他原专用业务facade，不把本次K01通过称整套启动入口统一。两项目不再共用K01 Python源码运行路径。
2. Hub自有parser/embed容器使用现有固定镜像层派生，仅在researchhub_default，不调用旧服务。九文件精确封包、离线BGE模型七文件SHA校验，缺基础镜像/模型在停API前失败；本次真实生产准备和健康检查已通过。新服务器需提前具备这些固定基础镜像，不假定可以自动下载。
3. 管理员通过原K01页面上传1份原创扫描PDF（仅合成软件验证说明），导入任务cmwovpzni0044ph07q32aozio完成；文档9835c3ca-4c60-47f1-bcbe-fdec6c31755c，审核后v1。中文标题/正文无乱码，人工审核字段可读。实际search返回1条vector命中该新文档；不是关键词结果冒称向量。
4. 原件6,020,528字节鉴权读取200，SHA256 e78dc51de224016eaaff500ee9e93b2e3875f50286a284b8817faafede41ce14与上传原件一致；Range bytes=0-31返回206及正确32字节。原生Import实际按storageKey从对象存储读取；存储HeadBucket可用。本生产沿现有OSS S3兼容配置，并非新增腾讯COS。
5. 管理员实际发送1次问题，job cmwovr9oj004fph07ukfwjzol completed，usedMock=false，sourcePolicy=rh-kb-reviewed-source-v2-grounded-advice。依据原文回答“保留原件、人工审核后进入检索”，明确原文未指定负责人，没有补造角色或规范。两条来源为当前固定版，鼠标点击[1]显示v1/page1/中文原文、正文hash和chunk标识。
6. owner真实浏览器入口、输入框启用、原生quota.canStart=true，无模型调用；不把owner免费入口测试称作第二次真实模型验收。首次isEnabled即时断言未等初始化，改为等待非disabled后通过，没有业务修补或付费重试。

## 费用与历史守恒

- 本机真实问答1请求，按Provider usage与当日峰值价保守核算14427microCNY；合并原100笔已知记录2258541，共2272968microCNY<5000000。原文件SHA、全局过期、其他模块校验保持。
- 生产本次1请求，保守12366microCNY；加原100026，累计112392microCNY（0.112392元）<1元。不充值、不重试、不续额、不对账。此为真实usage按峰值单价的上界，与消息meta.costEstimate的旧估价口径不同，不混用。核价来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ 。
- 验收回执独立记录本轮调用，不把测试次数/费用门禁植入正常产品，不改旧验收账本。
- 注意时间：首份prod-post-inspect是11:11:59，早于11:12:53问答；仅作为发布后预检。最终run44726371673（https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44726371673）在问答后只读复核：623条旧任务完整行hash仍735bdccbbc401c67285f0dd9714a2bed、175条仍queued；旧ledger SHA仍8c4840344ddc553ac1436ae59f2da336eb2480bbec0633050e55588cf38aedd1。0DB写/0模型/0Worker启动，不能把早先快照冒称后验。

## 验证与保留问题

候选源码runtime119项、工作目录runtime128项、聚焦57项均通过（重叠且包含其他未并入工作，不相加报唯一数量）。发布回滚/配置/profile/封包及DDL分类回归通过，真实合成PG授权/失败结算案例全回滚。独立只读评审关闭封包、回滚配置/依赖/快照等本轮P1，并逐项核对生产真实证据。

未完成：K01历史阅读区高度体验；单篇文章AI、岐研AI附件及研究设计等非本切片装配；通配AgentAccess；整体启动入口和本机Node25/生产22差异。本机OCR使用现有Tesseract、生产固定镜像使用Paddle，算法实现存在平台差异，本次两端均仅以合成材料实测，不宣称逐字输出一致。仅复用同一旧镜像切profile的非首发控制分支仍有安全拒绝P2；本次实际重建发布未触发，不据此扩展无构建切换能力。

私有证据：.tmp/single-hub-runtime-20261120/下的prod-k01-upload.json、prod-original-read.json、prod-k01-real-qa.json、prod-owner-ready.json、prod-post-runtime.json、prod-final-inspect.json、paired-production-release.log及截图/录屏。凭据、原始回执和依赖副本不提交。
