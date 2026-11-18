# WF02 已审核模板带入与差异核对验收

2026-11-17。范围为本机19501合成环境中的原生可移植模板；用户已要求完整验收不重复签收，按已批准标准代理核定。真实临床、生产及原课题专属总分来源的迁移不在本次通过结论内。WF03–WF12仍待串行完成。

## 结果与四层证据

| 层 | 实际结果 |
|---|---|
| 代码 | V5十三文件冻结；相关75/75、独立78/78（含3纯PG guards）；前端1062通过/1既有420MiB opt-in跳过；构建4.84秒，保留既有chunk告警 |
| 目标环境 | 受协调owned重载至50868，19501/19502真实加载新路由与原S11界面；不修改共享启动器、旧核心或模拟登记 |
| 实际执行 | 6项真实aisci_app整笔回滚预测；管理员/普通科研账号3次原生UI导入200；原key回执、三页回读、精确副本与6条审计核对 |
| 业务结果 | 从S11当前卡片搜索、预览固定内容与差异，一次带入新draft；无需重录表单/访视/结局映射；未知先只读核对，不重复写；五宽、原生200%、身份迟到与原数据保护通过 |

最终源以[implementation-freeze-v5.json](evidence/study-workflow-simplification-2026-11-17/wf02/implementation-freeze-v5.json)及相对before补丁为准，旧V1–V4与失败证据保留。没有把离线绿色或模拟专属适配视为通用能力。

## 原源阻断与验收资源调整

初始A/D选用已签收真实课题模拟源645…：4个实际时点、5个人群分支plan、3表单、3个form_score结局。V3先阻断了明确的合成预处理特征标记，V4完整保留固定三字段后，HTTP源预览显示可带入；但原生PG预测实际拒绝。原因是三个总分依赖原case的Protocol ID/hash/variables/formVersionId专属绑定，新Protocol不能继承，连同Study新draft也不例外。

V5在预览和提交共用检查中仅允许原生data_field/scale来源，保留原source/target固定检查；form_score及未知来源在复制前明确阻断，不猜测映射、不删除结局、不复制模拟登记。实际A/D GET与原页面均canImport:false，显示阻断原因，带入按钮禁用，0业务写。不能宣称原真实课题form_score模板已导入或通用化。

旧primary manifest保持不变。新[portable-primary-manifest-v2.json](evidence/study-workflow-simplification-2026-11-17/wf02/portable-primary-manifest-v2.json)明确以既有1a7303…原生QA源为正例；仍只用WF01的A/B/D三个目标和既有账号。普通科研身份authVersion=0、管理员=5均实际重验。未为测试修改旧权限、许可、适用性或政策。

## 原生执行与业务核定

- V5 PG六项：A/B/D success、A复制后故障、source fingerprint过期、target fingerprint过期。每项仅一个物理aisci_app事务；成功路径先强制全部约束，再sentinel整笔回滚，外部只读核对0残留；中途故障实际已有固定副本再抛错，仍0残留。
- A/admin、B/原reviewer、D/admin各一次页面导入。每目标仅1个draft；合计12表单、3结局、6访视plan、24采集requirement。schema/scoring（含NULL）、单位/方向/时点、0/null/false、来源标记均精确保留；行ID新建、引用逐项重映射。未复制政策/审批/启用、被试/同意/答卷或许可。
- 原生3条operation与6条本项业务audit逐项对账（不是全库新增审计总数），source/target/current actor、authVersion、原key/hash及全部form/outcome来源映射吻合。S11/S02/S07显示同一来源和新draft。
- D先取得真实POST200再丢弃响应。原opaque marker跨关闭/重开仍保留；新标签只读查看当前Study草稿，返回原tab后marker字节不变；真实gesture、刷新beforeunload、原回执GET找回同一draft，0额外import。
- 实际collector可读源但canConfigure=false，模板列表403；管理员读取reviewer的私有回执仅found:false；未知key亦found:false。扣住旧admin真实200预览，在同context实际登录collector后交付，原表单/预览均不回显。未修改账号来制造撤权。
- 治理页原按钮真实进入，当前draft尚未提交，按规则不入待审队列；available:false为真实边界，不冒称G02新draft入口通过，不为验收额外提交/批准。WF03自然进入审核时再验。

## 浏览器、恢复与限制

1440/1920/1366/390/320与Chrome原生200%（720 CSS、DPR2、scale1、raw CDP1440 PNG）均通过功能区212个可见控件测量、固定内容末项可滚动/不遮挡、14/22、Enter/Tab/ShiftTab/Esc、纯GET刷新无beforeunload。原生SELECT computed normal按appearance:auto、authored22、最小40单列。截图/WebM留存，根已目视核对320、1440末项及原生200% raw PNG。320与原生200%下既有Shell搜索、品牌/身份区拥挤不在本项改版范围，不宣称全站视觉清理。

一次D恢复脚本只按S11 URL找原tab失败：根主动登出自建浏览器后，实际原tab恢复在登录页，原marker仍在。修正验收器为查找真实原marker所在tab，并回到原记录URL；没有注入marker或重播写。一次G02脚本把Shell按钮当链接而超时，改用真实原按钮，未改产品行为。失败记录保留。

旧316研究runs、48修订、39快照、36科学文件、原Word，以及WF01四课题/三研究/九operation及全部原行hash均保护通过。真实源/目标换权限或authVersion的部分反例仅契约/组件层，不冒称实际改权限测试；完整临床与生产另验。

## 主要证据

证据根：`evidence/study-workflow-simplification-2026-11-17/wf02/`。

| 证据 | 相对根路径 |
|---|---|
| 当前预览、原源负例、空目标/回滚后保护 | root/prepare-2026-11-17T03-52-10-931Z-b1025/ |
| 6项真实回滚预测 | root/pg-all-2026-11-17T03-52-35-696Z-0ea11/ |
| D原tab、popup、刷新及原回执 | root/ui-D-recover-2026-11-17T03-59-25-360Z-ead4e/ |
| 五宽 / 原生200% | root/visual-2026-11-17T04-00-50-161Z-47db2/；root/native200-2026-11-17T04-01-38-442Z-25a4b/ |
| 原源界面阻断 | root/negative-2026-11-17T04-02-07-141Z-a9b9c/ |
| 实际权限/迟到 | root/boundaries-2026-11-17T04-03-21-139Z-a472e/ |
| 治理draft边界 | root/governance-2026-11-17T04-03-54-847Z-2d182/ |
| 最后原生精确对账/保护 | root/audit-2026-11-17T04-04-34-232Z-b5aa0/native-audit.json |

本项目标I/O已结束并明确释放给共享会话，后续不得据旧PID自动重载。产品/使用/技术及Notion已同步，WF02按本报告限定范围销项。直接进入WF03，不再请求重复签收。
