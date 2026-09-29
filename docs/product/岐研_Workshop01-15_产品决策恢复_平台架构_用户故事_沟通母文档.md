# 岐研｜Workshop 01--15 产品决策恢复与王教授沟通母文档

**版本：Recovery Draft v1.0**\
**用途：产品内部统一 / 王教授产品沟通 / Demo 讲解 / 后续
PRD、Figma、Codex 的产品依据**\
**恢复依据：Workshop 01--15 形成的 Product Baseline v1.0、受控修订
v1.0.1、原始《针灸治疗情志病科研平台｜产品架构+功能清单+用户故事（完整版
MVP）》以及此前讨论上下文。**

> **重要说明**\
> 这不是 15 轮 Workshop 的逐字会议纪要，而是依据最终 Decision
> Log、Product Baseline 和原始 MVP PRD 对 01--15
> 的"产品决策链"进行恢复。\
> 对于有明确 Workshop 编号与 DEC
> 记录的内容，按正式决策恢复；对于没有保留逐轮原始文字的
> Workshop，只恢复其在前后决策链中的作用，不虚构当时原话、参与人观点或不存在的结论。\
> 对外向王教授介绍时，应把尚未验证的内容称为"我们希望与您共同验证的产品假设"，不要包装成已被临床证明的事实。

------------------------------------------------------------------------

# 0. 一页执行摘要

## 0.1 岐研最终产品定位

**岐研是一套以 Study 为科研执行单元、以 Research Hub
为领域知识与协作网络、以 Research Asset 为科研价值沉淀载体，并由
Evidence-grounded Research Copilot 贯穿完整 Research Lifecycle
的中医临床研究智能平台。**

它不是传统 EDC 的简单升级，也不是文献平台、AI
聊天机器人或单一病种项目管理系统。

它要解决的核心问题是：

> **让临床经验沉淀为可信证据，并让可信证据更早形成下一项值得研究的问题。**

## 0.2 王教授项目的定位

王教授项目不是重新建设一套独立"针灸治疗情志病科研系统"，而是在统一的**岐研
Platform** 上建设首个**针灸治疗情志病 Research Hub**，并用真实课题验证：

**领域动态发现 → 研究机会 → 研究问题 → Study → 执行与数据质量 →
分析与产出 → 科研资产 → Hub 复用**

这一完整闭环。

## 0.3 Workshop 01--15 最重要的产品升级

原始思路更接近：

**专科科研系统 = 建题 + 数据采集 + 随访 + 文献 + AI 工具**

Workshop 之后升级为：

**Research Intelligence Platform = Research Discovery + Study
Execution + Evidence-grounded AI + Research Accumulation**

核心变化不是"多了几个功能"，而是**产品对象、用户心智和科研价值链被重新定义**。

------------------------------------------------------------------------

# 1. Workshop 01--15 总览

  -------------------------------------------------------------------------------------------------------------------------
  Workshop                核心主题                     最终沉淀
  ----------------------- ---------------------------- --------------------------------------------------------------------
  W01                     重新审视原始专科 MVP         从"功能清单"转向"产品对象与科研任务"
                          与现有岐研                   

  W02                     产品层级与核心业务上下文     岐研为顶层产品；针灸治疗情志病为 Research Hub；Study
                                                       为核心业务上下文

  W03                     Hub、Study                   明确不能把 Hub、课题、知识库混成一个层级，为资产模型铺路
                          与科研成果之间如何连接       

  W04                     科研成果如何成为可复用价值   Creator 发起、Publisher 审批；作者和来源持续保留

  W05                     身份、成员、角色、权限与 Hub Identity + Membership + Role + Scope + Permission；Hub
                          治理                         分层参与；课题自治

  W06                     完整 Research Lifecycle 与   Discover→Accumulate；AI 贯穿生命周期；AI Assist Human
                          AI                           Decide；Closeout ≠ End

  W07                     从生命周期反推产品对象       Discovery、Design、Execution、Data、Analysis、Output、Accumulation
                                                       需要连续连接

  W08                     Research Hub 的领域价值      Hub
                                                       不应只是课题目录或文献门户，而应连接领域变化、研究活动与下一项研究

  W09                     Platform / Hub / Study       Platform 通用化、Hub 领域化、Study 专业化
                          分层原则                     

  W10                     AI 产品模型                  统一 Research Copilot；后台 Specialized Agents；Context
                                                       对齐业务；Evidence-grounded；三种 AI 形态

  W11                     Study 从 Operations 升级     Execution 成为子域；增加设计、分析、产出、资产
                          Workspace                    

  W12                     My Research 与个人科研工作   My Research = 个人科研指挥中心；Job Adaptive；功能属于
                                                       Study，工作属于 User

  W13                     Research Asset 与治理        Artifact ≠
                                                       Asset；Provenance、Version、Scope、Lineage；Discoverability ≠
                                                       Accessibility

  W14                     Golden Journey 与用户验证    不按功能清单做原型；教授与研究员分任务；Task-based Validation

  W15                     Product Baseline 冻结与进入  Discovery 阶段性完成；冻结产品模型、MVP 边界、假设与 Open Questions
                          Prototype                    
  -------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 2. Workshop 01｜从"专科功能方案"回到"产品到底是什么"

## 背景

原始 MVP
已经有非常丰富的专科需求：标准化建题、证型/量表采集、针灸干预、长期随访、课题隔离、文献追踪、科研情报、知识库、科研写作
Agent 等。

问题在于：这些内容主要按"接入层 / 应用层 / 智能层 / 数据层 /
硬件层"组织，适合解决方案架构，但还不能清楚回答：

