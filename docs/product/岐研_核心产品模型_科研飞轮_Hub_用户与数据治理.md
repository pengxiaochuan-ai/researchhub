# 岐研 AI 科研平台｜核心产品模型与治理机制

> 用于 Product Baseline、产品设计、王教授沟通与签约 PPT 的统一说明  
> 核心定位：**面向临床科研 PI 的 AI 科研决策工作台 / AI Research Intelligence Platform**  
> 现行对象层级和页面职责以 `product-baseline.md` 为准，变更记录见 `product-changes.md`。

---

## 0. 一页总览

岐研不是传统课题管理系统，也不是单纯的文献数据库或通用 AI 聊天工具。平台围绕科研人员的真实工作，把 **科研生命周期、科研资产积累、AI × 专家协同、Research Hub、Study 与数据治理** 连接成一个持续演进的科研体系。

整体关系可以概括为：

```text
外部 Evidence / 领域变化
        ↓
Research Hub
        ↓
Research Opportunity
        ↓
Research Project（研究课题）
        ↓
Research Question（核心研究问题，位于课题内部）
        ↓
Study / Protocol
        ↓
Study Execution
        ↓
Data & Quality
        ↓
Analysis
        ↓
Research Output
        ↓
Research Asset
        ↓
回到 Research Hub
        ↓
形成新的 Evidence / Opportunity
```

与此同时：

```text
个人科研身份
      ↓
My Research
      ↓
Research Hub
      ↓
Study
      ↓
Research Asset
      ↓
Data Governance
```

AI 贯穿上述过程，但遵循：

> **AI Assist, Human Accountable.**  
> AI 提供 Intelligence，专家提供 Judgment，最终形成可信科研决策。

---

# 1. 科研生命周期飞轮
## 平台覆盖什么

### 1.1 核心问题

传统科研软件往往只覆盖课题立项之后的执行阶段，例如受试者、访视、数据采集和质量管理。

岐研把科研工作向前延伸到 **发现研究机会与形成研究课题**，向后延伸到 **分析、科研产出、科研资产沉淀与复用**。

因此完整生命周期是：

```text
External Evidence / 领域变化
        ↓
Research Radar / Research Brief
        ↓
Research Opportunity
        ↓
Research Project（研究课题）
        ↓
Research Question（核心研究问题，位于课题内部）
        ↓
Study / Protocol
        ↓
Study Execution
        ↓
Data & Quality
        ↓
Analysis
        ↓
Research Output
        ↓
Research Artifact
        ↓
Human Review / Governance
        ↓
Research Asset
        ↓
Research Hub
        ↓
New Discovery / New Opportunity
```

### 1.2 各阶段的产品含义

| 阶段 | 岐研要解决的问题 |
|---|---|
| External Evidence | 外部有哪些新的证据、指南、研究与领域变化 |
| Research Radar / Brief | 哪些变化值得科研人员关注 |
| Research Opportunity | 哪些证据变化形成了真正的研究空白或机会 |
| Research Project | 我要研究什么；课题是平台一级科研对象 |
| Research Question | 这个课题具体要回答什么；它下沉在课题内部，用 PICO 界定 |
| Study / Protocol | 如何把课题转化为可执行的研究方案 |
| Study Execution | 如何执行受试者、访视、中心、任务等研究活动 |
| Data & Quality | 数据是否完整、可信，是否存在异常和风险 |
| Analysis | 数据说明了什么，还不能说明什么 |
| Research Output | 形成论文、报告、模型、方法等科研成果 |
| Research Asset | 哪些成果值得治理、沉淀和复用 |
| Research Hub | 如何把资产重新带回领域科研空间 |
| New Discovery | 如何由已有积累形成下一轮研究机会 |

### 1.3 核心产品表达

> **岐研不是只管理课题执行，而是覆盖从发现研究机会、形成研究课题，到形成科研资产的完整科研生命周期。**

---

# 2. 科研资产飞轮
## 为什么越用越有价值

### 2.1 传统模式的问题

传统科研系统中，一个 Study 结束后，大量有价值的内容会分散在：

- 文件；
- 论文；
- 数据库；
- 研究人员个人电脑；
- 分析脚本；
- Protocol；
- 项目经验；
- 团队隐性知识。

结果是：

```text
课题结束
   ↓
成果发表
   ↓
项目归档
   ↓
大量科研经验无法继续复用
```

