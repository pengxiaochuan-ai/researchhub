# 独立总评审与作者修补

日期：2026-11-05。独立 reviewer：`/root/team_usability_final_review`，只读一次，不运行浏览器或写库，不二次复签。

## 原评审结论

0 Critical、1 Important、1 Minor。修补前不建议技术销项。

- Important：审核POST在途发生身份checking，旧请求失效而pendingRef保留；同身份恢复会再次展示旧确认框，可能生成新requestKey而非核对原提交。涉及TeamDirectoryWorkbench身份effect、submit守门、dialog busy。
- Minor：本叶子页头仍写“保存草稿后预览并审核”，与新入口不一致。
- 其余重点未发现阻断：保存回读先于预览、范围切换禁确认、来源精确标识、既有人员档案只读、409保输入/人工换基准。
- reviewer独立运行四个测试文件13/13通过，出现并发SSR已占WebSocket端口提示；没有将纯测试代替真实在途验收。

## 一次作者修补与证据

Important真实浏览器RED：`browser-f9b2e0ed-6d22-43e5-ba6a-7902eb2f28f0/failure.json`，审核请求仅在UI网络边界扣住，不转发到服务端；触发身份刷新，真实auth/me200后旧dialog数为1，预期0。

最小修补：身份重验即失效preview；存在未确认原请求时submit拒绝不同的新请求；确认框busy包含pending/ready状态。保留原key和核对回执/显式原内容重试，不自动重发。Minor同期更新且仅该叶子说明文案，不改Shell布局。

GREEN：`browser-328b8477-6427-42f7-b843-2fe56df65380/result.json`，11组通过，含同身份真实auth/me刷新后无旧框、原回执入口可见、普通审核禁用、迟到503不回填；真实404回执不冒称未提交，不新发审核。220前端/50后端及构建通过。只一次作者修补，无第二独立签认，不将原With fixes改称独立批准。

浏览器首轮还实际发现Esc关闭未归焦（`browser-273d2430...`），因busy禁用原按钮时焦点落body；显式捕获打开按钮后复测通过。所有失败原件保留，不覆盖为成功。

## 边界

没有延后Minor；无新权限/表/费用/云/发布。已有API的真正成功审核及中途失败原子性在真实PG回滚事务验证；浏览器在途审核是明确的UI边界故障注入，不称实际持久批准。用户专业体验仍待确认。