-   用户究竟在使用什么产品？
-   一个领域、一个课题、一个团队是什么关系？
-   AI、文献、数据和研究成果围绕什么业务对象组织？
-   杜教授项目与王教授项目是两个系统，还是一个平台里的不同研究？

## 当时争论的问题

核心矛盾可以恢复为：

**继续做一个"针灸治疗情志病垂直科研平台"，还是把已有岐研重新抽象为可承载多个专科/病种的产品平台？**

## Option / 分歧

**Option A：继续以针灸治疗情志病作为顶层产品。**\
优点：专科感强、短期表达直接。\
风险：病种、课题、平台、团队和知识空间混在一起；未来每个教授/病种都可能复制一套系统。

**Option B：岐研成为顶层产品，专科能力进入领域上下文。**\
优点：既保护已有 Study Execution，又能形成可复制的平台模型。

## 最终决策

W01 本身没有在现存 Decision Log 中留下独立 DEC 编号；它更像整个
Discovery 的问题重构轮。随后 W02 正式冻结了顶层产品层级。

## 为什么这么决定

因为原始 PRD
的问题不是功能少，而是**产品层级混合**。继续增加功能只会让系统更像"大而全菜单"，无法形成稳定
IA、权限模型和 AI Context。

## 对后续产品的影响

-   后续不再从"功能模块清单"出发设计首页。
-   开始用 Platform / Hub / Study / Asset 等领域对象建模。
-   王教授项目不再天然等于"新建一套系统"。

## 尚未关闭问题

-   "Research Hub"面向教授的中文名称是什么？
-   针灸治疗情志病的专科深度如何保留，同时避免把 Platform 写死？

------------------------------------------------------------------------

# 3. Workshop 02｜产品层级重构：岐研、Research Hub、Study

## 背景

必须解决杜教授已有系统、王教授新项目、针灸治疗情志病领域和未来其他中医专科之间的层级关系。

## 当时争论的问题

1.  岐研是不是顶层产品？
2.  "针灸治疗情志病"到底是产品、项目、专区还是研究领域？
3.  王教授的一项具体多中心研究是否等于这个领域平台？
4.  用户角色应该绑定账号，还是绑定具体 Study？

## Option / 分歧

**A：一个教授/病种一套独立平台。**\
短期直观，但会造成产品碎片化。

**B：一个统一岐研平台 + 多个领域空间 + 多个自治 Study。**

## 最终决策

-   **DEC-001：产品层级重构。**岐研为顶层产品，针灸治疗情志病为岐研中的垂直空间，而非独立平台。
-   **DEC-002：岐研是顶层产品。**杜教授和王教授项目均在统一平台延伸。
-   **DEC-003：Study 是核心业务上下文。**角色随 User × Study 关系变化。

## 为什么这么决定

真正稳定的业务责任边界是 Study。教授可以在一个 Study 是 PI，在另一个
Study 是协作者；"账号 = 固定角色"的模型无法支撑真实科研协作。

## 对后续产品的影响

形成第一版核心结构：

**Qiyan Platform → Research Hub ↔ Study**

并为后续 My Research、Membership、Asset、AI Context 奠定基础。

## 尚未关闭问题

-   Study 是否可以关联多个 Hub？
-   Hub 与 Study 的关联由谁授权？
-   Hub 是否应该看到 Study 的哪些 Metadata？

------------------------------------------------------------------------

# 4. Workshop 03｜Hub 与 Study 之间缺少"价值传递层"

## 背景

W02 解决了"领域"和"具体研究"的关系，但仍有一个缺口：

**一个 Study 做完以后，什么回到 Hub？**

如果答案只是"把文件放进知识库"，Hub 最终会退化成文档库。

## 当时争论的问题

-   Study 的数据、方案、分析、报告是否都自动属于 Hub？
-   Hub 发起人是否天然拥有所有研究成果？
-   论文、方案、量表、数据集、AI 总结是否都是同一种"知识"？

## Option / 分歧

**A：Study 内容自动汇聚到 Hub。**\
简单，但破坏课题自治、数据权限和作者责任。

**B：研究过程内容先属于
Study，只有经过治理的价值对象才进入更高层复用。**

## 最终决策

现存 Decision Log 没有 W03 独立
DEC，因此这里不能伪造正式决议。可以确认的是：W03 的问题在 W04 和 W13
被正式解决------最终形成 **Research Artifact → Research Asset → Hub
Reuse**。

## 为什么这么决定

科研成果不仅是文件，还涉及来源、作者、版本、责任、适用范围、数据权限和派生关系。

## 对后续产品的影响

Research Asset 成为连接 Study Production Loop 与 Hub Discovery Loop
的关键对象。

## 尚未关闭问题

-   哪些 Artifact 值得升级为 Asset？
-   谁审批？
-   数据类 Asset 与知识类 Asset 是否采用相同治理强度？

------------------------------------------------------------------------

# 5. Workshop 04｜科研资产治理：不是"上传文件"就是资产

## 背景

平台要形成长期科研价值，就必须回答"研究成果如何被可信地沉淀与复用"。

## 当时争论的问题

-   创建者是否可以直接发布为领域资产？
-   Hub 发起人是否有权修改他人资产？
-   复用后如何保留原作者和来源？

## Option / 分歧

**A：像网盘/知识库一样上传即共享。**\
低门槛，但科研责任和来源链条弱。

**B：Creator 发起资产化，Publisher 审核；作者与来源永久保留。**

## 最终决策

