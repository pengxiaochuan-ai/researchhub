# 岐研｜中医临床研究智能平台

## Workshop 01--15 产品决策恢复、平台架构、升级路径与王教授沟通母文档

**版本**：Workshop Recovery v1.0\
**用途**：产品决策母文档 / 王教授方案沟通 / 商务签约前产品说明 / 后续
UX、Figma、Codex 实现依据\
**整理原则**：优先依据 Workshop 01--15 冻结后的 Product Baseline v1.0 /
v1.0.1 与原始完整版 MVP PRD
恢复；无法从现有材料确认的逐轮细节明确标记为"恢复性推断"，不把后续 19
张高保真设计、Figma Make、Codex 实现阶段倒灌为 Workshop 原始结论。

------------------------------------------------------------------------

# 0. 阅读说明：哪些是"已确认"，哪些是"恢复性重构"

这份文档不是把后续设计稿反推成 Workshop，而是尽可能恢复 Workshop 01--15
的**产品决策演进**。

-   **A级｜已确认**：Product Baseline Decision Log 明确记录了 Workshop
    来源与决策编号。
-   **B级｜高可信恢复**：Baseline 正文、Hypothesis Register、原始 MVP
    PRD 能明确支持该轮讨论主题，但没有保存完整逐字讨论。
-   **C级｜恢复性推断**：为保持 01--15
    连续叙事，根据前后决策关系恢复"当时可能讨论的分歧与理由"；不能当作原会议逐字纪要。

> 对王教授沟通时，不需要讲"我们开了15轮
> Workshop"。真正应该讲的是：**我们经过多轮产品推演，把平台从"单课题执行系统"升级成了"覆盖科研全生命周期、以证据和科研资产为核心的智能科研平台"。**

------------------------------------------------------------------------

# 1. 一页结论：15轮 Workshop 最终把岐研变成了什么

## 1.1 最终产品定位

**岐研是一套以 Study 为科研执行单元、以 Research Hub
为领域知识与协作网络、以 Research Asset 为科研价值沉淀载体，并由
Evidence-grounded Research Copilot 贯穿完整 Research Lifecycle
的中医临床研究智能平台。**

它不是：

-   单一课题管理系统；
-   单一疾病数据库；
-   传统 EDC 的换皮；
-   文献检索工具；
-   ChatGPT 式 AI 聊天窗口；
-   若干 Agent 的功能集合。

它要解决的是一个更完整的问题：

> **如何让一个科研团队从"发现值得研究的问题"，到"形成可信研究"，再到"把研究结果沉淀为下一轮科研可以继续复用的资产"。**

## 1.2 产品愿景

> **让临床经验沉淀为可信证据，并让可信证据更早形成下一项值得研究的问题。**

## 1.3 核心产品飞轮

``` mermaid
flowchart LR
    A[外部 Evidence / 领域变化] --> B[Research Radar / Brief]
    B --> C[Research Opportunity]
    C --> D[Research Question]
    D --> E[Study Design]
    E --> F[Study Execution]
    F --> G[Data & Quality]
    G --> H[Analysis]
    H --> I[Research Output]
    I --> J[Research Artifact]
    J --> K[Human Review / Governance]
    K --> L[Research Asset]
    L --> M[Research Hub]
    M --> B
```

这意味着：**研究不再以"课题关闭"作为终点，而是以"形成可复用科研资产，并反哺下一轮研究"作为闭环。**

------------------------------------------------------------------------

# 2. Workshop 01--15 逐轮恢复

------------------------------------------------------------------------

## Workshop 01｜从"做一个专科系统"开始重新问：我们到底在做什么？

**恢复可信度：B/C**

### 背景

原始完整版 MVP PRD
已经包含针灸治疗情志病专科的标准化建题、低负担采集、长期随访、课题权限、文献、知识库、AI
写作等大量能力。但它同时混合了"平台""专科""课题""生态"几个层级。

现有杜教授项目又已经形成较成熟的 Study Execution
能力，因此新项目不能简单理解成"再做一套王教授系统"。

### 当时争论的问题

1.  王教授项目到底是一个独立系统，还是岐研的一部分？
2.  "针灸治疗情志病"究竟是产品名称、专科平台，还是一个领域空间？
3.  现有杜教授项目已经形成的能力，是 Legacy，还是新平台的基础？

### Option / 分歧

-   **Option A：重新做一个"针灸治疗情志病科研平台"**\
    优点：短期容易解释；缺点：会复制已有能力，平台无法扩展。
-   **Option B：把杜教授系统继续加功能**\
    优点：成本低；缺点：仍然是单 Study/单项目思维。
-   **Option C：把"岐研"提升为顶层产品，再重新定义专科和课题层级**\
    优点：既保留已有执行能力，又能向领域科研与 AI 扩展。

### 最终决策

Workshop 01 本身没有在现存 Decision Log 中留下独立 DEC 编号；但它构成
W02 产品层级重构的前置问题。后续正式冻结为：

> **岐研是顶层产品；针灸治疗情志病不是岐研本身，而是岐研中的垂直科研空间；具体研究则是
> Study。**

### 为什么这么决定

因为真正需要长期建设的是**科研平台能力**，而不是不断为不同教授复制项目系统。

### 对后续产品的影响

后续所有 IA、权限、AI Context、资产治理，都必须区分 Platform / Hub /
Study。

### 尚未关闭问题

-   "针灸治疗情志病"这一领域空间在教授端最自然的中文名称是什么？
-   教授是否自然理解 Research Hub，而不会把它误解成"项目文件夹"？

------------------------------------------------------------------------

## Workshop 02｜产品层级重构：Qiyan → Research Hub → Study

**恢复可信度：A级**

### 背景

原 PRD
把针灸治疗情志病同时描述为垂直平台、具体课题和多团队科研生态，层级混杂，无法指导用户任务和页面结构。

### 当时争论的问题

