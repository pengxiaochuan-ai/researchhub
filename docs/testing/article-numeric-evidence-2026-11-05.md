# 单篇解读：数值来源与语境核验技术交接

开始于2026-11-05，目标环境验收于2026-11-06（本机时间）。仅`wp01_test_full_baseline`与自有19501–19507服务，不接临床库、不改旧运行服务、不发布。用户授权的本轮主线是取消无差别数值拒绝，改为有据展示/有限确定性转述；不是任意数值自由生成。

## 四层结果

| 层级 | 结果与边界 |
| --- | --- |
| 代码实现 | 同包完整正文/摘要生成numericFacts；模型选择ID，后端核所属片段、版本与完整receipt，转义渲染原文；新输入proof v2和提交/读取重验已接线。限定一例病例类型及首个同值周随访语法通过；表格不冒充完整数值语境，不新增计算。 |
| 本机配置启用 | 自有环境无在途后重启至PID36346，七端点健康；原角色/额度/来源审核/页面布局不变，不恢复开发金额/次数门禁。 |
| 实际请求执行 | 新任务`cmw3r2i130004lu1m730c225r`真实DeepSeek回答完成，非Mock，六片段指纹与封存包对应，2项原文receipt实际写入并刷新重验；5224 Tokens已按原Billing结算。 |
| 业务可用性 | 原Chrome页面交付、来源核对、刷新和身份隔离有证；“一例患者”和“随访仅4周”不再误拦。作者支持度与局限见下，最终专业验收由用户完成，不以测试绿或独立代码Ready代签。 |

## 验证与独立评审

- 最终免费门禁：304项前端/相关后端纯组件契约、21项真实合成PG、构建、diff空白及旧Billing/Sessions/Queue/Orchestrator源码/原人民币账本保全通过；0 Provider调用。[结果](evidence/business-ai-quota-gates-4bc16433-5cb4-42d1-886a-a13dc7d39987/result.json)。该套件不是旧系统所有维护脚本的全量测试。
- 定向38项输出/会话恢复/Provider测试通过。一例额外患者、中文数量/裸评分、receipt全字段篡改、跨篇/段/版本、表格不完整、原推荐强度/停药误译、真实失败用量不丢失均覆盖。
- 源语境7个回归负例先RED后GREEN：否定随访、未执行随访、小数/范围截尾、其他研究建议、跨句别文归属和不适用于本病例；改为完整肯定源句＋整段明确归属/否定保守拒绝。无法识别的一般自由数值仍拒绝，不宣称通用语义证明。
- 同一独立评审者`/root/article_numeric_review`两轮重要问题修补后最终Ready，无未关闭项；未调用模型/写库，不替代专业验收。[评审记录](../planning/article-numeric-evidence-2026-11-05/code-review.md)。
- 原失败原因/输入恢复的首次免费Chrome检查通过，0新模型调用：[证据](evidence/article-numeric-browser-cf07751f-301e-4c3e-aade-c582684703b3/result.json)。

## 真实请求与费用，不隐藏失败

| 本轮任务 | 状态 | 实际Tokens | 保留状态 |
| --- | --- | ---: | --- |
| cmw3qcpsk0004lu9frtzvtzlm | failed | 5118 | 模型自由写“随访仅四周”，当时规则拒绝；0助手，原预留待对账 |
| cmw3qhbv7000glu9f8vqqbarq | failed | 5120 | 同上；0助手，原预留待对账 |
| cmw3r2i130004lu1m730c225r | completed | 5224 | 实际助手与2项receipt已提交，预留12288，按5224结算 |

本轮3次实际请求合计15462 Tokens，后两次失败不是“免费”；失败真实用量保留，不自动重试、回写历史或擅自对账。前两次失败证据分别在`evidence/article-numeric-browser-990639d8-8167-4e6b-8779-aee1ca73c5a7/`与`evidence/article-numeric-browser-fb197729-0935-4a43-af04-62f608c10f45/`。修补后免费回放不等于旧任务变成功。

用户原失败任务`cmw3h3yit000mluhbcq0fwu0r`（本轮前，2911 Tokens）及其待对账预留hash保全，仍failed/0助手。新成功任务只使用现有租户/账号Token和原Billing，无新增额度/充值/权限；原人民币开发账本只保留，不作运行门禁。最终0在途任务/导入。

## 真实Chrome与产物核对

新实际问题：“请解读本篇研究的设计、主要发现、局限及对针灸防治情志病研究的参考价值，并附一项原文数值依据。”无需技术字段或额外页面操作。

新任务/实际回答：[real-result.json](evidence/article-numeric-browser-02d59705-b96c-457c-9e2c-0bfcf08c0aed/real-result.json)。[浏览器结果](evidence/article-numeric-browser-02d59705-b96c-457c-9e2c-0bfcf08c0aed/result.json)、[Token结算回读](evidence/article-numeric-browser-02d59705-b96c-457c-9e2c-0bfcf08c0aed/billing-readback.json)、[最终历史/在途状态](evidence/article-numeric-browser-02d59705-b96c-457c-9e2c-0bfcf08c0aed/final-status.json)、[只读长文复验](evidence/article-numeric-browser-02d59705-b96c-457c-9e2c-0bfcf08c0aed/readback.json)。截图/录屏同目录；1440与390视口，Reading16/28、无整页横向溢出、0 pageerror。本人GET恢复不发送模型，owner读admin会话403/404。开发者临时测试脚本的`--send-one`只是有意发一次验证，不是产品次数限制。

![原文数值依据](evidence/article-numeric-browser-02d59705-b96c-457c-9e2c-0bfcf08c0aed/admin-numeric-context-1440.png)

截图确认沿原`.thread`独立滚动、原问题输入区不变；完整原文较长，占用阅读区，不删条件或缩字假装紧凑。未自行重设计页面。补图最初因Playwright默认导出读取方式出错而未启动浏览器；修正仅测试命令后，只读检查通过，无模型请求/数据改动。

支持度核对：数值片段3逐字保留干预与随访、各量表和未记录不良事件；片段4明确four-week **follow-up**，中文“随访仅4周”同值/同单位，不转成治疗时长。单病例/无对照、自发缓解与安慰剂、主观问卷/睡眠日记、残余症状、外推性及联合干预无法分离均保留，未自行计算有效率或强化为普遍临床适应证。

专业提示：原摘要使用“objective sleep quality”，而局限明确缺乏客观睡眠结构验证。当前答案分别保留“作者报告”归因和局限，没有证明存在客观仪器监测；仍建议研究者核对该原文术语张力。引用准确不等于独立证实论文结论，也不代表对所有数值自由中文翻译提供了通用保证。

## 用户复验

管理员登录后可直接打开[本次新结果](http://127.0.0.1:19501/pages/ai01/?articleId=pmc-PMC13672493&requestKey=article-08c45c5c-c43f-4008-9e01-34e5f7ff1ea2&inputHash=c43b875f52b4061562fb7871cee52a396803d8df5ca8ca6e82fe5745c7540f7c)，在原阅读区滚动核对两项原文依据、“随访仅4周”和局限；刷新只读恢复。打开原失败任务仍失败属保留历史，不需要清浏览器或重置账本。需要新问题时由本人点“发送本篇问题”，按当前Token额度预检，不自动发起。

最终交付范围：本机数值来源/语境修补的技术闭环；非生产发布、全平台通用语义证明或甲方专业签认。文档/Notion同步收据随实施计划登记。
