# H5 静默核权与单一提交反馈 · 独立窄审

2026-11-12。仅审 `useQuestionnaireH5.js`、`QuestionnaireH5.jsx` 指定交互修复与既有来源证明未变；未修改实现、原邀请、原答卷、邮件或运行配置。本轮未见未解决 Critical / Important 阻断。

## 源码结论

- `useQuestionnaireH5.js:18` 静默读取使用独立 reader 标记，只合并同一在途 quiet read，不占 working/busy；仍调用实际 client.read。finally 只清理自己持有的标记，成功、读取失败和旧响应丢弃均释放，不会永久停止后续核权。
- `:18,20,26–28` 每次读取有 readEpoch，显式写、恢复与放弃本页修改递增代次；响应及失败均同时核对 generation/epoch，旧 quiet 成功或失败不得越过较新的显式状态。提交在 quiet 在途时可以独立认领 working 并发起写；quiet 不把合法提交当作“忙”吞掉。显式读取/保存仍有 busy。
- `:12–13,28` 当前读取网络失败会撤销本页 verified 并保留 dirty 输入，后续核对成功才能继续写；当前失权/撤回仍清除内容与本地敏感内存。focus/visibility/每 10 秒核权继续存在，只有不可见、已有写操作或原未知保存标记等既有条件限制，不以静默为由移除安全读取。相同 DTO 不重复替换 view/输入；有变化时仍执行来源/版本和 dirty 冲突逻辑。
- `:21,26` 提交或恢复到 submitted 不再同时设置完成 notice；`QuestionnaireH5.jsx:14` 在 h5-state 保留唯一完成状态及 role=status。草稿暂存反馈、显式忙态、未知结果核对、冲突处理和站内确认保留。
- `src/questionnaire-h5-session.js` 仍为已审来源证明 SHA，mode/custom marker/root referrer/同源策略、expectedAssignmentId 和 cookie 路径未因本修复改变。

## 验证证据

已核作者真实合成浏览器 RED `h5-quiet-079bafaa/failure.json`：草稿期 spinner/disabled 各 4，提交后完成提示 2 条；提交实际 1 次。`h5-quiet-bc4ca585` 是 route handler 工具错误，作者已明确其产品断言不最终，不能把它当产品 RED。

已核作者真实合成 GREEN [h5-quiet-8619f995/result.json](../../testing/evidence/research-t11-2026-11-12/h5-quiet-8619f995/result.json)，并查看提交截图：草稿及提交后各真实等待 25.1 秒并回焦，分别 3/4 次 GET，spinner/disabled/navigation 皆 0，输入节点保持，提交仅 1 次，完成文本与完成 role=status 各 1；延迟旧 GET 不覆盖提交、当前用途撤回 410 清除答案。该脚本使用独立新合成被试/邀请，未重发邮件；是作者真实执行证据，本独审没有重跑该业务 fixture 或触用户原邀请。

独立新跑旧客户端及来源证明测试 10/10。另以全新原生 Google Chrome 运行实际 React hook，所有问卷 API 均拦截为合成替身，覆盖 3 个确定性反例：

1. quiet 连续重入只产生一条 GET，网络读取失败后 busy 不闪、读锁释放；下一次 quiet 可恢复 verified，dirty 值仍为 7。
2. quiet GET 在途时显式提交成功且仅一次 POST；随后旧 GET 返回 403，不得清除较新的已核对提交状态、答案或重新制造 pending/notice。
3. 新的当前 quiet 返回 403，仍清除 view 与答案并撤销 verified，证明旧响应屏蔽没有关闭当前撤权处理。

独立证据：[h5-quiet-independent-252cf82c/README.md](../../testing/evidence/research-t11-2026-11-12/h5-quiet-independent-252cf82c/README.md)。含结果、原生浏览器截图/录屏和可重复脚本说明；已查看失败恢复截图。该替身验证不当作真实 server/PG/同意撤回证明，也不代签用户原邮件的业务结果或生产环境。

| 冻结源码 | SHA-256 |
|---|---|
| pages/shared/useQuestionnaireH5.js | `796408a792cc35917cae5f4fd366eb6f0b12fec8f0b4d5d60629ed289d9b153b` |
| pages/shared/QuestionnaireH5.jsx | `892e9a16d834ce0418bce7cb1ab27a3e0bade2182e8969c76823a4a18e78cf5b` |
| src/questionnaire-h5-session.js（来源证明未变） | `096112e689a243a0d671d04864d591f5d005de6dcf619860689725e2e98dc08a` |

未独立构建、重载、发送邮件或修改原邀请；本轮新增仅测试脚本/fixture 与独审证据。共享产品、使用说明、版本与 Notion 同步由主循环收口。

建议下一项：把单一完成反馈与安静核权的真实浏览器证据并入本轮验收记录，继续已授权 S09 文件回执与重新核验联调。