-   顶层产品到底叫"岐研"，还是叫"针灸治疗情志病科研平台"？
-   王教授和杜教授的研究是否各自拥有一套系统？
-   用户角色是否固定为"PI/研究员"，还是跟具体 Study 的关系变化？

### Option / 分歧

-   独立专科平台；
-   多教授多套系统；
-   统一岐研平台 + 领域 Hub + 自治 Study。

### 最终决策

-   **DEC-001：产品层级重构**------岐研为顶层产品，针灸治疗情志病为岐研中的垂直空间。
-   **DEC-002：岐研是顶层产品**------杜教授和王教授项目均在统一平台延伸。
-   **DEC-003：Study 是核心业务上下文**------角色随 `User × Study`
    关系变化。

### 为什么这么决定

科研人员在不同课题里可能承担不同责任；"一个账号=一个固定角色"的模型无法适配真实科研协作。

### 对后续产品的影响

形成核心对象关系：

``` text
Qiyan Platform
      │
      ├── My Research（个人跨课题工作）
      │
      └── Research Hub（领域科研空间）
                │
                ├── Study A
                ├── Study B
                └── Study C
```

### 尚未关闭问题

-   Hub 的加入、创建、推荐、认证机制如何设计？
-   一个 Study 是否可以关联多个 Hub？
-   Research Question 在 Study 前是否可独立存在？后在 v1.0.1
    中被正式化。

------------------------------------------------------------------------

## Workshop 03｜科研成果不能只"存文件"：开始定义科研价值对象

**恢复可信度：C（主题由 W04 决策和 W13 资产模型反推）**

### 背景

如果平台只管理 Study
执行，那么研究结束以后留下的是数据库、文件和报告；这些东西并不会自动成为下一项研究可以复用的知识。

### 当时争论的问题

-   研究结束后，什么应该长期留下？
-   文献、方案、数据集、分析结果、报告是否都算"资产"？
-   谁拥有这些成果？作者、课题、机构、Hub 的关系如何表达？

### Option / 分歧

-   **文件库模式**：所有输出直接进入知识库。
-   **成果库模式**：只保存论文/PPT等最终成果。
-   **科研资产模式**：先把研究过程中产生的对象视为
    Artifact，再经过识别、审阅和治理升级为 Asset。

### 最终决策

本轮没有现存独立 DEC 编号；但后续 W04、W13
明确延续了这一方向：科研成果必须有作者、来源、治理和复用关系，不能退化为普通网盘。

### 为什么这么决定

"能下载"不等于"能复用"。真正可复用的科研对象必须回答： - 从哪里来？ -
谁负责？ - 哪个版本？ - 证据是什么？ - 谁能访问？ - 被谁引用/派生？

### 对后续产品的影响

直接催生后来的 Research Artifact / Research Asset / Provenance / Lineage
模型。

### 尚未关闭问题

-   哪些 Artifact 值得升级为 Asset？
-   谁负责认定"领域推荐资产"？
-   原始患者级数据如何与可共享知识资产分离？

------------------------------------------------------------------------

## Workshop 04｜科研资产治理：作者不能因为"共享"而消失

**恢复可信度：A级**

### 背景

当多个团队进入同一 Hub
后，研究成果需要被发现和复用，但不能因此模糊课题归属、作者责任和发布权限。

### 当时争论的问题

-   谁可以把 Study 产出发布到 Hub？
-   Hub 发起人能否直接拿其他课题成果？
-   发布后原作者和来源是否继续保留？

### Option / 分歧

-   Hub 管理者统一拥有；
-   Study Owner 自由发布；
-   Creator 发起、Publisher 审批，并持续保留作者与来源。

### 最终决策

**DEC-004：科研资产治理原则**\
Creator 可以发起；Publisher 负责审批；作者与来源持续保留。

### 为什么这么决定

科研协作的基础不是"共享一切"，而是**可追溯、可授权、可归责的共享**。

### 对后续产品的影响

形成后续核心治理原则：

> **课题自治、领域共建、授权共享、平台治理。**

### 尚未关闭问题

-   Publisher 是 Study PI、机构角色还是 Hub 委员会？
-   Domain Recommended Asset 的专家委员会工作流后置。

------------------------------------------------------------------------

## Workshop 05｜身份、角色、权限：Hub 发起人不等于所有课题管理员

**恢复可信度：A级**

### 背景

进入多团队、多课题场景后，传统 RBAC
很容易把"学术身份""机构身份""课题权限"混在一起。

### 当时争论的问题

-   个人研究者是否必须先绑定机构？
-   Hub Member 是否自动能看所有 Study？
-   Hub 发起人是否审批所有新 Study？
-   同一个人在不同 Study 是否可以是不同角色？

### Option / 分歧

-   机构先行、统一审批；
-   Hub 中央集权；
-   身份与角色分离、权限按 Scope 控制。

### 最终决策

-   **DEC-005**：Identity + Membership + Role + Scope + Permission。
-   **DEC-006**：允许个人科研身份；进入正式临床研究和患者数据时再触发机构与身份认证。
-   **DEC-007**：Hub 分层参与------公开访问、Hub
    Member、认证科研成员、Study Member 权限不同。
-   **DEC-008**：Hub 不审批所有课题；认证研究者可创建
    Study，涉及机构资源时再走治理。

### 为什么这么决定

既要降低科研探索的进入门槛，又要在正式研究、患者数据和机构资源处建立严格治理。

### 对后续产品的影响

平台从"管理员分配权限"升级为"身份 + 上下文 + 资源范围"的治理体系。

### 尚未关闭问题

-   跨机构 Study 的审批链；
-   患者级数据访问的具体法律/伦理责任；
-   Dataset Request 的正式流程。

------------------------------------------------------------------------

## Workshop 06｜从 Study Execution 升级为完整 Research Lifecycle

**恢复可信度：A级**

### 背景