**DEC-004：科研资产治理原则。Creator 可发起，Publisher
审批，作者与来源持续保留。**

## 为什么这么决定

科研复用必须保留责任和来源，否则"共享"会变成复制文件，无法形成可信的学术资产体系。

## 对后续产品的影响

后续形成：

**Artifact → Candidate Asset → Reviewed Asset → Research Asset → Shared
Asset → Hub Asset → Domain Asset**

## 尚未关闭问题

-   共享后的撤回、弃用、替代版本如何处理？
-   Domain Recommended Asset 是否需要专家委员会？

------------------------------------------------------------------------

# 6. Workshop 05｜身份、角色、权限与 Hub 治理

## 背景

一旦平台支持多个团队、Hub 和 Study，"谁能看什么、做什么"成为核心问题。

## 当时争论的问题

-   用户是否必须先属于机构才能使用？
-   PI 是否是账号永久角色？
-   Hub 发起人是否审批 Hub 内所有 Study？
-   公开浏览、Hub 成员、认证研究者、Study 成员权限是否相同？

## Option / 分歧

**A：账号绑定固定角色 + Hub 中央审批。**\
实现简单，但不符合跨课题协作。

**B：身份与角色分离；权限来自 Membership + Context。**

## 最终决策

-   **DEC-005：Identity + Membership + Role + Scope + Permission。**
-   **DEC-006：允许个人科研身份；正式临床研究和患者数据再触发机构与身份认证。**
-   **DEC-007：Hub 分层参与。**
-   **DEC-008：Hub 不审批所有课题；认证研究者可创建
    Study，涉及机构资源时走相应治理。**

## 为什么这么决定

科研协作天然是多上下文、多角色的。平台需要保护课题自治，同时允许领域共建。

## 对后续产品的影响

形成治理原则：

> **课题自治、领域共建、授权共享、平台治理。**

## 尚未关闭问题

-   Hub Member 认证规则。
-   单机构 / 多中心 Study 的创建政策。
-   Data Ownership、Custody、Control、Access、Use、Share
    的法律与治理边界。

------------------------------------------------------------------------

# 7. Workshop 06｜从 Study Execution 扩展到完整 Research Lifecycle

## 背景

现有岐研的强项集中在启动与执行：Subject、Visit、eCRF、Questionnaire、Task、Deviation、Query、Review、Data
Agent 等。

如果产品只停留在执行层，它仍然更接近高质量临床研究执行系统。

## 当时争论的问题

-   岐研要不要向研究发现、设计、分析、产出、资产延伸？
-   AI 是一个独立入口还是贯穿科研过程？
-   Study Closeout 是否意味着产品价值结束？

## Option / 分歧

**A：继续把执行做深。**\
风险：无法形成"科研智能平台"的完整价值。

**B：保留 Execution Core，同时向前后扩展完整 Research Lifecycle。**

## 最终决策

-   **DEC-009：覆盖完整 Research Lifecycle。**
-   **DEC-010：AI 贯穿生命周期，不作为独立孤岛。**
-   **DEC-011：AI Assist Human Decide。**
-   **DEC-012：Study Closeout 不等于结束，增加 Research Accumulation。**

生命周期最终形成：

**Discover → Ideate → Design → Launch → Execute → Data & Quality →
Analyze → Produce → Accumulate → New Discovery**

## 为什么这么决定

科研真正的价值不是"完成采集"，而是从问题到可信成果，再把成果转成下一轮研究基础。

## 对后续产品的影响

这是岐研从"研究执行系统"升级为"Research Intelligence
Platform"的关键转折。

## 尚未关闭问题

-   各阶段 Production MVP 的具体深度。
-   哪些阶段可以复用现有能力，哪些需要新增对象。

------------------------------------------------------------------------

# 8. Workshop 07｜从生命周期反推领域对象，而不是继续堆菜单

## 背景

W06
有了完整生命周期，但如果仍然把"文献、AI、数据、报告"作为孤立模块，生命周期只会停留在
PPT 上。

## 当时争论的问题

-   Discover 阶段的核心对象是什么？
-   Ideate 如何避免"一篇论文一键生成课题"？
-   Analyze 产生的是结果、文件还是可追溯 Analysis Artifact？
-   Produce 与 Accumulate 如何连接？

## Option / 分歧

**A：生命周期只是导航分类。**

**B：每个阶段必须有稳定的领域对象和状态转换。**

## 最终决策

W07 没有单独保留 DEC 编号，但后续 Baseline 明确形成对象链：

**External Evidence → Research Opportunity → Research Question →
Hypothesis / Protocol → Study**

以及：

**Study → Research Artifact → Research Asset → Hub Reuse → New Study**

## 为什么这么决定

页面会变化，但对象、来源、权限、状态和关系更稳定。产品、UX、数据模型和
AI 都需要共享同一种业务语言。

## 对后续产品的影响

Research Opportunity、Research Question、Artifact、Asset、Attention
等成为后续产品设计的核心对象。

## 尚未关闭问题

-   Research Question 的 Ownership / Collaboration / Version / Lifecycle
    State。
-   Opportunity 的生成标准和误报反馈。

------------------------------------------------------------------------

# 9. Workshop 08｜Research Hub 不是文献门户，也不是课题后台

## 背景

有了 Hub 概念后，最大的风险是把它做成"领域首页 + 文献列表 + 课题列表"。

## 当时争论的问题

Hub 为什么值得教授持续回来？

它应该回答：

1.  领域最近发生了什么？
2.  哪些变化与我有关？
3.  什么值得进一步探索？
4.  已有哪些团队、研究和资产？
5.  我下一步可以做什么？