岐研希望改变这个结构。

### 2.2 科研资产价值闭环

```text
临床实践
   ↓
真实科研问题
   ↓
高质量研究
   ↓
可信数据
   ↓
研究分析
   ↓
科研产出
   ↓
Research Artifact
   ↓
Human Review
   ↓
Research Asset
   ↓
领域知识积累
   ↓
新的 Research Opportunity
   ↓
新的 Research Project
   ↓
下一轮研究
```

### 2.3 Artifact 与 Asset

**Research Artifact** 是研究过程中产生的成果对象，例如：

- Protocol；
- Dataset；
- Analysis；
- Statistical Model；
- Research Report；
- Paper；
- Method；
- Evidence Synthesis。

但并不是所有 Artifact 自动成为 Asset。

推荐过程：

```text
Research Artifact
       ↓
Candidate Asset
       ↓
Human Review
       ↓
Governance
       ↓
Research Asset
```

Research Asset 应具有：

```text
Provenance
Version
Governance Context
Access Scope
Derived From / Lineage
Reuse Context
```

### 2.4 核心原则

> **Knowledge 是工作空间，Asset 是受治理的价值对象。**

> **研究结束不是终点，科研资产沉淀才形成下一轮研究的起点。**

> **过去一个课题结束，很多科研经验也随之结束；岐研希望让每一次研究都成为下一次研究的基础。**

---

# 3. AI × 专家协同飞轮
## AI 如何可信地参与科研决策

### 3.1 AI 的定位

岐研 AI 不是一个脱离业务上下文的通用聊天机器人。

它是：

> **Qiyan Research Copilot｜科研智能协作伙伴**

AI 的作用不是替代 PI，而是在复杂 Evidence、Study、Data、Asset 上下文中帮助专家更快形成判断。

### 3.2 AI × Human Decision Loop

```text
Evidence
   +
Research Context
   +
Study Context
   +
Data Context
   ↓
Qiyan Research Copilot
   ↓
理解 / 归纳 / 比较 / 提醒 / 建议 / 解释
   ↓
Evidence + Interpretation + Uncertainty
   ↓
专家判断
   ↓
查看依据 / 质疑 / 修改 / 接受 / 拒绝
   ↓
Human Confirmation
   ↓
正式科研状态 / 决策
   ↓
产生新的 Evidence / Context
   ↓
再次进入 AI 分析
```

### 3.3 CCAE：AI 的可信边界

#### Context

AI 知道：

> **现在正在研究什么。**

包括：

```text
User
Research Hub
Study
Subject
Visit
Artifact / Asset
```

#### Capability

AI 知道：

> **自己能够做什么。**

例如分析 Evidence、发现异常、总结趋势、形成建议。

#### Authority

AI 知道：

> **自己被允许做什么。**

例如 AI 可以建议，但某些正式科研状态只能由授权人员确认。

#### Evidence

AI 必须能够说明：

> **为什么这么说。**

因此 AI 输出不能只有答案，还需要：

```text
Evidence
Interpretation
Uncertainty
Source / Provenance
Human Action
```

### 3.4 核心原则

> **AI Assist, Human Accountable.**

> **AI 给答案不难，难的是让答案有依据、有边界、有责任归属。**

> **Evidence 不是答案的装饰，而是科研判断的基础。**

---

# 4. Research Hub 产品模型
## 进入一个科研领域，而不是加入一个组织

### 4.1 Hub 定义

Research Hub 是围绕一个稳定研究领域形成的，由以下核心对象共同构成的科研空间：

```text
                 Research Hub
                      │
       ┌──────────────┼──────────────┐
       │              │              │
    Evidence      Researchers      Studies
       │              │              │
       └────────── Research Assets ──┘
```

例如：

> **针灸治疗情志病 Research Hub**

它不是传统群组、门户或项目文件夹，而是一个持续积累领域 Evidence、研究者、Studies 与 Research Assets 的领域科研空间。

### 4.2 Hub 三类核心机制

#### Discover｜发现与了解

用户可以：

- 浏览 Hub；
- 查看公开领域内容；
- 查看 Evidence；
- 查看公开研究；
- 查看公开 Research Asset；
- 接收 AI Hub 推荐；
- Follow Hub；
- 获取 Research Brief。

#### Participate｜参与与贡献

参与层级：

```text
Visitor
   ↓
Follower
   ↓
Member
   ↓
Verified Researcher
```

