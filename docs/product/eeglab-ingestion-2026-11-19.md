# EEGLAB 原件上传与访视归档

2026-11-19。当前需求：接通 EEG 原始文件与访视归档；用户确认设备导出为 EEGLAB `.set`，可能配套 `.fdt`。沿用本次访视→岐研AI→核对登记→原访视/受试者回看的既有入口与布局，不扩 EDF/BDF、波形、预处理、特征、诊断、统计或生产部署。

## 原件与一次操作

原访视入口和AI资料区在选择前提示先在EEGLAB去除身份信息并重新保存，不增确认步骤。原“上传文件”一次选1份 SET，必要时同时选它引用的1份 FDT；不让操作人逐文件登记。系统自动封装为不压缩的完整原件包，成员原名、原字节及 SET 内引用不变。一次采集对应一个媒体来源、一次确认、一个 eeg/raw/needs_review 文件和原登记审计。原受试者、本次访视与研究自动带入；实际采集时间未知则为空，不从文件头猜测。

技术上用内部 `.eeglab`/application/zip 的 ZIP_STORED 信封复用原分片、内容身份、私有存储、来源SHA、回执和恢复链；不开放任意 ZIP 输入。成员只允许1个SET与至多1个FDT；禁止路径、控制字符、重复/混淆名、压缩、加密、软链接及额外成员。包总量≤500MiB，SET物理≤100MiB，SET解压及内嵌逻辑数据≤256MiB。前端分块CRC、File/Blob拼接，不把整份FDT读入JS内存；封装固定顺序和时间以保证重选同组后内容身份不变。

## 文件检查与科学边界

支持 MAT v5–7.2 与 HDF5/MAT7.3，顶层 EEG struct 与 flat字段布局，内嵌数值 data 与外部 FDT 引用。独立固定版本本地 Python/SciPy/h5py 检查，不执行 MATLAB/history/插件，不进入 ffmpeg、媒体解读或模型。压缩累计上限、子进程资源/超时、HDF5外部链接/外部存储/VDS/未知过滤器拒绝；不读取原件以外路径。

外部引用必须是安全原leafname，与所选FDT精确一致；data与datfile矛盾、缺件、错名、多件、FDT长度不等于 nbchan×pnts×trials×4 均阻断登记。内嵌数值shape须与metadata一致，多余FDT拒绝。FDT无自描述头，同名同尺寸的错误配套无法自动识别；一次登记旁明确提示由采集人核对同次导出。检查通过只表示文件结构可读，不证明未预处理、采集质量或临床合格。

仅展示/冻结白名单文件事实：hasEeg=true，其他hasAudio/Video/Image=false，format=eeglab、matVersion、layout、channels、sampleRateHz、samplesPerEpoch、epochCount、sampledDurationSeconds及members的name/extension/size/SHA。采样总时长为确定性samplesPerEpoch×epochCount/sampleRateHz，不冒称墙钟时长，不从float32推导设备位深。不得投影subject/record/history/event/日期等头字段。上传前应在EEGLAB去除身份信息并重新保存，重命名文件不能清除SET内信息。

## 界面、权限与恢复

原媒体列表显示“EEG原件 · SET内嵌 / SET+FDT配套”及文件事实；一次“确认关联并登记”。原访视文件区与受试者详情显示“下载完整原件”“查看登记记录”，没有播放器或解读入口。原研究侧及本人会话授权content端点返回attachment ZIP、private/no-store/nosniff，下载成员SHA与上传原件一致。

来源与目标双授权、当前角色/成员/authVersion、原creator/grant、同意/入组/方案/访视/版本、SHA与审计全部保留。管理员沿用原当前租户权限，不新建授权。刷新、离页、丢响应、重试沿原key只读核对，重选必须是同一完整文件组，不能补写半份来源或重复登记；失权/身份切换立即清空显示，晚到响应不能恢复旧内容。保留共享站内未保存确认和beforeunload。

## 实施与验收

先完成契约/解析/负例，再页面接入；新schema只由根显式升级精确本机合成数据库，旧image/audio/video契约及数据保持。独立复核SQL和真实PG ROLLBACK后再启用，绝不自动迁移生产。

19501使用全新合成内嵌SET、SET+FDT和MAT7.3样例真实上传、一次登记、原访视/受试者回看、完整包下载逐成员SHA核对；同时验证缺件/错名/损坏、匿名及越权拒绝、刷新防重、零模型/处理任务、旧来源保全。真实Chrome六宽及原生200%截图录屏，保留既有窄屏Shell限制。不把本机合成验收代签真实临床/生产或满500MiB压力验收。用户已要求自主完整验收，不反复索取通过确认。

状态：19501本机合成四层验收完成。三组内嵌SET/SET+FDT/MAT7.3实际各一次上传登记并完整下载，4原成员SHA保持，刷新防重、权限/来源、原访视/S04、六宽/原生200%通过；182表旧行保全、零模型/处理任务。详见[验收记录](../testing/eeglab-ingestion-2026-11-19.md)。真实临床/生产、信号质量与满500MiB压力另验。
