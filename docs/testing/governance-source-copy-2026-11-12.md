# 来源审核状态文案：展示与AI用途分开说明

日期2026-11-12，用户批准上一轮推荐项。仅改G02来源状态文案，不改布局、审核分类/记录、权限、接口、表结构、旧服务或费用。前轮全局身份刷新问题不在本轮修补范围。

## 实际结果

真实指南“循证针灸临床实践指南：抑郁症（修订版）”在治理待办与审核详情显示“页面展示已批准（公开）；AI检索尚未授权。”，队列和底部阅读栏显示“展示已批准 · AI未授权”。partial重复状态行省去，不增加表单或确认。

共用sourceReviewCopy只呈现当前记录，不得用作交付授权。原partial状态仍是待处理，范围下拉仍未选择，保存仍禁用直到用户明确选择；没有替用户重复批准展示或新增AI用途。仅租户/部分/过期/撤回/缺提取决定/不同统一操作引用均保守说明；AI已有有效分项批准时提示当前内容范围仍需确认，不假称未授权或整篇已可检索。工作簿分项不推定整批已批准。

## 验证

- [真实旧文案RED](evidence/governance-source-copy-2026-11-12/red-result.json)及截图、视频保留；新增契约首跑7失败，旧总览仍输出“审核范围尚需统一核对”。
- [最终38项相关测试](evidence/governance-source-copy-2026-11-12/related-final-tests.log)全部通过，含8项新文案契约、队列/状态、决定控件、授权分页和原服务端objectReviewState纯契约；未改服务端。
- [最终Chrome五组](evidence/governance-source-copy-2026-11-12/final-result.json)：真实总览入口→队列/决定区/底部阅读栏、刷新、1440/1366/1920/390/320及窄屏返回，字体14px、无横溢出；owner来源审核GET仍403。全页面无pageerror/console error；context监听0业务写请求。
- [真实Chrome原生200%](evidence/governance-source-copy-2026-11-12/native200-result.json)：Chrome设置2，dpr2、scale1、CSS视口720×456，字体14px、选择框266.25px，无横溢出；[完整物理截图](evidence/governance-source-copy-2026-11-12/native200-full.png)经作者读图确认。不是CSS zoom或简单窄屏替代。
- 实际源对象、decisions、fingerprint与raw partial前后hash均为fb59f72dc92edec35e439f0a2b47f37944baf104b222248b17167c87d4a10604；不是只比题名/数量。读取专用合成环境，不做审核/AI任务/业务写入，原会话登录及审计正常存在。
- [最终构建](evidence/governance-source-copy-2026-11-12/build-final.log)4.71s退出0，原>500KB分块告警保留。源码/测试/脚本hash见同目录source-sha256.txt。七服务ready；当前PID89387由并行工作改变，本轮未调用重启，不将环境PID声称不变。

## 全量门禁未全绿：范围外并行变更

首次[完整前端](evidence/governance-source-copy-2026-11-12/frontend-tests.log)419中418通过、1失败：tests/agent-question-length.test.mjs引用article-ai-output.mjs尚无的assertArticleModelInput。最终[完整前端](evidence/governance-source-copy-2026-11-12/frontend-final-tests.log)425中424通过、1失败：tests/article-ai-ui.test.mjs:50仍断言textarea maxLength=100，但当前AI输入组件已变化。两次不同失败全部保留，不删测、不跳测、不改AI输入长度模块，不把相关38项与浏览器通过冒称全量通过。恢复全量门禁应在该并行模块完成后处理，本轮不是生产可发布结论。

## 一次独立只读总评

0 Critical、1 Important、1 Minor。Important：注册“仅展示”的hub-display引用也必须与当前提取批准一致，否则后端仍不交付结构化部分，新文案却可能误报全部批准；作者增加真实纯内存反例先RED（[原失败](evidence/governance-source-copy-2026-11-12/review-red.log)），再最小修复、最终38项/Chrome/build重跑通过。Minor：补底部阅读栏直接断言，不仅凭源码声称覆盖。评审者独立运行相关14项纯测试，未代跑全部浏览器/完整前端或读取凭证；不另起重复评审。

四层区分：代码已实现、本机已加载、真实请求与UI链已执行；当前状态语义和可读性有本机证据，但专业用户签收、全量绿灯与生产发布独立。没有审核提交或付费AI运行，不宣称AI检索已获准或生产已生效。

## 文档同步

规格、基线、变更、版本、使用说明、前端架构、UI验收、治理规则、索引及本轮计划/事实/进度已同步本地与Notion对应章节，旧记录保留。[Notion交接](https://app.notion.com/p/41656479ab5881cbbfaecf22c28788e7)已回读确认。不覆盖前轮定位证据或并行模块改动；未暂存、提交、推送或发布。