## Option / 分歧

**A：传统 Feed / 文献门户。**

**B：Personalized Research Brief + Evidence + Opportunity + Study +
Asset 的领域研究空间。**

## 最终决策

W08 在现存 Decision Log 中主要保留为 HYPOTHESIS，而非正式 DEC：

-   Personalized Research Brief 优先于传统最新论文 Feed。
-   Hub 的价值在于连接领域变化、个体研究、机会和新 Study。
-   Research Network 后置，不以帖子、评论、点赞为核心。

## 为什么这么决定

教授没有必要再获得一个"信息更多"的平台；真正价值是**缩短从领域变化到科研判断的时间**。

## 对后续产品的影响

形成 Research Hub Value Loop：

**External World → Radar → Evidence → Opportunity → Question → Study →
Data → Analysis → Output → Asset → Hub**

## 尚未关闭问题

-   Radar 数据源、许可、更新频率。
-   Research Opportunity 是否符合教授真实科研心智。
-   Hub 中文名称。

------------------------------------------------------------------------

# 10. Workshop 09｜Platform 通用化、Hub 领域化、Study 专业化

## 背景

原始 PRD
强调"所有能力都围绕针灸治疗情志病垂直定制，不泛化"。这对项目表达有价值，但如果落实到平台底层，会导致每个专科重复建设。

## 当时争论的问题

哪些能力应该通用？哪些必须领域化？哪些应该由具体 Study 配置？

## Option / 分歧

**A：全栈专科化。**\
每个专科拥有独立权限、访视、数据、AI 等能力。

**B：三层分工。**

-   Platform：身份、权限、Study Engine、数据治理、AI
    基础设施等通用能力。
-   Hub：领域知识、标准、Evidence、AI Context。
-   Study：Protocol、Outcome、Visit、eCRF、具体执行。

## 最终决策

**DEC-013：Platform 通用化、Hub 领域化、Study 专业化。**

## 为什么这么决定

这是"可复制产品"与"专科价值"之间的平衡点。

## 对后续产品的影响

针灸治疗情志病成为首个验证
Hub，但产品架构可以复制到其他中医优势病种或专科，而不需要复制整套系统。

## 尚未关闭问题

-   哪些标准属于 Platform，哪些属于 Hub。
-   多 Hub 共用同一 Study 的治理方式。

------------------------------------------------------------------------

# 11. Workshop 10｜统一 Research Copilot：AI 必须知道"我在哪里工作"

## 背景

原始系统已有 Data Agent、科研 Agent、知识库；继续增加 Agent
容易让用户面对一堆工具。

## 当时争论的问题

-   用户应该选择不同 Agent，还是面对一个统一科研 AI？
-   AI 是否能直接修改正式数据？
-   AI 的上下文从哪里来？
-   如何让科研人员知道 AI 的依据和边界？

## Option / 分歧

**A：多个独立 Agent / 工具入口。**

**B：前台统一 Research Copilot，后台 Specialized Agents。**

## 最终决策

-   **DEC-014：统一 Copilot 体验。**
-   **DEC-015：AI Context 对齐业务
    Context：User、Hub、Study、Subject、Visit、Artifact。**
-   **DEC-016：AI Assist Human Accountable。**
-   **DEC-017：三种 AI 形态：Embedded / Copilot / Proactive。**
-   **DEC-018：重要 AI 输出必须 Evidence-grounded and Traceable。**

## 为什么这么决定

科研 AI
的价值不是"会聊天"，而是**知道用户当前研究上下文、能看到被授权的证据、明确自己能做什么和不能做什么**。

可用 CCAE 理解：

-   **Context**：AI 当前知道哪些研究上下文。
-   **Capability**：AI 能完成哪些任务。
-   **Authority**：AI 被允许执行到哪一步。
-   **Evidence**：AI 的判断依据是什么。

## 对后续产品的影响

岐研 AI 从"功能"升级为横向能力层。

## 尚未关闭问题

-   AI 运行审计：模型版本、Prompt、检索来源、运行记录、保留周期。
-   Diagnosis Agent 长期定位。
-   不同场景的 Human Review 强度。

------------------------------------------------------------------------

# 12. Workshop 11｜Study Operations → Study Workspace

## 背景

现有岐研 Study
执行能力已经较强，但"课题空间"仍容易被理解为项目执行后台。

## 当时争论的问题

Study
是否只负责执行？研究设计、分析、科研产出、资产是否应该进入同一科研上下文？

## Option / 分歧

**A：Study = Operations。**

**B：Study = 完整科研工作空间，Execution 只是其中一个子域。**

## 最终决策

**DEC-019：Study Operations 演进为 Study Workspace。**

形成：

**课题概览 → 研究设计 → 研究执行 → 数据与质量 → 研究分析 → 科研产出 →
科研资产 → 团队与设置**

## 为什么这么决定

研究人员需要围绕"这项研究"工作，而不是在数据、AI、文档、报告多个工具之间反复切换。

## 对后续产品的影响

-   现有 Subject / Visit / eCRF / Query / Deviation / Raw Data /
    Standard Data 全部保留。
-   Data Agent 被嵌入采集与数据确认。
-   科研 Agent 升级为 Study-aware Copilot。
-   新增 Analysis、Output、Asset 工作域。

## 尚未关闭问题

现有 Study 页面与新 IA 如何渐进迁移，不能破坏已经验证的执行效率。

------------------------------------------------------------------------

# 13. Workshop 12｜My Research：功能属于 Study，工作属于 User

## 背景

