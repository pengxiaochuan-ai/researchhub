# 实际Chrome管理员登录来源403 · 本机修补验证

## 根因及范围

用户实际Chrome登录页邮箱为正确admin@example.org，提示“当前账号无权执行此操作”。同一本机管理员标准同源HTTP201，错误末尾标点账号401；不是应追加角色或权限的故障。

原生Chrome在输入不存在的具名合成账号时同样出现403。临时只记录来源元信息后确认：Origin=http://127.0.0.1，完整页面来源=http://127.0.0.1:19501，Sec-Fetch-Site=same-origin、Mode=cors、Dest=empty、JSON=true。新会话严格Origin比较遇本机实际Chrome去端口行为拒绝，前端又把所有403映射成“无权”。诊断未记录密码、Cookie、账号、请求体或查询参数，临时打印已移除，原私有日志保留。

按[最小规格](../technical/session-origin-fix-2026-11-06.md)仅给本机19501采用已有目录写入口的独立同源证明：去端口Origin仍须loopback、限定Host、无转发头、完整同源Referer、same-origin Site/Mode、empty Dest、专用session-v1头全部成立。不是添加宽松Origin/CORS白名单，正式HTTPS无此例外；12h/当前授权/失效/退出撤销/数据库/旧系统/布局不改。三个会话POST前端显式same-origin和专用头；来源403使用AUTH_ORIGIN_REJECTED安全文案，真正业务403仍无权，不透传原始服务端详情。

## 验证

- 本轮单元先RED复现浏览器证明缺口及错误分类，再GREEN；251前端/71认证、目录及字典后端（含真实PG）通过，构建通过，保留既有大分包警告。
- 真实原生Chrome同一表单的不存在合成账号从来源403变为预期凭据错误401文案，证明跨过来源守门进入原账号认证。清除诊断输入，刷新清除合成失败提示，恢复admin@example.org、密码为空，原AI返回地址保留；没有代填/更改用户密码，不冒称已替用户完成原生Chrome管理员登录。
- 真实HTTP逐项缺失/伪造证明拒绝；两个原合成账号走完整去端口证明登录201→续期200→退出200→旧凭证renew401。共41项通过，证据`evidence/session-origin-fix-2026-11-06/b30c2bea-973c-4dd9-98dc-f7b3efd33bcf/result.json`，不存凭证。日志归档在本轮evidence/logs。
- 完整双账号Chrome会话/知识iframe/过期原页及带参数回跳回归通过，5组检查点，PNG/WebM及请求证据`evidence/session-policy-2026-11-06/6c7b0288-ec58-46a6-ab3c-9878582fca00/result.json`。pageErrors为空；主动离线及过期负例的控制台报错单列。用户实际Chrome的合成复现与纠正来自本会话原生AX工具记录，和隔离Chrome脚本结果分别举证，不混称同一浏览器或同一账号已成功。
- 单次只读独立总评审无Critical/Important/Minor，独立复跑28项相关测试通过，确认全部本机同源证明为合取条件、正式HTTPS及原授权/12h/撤销均不放宽。产品基线/变更、使用说明、版本、架构/索引、API及本规格/报告已同步Notion：[验证记录](https://app.notion.com/p/41056479ab5881dbb644efdc208659ed)、[最小修补](https://app.notion.com/p/41056479ab5881d89a8fd989b798e2de)。

只重载本机具名独立环境；不接临床库、不影响旧服务、不创建云资源或真实发布、无模型调用或真实团队审核。管理员可在原登录页用原密码重试，邮箱末尾不加标点。
