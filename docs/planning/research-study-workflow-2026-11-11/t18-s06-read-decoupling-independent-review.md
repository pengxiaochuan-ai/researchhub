# T18 / S06 当前详情与近期列表解耦：独立窄审

2026-11-13。最终结论：本次冻结的三个产品源无剩余阻断。范围为读取解耦、权限与来源、迟到结果、未知操作恢复及原近期 Card 状态；未重审统计实现或改变页面布局。仅执行纯进程内测试，测试的所有 GET/POST 均为假传输；未发实际 API、SQL、浏览器或业务请求，未修改产品源。

最终 [作者 manifest](../../testing/evidence/research-t18-2026-11-13/methods-read-decoupling-05f8b49e/manifest.json) SHA `44a26e389bc0de5588e0c7eadf7240f620b34efad62ab67fed7f41352549da83`。已独立核完其中 3 产品源、3 支持文件、5 证据文件的 SHA/大小，11/11 相符：

| 产品源 | SHA-256 |
| --- | --- |
| `src/formal-methods-read.js` | `c886129c1c1628d8bc282543ba5ff9e5b530baea89c6f6fa699d7d1fd1987244` |
| `pages/shared/useFormalMethods.js` | `79b8e0a7e3cd64cbfe7ce9e72937965359cd686a450c3e3c32c3686e07aa7cb2` |
| `pages/shared/FormalMethodsWorkspace.jsx` | `afaa956d51ef28bcc687f4a1f2830b0870487577e10bfb0165705f2258b87d72` |

独审在首版 hook `5793aa33…` 发现 Important 并发问题：详情核对后后台列表仍可在写入进行中或恢复既有未知标记之后返回 401/403，触发 reset/forget，删除已经落盘的原键。使用冻结的实际 hook 做进程内复现，两个独立断言均 RED：挂起 review POST 的原键被删除、恢复的未知原键被删除。原文和失败日志均保留。首次生成独立测试时参数遗漏造成的 harness 错误另存，不算产品 RED。

最终修复关闭了该路径：列表拥有独立身份客户端；send/recover 先使旧列表及其身份查询作废；恢复原标记先于启动后台列表；marker/writer 存在时不启动列表；只有写入或原键确认已结束且标记已消除，才在 finally 刷新列表。旧列表不会覆盖写后的当前状态，也不会从共享身份客户端回调中取消新 POST。两个独立原 RED 在修复后均 GREEN。

其余边界已窄核：

- 精确 Run/固定 snapshot 直接核当前权限、Run、批准计划/快照/配置与算子证据，不等待全研究列表；receipt ACK 只依赖原键和当前精确来源。
- 仅专用近期列表 GET 使用 60 秒界限；精确详情和身份仍为原 20 秒。列表前后核同 actor/authVersion，独立 epoch/abort 丢弃旧身份或旧请求结果。
- 普通列表 503 仅改变近期 Card，保留已核详情；真实权限丢失清受限详情。当前来源 409 或输入 hash 变化移除旧数值；迟到列表不能把数值重新放回详情。
- quiet 不重复全表读取。仅列表入口仍等真实列表，加载/错误/真空态明确；pending 期间显示暂停读取提示。原主 Card、tabs、统计值呈现与写入正文/TTL 不变。

最终 `79b8/afaa` 相对前次已审 `bd9a/122c` 只增加暂停状态和相应提示；移除这些变化可逐字还原两份前次 SHA。最终同字节合跑独立 2 例及相关 23 例，共 **25/25** 通过。

[独立审结 JSON](../../testing/evidence/research-t18-2026-11-12/s06-read-decoupling-independent/final-review.json) SHA `d6fecce397d498e5b8e0239e7e5cc4f63238290a56b123f8098ca3ac472f1c0c`；同目录保留初版/最终字节、修复差异、独立 RED/GREEN、最终冻结测试日志及 harness 错误原件。本次结果只证明源码与纯契约，完整构建和目标环境真实只读验收由根另行举证。

建议下一项：根按上述三个最终 SHA 完成统一真实只读窗口，验证慢列表不再阻断原 Run；通过后再继续仅审核已创建 Run，保持 Worker 一次。
