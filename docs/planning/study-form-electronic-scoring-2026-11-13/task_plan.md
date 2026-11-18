# 本轮：表5电子计分与PHQ-9原文展示

当前用户请求：确认舌脉类别/共计/不适用处理，按表5实现电子化计分；PHQ-9现场/H5填写、核对与回看适配。

## 范围

只改ResearchHub及其本轮表单适配；保持Shell/导航、当前权限/同意、原键/修订/审计。不恢复旧19项或其他治理/数据专项，不修改旧系统服务/源码/配置。真实患者数据不读取；全新合成例验证，真实课题启用另按实际绑定/政策。

## 阶段

1. [done] 核实架构与临床项目规则；用户已明确采用类别/脉象复核/N-A首版策略。
2. [done] PHQ-9版本化展示契约：schema.presentation(title,recallPeriodPrompt,instruction,attribution)；number/integer字段choices([{value:number,label:string}])，原数值存储、不默认选0。
3. [done; actual_clinical_binding_pending] ResearchHub内确定性表5计分与项目操作策略，字段离散有/无/状态、>=20且组合；不静默补0，不输出未知的完整分/诊断。
4. [done] 现场/H5/预览/核对/历史/更正共用展示及标签回显；保留既有页面框架。
5. [technical_verified; business_pending] 单元/契约→真实HTTP/PG合成例→真实浏览器/Playwright录屏截图→独立审查→文档/Notion/业务结果核对。

## 边界

前端可先做PHQ契约，不依赖未确认的临床策略。后端在ResearchHub适配层实现，先查共享事务core如何调用normalize/score，不改外层app/server旧系统。发布入口仅在本任务必要且既有边界内接通；不直接挂整个旧Controller。

## 规则确认后续（2026-11-13，本轮唯一增量）

用户已回复采用首版规则；上述阶段1的待答复已解除，阶段3的临床操作规则由候选升级为项目策略v1。阶段记录保留为上一阶段事实，当前以本节及rule-confirmation-v1.json为准。

1. [done] 归档pending原件，canonical更新confirmed及明确版本/确认来源；原权重/阈值/页面不改。
2. [done] 新profile定向规则/旧pending契约与全新合成PG/HTTP/真实浏览器回看，保留历史版本。
3. [done] 同步当前产品、操作、版本、校准、技术/测试与Notion；真实组/PI/Study未绑定继续明示，不扩为建账号/授权/生产启用。