典型行为：

- 关注领域；
- 收藏 Evidence；
- 形成 Research Project，并在课题内定义 Research Question；
- 参与科研讨论；
- 创建 Study；
- 贡献 Evidence；
- 提交 Research Asset。

#### Govern｜治理与建设

主要承担者：

```text
Hub Initiator
Hub Steward
Platform Governance
```

治理对象主要包括：

- Hub Scope；
- 公共 Evidence；
- 推荐科研资产；
- 公共领域内容；
- Hub 创建与重复性治理；
- 争议处理；
- 领域长期建设。

Hub Governance **不等于审批所有 Study**。

### 4.3 Hub 参与层级

| 层级 | 身份 | 主要能力 |
|---|---|---|
| L0 | Visitor | 浏览公开 Hub 信息 |
| L1 | Follower | 关注 Hub、接收 Research Brief |
| L2 | Member | 参与讨论、收藏、形成研究课题 |
| L3 | Verified Researcher | 创建 Study、贡献 Evidence、提交 Asset |
| Governance | Steward | 维护领域范围和公共科研内容 |

注意：这里是 **Hub Membership Level**，不要与平台科研身份 L0–L3 混为同一套等级。

### 4.4 Hub 创建机制

推荐：

```text
Verified Researcher
       ↓
Create Hub Proposal
       ↓
定义研究领域 / Scope
       ↓
AI Similarity Check
       ↓
是否存在相似 Hub
    ↙              ↘
已有               无明显重复
 ↓                    ↓
加入 / 共建        Governance Review
已有 Hub               ↓
                    Active Hub
                       ↓
              Hub Initiator / Steward
```

正式 Hub Proposal 可以包括：

- Hub 名称；
- 研究范围；
- 创建理由；
- Evidence Scope；
- 初始研究方向；
- 发起人；
- 合作机构；
- Existing Studies；
- Existing Research Assets。

### 4.5 Hub 推荐机制

推荐不应该只告诉用户：

> “92% Match”

而应该解释：

> **Why this Hub?**

推荐上下文：

```text
User Research Context
        +
Study Context
        +
Evidence Context
        +
Research Asset Context
        ↓
Hub Recommendation
```

例如：

> 与你正在进行的「针刺治疗抑郁症临床研究」相关。  
> 该 Hub 最近新增 8 条神经调控 Evidence，其中 3 条与你关注的 HAMD 疗效评价相关。

### 4.6 Hub 与 Study 的核心关系

> **加入 Hub ≠ 加入 Study ≠ 获得数据权限。**

Hub 可以知道一个 Study 的存在，但 Study 的具体访问权限仍由 Study 团队管理。

推荐模型：

```text
Study
 ├─ 标题 / 摘要              Public / Discoverable
 ├─ PI                       Public / Discoverable
 ├─ Protocol                 根据授权
 ├─ Aggregate Result         根据授权
 ├─ eCRF                     Study Only
 └─ Patient-level Data       Restricted
```

核心原则：

> **Discoverability ≠ Accessibility。**

> **课题自治、领域共建、授权共享、平台治理。**

---

# 5. 用户体系 → Hub → Study → Data Governance

## 5.1 两套概念必须分开

科研身份回答：

> **这个人在岐研平台被认证到了什么程度？**

角色和权限回答：

> **这个人在某个具体科研上下文中承担什么责任、能访问什么？**

因此：

```text
科研身份等级
    ≠
Hub Role
    ≠
Study Role
    ≠
Data Permission
```

---

# 6. 4级科研身份模型

| 等级 | 平台身份 | 含义 | 典型能力 |
|---|---|---|---|
| L0 | Qiyan User | 普通平台用户 | 浏览公开内容 |
| L1 | Researcher Profile | 个人科研身份 | My Research、关注 Hub、Evidence、Question、Copilot |
| L2 | Verified Researcher | 已认证科研人员 | 创建 Study、正式科研协作、贡献 Evidence、提交 Asset |
| L3 | Institutional Researcher | 已认证机构科研人员 | 机构 Study、机构资源、正式临床研究 |
| 独立权限层 | Study Role / Data Permission | 具体研究授权 | PI、研究者、CRC、数据管理员、数据访问范围 |

科研身份等级不是组织层级：

```text
L3 并不天然拥有 L2 用户的数据权限
```

应该理解为：

> **Identity Level 决定“你具备什么资格”。**