现有岐研强项集中在启动与执行：受试者、访视、eCRF、问卷、任务、偏离、Query、数据质量。问题是：科研在"建题之前"和"执行之后"同样有大量高价值工作。

### 当时争论的问题

-   岐研是否继续做"研究执行系统"？
-   文献、选题、分析、写作是外围工具还是主流程？
-   AI 是一个单独模块，还是贯穿科研生命周期？

### Option / 分歧

-   继续强化 EDC/执行；
-   外挂文献和 AI 工具；
-   用完整 Research Lifecycle 重构产品主线。

### 最终决策

-   **DEC-009**：覆盖完整 Research Lifecycle。
-   **DEC-010**：AI 贯穿生命周期，不作为独立孤岛。
-   **DEC-011**：AI Assist Human Decide（后在 W10 细化为 Human
    Accountable）。
-   **DEC-012**：Study Closeout 不等于研究结束，增加 Research
    Accumulation。

### 为什么这么决定

真正的科研价值链不是"建题→录数据→结束"，而是：

``` text
Discover
→ Ideate
→ Design
→ Launch
→ Execute
→ Data & Quality
→ Analyze
→ Produce
→ Accumulate
→ New Discovery
```

### 对后续产品的影响

岐研正式从 **Study Execution Foundation** 向 **Research Intelligence
Platform** 演进。

### 尚未关闭问题

-   各阶段 MVP 深度如何控制？
-   AI Protocol Designer 是否进入一期？后置。
-   Produce 阶段与专业写作工具的边界。

------------------------------------------------------------------------

## Workshop 07｜把"研究发现"从文献 Feed 升级为科研判断

**恢复可信度：B/C**

### 背景

原 PRD
已提出多数据库文献检索、订阅、趋势分析。但"更多论文"并不能自动转化成"更好的科研问题"。

### 当时争论的问题

-   Research Hub 首页应该是论文 Feed，还是"本领域发生了什么"？
-   AI 能否从一篇论文直接生成课题？
-   什么对象承接 Evidence 到 Study 之间的科研判断？

### Option / 分歧

-   文献 Feed；
-   AI 一键生成课题；
-   Evidence → Opportunity → Question 的渐进式科研判断链。

### 最终决策

这一轮未在现存 Decision Log 中留下独立 DEC；但后续冻结为核心原则
**P-06：Evidence → Opportunity → Question**，并形成 HYP-006/HYP-008： -
Research Opportunity 是 Discover 到 Ideate 的核心对象； - Personalized
Research Brief 优先于普通文献 Feed。

### 为什么这么决定

科研创新不是"看到一篇论文→生成一个课题"。需要保留： - 支持证据； -
相反证据； - 限制； - 不确定性； - 与本人研究的相关性； - 专家判断。

### 对后续产品的影响

形成 Radar、Research Brief、Evidence Detail、Research
Opportunity、Research Question 等产品对象。

### 尚未关闭问题

-   教授是否真正愿意使用 Opportunity 对象？
-   Brief 能否比论文 Feed 更快形成 Time to Insight？
-   Opportunity 的状态模型是否需要复杂化？

------------------------------------------------------------------------

## Workshop 08｜Research Hub：从"专科门户"变成领域科研工作空间

**恢复可信度：B/C**

### 背景

确定岐研是 Platform 后，需要重新回答：Research Hub
到底提供什么独特价值？

### 当时争论的问题

-   Hub 是专题门户、社区、知识库还是研究中心？
-   是否一开始就做全国科研网络和排行榜？
-   Hub 如何连接"领域变化"和"我自己的研究"？

### Option / 分歧

-   信息门户；
-   科研社区/Research Network；
-   领域科研上下文：Radar + Studies + Assets + AI，Network 后置。

### 最终决策

后续 HYP-005/HYP-007 冻结为： - Hub
v0.1：概览、Radar、Studies、Assets、AI； - Network
在关系和数据不足时后置； - Hub
的核心价值是连接领域变化、个人研究、Research Opportunity 和新 Study。

### 为什么这么决定

没有足够关系数据时先做"社区"容易成为空壳；而领域证据、在研 Study
和科研资产是立即可产生价值的。

### 对后续产品的影响

Hub 成为平台"领域化"的主要载体。

### 尚未关闭问题

-   Network 何时启动？
-   Hub 的领域影响力指标如何避免做成虚荣指标？
-   Research Graph 的数据基础何时足够？

------------------------------------------------------------------------

## Workshop 09｜冻结分层原则：Platform 通用化、Hub 领域化、Study 专业化

**恢复可信度：A级**

### 背景

原 PRD
强调所有能力都围绕针灸情志病垂直定制、不做泛化；但这与岐研作为可持续平台发生冲突。

### 当时争论的问题

-   是否所有模板、AI、数据结构都写死针灸情志病？
-   怎样既保证王教授的专科深度，又不把平台做成一次性项目？
-   哪些能力属于平台，哪些属于 Hub，哪些属于 Study？

### Option / 分歧

-   全部垂直化；
-   全部通用化；
-   三层分工。

### 最终决策

**DEC-013：Platform / Hub / Study 分层原则** - Platform 通用化； - Hub
领域化； - Study 专业化。

### 为什么这么决定

真正可复制的产品不是把专科知识删除，而是把专业性放到正确层级。

### 对后续产品的影响

例如： - 权限、访视引擎、审计、数据质量 → Platform； -
针灸情志病领域证据、标准、AI Context → Hub； - 具体
Protocol、Outcome、Visit、eCRF → Study。

### 尚未关闭问题

-   哪些标准应该由 Hub 继承到 Study？
-   Study 修改 Hub 模板后如何记录版本和来源？

------------------------------------------------------------------------

## Workshop 10｜AI 产品化：一个 Copilot，背后多个 Specialized Agents

**恢复可信度：A级**

### 背景

