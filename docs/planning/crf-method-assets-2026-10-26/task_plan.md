# WP08首切片 · 本轮文档编制计划

本页为已结束的编制阶段记录。用户现已批准规格/八步/A01–A04并进入实施；当前执行以implementation-plan.md、implementation-progress.md和本片专属SDD台账为准，不恢复下方编制任务或把已完成文档步骤当代码完成。

当前请求仅编制“真实方法报告→本人科研资产候选与复用准备”规格、最小授权及3＋1工作日计划，提交用户确认；不是批准实施/授权/付费。目录仅属本轮，不读取根级旧task_plan或运行session-catchup恢复其他任务。

- [x] 核对当前WP07技术交接、原资产与报告接口、项目产品/UI约束。
- [x] 完成规格/最小授权/八步计划及复用证据。
- [x] 一次fresh只读文档总评审；原结论Approve with Minor（0阻断/0重要/2轻微）；主编源码核对补清两项，不算未来实施后代码评审。
- [x] 更新文档入口/产品基线/变更和倒排；33处新增链接、24＋8h/8任务映射校验；60个相关源码hash保持。Notion7新叶页＋5既有页新增节首次同步回读，保留原章节/子页；日志收尾同步继续复核。
- [x] 形成提交材料及单一批准入口，停在待用户确认、未实施状态。

方式：当前目录串行，不建worktree/分支、不提交/推送、不改业务代码/Schema/角色/scope/运行配置，不连接PG/Worker/模型或重启服务。沿用原专用合成环境边界；旧任务仅参考，不自动续跑。

## 编制取舍

已选推荐窄适配：新报告marker独立承接，复用原Artifact/Version/Source/Audit和A01/A02视觉；旧seed候选/服务不无声换schema。只准备本人派生资产，不自动新建方案/Study或跨Study应用。本片默认0模型调用。

## 工具问题

多文件读取总输出有截断，已缩小段落补读；后续限制单次输出。一次按猜测查找local-knowledge-assets.mjs不存在，改为已确认local-synthetic-assets.mjs与实际装配文件，不创建不存在的模块。UI-UX查询命中Feedback/Error Recovery（适用于错误恢复），不采用无关Input Types结果，不生成新主题。

后续定点rg曾包含不存在的knowledge-ai-guard.mjs、authorization目录和两个猜测的synthetic输入/准备文件；均只读查询失败，已按实际imports改为retrieval.service.ts、common/worker-publication.ts与research-execution-preparation-contract.mjs，不创建猜测路径。无写入/测试/服务副作用。

一次回读编排JS有多余括号，解析阶段即失败、没有任何工具执行；修正括号后12页回读/7子页验证成功。Notion按其增强Markdown指南写的mention-page/mention-date被服务端提示弃用并自动转换为mention/date，保留此告警，不伪称零告警；后续收尾同步改用服务端已返回的新语法。
