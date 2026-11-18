# 当前发现

- 本机local-knowledge-ai使用LocalAiBudget及单篇/资产目的费用链，Provider、入队、状态、前端重复执行开发限制；旧SessionsService另执行租户/账号Token原子预留、实际用量及结果同事务结算、失败待对账。
- 已确认最后验收报价过期且owner专用，不能把这些条件当产品账号/文章授权。
- 其他五类AI草稿工作台也有budget同步门禁；EDC/CRF/资产还有paidAiApproved/次数。移除仅这些费用开发条件，保留其原业务授权及技术容量。
- 使用本机专用合成库wp01_test_full_baseline；不接临床库、不运行旧任务、不改角色/旧预留。

最终裁定：上述是改动前发现，现行runtime已不import四开发费用守门；原ledger及receipt保留。不能把旧业务授权scope过期当报价问题续权。失败模型消耗通过现有typed错误和partialUsage保留待对账，禁止仅删预算导致失败免费；成功实际2917 Tokens已在原链结算。
