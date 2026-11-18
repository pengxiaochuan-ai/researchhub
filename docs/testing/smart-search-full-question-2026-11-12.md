# 完整原题智能搜索复验 · 2026-11-12

结论：**完整输入及真实执行链通过，专业任务整体部分通过，不能整体销项。** 本轮用户只授权复验；未修改产品代码/提示词/校验规则/页面/权限，没有自动重试、充值、手工对账、服务重启或生产动作。仅本机专用合成库、原owner/admin与当前Study。当前目录串行真实执行＋独立smart_grounding_review只读专业核对；该复核未跑测试/数据库/网络或写数据。

## 本轮原题与结果

原问题直接读取前轮`who-v2.json`、`nccih-v2.json`的text，而不是使用后来为适配100字改短的脚本问题；原记录和旧Job未改。两题通过页面点击“智能搜索”开启才联网，分别建立新会话，各只发送一次。

| 项目 | WHO＋Harvard（owner） | NCCIH（admin） |
| --- | --- | --- |
| 完整原题字符 | 177 | 103 |
| 新Job | cmwd01wq3004ulud9nuotxx8u | cmwd03qnp005hlud9qsyg8svi |
| 新会话 | cmwd01t92004olud9agek8kfc | cmwd03ni6005blud9kfu58d8t |
| Job状态 | completed，双源任务部分完成 | completed，来源一致但任务部分完成 |
| Provider调用/Token | 2 / 3255 | 2 / 3095 |
| 预留 | cmwd01xh1004xlud96xctdsuw，settled/3255 | cmwd03rd6005klud9693ss18f，settled/3095 |
| UsageRecord | cmwd02cpu0054lud9s4aujkkr | cmwd04d1c005rlud9kqdllk4i |
| 实际网页工具 | WHO成功；Harvard WEB_HTTP_202失败 | NCCIH成功 |
| 原文/推论 | 1段事实交付、2段扣下；核心比较未完成 | 3段事实＋1段推论交付，均有本次原句 |

累计4次真实Provider调用、6350Token，均原业务账本自动正常结算；未增加额度，不将本轮费用归入已取消的开发临时上限。没有人工结算或释放旧预留，也没有把失败免费计零。

### 原题一

读取 https://www.who.int/news-room/fact-sheets/detail/anxiety-disorders 与 https://repository.gheli.harvard.edu/repository/14380/ ，概括科研背景，区分WHO原始资料和目录收录；能否据此判断目录获得WHO授权？请简洁回答，最多三段。

### 原题二

读取 https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety 总结证据局限，并给出一条研究设计建议。请简洁回答，最多三段。

## 四层逐项核对

1. **代码契约（沿用，不修改）：**4000字符输入及智能搜索v2分段事实/推论、来源短引回执保持当前版本，不重设规则去迎合结果。来源短引精确匹配只证明出处，不等同专业语义充分。
2. **本机启用：**两题前业务quota.canStart=true；智能搜索由OFF点击ON，正常业务Token预留。初始/结束本机PID均3069，未重启；仅合成库guard `wp01_test_full_baseline`，roles/grants及各自原旧Job处理前后hash相同。
3. **真实工具与输入：**页面inputValue、实际POST body、PG user content/originalText、Job.text与原问题完全相同；两次Provider各轮user消息均含完整原题。工具真实OpenCode轨迹与requestedUrl/时间/结果留存，两条完整URL均实际进入工具，不再把截坏URL的失败当外站失败。
4. **实际交付与业务核对：**源证据/grounding回执通过重放，真实API current消息为snapshot、正文与DB一致；两角色Chrome刷新正文一致、智能搜索回OFF、pageErrors空，截图/WebM保留。已交付事实和AI推论逐条独立专业核对，但任务完整性见下列未过项，不能用completed或回执绿测代替专业验收。

## 专业结论及未过项

### WHO＋Harvard：部分通过

WHO实际取得4500字符截断选段；Harvard返回`WEB_HTTP_202`，无正文，不能称读取了目录页或比较了两个正文。独立公共浏览工具也未能读取Harvard，但其返回403，与Hub本次202分开记录，不能互相替代或断言站点永久不可用。

最终交付的WHO患病比例及治疗障碍段与保存及模型可见原句一致，无伪造来源或第三方官方归属。阅读范围、Harvard失败链接及“不得据此作完整比较”诚实可见；最后提示来源不足以确认授权。

但目录与WHO原始资料的核心比较没有完成，授权回答只剩泛化限制，不能算整题通过。两个扣下段必须区分：

- 首段五条Key facts实质在选段有据，但模型把五个Markdown列表项合成一段quote，省掉项间的星号；当前连续短引只折叠空白，触发excerpt-missing。这是有据内容的格式机械拒绝，不是五条事实全都无来源。
- 另一段把`unavailableSources`工具状态文本填成WHO原文quote，引用不实，拒绝这条引用合理；其“页面未读、不能确认授权、收录不等于授权”的语义本身准确。不能把此次拒绝冒称成功拦住了错误的正向授权断言。

模型3个claims没有超三段意图，但最终长引文及重复固定说明不够简洁，且关键任务段缺失。此处只登记，不调整校验、不补写原回答、不重跑模型。

### NCCIH：来源一致性通过，任务完成度部分

三段事实关于机制尚未完全明了、非特异性效应及视频引导想象例子，逐段忠于本次原句；“显著”对应原文significant，不是新统计量。研究设计建议明确标“AI推论（非原文结论）”，假针灸对照与评估期望/治疗信念有已读前提，“帮助区分”的表述不是NCCIH已证实结论，没有再把盲法困难冒充原文。

仍有两项不满足：实际4个实质回答段，超过完整原题“最多三段”；“证据局限”偏重机制未知与非特异性效应，视频例子偏离局限总结，未充分归纳研究质量/偏倚。保存源4500字符，但本次Provider预算视图更短、末尾截在`knee pain associated`；后文低/中质量分级未进模型，不能说模型已阅读全文或完整评估了全文质量。回答已明示网页选段/截断，所述事实并非凭空编造；任务完整性仍不能判全通过。

## 证据与本轮边界

`.tmp/smart-search-full-question-2026-11-12/`：两份marker JSON含原问题/原Job与新Job/请求/输入/用量/保存及刷新校验；各自`-provider.json`、`-evidence.json`、`-grounding.json`、`-answer.md`及before/terminal/answer/final截图和video。Provider凭据不入报告；痕迹为已脱敏实际请求/返回，文件仅本机工程证据。

`.planning/2026-11-12-full-question-recheck/`单独记录本轮task_plan/findings/progress，不读取旧计划后自动续跑。操作脚本`scripts/smart-search-full-question-recheck.mjs`只允许每题一个具名marker，既有marker即拒重发；本轮未运行旧持久PG测试、未清理夹具、未改原历史或旧系统。

建议下一项：单独确认修复“列表原文短引的机械误拦＋工具失败状态的非文章依据表达”，让部分网页不可读时仍能直接回答可确定的边界；同时约束简洁段落数。Harvard站点访问问题另列，不绕限制或自动重试。