> **Role + Scope + Permission 决定“你在这里能做什么”。**

---

# 7. 四类用户进入岐研的路径

## 7.1 个人科研人员

这是最自然的平台进入路径。

```text
发现岐研
   ↓
注册
   ↓
L0 Qiyan User
   ↓
建立个人科研身份
   ↓
研究方向 / Research Interests
   ↓
L1 Researcher Profile
   ↓
My Research
   ↓
Evidence / Hub / Question / Copilot
   ↓
Follow Hub
   ↓
持续产生科研行为
   ↓
需要正式科研权限
   ↓
科研身份认证
   ↓
L2 Verified Researcher
   ↓
需要机构资源时
   ↓
L3 Institutional Researcher
```

核心体验：

> **先探索 → 再参与 → 按需认证。**

## 7.2 Hub 发起者

例如王教授发起：

> 针灸治疗情志病 Research Hub

路径：

```text
注册 / 登录
   ↓
L1 Researcher Profile
   ↓
科研身份认证
   ↓
L2 Verified Researcher
   ↓
必要的机构关系验证
   ↓
L3 Institutional Researcher
   ↓
Create Research Hub
   ↓
Hub Proposal
   ↓
Similarity Check
   ↓
Governance Review
   ↓
Active Research Hub
   ↓
Hub Initiator
   +
Hub Steward
```

Hub 发起者治理领域科研空间，但：

> **Hub Initiator ≠ 所有 Study 的管理员。**

## 7.3 课题成员

很多科研人员第一次进入岐研可能来自 Study Invitation。

```text
PI 发出 Study Invitation
        ↓
研究人员收到邀请
        ↓
注册 / 登录
        ↓
建立 Researcher Profile
        ↓
L1
        ↓
接受 Study Invitation
        ↓
根据 Study 要求完成认证
        ↓
L2 / L3
        ↓
获得 Study Role
        ↓
确定 Scope
        ↓
获得对应 Data Permission
```

例如：

```text
张医生

Platform Identity
L3 Institutional Researcher

Study Role
Sub-Investigator

Scope
北京中心

Data Permission
北京中心授权范围内的研究数据
```

Study Member 不需要先加入 Hub。

如果 Study 关联某个 Hub，系统可以在加入 Study 后推荐：

> 该 Study 关联「针灸治疗情志病 Research Hub」，是否关注？

## 7.4 课题负责人 / PI

PI 可以从 Research Project、Research Hub 或独立入口创建 Study。核心研究问题随课题进入方案，不单独作为创建入口。

```text
L2 / L3 Researcher
       ↓
Create Study
       ↓
选择来源
 ┌─────┼─────────┐
 │     │         │
Project  Hub   Independent
 │     │         │
 └─────┼─────────┘
       ↓
Study Design
       ↓
Study Governance
       ↓
Study Created
       ↓
Study PI
```

如果来自 Hub 中的科研机会，应保留科研 Lineage：

```text
Evidence
   ↓
Research Opportunity
   ↓
Research Project
   ↓
Research Question
   ↓
Study / Protocol
   ↓
Research Output
   ↓
Research Asset
   ↓
Research Hub
```

---

# 8. 从用户到数据治理的完整模型

```text
                         Qiyan Platform
                              │
                     Personal Account
                              │
                  Personal Research Identity
                              │
                      My Research
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
       Evidence          Research Hub          Copilot
           │                  │                  │
           └────────── Research Context ────────┘
                              │
                         Follow / Join
                              │
                      Research Activity
                              │
                  Verified Researcher
                              │
              ┌───────────────┴───────────────┐
              │                               │
          Create Study                    Join Study
              │                               │
              └───────────────┬───────────────┘
                              │
                    Institutional Context
                              │
                        Study Role
                              │
                             Scope
                              │
                          Permission
                              │
                       Data Governance
```

这条链路可以概括成：

```text
User
 ↓
Identity
 ↓
Research Context
 ↓
Hub
 ↓
Study
 ↓
Role
 ↓
Scope
 ↓
Permission
 ↓
Data
```

---

# 9. Data Governance 的核心原则

## 9.1 Discoverability ≠ Accessibility

系统可以允许科研人员知道某个 Study 存在，但这并不意味着可以访问这个 Study 的研究数据。

## 9.2 Hub Membership ≠ Study Membership

