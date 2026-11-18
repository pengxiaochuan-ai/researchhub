# 视频内容首切片 Implementation Plan

> 使用executing-plans由主实现串行实施，最终一次独立总评。不新建worktree、不提交/推送当前共享改动。

**Goal:** 原AI视频区域自动执行真实本机转写/抽样视觉，并可按固定来源点击回放，保持当前授权与刷新恢复。
**Spec:** [已批准最小规格](../../product/qiyan-ai-media-first-slice-2026-11-17.md)。
**Architecture:** 两Hub表，根prepared记录承载限定媒体许可；当前源/目标上下文与短事务守门；独立Python环境＋本机模型执行在锁外；原视频区投影真实证据。
**Tech Stack:** 现有Nest/React/PG/Storage；Whisper small＋Silero VAD、FFmpeg、LM Studio已有Qwen3.5-9B。

状态：P01–P05已完成本机合成技术交接；独评全部阻断解除，最终共享窗口明确释放后复验通过。无额外付费调用，后续工作不由本计划自动恢复。

## Global Constraints

- 仅专用合成库，原owner/admin、当前Study，每账号最多1份新具名合成视频；旧对象/任务/账本不动，原件不复制入被试库。
- 现有500MiB上传保持；内容定位首支持经验证的零起点连续MP4/晚音轨；非零PTS/MOV/WebM/VFR未测不冒称支持。
- 每通道并发1；10分钟/32帧容量必须实测启用，不静默截取。无付费/远端配置/云/发布，无退役检测，无患者视频。
- UI只在原视频展开区增加状态/转写/画面/实际范围及时间按钮，14/22；不改Shell、历史/输入/右栏。

## Review Focus

1. 授权根撤销/过期、已删除源仍能终止许可；不得由执行者自发授予。
2. 分支CAS与租约并发完成不能互相覆盖；旧attempt迟到结果不可发布。
3. 重试键能永久找回原attempt，提交未知不重跑模型。
4. 字段/时间/引用伪造、字幕材料注入、切身份/刷新迟到响应不得串源。
5. 目标模型故障必须明确分支失败；不能把ASR成功当视觉/Hub整体完成。

## P01 准入与契约

Files: `server/ai-agent/session-media-content-contract.mjs/.test.mjs`；`scripts/ai-media-content-runtime-setup.py`；私有MC范围/保护清单。
Produces: `normalizeContentRequest`、`validateContentOutput`、独立Python锁定环境及固定模型清单。
- [x] 先RED检验输入严格白名单、引用/时间/数值类型、非零PTS拒绝。
- [x] 完成独立环境离线装配，证明sys.path不依赖另一项目venv；验证原包/权重不改。
- [x] 冻结两账号新媒体清单及保护基线，不在此阶段创建额外旧项目对象。

## P02 两表/权限/PG

Files: `server/ai-agent/session-media-content-schema.sql`、`scripts/ai-session-media-content-schema.mjs`、schema/service PG tests。
Consumes: P01输入/时间契约。Produces: 根prepared许可、attempt/证据，应用角色RLS、catalog守门。
- [x] RED真实PG回滚：仅管理员具名发行、跨账号/租户拒绝、根撤销/过期、源版本、请求键/attempt、终态不可覆盖。
- [x] 显式仅合成库应用两表与新表最小DML；不做启动迁移或修改旧public结构。
- [x] GREEN后记录SQL/catalog与保护清单。

## P03 服务与真实执行

Files: `server/ai-agent/session-media-content.mjs`、`scripts/local-session-media-content.mjs`、`server/media-content/execute.py`及对应测试。
Consumes: P01/P02。Produces: create/get/receipt/retry/evidence、当前授权认领/心跳/原子发布与独立恢复。
- [x] RED service PG：双通道CAS、当前权限/真实父链/租约、失败原子回滚、旧attempt迟到和未知原键恢复。
- [x] 本机独立子进程先VAD再ASR；真实PTS抽帧＋独立具名视觉实例；实际用量/失败留痕，不持PG锁推理。
- [x] 私有派生只按有权证据读取，源读取/发布/交付前后重验，未交付流关闭。

## P04 原页面与Agent只读工具

Files: `pages/shared/AgentMediaContent.jsx/.css`、`AgentMedia.jsx`、`HubAgentPanel.jsx`、`src/session-media-session.js`、本机装配/状态。
Consumes: P03真实投影。Produces: 自动触发、可恢复状态、证据/时间点击同源播放，Agent受控只读证据。
- [x] RED客户端严格路径、当前身份/源版本、原key恢复；组件切身份/迟到/断网/不可用/刷新测试。
- [x] 原区域接线，不额外准备弹窗或模型选择；无权/不支持明确显示，不替换演示数据。
- [x] 原上传/登记/历史/焦点回归及构建。

## P05 真实验收与独评

- [x] 两账号各1新具名合成文件，实际上传/ASR/视觉/刷新/时间播放及角色边界；未知提交沿原键，不增加新成功媒体。
- [x] 10分钟/32帧压力与不支持格式/静音/视觉故障等有界验证；临床/生产和复杂映射未验另列。
- [x] 保护核对、一次独立总评和集中RED/GREEN修补；living spec/使用说明/版本/技术/报告与Notion同步。

Pre-flight P01→P02：许可保留在根prepared行，不新增第三表；首次请求一次绑定，后续attempt引用根许可。P02→P03：每通道独立CAS/lease，事务内证据与终态提交。P03→P04：状态/范围为后台真实投影，不额外综合模型调用。原接口名称/最大10分钟与32帧未变。