原系统已经有 Data Agent、知识库和科研 Agent。继续按 Agent
增加入口会导致产品碎片化，而且用户无法理解不同 Agent 的责任边界。

### 当时争论的问题

-   用户是否需要面对多个 Agent？
-   AI 如何知道当前正在讨论哪个 Hub、Study、Subject、Visit 或 Artifact？
-   AI 输出什么时候可以直接执行？
-   AI 如何获得科研信任？

### Option / 分歧

-   多 Agent 工具箱；
-   单独 AI 聊天页面；
-   统一 Research Copilot + 后台 Specialized Agents + 上下文权限。

### 最终决策

-   **DEC-014**：用户面对统一 Copilot，后台采用 Specialized Agents。
-   **DEC-015**：AI Context 对齐业务 Context：User / Hub / Study /
    Subject / Visit / Artifact，并受权限约束。
-   **DEC-016**：AI Assist, Human Accountable。
-   **DEC-017**：三种 AI 形态------Embedded / Copilot / Proactive。
-   **DEC-018**：重要 AI 判断必须 Evidence-grounded and Traceable。

### 为什么这么决定

科研 AI 的壁垒不是"会回答"，而是： 1. 知道当前科研上下文； 2.
知道自己能做什么； 3. 知道自己有没有权限； 4. 知道依据是什么。

可概括为后续设计中的 **CCAE**：

``` text
Context     当前研究上下文
Capability  AI 能做什么
Authority   AI 被允许做什么
Evidence    AI 为什么这么说
```

### 对后续产品的影响

AI 不再是一个页面，而是横向能力： - Embedded：页面内解释、抽取、建议； -
Copilot：连续科研对话； - Proactive：主动发现 Research Attention /
Opportunity。

### 尚未关闭问题

-   哪些动作允许 AI 受控执行？
-   Evidence 的展示粒度；
-   AI Trust 如何量化验证？

------------------------------------------------------------------------

## Workshop 11｜Study Operations → Study Workspace

**恢复可信度：A级**

### 背景

"Study Operations"容易把课题理解为执行管理，而完整 Research Lifecycle
已经要求 Study 承载设计、执行、质量、分析、产出与资产。

### 当时争论的问题

-   Study 页面是"项目管理后台"，还是研究者真正工作的空间？
-   执行能力是否仍然是 Study 的全部？
-   如何保护已经验证的 Study Execution，不被新概念破坏？

### Option / 分歧

-   继续 Study Operations；
-   完全重写 Study；
-   演进为 Study Workspace，Execution 作为其中一个子域。

### 最终决策

**DEC-019：Study Operations 演进为 Study Workspace。**

### 为什么这么决定

既保护已有执行核心，又让课题拥有完整研究上下文。

### 对后续产品的影响

Study Workspace 承载： - Overview / Attention； - Research Design； -
Subject； - Data & Quality； - Analysis； - Documents / Output； -
Team； - Discussion / Decision； - Asset。

### 尚未关闭问题

-   不同研究类型的 Workspace 差异；
-   复杂统计分析的产品边界；
-   哪些模块首期只做入口/Mock。

------------------------------------------------------------------------

## Workshop 12｜My Research：功能属于 Study，工作属于 User

**恢复可信度：A级**

### 背景

教授同时负责多个课题；研究员也可能跨多个 Study 工作。如果每次都进入某个
Study 才能知道"今天该做什么"，认知负担很高。

### 当时争论的问题

-   首页应该展示功能菜单、数据大盘，还是个人科研工作？
-   PI 和研究员是否做两套首页？
-   跨课题待办应该放在哪里？

### Option / 分歧

-   通用 Dashboard；
-   PI 首页 / Researcher 首页硬切；
-   My Research + Job Adaptive Experience。

### 最终决策

-   **DEC-020**：My Research 是个人科研指挥中心，由
    Inbox、Portfolio、Brief、AI 组成。
-   **DEC-021**：采用 Job Adaptive Experience，不按账号类型硬切首页。
-   **DEC-022**：**功能属于 Study，工作属于 User**------Study
    保持完整业务结构，My Research 聚合跨课题实际工作。

### 为什么这么决定

用户不是来"浏览系统模块"的，而是来完成今天的科研判断和工作。

### 对后续产品的影响

形成 Research Attention： \>
系统主动告诉教授"现在最值得您关注什么"，而不是让教授巡检所有课题。

### 尚未关闭问题

-   Research Attention 是否真的能降低 PI 认知负担？
-   PI 首页和研究员首页应共享多少结构？
-   排序优先级由规则、AI 还是用户控制？

------------------------------------------------------------------------

## Workshop 13｜Research Artifact → Research Asset：建立科研资产治理链

**恢复可信度：A级**

### 背景

前期已经意识到"文件≠科研资产"。这一轮正式把资产模型、来源、访问、派生关系冻结下来。

### 当时争论的问题

-   所有 Study 输出是否自动成为 Asset？
-   知识库和科研资产有什么区别？
-   Dataset 在 Hub 可发现是否意味着可以下载？
-   复用资产后如何保留来源？

### Option / 分歧

-   文件/知识统一管理；
-   所有输出自动资产化；
-   Artifact 与 Asset 分离，建立治理生命周期。

### 最终决策

-   **DEC-023**：Artifact 与 Asset 分离。
-   **DEC-024**：资产分级生命周期，从 Artifact 升级到 Domain Asset。
-   **DEC-025**：资产必须有 Provenance、Version、Governance
    Context、Access Scope。
-   **DEC-026**：知识与数据不同治理，原始受试者数据不能普通共享到 Hub。
-   **DEC-027**：Discoverability ≠ Accessibility。
-   **DEC-028**：复用保留 Derived From / Lineage。
-   **DEC-029**：Knowledge 是工作空间，Asset 是受治理价值对象。

### 为什么这么决定

科研资产的核心价值是**可信复用**，不是"集中存储"。

### 对后续产品的影响

形成：

