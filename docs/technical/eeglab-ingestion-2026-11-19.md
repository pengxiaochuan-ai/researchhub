# EEGLAB 原件接口与本机启用

范围与契约见[产品规格](../product/eeglab-ingestion-2026-11-19.md)。只启用19501本机合成环境，不涉及生产或真实受试者原件。

## 数据与资源

`src/eeglab-envelope.js` 从原选择器生成确定性 ZIP_STORED，原SET/FDT不改字节；固定顺序、DOS时间、UTF8标记、无extra/descriptor，逐1MiB计算CRC，Blob拼接避免FDT全量进JS内存。统一opaque文件名 `eeglab-originals.eeglab` 和application/zip进入既有1MiB分片/内容身份链。界面不接受用户ZIP；服务端仍完整核对信封和EEGLAB内容，不以扩展名或“由UI创建”作为信任依据。

每包一个媒体来源，一次prepare/confirm，一个eeg/raw/needs_review ModalityFile。包SHA与逐成员SHA用途不同：包SHA固定本次上传身份，members固定内部原件。外部FDT原引用精确匹配，不修复/重命名SET；错名、缺件、尺寸不符阻断。旧媒体DTO、权限/回执、来源CAS/审计和恢复保持；无新表、角色、grant或模型/ProcessingTask。

白名单inspection：`hasEeg:true`，其余hasAudio/Video/Image=false，format=eeglab、matVersion=v5/v7.3、layout=embedded/external-fdt、channels、sampleRateHz、samplesPerEpoch、epochCount、sampledDurationSeconds、members=[name,extension,size,sha256]。失败仅七种safe failureCode：missing_fdt、reference_mismatch、unexpected_fdt、metadata_mismatch、resource_limit、unsupported_mat、invalid_envelope。不得返回subject/history/event/路径或异常stack。

SET≤100MiB、累计解压/逻辑数据≤256MiB、包≤500MiB；通道≤4096、采样率≤1e6Hz均为工程资源边界，不是方案临床阈值。采样时长确定性计算，原采集时间/设备位深不推测。缺件来源可以保留在本人会话的不可用记录，但不能研究侧登记成功。

## 独立本地检查运行时

独立requirements为 `server/eeglab/requirements.txt`，固定 NumPy2.5.1 / SciPy1.18.0 / h5py3.16.0。本轮专用解释器 `.tmp/eeglab-ingestion-2026-11-19/venv/bin/python`；不修改旧skills/media环境，不在服务启动时自动pip。运行时必须实际可导入对应版本，不能仅判断文件存在。无MATLAB/脚本执行、模型或外部文件解析。v5压缩累计上限，HDF5拒绝外部link/storage/VDS/未知filter，进程资源与墙钟上限。

沿既有本人会话content与研究侧已登记content端点下载完整包，attachment `.zip`、private/no-store/nosniff及当前权限双检查；无公共对象URL。原始数据仅在授权服务端与浏览器传输，不提交模型。

## 精确升级纪律

仅根在独立SQL审查与真实PG ROLLBACK测试后，显式升级精确 `wp01_test_full_baseline` 的既有media扩展/MIME CHECK和原ingest guard。版本以audio-originals.v1及既有catalog/hash为prior，变更前后核对对象、ACL、旧行和ready receipt；有EEG记录不得down，有新版本时旧升级helper不得回退覆盖。完整实际hash与命令留在本轮验收证据。

19501重载前检查原owned runtime、零活动分析/有效模型lease/当前交互命令；不恢复历史队列或typed pause。重载前后182表逐表hash相同，新验收后只排除确切新增session/media/ingest/file/audit行再次比较旧数据。

## 一手依据

- [EEGLAB数据结构](https://eeglab.org/tutorials/ConceptsGuide/Data_Structures.html)：MAT顶层EEG与flat字段、内嵌数据及FDT引用。
- [EEGLAB数据集保存](https://eeglab.org/tutorials/03_Dataset_management/datasets.html)：单/双文件与MAT7.3。
- [SciPy loadmat](https://docs.scipy.org/doc/scipy/reference/generated/scipy.io.loadmat.html)：v7.2以前MAT支持及7.3需HDF5 reader。
- [h5py dataset](https://docs.h5py.org/en/stable/high/dataset.html)：外部存储、过滤器与虚拟数据集边界。

## 本机实际启用回执

根在独立最新候选复评及42项真实PG（含98项EEG直接SQL反例、全部ROLLBACK）通过后，仅对精确本机目标显式执行升级，19501重载七服务ready；182表重载前后相同。实际guard=`ba7277e0025f11e62cc93fb420c8479329c1f22a6a5bc81e5c0fcb4e00ab9223`，upgrade=`23df5191517fdac7c621d08010657c6e9e06315362417ef12577282b3e3b79b3`，media catalog=`4d6da991b6fe81bb9ae7ef750726a92a308fea8deaf2e0e8d8ca66d11a624552`，ingest catalog=`ce7a378c3edd13f0b441f1b15b4eea654157c5c656752484192302f583f74e98`。

CPU30秒、墙钟40秒、250ms轮询RSS超过1GiB则终止；RSS监控不是瞬时硬内存隔离。启动及每次检查均实际import并核对固定包版本，未配置/版本不符明确不可用，不能由其他步骤成功掩盖。原helper识别新revision并禁止跨版本down；已有EEG原件时禁止降级。

三组新合成原件实际各一次prepare/confirm并下载逐成员SHA；本人AI来源和研究侧均为private attachment ZIP，Range206核对。只有1个新session、3个media/ingest/file及新audit，182表旧行全部相同，175历史模型队列保持、零当前有效lease/分析/交互任务。原件归档不代表信号质量通过，临床/生产与满500MiB压力另验。[完整证据](../testing/eeglab-ingestion-2026-11-19.md)。