教授同时主持、参与、协作多个
Study；研究员每天也可能跨课题处理访视、疑问和确认。

传统 Dashboard 往往展示大量指标，却不能回答"我现在最应该做什么"。

## 当时争论的问题

-   首页按角色硬切，还是按用户当前任务适配？
-   My Research 是否复制所有 Study 功能？
-   跨课题待办、风险、科研机会如何聚合？

## Option / 分歧

**A：按 PI / CRC / 研究员做不同固定首页。**

**B：Job Adaptive Experience，围绕用户任务动态组织。**

## 最终决策

-   **DEC-020：My Research 是个人科研指挥中心。**
-   **DEC-021：采用 Job Adaptive Experience。**
-   **DEC-022：功能属于 Study，工作属于 User。**

My Research 核心组成：

-   Research Inbox
-   Research Portfolio
-   Research Brief
-   Today's Work
-   Qiyan AI

## 为什么这么决定

复杂业务结构应该留在
Study；用户首页应该帮助用户**压缩认知负担和跨课题切换成本**。

## 对后续产品的影响

后来首页出现"今天最需要判断什么""Research
Attention"等设计，根源就在这里。

## 尚未关闭问题

Research Attention
的优先级、聚合、去重、关闭和误报反馈仍需真实用户验证。

------------------------------------------------------------------------

# 14. Workshop 13｜Research Asset：把"研究结束"变成"下一项研究的开始"

## 背景

如果每个 Study 结束后只留下数据文件、报告和论文，平台无法形成长期复利。

## 当时争论的问题

-   Artifact 和 Asset 是否是一回事？
-   外部 Evidence、Knowledge、Data 是否都可以直接共享？
-   数据集"可发现"是否意味着"可访问"？
-   资产复用后如何保留派生关系？

## Option / 分歧

**A：知识库式管理：上传、分类、共享。**

**B：受治理的科研资产生命周期。**

## 最终决策

-   **DEC-023：Artifact 与 Asset 分离。**
-   **DEC-024：资产分级生命周期。**
-   **DEC-025：资产必须有 Provenance、Version、Governance
    Context、Access Scope。**
-   **DEC-026：知识与数据不同治理。**
-   **DEC-027：Discoverability ≠ Accessibility。**
-   **DEC-028：支持引用、派生和 Lineage。**
-   **DEC-029：Knowledge 是工作空间，Asset 是受治理价值对象。**

## 为什么这么决定

科研价值的长期复用依赖可信来源、责任、版本和授权，而不是文件数量。

## 对后续产品的影响

形成岐研第二条核心飞轮：

**Study → Artifact → Asset → Hub → Reuse → New Study**

## 尚未关闭问题

-   Asset 访问撤回和版本责任。
-   Domain Asset 推荐治理。
-   跨机构 Dataset 的完整治理流程。

------------------------------------------------------------------------

# 15. Workshop 14｜Golden Journey：不再按"功能清单"设计 Demo

## 背景

产品模型已经复杂，如果原型仍按菜单逐页展示，教授看到的会是"很多功能"，而不是"科研工作方式"。

## 当时争论的问题

-   原型是覆盖所有页面，还是验证关键科研任务？
-   教授是否需要测试 Subject、Visit 等大量日常执行页面？
-   如何判断 AI 是否被理解和信任？

## Option / 分歧

**A：Feature Demo。**

**B：Task-based Golden Journey。**

## 最终决策

-   **DEC-030：以 Golden Journey 驱动原型。**
-   **DEC-031：教授与研究员分任务集。**
-   **DEC-032：Task-based Validation，记录 First Click、Wrong
    Turns、Time to Insight、Concept Understanding、AI Trust。**

七条核心 Journey：

1.  **领域变化 → Evidence → Opportunity → Question → Study**
2.  **已有 Protocol → AI 理解结构 → 补齐配置 → Study**
3.  **Visit → 原始 Evidence → AI 解析 → 人工确认 → 可信数据**
4.  **PI Research Attention → 理解异常 → 查看依据 → Human Decision**
5.  **Dataset → Analysis → Analysis Artifact → Report / PPT**
6.  **Study → Candidate Asset → Review → Hub Asset → Reuse**
7.  **教授自主探索 Hub → 发现与自己有关的领域变化和研究机会**

## 为什么这么决定

真正需要验证的不是"用户能不能找到一个按钮"，而是：

> **教授是否理解岐研的产品心智，并愿意把它放进自己的科研工作流。**

## 对后续产品的影响

19 张高保真页面和后续 Demo 都应该服务于 Golden
Journey，而不是反过来让产品围绕页面生长。

## 尚未关闭问题

多轮可用性研究的样本、阈值、Time to Insight 与 AI Trust 基线尚未确定。

------------------------------------------------------------------------

# 16. Workshop 15｜冻结 Product Baseline，Discovery 阶段性完成

## 背景

经过前 14 轮，如果继续无限讨论，会陷入概念完善而无法验证。

## 当时争论的问题

-   什么已经是 Decision？
-   什么仍是 Hypothesis？
-   什么是 Open Question？
-   哪些长期能力必须后置？
-   下一阶段到底做 PRD、UI 还是 Prototype？

## Option / 分歧

**A：继续补齐所有功能和治理细节再设计。**

**B：冻结 Product Baseline，把不确定性显式登记，用 Prototype
和教授验证。**

## 最终决策

截至 Workshop 15 的产品认知冻结为 Product Baseline v1.0。

下一阶段顺序：

**Prototype Scope → Low Fidelity UX → Professor Validation → UX Revision
→ Visual Direction → Interactive Prototype → Codex Handoff**