``` text
Study Output
   ↓
Research Artifact
   ↓
Candidate Asset
   ↓
Human Review
   ↓
Governance
   ↓
Research Asset
   ↓
Hub Discovery / Reuse
   ↓
Derived From / Lineage
```

### 尚未关闭问题

-   Domain Dataset 的完整数据使用申请流程；
-   Domain Recommended Asset 专家委员会；
-   完整 Research Graph / Asset Lineage 可视化。

------------------------------------------------------------------------

## Workshop 14｜不按功能做原型：用 Golden Journey 验证产品

**恢复可信度：A级**

### 背景

产品模型已经足够复杂。如果按"功能清单"做
Demo，很容易做成后台系统展示，无法验证教授是否理解产品价值。

### 当时争论的问题

-   原型要覆盖多少页面？
-   教授是否需要测试受试者录入、访视等大量日常执行？
-   如何判断教授是真的理解，而不是"觉得页面不错"？

### Option / 分歧

-   功能全覆盖；
-   页面走查；
-   Golden Journey + Task Based Validation。

### 最终决策

-   **DEC-030**：以 Golden Journey 驱动原型，不按功能清单逐页设计。
-   **DEC-031**：教授与研究员分任务集；教授不验证大量日常执行页面。
-   **DEC-032**：Task Based Validation，记录 First Click、Wrong
    Turns、Time to Insight、Concept Understanding、AI Trust。

### 为什么这么决定

我们真正需要验证的是： - 教授是否理解 Hub / Study / Asset； - 能否从
Evidence 形成 Question； - 是否信任 AI 的依据与边界； - 是否理解"AI
建议≠正式科研结论"。

### 对后续产品的影响

形成 Golden Journey：

``` text
Radar / Brief
→ Evidence
→ Opportunity
→ Question
→ Study
→ Execution / Quality
→ Analysis
→ Output
→ Asset
→ Hub Reuse
```

### 尚未关闭问题

-   单个教授样本只能形成方向性证据，不能作为统计意义上的"验证通过"。
-   哪些任务最适合首轮 60 分钟验证？

------------------------------------------------------------------------

## Workshop 15｜冻结 Product Baseline：从"继续讨论"进入"教授验证"

**恢复可信度：B**

### 背景

到 W14，核心产品模型、AI、资产、Golden Journey
已基本形成。继续增加概念会让项目无法进入原型。

### 当时争论的问题

-   哪些是已经冻结的 Product Decision？
-   哪些仍然只是 Hypothesis？
-   哪些长期能力必须后置？
-   王教授第一次验证究竟验证什么？

### Option / 分歧

-   继续扩展长期愿景；
-   直接进入全功能开发；
-   冻结 Baseline，明确 Decision / Hypothesis / Open Question / Later
    Register，再进入 Prototype。

### 最终决策

现存 Decision Log 没有新增标记为 W15 的 DEC，但 Product Baseline 将
Workshop 01--15 统一冻结为后续 UX、Figma、Codex
的产品输入。王教授首轮验证最终收敛为五类任务：

1.  看领域最近有什么值得关注或继续研究；
2.  判断自己当前最需要处理、关注和继续探索的科研事项；
3.  从一条证据形成研究问题，并把它带入一个课题；
4.  判断一个进行中的课题目前最值得关注的问题；
5.  理解、沉淀并复用一项科研资产。

AI Trust 作为横向观察维度，而不是一个单独功能。

### 为什么这么决定

产品已经进入"需要真实专家证据，而不是继续内部想象"的阶段。

### 对后续产品的影响

形成后续阶段纪律： **Product Baseline → UX → Prototype → Professor
Validation → Demo UI → Interaction / Implementation**。

### 尚未关闭问题

Baseline 中仍保留的核心 Active Hypothesis 包括： - My Research / Hub /
Study 三个上下文是否符合教授心智； - Research Opportunity 是否成立； -
Personalized Research Brief 是否优于普通 Feed； - Research Attention
是否是 My Research 的核心聚合对象； - AI Research Artifact
是否应成为独立对象； - 长期 AI 壁垒是否真正来自 Context + Asset + Data +
Evidence。

------------------------------------------------------------------------

# 3. 15轮 Workshop 的真正升级：从"系统功能"到"科研操作系统"

## 3.1 升级前：Study Execution Core

已有能力是有价值的，而且不应被推倒重做：

``` text
课题启动
→ 受试者
→ 访视
→ eCRF / 问卷
→ 随访
→ Task
→ Deviation / Query
→ Data Quality / Review
```

并已有： - Data Agent； - 知识库； - 科研 Agent。

这部分是 **Qiyan vNext 的 Study Execution Foundation**。

## 3.2 升级后：Research Intelligence Platform

``` text
向前：Discover → Ideate → Design
中间：Launch → Execute → Data & Quality
向后：Analyze → Produce → Accumulate
向上：Research Hub
横向：Evidence-grounded Research Copilot
个人层：My Research / Research Attention
```

## 3.3 升级的本质

  过去               升级后
  ------------------ ---------------------------------------------------
  管一个课题         管理并理解一个科研生命周期
  看数据             发现值得关注的问题
  文献检索           Evidence → Opportunity → Question
  AI 工具/Agent      统一 Research Copilot
  项目 Dashboard     My Research 个人科研指挥中心
  Study Operations   Study Workspace
  文件/知识库        Artifact → Asset → Provenance → Reuse
  课题结束           Accumulate → New Discovery
  权限角色           Identity + Membership + Role + Scope + Permission
  "能看到数据"       Discoverability ≠ Accessibility
  AI 给答案          Evidence-grounded + Traceable + Human Accountable

------------------------------------------------------------------------

# 4. 最新平台架构

## 4.1 产品上下文架构

