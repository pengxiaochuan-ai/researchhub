# 双语检索/单篇AI：B01隔离复用准备

实际执行：2026-11-03北京时间。文件名沿原11/02规格与计划。不抢占正在其他会话实施的S08；当前仅B01测试/文档，B02–B08未实施，F01仍未批准。本记录不是新功能或专业验收。

## 已证明与未证明

1. 真实PG能将同概念OR、跨概念AND过滤放到limit/cursor前，手写四行技术输入分页为03→04→空；未实现正式QueryPlan或生产SQL接线。
2. 旧`SessionsService.ensureKnowledgeSession`在真实app角色和三层RLS上下文下可幂等保存303字节单篇context；旧Message.meta与KnowledgeChatJob.payload完整往返16748字节的6片段合成包。新会话/消息/failed-job仅事务内可见，强制回滚后Session/job均不存在，未运行Queue/Provider，不是新证据包实现。
3. 现有来源提交锁及当前引用重验在同一真实事务中拒绝后续被篡改片段，assistant INSERT未发生；未实现新逐片验证器或完整Worker链。现有装配`beforeAssistant(tx)`的同事务落点源码已核对，不把源码检查当新分支实跑。

使用具名专用`wp01_test_full_baseline`身份守门；owner.authVersion=5实际读取。未修改原文章/审核决定/角色/授权/旧源码/服务/模型报价，预算账本hash前后相同；7个相关源文件观察hash未变，详情见[机器记录](../planning/bilingual-article-ai-2026-11-02/preflight.json)。旧账号可能被S08进一步变更，后续必须重新读当前版本。

## 命令与证据

- `node --test --test-concurrency=1 server/hub-sources/article-preflight.test.mjs`：3/3通过。是旧能力characterization，不编造新生产代码RED→GREEN。
- `node --test tests/*.test.mjs`：本轮实际167/167。不同于其他专项组合测试数，不称全旧后端通过。
- `pnpm build`和`git diff --check`通过；保留旧大chunk、HMR端口提示，不升级依赖或修打包。
- `node scripts/approved-source-chain-browser.mjs --mode local-synthetic`：现有资料链6组通过，[最新真实浏览器记录](evidence/approved-source-chain-4b7fe549/result.json)，两原账号13篇真实读取/引用/原图、匿名/未审边界、390/320，0页面错误/Provider，原队列摘要不变。PNG/WebM已留存并打开截图核对。不是双语/单篇新UI验收，没有新增业务交互。

首轮探针2过1失败：测试只设置tenant，缺少Study组/项目GUC，旧Session INSERT被RLS拒绝。对照现有scoped装配补齐两个set_config后通过，未借direct角色绕过Session写权限，原失败快照[保留](evidence/bilingual-preflight/ba-preflight-a4f5274d-a7d5-4b7d-835b-341be1306ea6.json)。最终证据[本轮记录](evidence/bilingual-preflight/ba-preflight-0d088caa-7538-4609-a008-1e94bd7b46d6.json)。

## 四层与下一步

代码：仅预检测试新增，无业务实现。环境：旧合成能力可复用，无新功能启用。实际执行：PG回滚探针/现有HTTP/Chrome执行；没有Provider。专业结果：双语检索与单篇解读尚未交付，用户验收未开始。

按已批顺序，等待S08闭环后进入B02词表与QueryPlan，不因准备通过自动改优先级/重启共享运行环境。唯一独立代码总评审留B08；实际AI核价及最多2次调用仍需F01另批，不用旧5元余额当许可。
