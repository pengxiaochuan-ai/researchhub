# 单篇文章AI：共同后端最小接通与私有内核准入（待确认）

用户本轮选择：保留K01现有布局，继续后端功能。优先消除单篇文章AI的“尚未配置”，复用现有文章契约、模型、队列、原生额度/计费和来源。当前仅免费准备，尚未启用/发布本功能；不把接口占位去掉等同能力完成。

## 已核问题和免费工作

1. 正式chat控制器的article-context仍是503占位；ensure/send/state/source没有文章分支。本机已有createArticleAi与article-response.v4，可复用，不重做业务。
2. article-evidence固定读本机.tmp原件。已补可注入的权威对象读取器，严格核objects/SHA/长度；指定对象存储失败不切回本机。生产将接已有createPmcObjectReader，本机保留明确的本机存储绑定，解析/选段/审核重验共用。
3. 固定core55原生管理员Worker只允许Hub或kb上下文，拒绝hub-article。对现有admin文章任务cmw4ri9oy0004luyiuc1eq9u3做真实PG只读调用，明确返回WORKER_AUTHORIZATION_REVOKED；不能补成员、换成Hub会话或绕过Native Worker。
4. 仅封包源码候选（不是新运行环境）：保持账户/租户/Study/Agent/Access原检查，只补canonical文章会话与服务器任务payload一致性；2项谓词测试和全候选模块编译后真实PG只读调用通过。原core文件、运行API、Worker和数据库未切换或写入，模型调用0。最初候选生成的字符串替换转义错误已修，失败源码/日志保留，不进入批准版本。

## 本次必要增量

只修改Hub私有构建副本中的src/common/hub-knowledge-admin.ts，追加1份prisma/runtime-adaptations/article-admin.json证明；旧app源码/服务不改。精确身份：

- 源core：`55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669`
- 待批新core：`c5a27d1cdb85681bf21821e7b8c8eabd482469fb7c87031dabb5faa69cf9e087`
- helper原SHA：`38084013d85f37da2c0f97f826e1c0435d17ee346b3eeac67ca56075cf9efa60`
- helper新SHA：`5f281d385c983522dac08cba62a5292b3a8983e61a3a11c6cc430e8caef93fff`

新增文章分支只接受canonical hub-article:v1，四字段recordId/articleVersion/rawSha256/reviewVersion完整、格式合法、编码唯一；会话绑定与任务articleEvidence.binding及source相同，packHash/articleInputHash格式有效，kbIds/attachments均为空。现有Hub/KB分支不改。该原生分支仅核真实任务父对象与身份；当前正文展示/AI许可、审核版本、packHash全文重建仍由Hub在原生事务中校验，不能用语法正确代替资料授权。

须同时补准确55↔本新指纹的standard发布准入、能力声明、构建证明与配对回滚；不能泛化接受任意core SHA，不能移除原守门。当前发布脚本只有85↔55规则，直接换hash会被正确拒绝。旧55包、旧配置与账本保留；升级失败恢复旧版本。Prisma模型、数据库DDL/GRANT、账号、角色、成员、额度均不新增或调整。

## 共同业务切片

- 首轮只使用既有、已审核且具备AI用途的PMC正文；缺正文或许可明确材料不足，不抓新全文、不追加许可、不推定有权使用。
- 共用原context/ensure/幂等enqueue/state/source。资料读取器接当前环境真实存储；不建第二套本机API/PG，不补生产占位关闭，不设置验收账号/次数白名单作为产品规则。
- 新增薄article-turn/module，复用Native Sessions/Orchestrator/Queue、执行及assistant提交围栏、持久用量和原生Token；不把文章伪装成kb资料，也不降级为普通自由回答。
- 沿用article-response.v4：模型定性解释并选择真实fragment/numericFact标识；后端验证引用、科学数值和定位并渲染，保留不足/待核对，不编造数据。
- 入队原子事务核当前用户、真实会话/Study/Agent与固定文章，再创建消息/任务；执行前/后和提交前重验授权、审核/用途、版本/来源及租约。已知失败用量结算、未知用量待核，不自动重试或对账。
- 原E02/AI01布局与按钮不变；仅挂通现有入口。K01现布局按用户决定保留，阅读区优化暂缓。

## 小步计划与验收

1. 免费源读取修补及候选守门（已完成准备）：32项读取/文章引用/数值契约测试通过；2项候选谓词及PG只读对照通过，0写入/调用/服务启动。
2. 确认后：实现共同文章执行/五入口与同事务围栏；本机19501原位验证两原账号及既有当前Study。PG回滚覆盖无成员管理员、普通成员、错父对象、撤权/撤审/版本漂移、同键防重、已知/未知用量，不改变旧样例。
3. 精确候选封存、55↔新指纹升级回滚测试及独立总评；保留原K01/普通Hub问答及175条历史排队，其他模块不扩。
4. 正常feature分支→main→既有同版CI/CD；生产独立researchhub，无迁移，不动旧系统/官网，不创建云资源或新环境。
5. 若同意本次验证调用范围：最多2个新问答任务、2次真实HTTP请求（本机/生产各1，失败与内部fallback计入，不自动重试）；验证只用原admin/owner、当前Study及已有获准资料，不新增用途许可。费用共用原本机5元/生产1元，不充值/续额，调用前重新核价及检查剩余。现有已知上界分别2.272968元/0.112392元；原账本及过期规则不改。此计数只约束测试，不植入产品运行。超预算、缺许可/资料或未知用量即停。

四层验收须分别举证：代码、两环境装配、真实工具/Provider执行、固定版引用与可用解释；全部未完成前不得标为上线。本页拟批准的是上述有界私有兼容/实施及可选2调用，不是新的角色或数据库授权。

私有证据：.tmp/article-runtime-parity-20261120/；原生只读失败、候选源码/指纹/编译、PG只读对照及32项回归均保留。候选源包未激活、未上传或提交Git，未改变现有服务。