``` mermaid
flowchart TB
    Q[Qiyan Platform 岐研平台]
    MR[My Research 我的科研]
    HUB[Research Hub 领域研究中心]
    SW[Study Workspace 课题工作空间]
    ASSET[Research Asset 科研资产]
    AI[Evidence-grounded Research Copilot]
    GOV[Governance 治理与审计]

    Q --> MR
    Q --> HUB
    HUB --> SW
    SW --> ASSET
    ASSET --> HUB
    AI -.贯穿.-> MR
    AI -.贯穿.-> HUB
    AI -.贯穿.-> SW
    GOV -.约束.-> Q
```

**注意：My Research、Research Hub、Study 并非简单父子页面。**\
用户可以从 My Research 直接进入某个 Study 的关键问题，也可以从 Hub 的
Evidence / Opportunity 进入 Question，再形成 Study。

## 4.2 四个核心回答

-   **Qiyan Platform**：平台如何提供统一、可信、可治理的科研基础能力？
-   **My Research**：我现在最应该关注和处理什么？
-   **Research Hub**：这个领域发生了什么，什么值得继续研究？
-   **Study Workspace**：如何把一个研究问题变成可信研究结果？

## 4.3 AI 架构：CCAE

``` text
                Qiyan Research Copilot
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     Context         Capability       Authority
  我现在在哪个       AI能做什么       AI被允许做什么
  科研上下文？
        └────────────────┼────────────────┘
                         │
                      Evidence
                    为什么这么说？
```

核心原则：

> **AI Assist, Human Accountable.**

AI
可以理解、建议、起草、解释，并在受控条件下执行；关键科研状态、正式研究数据、资产发布和对外共享由授权人员确认。

------------------------------------------------------------------------

# 5. 王教授项目在整个产品中的正确位置

王教授不是"买一套孤立的软件"。

更准确的产品叙事是：

``` text
岐研 Qiyan Platform
        ↓
针灸治疗情志病 Research Hub
        ↓
王教授发起 / 参与的多个 Study
        ↓
Study Data / Analysis / Output
        ↓
Research Asset
        ↓
回到 Research Hub
        ↓
支持新的 Evidence / Opportunity / Question
```

这意味着王教授得到的不是"一个课题管理工具"，而是：

1.  一个能够承接现有课题执行的 Study Workspace；
2.  一个围绕"针灸治疗情志病"持续积累的 Research Hub；
3.  一个跨课题帮助他发现科研优先事项的 My Research；
4.  一个理解其研究上下文、证据与权限边界的 Research Copilot；
5.  一套让研究成果长期沉淀、可追溯、可复用的 Research Asset 体系。

------------------------------------------------------------------------

# 6. 从产品角度重新写用户故事

## 6.1 王教授 / PI：不是"使用系统"，而是"做科研判断"

### US-PI-01｜每天先知道什么值得我判断

**作为**同时负责多个研究的 PI，\
**我希望**打开岐研时，系统能主动呈现今天最值得我关注的研究问题、变化和待判断事项，\
**从而**不需要逐个课题巡检，也不会被大量运营数据淹没。

**产品承载**：My Research + Research Attention。

### US-PI-02｜知道领域发生了什么，而且知道与我有什么关系

**作为**某个研究方向的负责人，\
**我希望**看到领域最新 Evidence、变化趋势及其与我现有课题的关联，\
**从而**快速判断哪些变化值得进一步研究。

**产品承载**：Research Hub + Radar + Research Brief。

### US-PI-03｜从证据形成值得研究的问题

**作为** PI，\
**我希望**系统把支持证据、相反证据、限制和不确定性组织起来，\
**从而**由我判断一个 Research Opportunity 是否值得形成 Research
Question，而不是让 AI 一键替我"生成课题"。

**产品承载**：Evidence → Opportunity → Question。

### US-PI-04｜判断正在执行的课题哪里最需要关注

**作为** PI，\
**我希望**系统把入组、中心差异、数据质量、偏离等复杂信息压缩成可判断的问题，并提供
AI 分析依据，\
**从而**快速决定是否需要调整研究执行。

**产品承载**：Study Overview + Research Attention + AI Evidence。

### US-PI-05｜AI 给我依据，不替我承担责任

**作为** PI，\
**我希望**AI 每个重要判断都能说明来源、证据、限制和不确定性，\
**从而**我可以接受、修改、质疑或拒绝 AI 建议，并保留最终科研判断权。

**产品承载**：Evidence-grounded Copilot + Human Review。

### US-PI-06｜研究结束以后，成果仍然继续产生价值

**作为** PI，\
**我希望**研究产生的数据集、分析方法、报告、方案和证据经过治理后成为可追溯科研资产，\
**从而**下一项研究能够复用，而不是每次从零开始。

**产品承载**：Artifact → Asset → Hub Reuse。

------------------------------------------------------------------------

## 6.2 研究员 / 临床科研人员

### US-R-01｜今天先做什么

作为研究员，我希望 My Research 聚合跨 Study
的待确认、即将逾期、访视和数据问题，让我按工作而不是按系统菜单行动。

### US-R-02｜减少重复录入

作为研究员，我希望系统先理解已有
Protocol、文档和历史资料，再让我补充缺失配置，而不是把已有内容重新录一遍。

### US-R-03｜AI 解析但不污染正式数据

作为研究员，我希望 AI
能抽取、结构化和建议字段，但在进入正式研究数据前由人确认，保证效率与可信度同时成立。

### US-R-04｜快速处理质量问题

作为研究员，我希望系统把 Query、Deviation、缺失数据和异常聚合到具体
Study / Subject / Visit 上下文中，让问题可以直接被解决。

------------------------------------------------------------------------

## 6.3 机构与治理角色

### US-G-01

作为治理人员，我希望权限由 Identity、Membership、Role、Scope 和
Permission 共同决定，使跨机构、多 Study 协作可控。

### US-G-02

作为资产治理人员，我希望每项 Research Asset 保留
Creator、Source、Version、Provenance、Access Scope 和治理记录。

### US-G-03

