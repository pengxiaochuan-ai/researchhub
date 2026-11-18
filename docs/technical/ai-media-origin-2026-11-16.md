# 岐研AI视频来源拒绝 · 本机最小修补

2026-11-16，当前唯一主线是用户新会话仍出现“请从当前岐研AI页面操作”。最新服务端记录证明POST的Host通过、Origin存在但不匹配，无转发头。当前不能把它归为上一轮的文件大小/旧pending问题，也不声称已从旧日志拿到原Origin全文。

项目已有session-origin-fix-2026-11-06的真实普通Chrome证据：Origin会表现为http://127.0.0.1而Referer保留19501端口；具体改写环节未确认。视频当前只做严格字符串比较。本片按相同的受控本机证明补齐，原严格Origin路径保留；不改登录、旧系统、角色、Study/本人授权、文件身份/分片/保留及页面布局。

## 最小协议

- 视频写请求才添加专用X-ResearchHub-Request=session-media-v1，显式fetch mode=same-origin、credentials=same-origin、redirect=error。
- 视频二进制分片改用同源fetch，其余文献/Excel上传XHR不变。进度以已获服务器成功响应的分片字节累计，保留3并行、1MiB片大小、失败不自动重试。
- 后端仅对本机19501这一固定入口、Origin恰为无端口http://127.0.0.1的POST增加兼容。须同时满足loopback真实socket、限定实际Host、无任意转发头、完整同源Referer且无用户信息、same-origin Site/Mode、empty Dest、专用标记、严格合法媒体POST路由及其JSON/octet-stream类型。null/缺失/其他Origin、localhost别名、其他端口、证明不全仍403。不是新增宽松CORS或Origin白名单。
- 源拒绝输出稳定MEDIA_ORIGIN_REJECTED及用户可操作说明；日志只记录来源分类和证明布尔值，不记录Cookie、凭证、姓名/文件/请求正文、完整Referer或查询参数。正式HTTPS无此本机例外。

## 实施与验收

先用原服务做具名合成账号的无效初始化，完整Origin到字段校验400，去端口Origin加完整证明仍403，0媒体写；留RED。再补纯测试、真实HTTP完整反例、两个账号真实Chrome的初始化→分片→完成→核对→播放/刷新。浏览器去端口路径使用明确记录的出站Origin控制，仅改该头且真实请求后端，不伪造响应，不冒称当前用户浏览器的具体改写器已查明。

仅专用合成库、原owner/admin。最多各1份新的具名合成视频，所有先前对象只读，不接触用户原视频字节，不新增模型/费用/表/授权。保留同一个requestKey/uploadId恢复；运行中未知结果不得另建原件。当前目录串行实施＋一次只读独立评审。共享窗口若被明确占用则等待，不发送跨会话消息。完成后更新living spec/版本/手册和Notion，原文件成功仍由用户复验。

## 实施后的证据校准

普通Chrome的新上传已创建原两份合成归档，但route.continue不能作为最终线上Origin改变的证明。当前验收改为CDP读取实际浏览器同源元数据，按实测证明回放去端口请求至真实后端，分别核对JSON201和二进制缺失ID404；完整边界另有25组真实HTTP。原两归档沿保存回执恢复，不增第三份。恢复脚本缺少既有checkpoint/原key时立即拒绝，不默认重建；初次普通上传与受控来源回放在报告中分开。详见[实际执行及用户复验边界](../testing/ai-media-origin-2026-11-16.md)。