## 为什么这么决定

产品 Discovery 的目标不是证明团队的想法正确，而是尽快暴露错误假设。

## 对后续产品的影响

建立四种状态：

-   **FACT**：已有事实。
-   **DECISION**：Workshop 已冻结决定。
-   **HYPOTHESIS**：需要真实用户验证。
-   **OPEN QUESTION**：证据不足，不允许 UI / 开发自行补答案。
-   **LATER**：方向可能成立，但不进入当前 MVP。

## 尚未关闭问题

包括但不限于：

-   Data Ownership 与 Legal Governance
-   Hub 中文名称
-   Hub 成员认证与 Study 创建政策
-   Radar 数据源与许可
-   Opportunity 生成标准
-   AI 运行审计
-   Study 迁移策略
-   Research Attention 规则
-   Asset 撤回与版本责任
-   成功指标框架
-   Study ↔ Hub Association Policy
-   Research Question 的 Ownership / Collaboration / Version / Lifecycle

------------------------------------------------------------------------

# 17. 15 轮 Workshop 最终提炼的平台架构

## 17.1 产品上下文架构

``` text
┌──────────────────────────────────────────────────────────────┐
│                    岐研 Qiyan Platform                       │
│ 身份｜机构｜权限｜治理｜Study Engine｜AI Infrastructure       │
└──────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   My Research       Research Hub     Management & Governance
  我的科研指挥中心      领域研究中心          管理与治理
          │                │
          └──────────┬─────┘
                     ▼
               Study Workspace
                 具体研究/课题
                     │
      ┌──────────────┼────────────────┐
      ▼              ▼                ▼
 Design/Execute   Data/Analysis   Output/Artifact
                                      │
                                      ▼
                               Research Asset
                                      │
                                      ▼
                                  Hub Reuse
```

## 17.2 Research Intelligence 双循环

``` text
外部科研世界
     │
     ▼
Radar / Research Brief
     │
     ▼
External Evidence
     │
     ▼
Research Opportunity
     │
     ▼
Research Question
     │
     └────────────── Research Discovery Loop
     ▼
Study Design
     ▼
Study Execution
     ▼
Data & Quality
     ▼
Analysis
     ▼
Research Output
     ▼
Research Artifact
     ▼
Research Asset
     │
     └────────────── Research Production Loop
     ▼
Research Hub
     ▼
新的 Evidence / Opportunity / Study
```

## 17.3 AI 横向架构

``` text
                 Qiyan Research Copilot
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
     Embedded           Copilot          Proactive
   流程内 AI 辅助       对话/协作         主动发现与提醒
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
              CCAE Trust Boundary
      Context | Capability | Authority | Evidence
                          │
                          ▼
               Human Review / Approval
```

------------------------------------------------------------------------

# 18. 从原始 MVP 到岐研 vNext：到底升级了什么

## 18.1 从"专科项目"升级为"平台 + 领域 + Study"

**过去：**针灸治疗情志病科研平台。\
**现在：**岐研是 Platform，针灸治疗情志病是首个 Research
Hub，具体研究是自治 Study。

**商业意义：**王教授买到的不是一次性项目，而是一个可以持续承载研究、团队、证据和科研资产的领域科研空间。

## 18.2 从"EDC / 执行"升级为"完整科研生命周期"

过去重点是建题、入组、访视、采集、随访。\
现在覆盖 Discover、Ideate、Design、Launch、Execute、Data &
Quality、Analyze、Produce、Accumulate。

## 18.3 从"AI 工具集"升级为"Research Copilot"

过去：Data Agent、科研 Agent、写作 Agent 等工具。\
现在：用户面对统一岐研 AI，AI 自动继承当前 User / Hub / Study / Subject
/ Visit / Artifact Context。

## 18.4 从"知识库"升级为"科研资产体系"

过去：上传、分类、知识沉淀。\
现在：Artifact 与 Asset 分离；资产有
Provenance、Version、Governance、Access Scope、Lineage。

## 18.5 从"Dashboard"升级为"My Research"

过去：展示指标。\
现在：回答"我现在最应该关注什么"，用 Research Attention
聚合风险、审批、Query、Insight、Opportunity 等。

## 18.6 从"文献追踪"升级为"Research Discovery"

过去：最新论文、订阅、检索。\
现在：

**Evidence → Opportunity → Question → Study**

避免"看了一篇论文 → AI 一键生成课题"的伪科研捷径。

## 18.7 从"项目结束"升级为"科研复利"

过去：Closeout。\
现在：Accumulate。

> **一项研究结束，不是平台价值的终点，而是下一项研究的起点。**

------------------------------------------------------------------------

# 19. 从产品角度重新整理的核心用户故事

## 19.1 王教授 / PI：科研决策者

### Story P1｜每天知道最值得判断什么

**作为 PI，**\
我希望进入岐研后，不需要逐个检查所有课题，系统能够把真正需要我判断的研究风险、异常、机会和审批聚合出来，\
**从而让我把时间用于科研判断，而不是信息巡检。**

产品对象：My Research / Research Attention。

### Story P2｜知道"为什么值得关注"

**作为 PI，**\
当系统告诉我某个中心入组下降或某个研究机会值得关注时，我希望同时看到事实、证据、影响、不确定性和
AI 判断依据，\
**从而决定是否采取行动，而不是相信一个黑箱结论。**

产品对象：Research Attention / Evidence / Qiyan AI。

### Story P3｜持续掌握一个研究领域