作为数据治理人员，我希望"数据集可被发现"不等于"患者级数据可直接访问"，所有敏感数据使用都经过明确授权。

------------------------------------------------------------------------

## 6.4 领域科研成员 / 协作者

### US-H-01

作为领域研究者，我希望在 Research Hub 看到这个领域的 Evidence、Studies
和可复用 Assets，而不是一个静态门户。

### US-H-02

作为潜在协作者，我希望能够发现某项研究和资产的存在、负责人和合作入口，但不因此自动获得私有数据权限。

------------------------------------------------------------------------

# 7. 三条 Golden Journey：王教授最容易理解的平台能力

## Journey A｜从"领域变化"到"下一项值得研究的问题"

``` text
Research Hub
→ Radar / Research Brief
→ Evidence Detail
→ Research Opportunity
→ Research Question
→ Study Design
```

**价值**：岐研不仅帮教授"找到论文"，而是缩短从外部证据到科研判断的距离。

------------------------------------------------------------------------

## Journey B｜从"课题执行"到"专家判断"

``` text
My Research
→ Research Attention
→ Study Overview
→ Data / Quality / Center Difference
→ Qiyan AI Analysis
→ Evidence / Uncertainty
→ Human Decision
```

**价值**：教授不再逐个翻系统，而是先看到"值得判断的问题"。

------------------------------------------------------------------------

## Journey C｜从"研究成果"到"下一轮科研基础"

``` text
Analysis / Output
→ Research Artifact
→ Candidate Asset
→ Human Review
→ Governance
→ Research Asset
→ Hub Reuse
→ Derived From
→ New Research
```

**价值**：研究不再结束于论文和结题，而是形成可复用的科研资产。

------------------------------------------------------------------------

# 8. 对王教授的能力说明：建议按"价值"而不是"模块"讲

## 能力一：科研发现

平台持续组织领域 Evidence 和变化，帮助识别值得关注的 Research
Opportunity。

**不是**：给您推一堆论文。\
**而是**：告诉您"最近发生了什么、为什么与您的研究相关、是否值得继续研究"。

## 能力二：科研构思与设计

从 Evidence 形成 Research Question，再进入 Study Design。

**不是**：AI 一键替您生成课题。\
**而是**：AI 帮您把证据、限制和假设组织清楚，最后由您决定问题是否成立。

## 能力三：课题执行与数据质量

承接已经验证的 Study Execution
Core，包括受试者、访视、eCRF、问卷、随访、Query、Deviation、Review 等。

**不是**：为了新概念推倒已有系统。\
**而是**：把已经成熟的执行能力放进更完整的科研生命周期。

## 能力四：科研智能

AI 理解 User / Hub / Study / Subject / Visit / Artifact
上下文，并且重要判断可追溯到 Evidence。

**不是**：一个通用聊天机器人。\
**而是**：一个知道"您在研究什么、现在发生什么、依据是什么、哪些事情必须由您决定"的
Research Copilot。

## 能力五：分析与科研产出

研究数据进入可追溯分析，形成报告、汇报、论文工作空间等 Research Output。

**不是**：AI 自动生成"科研结论"。\
**而是**：在数据版本、分析方法和审核 Context 清楚的基础上辅助科研产出。

## 能力六：科研资产沉淀

Study 产出经过 Human Review 和 Governance，成为 Research Asset，并可被
Hub 发现和复用。

**不是**：知识库里多一个文件。\
**而是**：把研究经验变成有来源、有版本、有责任、有权限、可复用的科研资产。

------------------------------------------------------------------------

# 9. 给王教授讲平台时的建议叙事

## 9.1 开场，不先讲软件

> 王教授，我们这次不是想再给您做一个传统课题管理系统。\
> 我们一直在想一个更根本的问题：一个科研负责人真正缺的，是不是更多的系统页面？\
> 我们最后认为不是。真正缺的是------**怎样更早发现值得研究的问题，怎样更快理解正在发生的研究变化，怎样让
> AI 的建议有依据、有边界，以及怎样让今天的研究成为明天研究的基础。**

## 9.2 第二段：承认已有执行能力

> 岐研并不是从零开始。受试者、访视、数据采集、随访、数据质量这些执行能力，我们已经有基础。\
> 这一次我们不是推倒重做，而是向前扩展到研究发现和设计，向后扩展到分析、产出和科研资产。

## 9.3 第三段：讲 Research Hub

> 所以"针灸治疗情志病"在岐研里，不只是一个课题，也不是一个静态专题页。\
> 我们希望它成为一个长期成长的 Research
> Hub：这个领域的证据、课题、研究机会和科研资产会在这里持续积累。

## 9.4 第四段：讲教授每天真正看到什么

> 您每天打开平台，不应该先看到几十个模块。\
> 平台应该先告诉您：**今天有什么事情真正值得您判断。**\
> 比如某个多中心研究入组速度异常，系统不仅告诉您"下降了"，还要告诉您主要发生在哪些中心、有哪些事实、AI
> 为什么认为值得关注，以及哪些地方仍然不确定。

## 9.5 第五段：讲 AI 边界

> 我们不希望 AI 替您做科研决策。\
> AI
> 的职责是帮助您理解、整理、解释和提出建议；关键判断、正式研究数据和资产发布，仍然由人确认。\
> **AI 给答案不难，难的是让答案有依据、有边界、有责任归属。**

## 9.6 第六段：讲长期价值

> 一个研究结束，不应该只剩下一篇论文和几个文件。\
> 它里面有价值的方案、数据集、分析方法、证据和经验，应该经过治理后成为下一项研究可以继续使用的资产。\
> **过去一个课题结束，很多经验也随之结束；我们希望未来一个课题结束，恰恰是下一项研究的开始。**

------------------------------------------------------------------------

# 10. 建议保留的"金句"

