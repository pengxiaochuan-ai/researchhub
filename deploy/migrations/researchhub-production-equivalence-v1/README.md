> 2026-11-19真实生产核对更新：aisci在public/rh_*检查范围仅返回public，未观察到rh_*；指纹c3926157b522a67b902cc579eb738025，与本包前置不符。**禁止将本包用于该生产库首次安装，禁止改before hash绕过。**新任务见[首次安装方案](../../../docs/technical/hub-first-install-production-plan-2026-11-19.md)。下文保留本包原适用范围与演练记录；“生产尚未读取”描述为原交付时点，已由本条更新。

# 生产等价增量候选（尚未完成生产适用性验收）

本包可由 `deploy/migration-runner.mjs` 校验；五步仅在本轮新独立合成库应用通过。不是空库安装包，不含旧核心源码、完整结构dump、账号、数据、密钥或历史任务。

严格要求manifest第一项before指纹对应的12个schema已存在，且结构、owner/ACL/RLS一致。生产尚未读取或核实该基线；不得恢复合成schema到生产，也不得运行本机初始化脚本补齐。基线不符必须停下重新列真实增量，不能改指纹绕过。

| 步骤 | 内容 |
| --- | --- |
| 001 | 资产业务对象、用途、附件、评论、复用约束 |
| 002 | 来源审核回执的当前身份与授权 |
| 003 | 材料AI独立用途依据 |
| 004 | 评论父固定版本修正 |
| 005 | 复制目标的业务父键/元组/固定来源及当前role/adminFlag一致性 |

既有001–004文件及账本不改写，005追加修正。每步SHA、前后结构指纹及依赖见manifest，准确DDL与GRANT见各SQL。材料AI链已在新库验证许可/撤销/再授权及免费固定引用；评论、文件、复制/应用已有新库真实正向和原子回滚证据。005错误元组/归属和失效身份拒绝已核，正文不一致由更早的原生约束拦住。完整Agent装配/启用与整包最终总评仍未完成；结构应用成功不代表完整业务验收。

运营者私有配置必须显式绑定target、marker及TLS；本轮不提供真实生产配置或执行授权。plan绑定端点及目标身份，apply需要本次计划digest，verify重核账本、源hash与当前结构。不自动迁移，禁止CI提交时隐式运行。生产DDL/GRANT、备份恢复、停线及发布分别确认。

```sh
node deploy/migration-runner.mjs plan deploy/migrations/researchhub-production-equivalence-v1 /private/operator-config.json
node deploy/migration-runner.mjs apply deploy/migrations/researchhub-production-equivalence-v1 /private/operator-config.json REVIEWED_PLAN_DIGEST
node deploy/migration-runner.mjs verify deploy/migrations/researchhub-production-equivalence-v1 /private/operator-config.json
```

每步原子，不是整包原子；后步失败不会回滚前步。回退优先停用新应用并保留追加表/事件，不能删除业务或清迁移账本。旧应用兼容、备份还原及真实生产回退尚待独立演练，不提供无依据的DROP脚本。
