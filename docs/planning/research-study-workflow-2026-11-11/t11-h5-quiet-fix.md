# T11 H5 静默核权与单一完成状态 · 窄修复合同

2026-11-12，用户真实原邮件问卷已提交后反馈“自动刷新”和两条完成提示。原邀请、邮件与答卷不改、不重发；只修 H5 页级交互。

现因 focus/visibility/每10秒 check 都设置 busy，自动核权期间会显示“正在核对问卷”并禁用字段；submit 的 notice 与常驻状态重复。保留后台定时/回焦真实当前身份、邀请目标、参与及用途授权 GET，自动路径只静默核对，显式重读/保存仍有忙态。静默 GET 独立读锁，不阻止正常输入或吞掉提交点击；保存/恢复/放弃修改与新读取递增读取代次，旧静默响应不得覆盖较新写后状态。未变化的授权结果无需重置表单节点/答案；同意撤回仍立即清敏感内容。

提交完成只保留一条可朗读的状态“已提交，感谢完成。”；草稿暂存反馈和未知结果恢复保留。新独立通用合成邀请真实浏览器先记录反例，后验证：填写前后各至少25秒及focus，GET仍执行、无spinner/禁用/导航/答案重置；提交仅一次POST且只一条完成提示；延迟静默 GET 与实际提交并发后不能把提交态改回草稿；当前用途撤回清答案。保留PNG/WebM、原反例及新证据，再同步产品/living/manual/version/Notion。不会暂停安全轮询，不覆盖新H5 origin proof，不动原真实用户邀请。

## 实现与真实回归

只修改 `useQuestionnaireH5.js` 与 `QuestionnaireH5.jsx` 的上述交互：quiet独立读锁、读取代次、无变化时不重置视图、单一常驻 `role=status` 完成状态。显式重读/保存忙态及原错误/撤回守门保留，公共客户端 origin proof 与 expectedAssignmentId 未改。原整链脚本的人工并发 HTTP 请求补同源标记，与现客户端一致，没有放宽后端。

证据基目录 `docs/testing/evidence/research-t11-2026-11-12/`：

| 证据 | 结果 |
| --- | --- |
| `h5-quiet-079bafaa/failure.json` | 修复前真实反例，两个25.1秒窗口GET分别3/4次；填写态spinner4次、禁用4次，提交态spinner4次、完成文字2处，实际导航0，submit仅1POST。因此反馈中的刷新感可由核对忙态复现，未伪称捕获真实整页导航。 |
| `h5-quiet-8619f995/result.json` | 修复后两个真实25.1秒窗口+focus，GET仍3/4次，spinner/禁用/导航均0，原输入节点和值保留。实际submit仅1POST，只有一处感谢完成且可朗读status1；刻意held旧draft GET跨实际submit返回，未回退已提交。独立case延迟GET仍可继续输入、真实用途撤回后清input/select/state。390 PNG/WebM齐。120ms延迟和held响应是明确网络调度注入，真实API结果未改。 |
| `h5-ui-b4c7cf6b/result.json` | 新独立样例重跑原T11整链：草稿0/false、刷新继续、实际已写后断响应原GET恢复、503保留、双HTTP CAS409、弹窗Esc/焦点、单次提交只读、A/B Cookie目标错配、真实撤回与404禁写；桌面/390/320及原生200% PNG/WebM。 |
| `h5-quiet-freeze/` | 前端446/446、独立临时Vite构建5.71秒，日志与6源/脚本/合同SHA256。未写共享业务dist，保留既有chunk提示。 |

`h5-quiet-bc4ca585/` 为首轮修复后harness失败：测试在held响应fulfill前移除Playwright路由，触发Route already handled；原工件和失败记录保留。仅修harness等待策略后全新案例重跑通过，没有为通过测试改权限或数据。

本记录使用独立合成邀请，邮件provider为unknown替身且未发送SMTP，不触碰真实原邮件/答卷，也不能取代主线程对真实提交回执的验证。主线程窄审与产品/版本/Notion同步后收口本紧急修复，再串行继续T14。