1.  **岐研不是帮助科研人员管理一个课题，而是帮助科研团队建立一个持续进化的科研能力体系。**
2.  **让临床经验沉淀为可信证据，并让可信证据更早形成下一项值得研究的问题。**
3.  **Platform 通用化，Hub 领域化，Study 专业化。**
4.  **课题自治、领域共建、授权共享、平台治理。**
5.  **功能属于 Study，工作属于 User。**
6.  **AI Assist, Human Accountable。**
7.  **AI 给答案不难，难的是让答案有依据、有边界、有责任归属。**
8.  **Evidence 不是答案的装饰，而是科研判断的基础。**
9.  **不是从一篇论文一键生成课题，而是从 Evidence 到 Opportunity，再到
    Question。**
10. **系统已经知道的信息，不应该让科研人员重新录一遍。**
11. **不要让教授巡检系统，要让系统主动呈现值得教授判断的事项。**
12. **Knowledge 是工作空间，Asset 是受治理的价值对象。**
13. **Discoverability 不等于 Accessibility。**
14. **研究结束不是终点，科研资产沉淀才形成下一轮研究的起点。**
15. **岐研 AI 不是通用聊天机器人，而是理解科研上下文、证据和权限边界的
    Research Copilot。**
16. **我们不是用 AI
    替代专家，而是让专家在复杂证据面前更快形成可信判断。**

------------------------------------------------------------------------

# 11. 商务沟通时真正应该让王教授认可的五件事

不是要求教授一次认可所有功能，而是确认五个核心命题：

### ① 这个平台是否理解教授真正的科研工作？

从"管理数据"升级到"发现、理解、判断、执行、沉淀"。

### ② Research Hub 是否有长期价值？

"针灸治疗情志病"是否值得成为长期积累的领域科研空间，而不只是某个项目的网站。

### ③ My Research 是否解决 PI 的认知负担？

教授是否愿意让平台主动呈现最值得关注的问题，而不是自己逐课题巡检。

### ④ AI 的可信边界是否正确？

Evidence、Uncertainty、Human Review 是否符合教授对科研责任的要求。

### ⑤ Research Asset 是否构成长期壁垒？

教授是否认可：研究成果应被治理、保留来源并进入下一轮研究，而不是停留在文件层。

如果这五件事得到认可，后面的功能、页面和实施范围才有稳定基础。

------------------------------------------------------------------------

# 12. 对外产品价值总结

## 一句话

**岐研是一套面向中医临床科研团队的 AI Research Intelligence
Platform，连接研究发现、研究设计、课题执行、数据质量、分析产出和科研资产复用。**

## 给 PI

**更早发现值得研究的问题，更快理解研究状态，更有依据地做科研判断。**

## 给研究团队

**减少重复录入和系统切换，让日常执行、数据质量和研究协作进入同一个 Study
Context。**

## 给机构

**让权限、数据、AI、资产和共享都有清晰责任边界与审计链。**

## 给领域

**让分散的研究成果逐渐沉淀为可发现、可追溯、可授权复用的科研资产网络。**

------------------------------------------------------------------------

# 13. 当前仍应诚实标注的边界

为了让方案可信，以下内容不宜在签约沟通中描述成"已经全部完成"：

-   Research Network 完整社区能力：后置；
-   完整 Research Graph / Asset Lineage 可视化：后置；
-   完整 AI Protocol Designer：后置；
-   复杂趋势预测、影响力排名、科研热点大屏：后置；
-   跨机构 Domain Dataset 完整治理与数据使用流程：后置；
-   Domain Recommended Asset 专家委员会工作流：后置；
-   硬件设备接入：后置；
-   多病种/多专科同时扩张：后置；
-   Institution Knowledge 是否作为独立层：仍需进一步定义。

**签约价值不应该建立在"什么都已经有"上，而应该建立在：核心产品模型清晰、已有
Study Execution
基础可继承、王教授项目有明确一期闭环、长期演进路径可解释。**

------------------------------------------------------------------------

# 14. 最终建议：王教授第一次完整介绍的 30--45 分钟结构

### 0--5 分钟｜为什么重新设计岐研

从"课题管理"讲到"科研全生命周期"。

### 5--10 分钟｜平台模型

讲清： **岐研 Platform → 针灸治疗情志病 Research Hub → Study → Research
Asset。**

### 10--18 分钟｜My Research + Research Attention

让王教授看到平台如何帮助 PI 判断"今天什么最重要"。

### 18--25 分钟｜Research Hub + Evidence → Opportunity → Question

说明平台如何帮助科研发现，而不是只做文献检索。

### 25--32 分钟｜Study Workspace + AI

展示已有执行能力如何升级，以及 AI 如何基于 Context + Evidence 工作。

### 32--37 分钟｜Research Asset

解释为什么课题结束后价值仍然继续积累。

### 37--45 分钟｜让王教授参与定义

重点询问： 1. 哪些科研问题最值得系统提前提醒？ 2. AI
提供什么依据，您才愿意信任？ 3. 哪些判断必须由 PI 本人确认？ 4.
哪些研究成果最值得沉淀为长期资产？ 5. "针灸治疗情志病 Research
Hub"是否符合您对未来领域科研平台的理解？

------------------------------------------------------------------------

# 15. 结语

15轮 Workshop 最重要的成果，不是多了多少功能，而是把岐研的产品逻辑从：

> **"帮一个课题把研究执行完"**

升级成：

> **"帮助一个科研团队持续发现问题、形成可信研究、积累科研资产，并让 AI
> 在有证据、有权限、有责任边界的前提下参与整个科研生命周期。"**

对王教授而言，这个平台真正要交付的也不只是一个 Demo。

它要交付的是一套围绕"针灸治疗情志病"长期成长的科研工作方式：

**领域证据持续进入 → 值得研究的问题被发现 → Study 被可靠执行 →
结果形成科研资产 → 资产继续反哺下一轮研究。**

这才是岐研从项目软件升级为科研智能平台的核心价值。
