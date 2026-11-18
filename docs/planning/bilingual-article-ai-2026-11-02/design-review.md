# 最小方案独立可实施性评审

2026-11-02。仅文档/只读源码评审，无数据库/服务/模型/权限操作；不是代码总评审、运行时验证或用户批准。

## 原评审结论

独立评审发现1项重要接口缺口：刷新后可能丢sessionId，article-context原只返回绑定，knowledge-state又要求已知sessionId，jobs无requestKey，无法兑现“只GET恢复”。应明确在当前本人/Study/Agent/binding下只读查既有会话和任务、用原key及inputHash核对；不能临时用POST ensure/localStorage补洞。

其他已核对的词组/分页前过滤、单篇固定范围、多片当前重验、原提交事务和独立费用授权，无必须另问用户的重要未定决策。短片段hash与旧固定1200窗口的差异由作者明确分流，不放宽原规则。

## 作者修订（不冒称独立复签）

已补入规格第6/7/9节和B04/B05：article-context返回existingSessionId/latestTask，可选requestKey精确恢复；新article-state最多20 jobs带requestKey/inputHash；同本人绑定最多1在途、事务内检查，重复不新增预留。刷新、ensure回执丢失、send回执丢失、并发两页面均有明确反例，旧结果不能冒充新任务。

原评审问题与作者修订分开留痕。规格/计划/UI01–04/M01–M02仍待用户确认，F01核价和调用单独批准；本轮未写产品代码或做新功能浏览器验收。24＋8h与首4h止损保持。
