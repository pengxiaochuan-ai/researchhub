# EEGLAB 原件与访视归档验收

2026-11-19。仅当前用户指定SET/可能FDT的EEG采集链，[规格](../product/eeglab-ingestion-2026-11-19.md) · [接口与启用](../technical/eeglab-ingestion-2026-11-19.md)。目标19501、wp01_test_full_baseline；全新合成原件与既有合成访视，没有患者文件、生产操作、模型、邮件或真实研究规则更改。不以代码/Mock冒称真实能力；用户已要求自主完整验收，不反复请用户代操作或签认。

## 四层验收台账

| 层 | 状态与证据 |
| --- | --- |
| 代码 | 61项相关客户端/页面、67项后端契约/reader、42项真实PG通过（含98项EEG直接SQL反例和112项旧音频反例，全部新写及DDL回滚）。原67组覆盖37文件，独立追加3正例后根实际复核40case：10有效/30拒绝均符合预期。EEG专属15项及45项旧媒体浏览器通过；组间有重叠，不累加。 |
| 目标装配 | 最新独立候选复评后根仅精确本机升级2个CHECK、原ingest guard和ready receipt，无新表/角色/ACL/grant。19501七服务ready，182表重载前后hash相同，独立Python与包版本实际核对。 |
| 真实请求 | 原S09→AI自动带入研究/受试者/访视；内嵌SET、SET+FDT、MAT7.3三组各一次实际上传/prepare/confirm。回原访视实际点击完整原件下载，四个成员SHA/原名/字节与上传前相同，刷新0重复。本人AI和研究侧private attachment ZIP、Range206与来源SHA一致。 |
| 业务结果 | 三份均eeg/raw/needs_review、零ProcessingTask/Feature/模型；原访视/S04可下载与查记录，缺件不能半份登记。owner研究侧404/来源侧403、匿名401、身份/失权/迟到/未知原键恢复通过，旧舌图/语音/视频可用。满足本轮本机合成原件采集闭环，真实临床/生产与信号质量另验。 |

## UI/UE与数据保护

原入口不新建页面或菜单，一次选组、一次登记、一次下载。上传前在原S09支持说明和AI资料区提示EEGLAB去身份并重新保存；没有重复确认。原件只显示可核验事实及成员名，设备位深/实际采集时间不推测。原访视/受试者回看没有EEG播放器或解读按钮，采样时长直接显示确定性原值（例如8/128=0.0625秒，避免未标约数的0.063）。

六宽320/390/1024/1366/1440/1920新卡片均scrollWidth=clientWidth，20项实际回看/角色检查通过；原生200% CSS720×456/DPR2/scale1，CDP物理截图1440×913，登记按钮14/22、元素命中。上传前提示在200%也实际检查、0新业务写。保留既有其他窄屏Shell留项，不宣称全站手机/无障碍验收。

182表中177表完全相同；另5表仅允许确切新增1会话、3媒体、3登记、3原件与新审计，排除这些新ID/新审计后旧行hash/count全部相同。175历史模型队列保持，当前有效lease/分析/交互任务为0。未操作生产/RDS、邮件或患者资料。

## 发现与修复

- 首轮旧媒体浏览器组沿旧测试默认19613导致连接失败；显式固定RH_MEDIA_TEST_BASE/RH_UPLOAD_TEST_BASE为19501后45项通过，不将其误报为功能故障。
- 新EEG选择反例发现：先选孤立FDT，再选不支持ZIP，旧媒体错误与新资料错误叠加。已改新选择仅清旧输入反馈，保留pending/来源/登记，复验不再重复提示。
- 隔离harness原先用Playwright route.fulfill模拟attachment，Chrome下载绕过该route而向真实站点请求不存在的假source，收到401/JSON后取消。已改临时只读合成HTTP服务验证真实download，15项通过，不弱化SHA断言；后端另有上述19501实际请求，不能将harness冒称真实后端。

## 证据目录

`docs/testing/evidence/eeglab-ingestion-2026-11-19/` 保存改前六入口截图、schema/独评/PG、三组新原件一次执行记录、PNG/WebM、SHA、角色与原生200%以及182表旧行证明。所有真实上传均有单次journal；成功后不重放。

- `live/result.json`与PNG/WebM：三组一次实际登记/完整下载及原成员SHA；`source-read.json`为本人来源Range/SHA。
- `readback/result.json`20项、原生200%物理截图/JSON及`preupload-guidance.json`：角色、尺寸、当前原件及旧模态。
- `schema-applied.json`、`before/after-restart.json`、`after-acceptance.json`和`preservation-final.json`：启用、旧行与零任务。
- `backend-delivery.json`、后端/PG日志、最新独立candidate/reader/final复评、`root-reader-final.json`及最终manifest：精确版本、代码、测试、证据。

首轮回看脚本在重复访问同一hash页时无条件点击“查看登记记录”，第二宽误将已展开记录收起而超时；已改为先判断可见再点，20项复验通过，没有为此修改业务展开/收起行为。原失败记录保留first-attempt-result.json。

完成：本机合成四层闭环有据；满500MiB压力、真实临床/生产和信号质量另验，用户未提交本轮真实临床操作反馈，不代签。