**作为领域负责人，**\
我希望 Research Hub
帮助我理解针灸治疗情志病领域最近发生了什么、哪些变化与我的研究有关、哪些方向值得进一步探索，\
**从而把领域变化转化为下一项研究。**

产品对象：Research Hub / Radar / Research Brief / Opportunity。

### Story P4｜从证据形成研究问题

**作为科研负责人，**\
我希望把支持证据、相反证据和研究空白组织成一个可讨论、可编辑、可追溯的
Research Question，\
**而不是让 AI 直接替我生成一个"正式课题"。**

### Story P5｜已有方案不要重新录一遍

**作为已有 Protocol 的 PI，**\
我希望岐研先理解已有方案，识别研究对象、干预、结局、访视和缺失配置，\
**从而减少重复录入，并由团队确认后进入 Study。**

原则：Understand before asking researchers to re-enter。

### Story P6｜研究结束后还能继续产生价值

**作为 PI，**\
我希望研究产生的方案、工具、分析方法、知识和成果经过治理后成为 Research
Asset，\
**从而可以被下一项研究引用、派生和复用。**

------------------------------------------------------------------------

## 19.2 研究员 / 临床科研人员：执行与确认者

### Story R1｜今天先做什么

作为研究员，我希望 My Research
直接告诉我今天的访视、待确认数据、即将逾期任务和
Query，而不是让我进入多个 Study 查找。

### Story R2｜降低采集负担但不牺牲可信度

作为临床科研人员，我希望上传原始资料后由 AI
解析和提出结构化数据，我只需要核对和修正；AI
提议不能直接覆盖正式研究数据。

### Story R3｜围绕一次 Visit 完成工作

作为研究员，我希望在 Visit Workspace 中一次看到该访视需要的
Evidence、采集任务、时间窗口和完成条件，减少跨模块跳转。

------------------------------------------------------------------------

## 19.3 Hub 成员 / 领域协作者：发现与复用者

### Story H1｜发现已有成果而不是重复造轮子

作为 Hub 成员，我希望知道领域中已经有哪些
Study、Protocol、Instrument、Knowledge 和
Asset，从而优先引用或申请合作。

### Story H2｜能发现数据集，但不能越权拿数据

作为协作者，我希望看到某个 Dataset 的 Metadata
和价值，但真正访问患者级数据仍需要独立授权。

原则：Discoverability ≠ Accessibility。

------------------------------------------------------------------------

## 19.4 治理角色

### Story G1｜AI 不能悄悄改变科研事实

作为治理者，我希望关键科研状态、正式数据、资产发布和外部共享都保留授权人员确认和审计链。

### Story G2｜资产共享必须有责任链

作为 Publisher，我希望看到 Asset
的来源、作者、版本、适用范围、共享范围和 Derived From，再决定是否发布。

------------------------------------------------------------------------

# 20. 给王教授讲平台时的"能力地图"

不要按菜单介绍。建议分成五种能力：

## 能力一：看见科研

-   My Research
-   Research Attention
-   Research Portfolio
-   Research Brief
-   Research Hub Radar

**给教授的表达：**

> 岐研首先帮助您"看见真正值得关注的科研"，而不是让您多看一个 Dashboard。

## 能力二：理解科研

-   Evidence
-   Opportunity
-   Research Question
-   Qiyan AI
-   支持证据 / 相反证据 / 不确定性

**表达：**

> AI
> 不只是告诉您发生了什么，还必须告诉您为什么这么判断、依据在哪里、哪里还不能确定。

## 能力三：把问题变成研究

-   Question
-   Hypothesis
-   Protocol
-   Study Design
-   Protocol Upload & Structure

**表达：**

> 好的科研不是从录数据开始，而是从一个值得研究、能够被证据解释的问题开始。

## 能力四：把研究做可信

-   Subject
-   Visit
-   eCRF
-   Follow-up
-   Query
-   Deviation
-   Data Quality
-   Dataset
-   Analysis

**表达：**

> AI 可以降低科研执行负担，但不能降低研究可信度。

## 能力五：让科研形成复利

-   Research Output
-   Research Artifact
-   Asset Review
-   Research Asset
-   Hub Reuse
-   Lineage

**表达：**

> 一项研究的终点不应该只是论文；它还应该成为下一项研究可以继续使用的科研资产。

------------------------------------------------------------------------

# 21. 王教授沟通主线：建议用 6 个问题讲完整个平台

## 第一问：您每天真正需要知道的是什么？

不是"平台今天有多少数据"，而是：

**今天有什么事情真正值得您判断？**

进入 My Research。

## 第二问：为什么值得判断？

展示 Research Attention：

**事实 → 偏差 → 影响 → AI 分析 → Evidence → 不确定性**

## 第三问：一个研究领域如何持续产生新问题？

进入"针灸治疗情志病 Research Hub"：

**领域变化 → Evidence → Opportunity → Question**

## 第四问：一个问题怎样变成可信研究？

进入 Study：

**Design → Execute → Data & Quality → Analyze**

## 第五问：AI 在哪里？

答案不是"右边有一个聊天框"。

> **AI 应该在科研人员工作的地方出现，并理解当前研究上下文。**

## 第六问：研究结束以后留下什么？

进入 Research Assets：

> **不是把文件归档，而是把经过治理、可追溯、可复用的科研价值留给下一项研究。**

------------------------------------------------------------------------

# 22. 面向签单沟通的核心价值表达

以下话术适合介绍产品价值，但应避免把尚未验证的医学效果、市场第一等 CLAIM
当成事实。

## 22.1 开场

