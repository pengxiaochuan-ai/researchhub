# 视频聊天追问执行契约

2026-11-17。仅Hub新视频分支；不修改旧Agent内核、模型数据守门或媒体归档接口。

## 接口与存储

复用`POST /sessions/:sid/commands`和现有编辑/取消、`GET /sessions/:sid/knowledge-state`。客户端不能提交证据包、视频路径或来源ID；受控服务器从本人当前会话捕获单一可用视频。`GET /sessions/:sid/media/:mid/content-runs/:rid/evidence/:eid`再次核验后返回确定性微秒位置，原生`content`维持Cookie/Range播放。

没有DDL。现有用户消息`meta.hubCommand.hubMediaSelection`内部冻结证据，派发时复制到新job的`payload.hubMediaSelection/hubMediaEvidence`，保存`hubSkillRoute`。内部选择绝不进入HTTP用户消息元数据；助手只有通过当前校验后才能投影`videoEvidence`。commands列表本来只返回安全状态字段，job状态不返回payload/result。

## 固定与当前性

`hub-video-pack.v1`绑定tenant/account/group/project/session、media/run、源SHA/版本、逐条证据和上下文原问题，规范化哈希。受控读取最多12条、每条800字；确定性时间输入仅帮助定位，输出时间由后端生成，不接受模型URL或时间坐标。

入队、队列编辑、派发、真实执行读、每次Provider授权、实际提交及历史读取复核。引用限固定包的V来源ID；编辑为新检索清除视频选择，视频内追问校验同一原选择。使用已有来源授权锁、解析根许可与Study读取权限；对象存储统计SHA/长度复验。原视频不送模型，不调用联网工具，不重新ASR/视觉解析。

## 真实执行与计费

复用旧`SessionsService`/Worker claim/`UsageAccumulator`、Hub业务Token预留/结算和`runOpenCodeSynthesis`。新增`hub-video-content`内置策略模式，不冒称发布了新Skill。`media_content_read`真正执行读取并审计，再经隔离OpenCode与DeepSeek文本请求合成回答；保存工具执行时间、packHash、媒体/解析/证据ID、实际Provider用量及运行回执。

用户已批准owner/admin各一次（最多2请求），只发前切片生成的合成文字，不充值/补额/自动重试。此次数仅是验收脚本边界，不进入业务页面或产品费用逻辑。历史未知用量与预留不动。

公开模型价格已核对[DeepSeek官方定价](https://api-docs.deepseek.com/quick_start/pricing/)；2026-11-17页面显示`deepseek-v4-pro`支持JSON，峰时每百万Token缓存命中输入$0.044、未命中输入$1.32、输出$3.96，非峰时半价。实际按租户现行规则计Token，不将开发限额写入页面。

## 页面与故障

保留AI01布局、输入、排队、历史和原播放器。来源区分自动转写/抽样画面描述/AI解释，14/22，时间按钮经授权证据接口后定位现有播放器。断网/5xx保留结果且不自动重试；401/403/404/409/410或来源版本不符屏蔽原回答和来源、关闭播放器。身份/会话变化使旧响应失效。没有对外开放临床视频能力或正式部署。

## 当前显示策略与交接

`hub-video-display.v2`先验原始任务/原消息输出回执及当前来源，再清旧内部占位、保留混合句定性内容；HTTP投影当前显示回执，原存储/审计/账本保持。时间只放行明确定位短语且与所引模态/起止时间相符的秒值，其他临床测量不借用；负号、空白负号及数字尾部不能截取正值。帧按钮由微秒确定性格式为毫秒精度（如0:05.8），ASR仍近似秒定位。

新聊天播放引用经现有source/version校验后带focus:true，原播放器最近可见滚动；旧视频区seek默认false，不改布局/焦点/权限。两次真实执行已结算2009 Token；后处理修补免费重放原真实输出＋目标历史显示/回放复验。双账号各单轮、两份合成材料是本次技术交接界限。
