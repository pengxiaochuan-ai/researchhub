# 独立后端包与数据库增量：本机交付验收说明

2026-11-19。本轮以已批准的具名独立合成环境验证可执行包、迁移候选及当前权限；不等于正式环境启用或甲方专业验收。历史失败与修补保留在本轮进度，不由本页覆盖。

## 两项交付物

1. `deploy/core-bundle.mjs`、`deploy/backend-package.mjs`和`deploy/backend.Dockerfile`：显式旧源/私有manifest摘要，生成无.env/数据的私有核心与Hub构建上下文；Linux依赖与原生Prisma，独立full入口、只读存储探活、显式消费者、零启动授权。方法Worker另有独立构建器及Dockerfile。私有归档/镜像仅留本机忽略目录，准确hash见相应receipt；当前目标linux/arm64，不冒称amd64。
2. `deploy/migrations/researchhub-production-equivalence-v1`及`deploy/migration-runner.mjs`：五步追加SQL、依赖/逐步hash/前后指纹、target/marker/TLS/批准digest、只读check/plan、原子单步apply及ledger verify。新合成库applied=5/pending=0、最终指纹e69a720d93bed67c868f9941bc69089c。已应用SQL不改写；静态省市参考行使用独立显式初始化，非启动/隐式DDL。

## 实际执行证据

| 路径 | 本轮观察 | 限制 |
| --- | --- | --- |
| 构建/启动 | Node22.23.5 Linux原生镜像，私有依赖根/hash，独立端口/桶；重启28表hash不变、0新认领 | 不使用旧AppModule/旧配置；生产架构另验 |
| 账号/邀请 | admin/owner登录，注册待审不加Study，2个邮件challenge、1次只读邀请；共4账号 | 本机SMTP捕获；未发真实邮件 |
| 知识资料 | 唯一合成Markdown导入、读取、审核、检索，管理员无需补成员；错scope/只读写入拒绝 | 外部解析、PDF/OCR和向量服务配置后另验 |
| 研究/方法 | 原生方案/执行政策、3份CRF、快照、唯一确定性描述统计及确认，报告内部审核和Study私有启用 | 无真实临床数据、LLM或额外方法运行 |
| 资产 | 3registry/5artifact/5policy/15事件；报告登记审核、固定版复制、应用草稿v2、414字节附件、2评论及历史 | 私有未发布；不开放共享/导出，不增加版本 |
| 依据检索 | 材料/个人许可各3事件，撤销/再授权与A02→AI01固定片段引用 | 这是检索依据，未执行模型回答 |
| 聊天兼容 | 14原生正反例全ROLLBACK；真实HTTP管理员503、科研只读403、错scope403、知识读取200 | 无持久AgentConfig/Access、模型Profile、额度或聊天任务；F01终态不强改 |
| 对象存储 | 附件/Range字节及hash实测；公开PMC附件和G02原文均注入同一租户S3读器 | 无PMC新数据；审核原文仅纯契约测试，不冒称正向内容交付 |
| 门禁 | 98项当前限定纯回归0失败/0跳过；PG原子回滚、真实Chrome截图/录屏、迁移拒绝另列 | 不称全仓/生产/专业验收，未重跑旧DB测试 |

## 失败和已知边界

保留构建、错误请求参数、来源洗白、上传恢复、MIME及原生权限缺口的发现与修补过程。独评发现的工具交集越界已双侧封顶knowledge.search；源/目标目录别名、symlink及hardlink防护已补。原5份源码hash相同；旧服务/临床库未切换。

1440px当前原页面可读，无pageerror；390px A02母版仍横向溢出及导航遮挡，不计窄屏通过。无聊天配置的AI01显示受限，历史栏暂停时仍可残留读取提示，此为界面已知问题，不把拒绝链检查称完整AI界面验收，本轮不改布局。未启用模块以实际状态为准，不用其他成功步骤掩盖。

## 提交和正式执行边界

ResearchHub仓库根为独立Git仓库。公开提交包含代码/文档/迁移候选；不含私有核心二进制/源码归档、.env、业务数据、原始SQL结构dump、截图/录屏或运行账本。最终暂存区需独立复核。提交使用`[skip ci]`，不手动触发工作流，不因push main自动授权真实发布。

生产仍须单独确认：真实共享库基线/现有角色/ACL/RLS和扫描兼容、备份恢复、准确增量与GRANT、目标CPU架构、私有包传递与环境配置、对象数据同步、停线/回退及正式发布。基线不符必须停，不改指纹绕过，不把本机schema-only结构恢复到生产，不恢复合成账号/任务/额度。

详细证据索引：[本轮进度](backend-deployment-progress-2026-11-18.md)。用户操作与专业反馈：[统一手册](../product/用户验证与操作手册.md)。

## 源码交付结果

代码及增量候选已推远程main：[e72748e](https://github.com/pengxiaochuan-ai/researchhub/commit/e72748e1c8950be4ea8ae1164f8d01657f3789fb)。155个最终暂存文件经独立总评，无阻断P1/P2，119个JS/MJS语法检查通过；提交tree与受审index相同，远端SHA已核一致，工作树干净。提交含skip-ci，核验时该SHA匹配工作流为0，未手动dispatch。

私有交付为researchhub-backend-v33.tar.gz，10,483,760字节，SHA256 `8cab98a4ca99ae3efd392fde7241da3614c60388ab1f7a7d30dd93f8c9187477`，Linux/arm64。core摘要85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135；Hub摘要da01e52f5bf5cd31b35898f0cf5b4e6fd0b7be946e78a574ebf7bf65adde210e。归档及准确receipt仍只在本机私有忽略目录，不含运行配置或业务数据，不提交公开Git。最终镜像重启28表hash一致，Chrome再次确认管理员503/科研403及零新增。文档交付回执随后以仅文档skip-ci提交记录，不改变代码、数据库或运行环境。