加入「针灸治疗情志病 Research Hub」，不意味着自动成为「针刺治疗抑郁症多中心 Study Member」。

## 9.3 Study Membership ≠ Full Data Access

即使加入 Study，不同 PI、Sub-Investigator、CRC、Statistician、Data Manager 仍然对应不同 Role、Site、Scope 与权限。

## 9.4 数据访问由具体科研上下文决定

推荐权限模型：

```text
Identity
   +
Membership
   +
Role
   +
Scope
   +
Permission
        ↓
Resource Access
```

例如：

```text
User
张医生

Identity
L3 Institutional Researcher

Membership
Study A Member

Role
Sub-Investigator

Scope
Beijing Site

Permission
Read / Enter / Review

Resource
授权范围内的 Subject / Visit / CRF Data
```

---

# 10. 五个产品模型如何连接

### 第一层：科研生命周期

回答：**岐研覆盖什么？**

从 Evidence 到 Opportunity、Question、Study、Data、Analysis、Output、Asset，再回到 Research Hub。

### 第二层：科研资产

回答：**为什么平台越用越有价值？**

每一次 Study 不只是完成任务，而是在产生可治理、可追溯、可复用的 Research Assets。

### 第三层：AI × 专家协同

回答：**AI 如何可信地参与？**

AI 基于 Context、Capability、Authority、Evidence 提供 Intelligence，由专家承担最终 Judgment 和 Accountability。

### 第四层：Research Hub

回答：**科研知识、研究者、课题和资产在哪里持续汇聚？**

在围绕稳定科研领域形成的 Research Hub 中。

### 第五层：用户与治理

回答：**谁可以进入、参与什么、访问什么？**

通过：

```text
Identity
→ Hub Membership
→ Study Role
→ Scope
→ Permission
→ Data Governance
```

形成清晰的科研治理边界。

---

# 11. 最终产品闭环

```text
                         Researcher
                             │
                    Personal Research Identity
                             │
                         My Research
                             │
                             ↓
External Evidence ───→ Research Hub ←──── Research Assets
                             │                    ↑
                             ↓                    │
                    Research Opportunity          │
                             ↓                    │
                    Research Project              │
                             ↓                    │
                    Research Question             │
                             ↓                    │
                     Study / Protocol             │
                             ↓                    │
                      Study Execution             │
                             ↓                    │
                      Data & Quality              │
                             ↓                    │
                         Analysis                 │
                             ↓                    │
                     Research Output ─────────────┘

       ───────────── Qiyan Research Copilot ─────────────
           Context · Capability · Authority · Evidence

       ───────────────── Governance ─────────────────────
          Identity · Role · Scope · Permission · Data
```

---

# 12. 面向王教授的一句话解释

> **岐研希望把一位科研人员从“发现值得研究的问题”，到“形成课题并完成研究”，再到“把研究成果沉淀成可复用科研资产”的全过程连接起来。Research Hub 让这些 Evidence、课题、研究者和科研资产围绕一个领域持续积累；岐研 AI 在过程中帮助专家理解证据、发现问题和形成建议，但重要科研判断始终由人负责。同时，平台通过科研身份、Hub、Study、Role、Scope 和 Data Permission 分层治理，确保科研协作可以开放，但数据访问始终有明确边界。**

---

# 13. 核心产品原则

1. **Platform 通用化，Hub 领域化，Study 专业化。**
2. **功能属于 Study，工作属于 User。**
3. **AI Assist, Human Accountable.**
4. **Evidence-grounded & Traceable。**
5. **Research Hub 是进入一个科研领域，而不是加入一个组织。**
6. **加入 Hub ≠ 加入 Study ≠ 获得数据权限。**
7. **Discoverability ≠ Accessibility。**
8. **Identity Level 决定资格；Role + Scope + Permission 决定具体权限。**
9. **课题自治、领域共建、授权共享、平台治理。**
10. **Knowledge 是工作空间，Asset 是受治理的价值对象。**
11. **研究结束不是终点，科研资产沉淀形成下一轮研究的起点。**
12. **不要让教授巡检系统，要让系统主动呈现值得教授判断的事项。**

---

## 文档用途

本文档可作为以下材料的统一母版：

- Product Baseline 后续补充；
- Research Hub PRD；
- Identity / Permission / Governance PRD；
- 王教授签约 PPT；
- 高保真原型设计说明；
- Codex / Figma Make 实现上下文；
- Professor Validation 主持材料。
