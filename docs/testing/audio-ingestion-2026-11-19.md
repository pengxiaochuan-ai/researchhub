# 语音原件上传与访视归档验收

2026-11-19。仅当前用户授权的访视→AI语音上传→核对登记→原访视/受试者播放及采集记录。[产品规格](../product/audio-ingestion-2026-11-19.md) · [接口/升级](../technical/audio-ingestion-2026-11-19.md)。目标19501/wp01_test_full_baseline，三份全新通用合成音；没有患者资料、真实语音内容、ASR/特征/模型/邮件/生产。用户已要求自主完成验收，本轮不再请求代操作或签认。

## 四层结果

| 层 | 实际结果 |
| --- | --- |
| 代码 | 61项相关前端/客户端、24项后端契约、37项真实PG检查通过；PG包含112个直接SQL/权限SAVEPOINT反例，所有新写/DDL强制ROLLBACK。旧舌图/视频/native/grant/内容服务保持。 |
| 装配 | 独立复评后根仅在本机精确升级原两个CHECK和原guard，就绪hash/catalog已核；19501重载后七服务ready，182表重载数据不变。 |
| 真实请求 | 原S09进入AI，研究/受试者/访视自动核对带入；WAV24/44.1kHz、MP3和AAC-M4A/16kHz各一次实际上传、prepare、confirm。AI原件区及同visit回看实际播放且currentTime推进，原字节SHA相同、Range206字节正确、刷新0重复。 |
| 业务结果 | 三文件均audio/raw/needs_review，S04与原访视可播放和查看登记记录；WAV真实24位保留，压缩格式位深null，没有伪特征或任务。无权owner研究侧404/会话侧403、匿名401；原舌图/视频仍能读取/播放。满足本轮原件采集闭环，临床/生产与研究质量另验。 |

## UI/UE与恢复

基准1440×1000，改前六入口/改后同视口截图保留。320/390/1024/1366/1440/1920新原件卡片无自身横溢出，操作按钮14/22；真实Chrome200%为CSS720×456、DPR2、scale1，补CDP物理1440×913截图与登记按钮元素命中。原窄屏固定侧栏等Shell留项保持，本轮不宣称全站手机/无障碍完成。

专属8项组件和10项隔离浏览器（9场景+父）覆盖三格式实际播放、200MiB/格式拒绝、丢确认响应原键只读恢复、刷新、403/身份切换正在播放时旧node paused/detached/src清空、503同src重试0新增写。另51项媒体浏览器组、12项表格/资料契约及9项资料状态浏览器回归通过。各组有重叠，不相加为唯一用例数。

真实解码正例包括WAV16/16k、WAV24/44.1k、MP3、M4A；PCM32浮点与伪视频M4A明确不可登记。直接SQL反例含200MiB、codec/flags、错/缺/null/string/小数/极大元数据、采样率/声道/位深与快照/attempt/version篡改、当前权限/父链/旧helper/音频存在时down拒绝。

失败记录保留：最初SQL快照减键表达式优先级不正确，由真实PG prepare发现，补显式括号后重新核精确hash/catalog并全组通过，旧候选未应用。组件模拟onError未传DOM事件的边界已适配为实际节点/测试ref，Chrome仍验证真实cleanup。旧audio标签由“音频原件”统一为“语音原件”，原测试只更新该文案断言，其余来源/零特征/权限断言保持。没有重放旧舌图或本轮成功上传。

## 旧数据与边界

182表中177表完整count/hash不变；只增加本轮1来源会话、3媒体上传、3登记、3原件及原审计。其余5表剔除确切新ID/本轮新增审计后，旧行count/hash全等。原舌图/视频、Subject/档案/访视/同意/答卷/Feature/权限/Token/模型保持；175历史模型任务原样，0活跃分析/模型租约/当前派发，不恢复旧队列。

未测：200MiB全链压力、其他编码/多音轨、实际录音设备、录音内容与临床质量、真实临床/生产；原件编辑/删除、ASR/声学特征/EEG不适用本轮。当前上限是准入约束，短合成音通过不代表大文件吞吐或研究协议质量已验。

## 证据

`docs/testing/evidence/audio-ingestion-2026-11-19/`：

- `before/`、`schema-applied.json`、`before-restart.json`/`after-restart.json`：基准、精确升级、七服务及旧行保护。
- `backend-delivery.json`、`backend-contract-tests.log`、`backend-pg-tests.log`：24/37检查、112反例、源码摘要及原失败/修复。
- `independent-preapply-review.json`及`independent-final-review.json`：精确候选与最终独立复评。
- `live/result.json`与PNG/WebM：三种新原件一次上传/登记、实际播放、SHA/Range/0重复/0算法。
- `readback/result.json`：19项实际角色/原件/旧媒体/六宽/200%验证；`ai-original-playback.json`另证本人AI来源原件真实播放；`native200-physical.{json,png}`为物理截图与命中。
- `after-acceptance.json`/`preservation-final.json`：182表与确切新ID保护。
- `isolated-browser-*/`：受控故障、正在播放时失权/切号/源卸载和同源重试，区别于真实业务请求。

构建通过，原>500KiB bundle提示保留；git diff --check通过。没有提交/推送或发布其他环境。