> 王教授，我们这次不是想再给您做一个传统的科研管理系统。\
> 我们想解决的是更上层的问题：当您同时面对课题、团队、文献、数据和大量科研信息时，系统能不能帮助您更早发现真正值得关注的问题，更快看到依据，并把一次研究积累成下一次研究的基础。

## 22.2 为什么不是普通 EDC

> EDC
> 解决"数据怎么采"；岐研还希望继续回答"什么值得研究、研究现在发生了什么、为什么、结果意味着什么、哪些东西值得留下来继续复用"。

## 22.3 为什么不是普通 AI

> 我们不是在科研系统旁边放一个 ChatGPT。\
> 岐研 AI
> 必须知道您当前在哪个领域、哪项研究、哪个受试者或哪份科研产物里工作；同时它只能在授权范围内使用证据，关键科研状态最终仍由人确认。

## 22.4 为什么需要 Research Hub

> 您主持的不是只有一个课题。真正长期有价值的是"针灸治疗情志病"这个研究方向本身。\
> 所以我们希望给这个方向建立一个会持续成长的 Research
> Hub：新的证据进来，形成新的研究机会；研究完成以后，可信成果再回到
> Hub，继续支持下一项研究。

## 22.5 为什么值得长期建设

> 如果平台只帮助完成一次课题，它的价值会随着项目结束而下降。\
> 如果每一次 Study 都能沉淀新的 Evidence、Knowledge 和 Research
> Asset，平台的科研上下文会越来越强，下一项研究的起点也会越来越高。

------------------------------------------------------------------------

# 23. 建议保留的"金句"

1.  **岐研不是帮助科研人员管理一个课题，而是帮助科研团队建立一个持续进化的科研能力体系。**

2.  **让临床经验沉淀为可信证据，并让可信证据更早形成下一项值得研究的问题。**

3.  **Platform 通用化，Hub 领域化，Study 专业化。**

4.  **功能属于 Study，工作属于 User。**

5.  **AI Assist, Human Accountable。AI 可以辅助，但科研责任不能外包给
    AI。**

6.  **AI 给答案并不难，难的是让答案有依据、有边界、有责任归属。**

7.  **Evidence-grounded，而不是 Answer-grounded。**

8.  **好的科研不是从数据开始，而是从值得研究的问题开始。**

9.  **系统不应该让教授巡检所有模块，而应该主动把值得教授判断的事情呈现出来。**

10. **Research Hub
    的价值不是信息更多，而是让领域变化更快转化成科研判断。**

11. **Discoverability 不等于
    Accessibility：知道一份数据存在，不代表自动获得访问权。**

12. **Knowledge 是工作空间，Asset 是经过治理、可以长期复用的价值对象。**

13. **一项研究结束，不是科研价值的终点，而是下一项研究的起点。**

14. **我们不是把一个已经定义好的系统交给专家，而是和真正做科研的人一起定义未来科研工作的方式。**

------------------------------------------------------------------------

# 24. 王教授需要认可的不是 19 张页面，而是 7 个产品判断

建议沟通结束前明确确认：

1.  **是否认可"岐研 Platform + 针灸治疗情志病 Research Hub + 自治
    Study"的层级？**
2.  **是否认可 My Research 应优先告诉
    PI"什么值得判断"，而不是展示大量指标？**
3.  **是否认可 Evidence → Opportunity → Question 的研究发现路径？**
4.  **是否认可 AI 必须展示依据、限制和人工确认边界？**
5.  **是否认可已有 Protocol 应先被系统理解，而不是要求团队重新录入？**
6.  **是否认可 Study 完成后应继续形成 Research Asset 并可治理复用？**
7.  **针灸治疗情志病 Hub
    中，王教授最希望系统持续帮助他发现、判断和沉淀的科研任务分别是什么？**

这 7 个问题的答案，比"页面好不好看"更决定产品是否真正成立。

------------------------------------------------------------------------

# 25. 当前仍不能对王教授过度承诺的内容

以下内容仍属于 Hypothesis / Open Question /
Later，应作为共创议题而不是既定事实：

-   Research Attention 的最终生成与优先级规则。
-   Research Opportunity 的 AI 生成标准与误报机制。
-   Hub 的最终中文名称。
-   Hub Academic Governance。
-   数据所有权、使用权、共享权等法律与机构治理。
-   跨机构 Dataset 的完整访问流程。
-   AI 运行审计细则。
-   Research Question 的复杂版本与协作状态机。
-   Research Network / Research Graph 的完整形态。
-   "国内首个"等市场性表述，除非另行完成证据核验。
-   任何"AI
    一定提高临床疗效、随访依从性或科研产出"的效果性承诺，除非有真实数据验证。

------------------------------------------------------------------------

# 26. 最终总结：Workshop 01--15 真正完成了什么

15 轮 Workshop 并不是把一个原始 PRD"补完整"。

它完成的是一次产品模型升级：

``` text
原始专科科研系统
建题 + 采集 + 随访 + 文献 + AI 工具
                │
                ▼
         Study Execution Core
                │
                ▼
      完整 Research Lifecycle
                │
                ▼
 Platform + My Research + Research Hub + Study
                │
                ▼
 Evidence-grounded Research Copilot
                │
                ▼
 Artifact → Asset → Hub Reuse
                │
                ▼
      Research Intelligence Platform
```

最终岐研的价值不再只是：

> **把一项研究管好。**

而是：

> **帮助科研负责人持续发现值得研究的问题，把问题变成可信研究，把研究变成可复用资产，再让这些资产支持下一轮研究。**

这也是向王教授介绍岐研时最应该讲清楚的核心。
