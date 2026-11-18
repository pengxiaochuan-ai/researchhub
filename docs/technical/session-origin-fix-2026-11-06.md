# 本机实际Chrome登录来源403修补

2026-11-06用户报告admin@example.org提示“当前账号无权执行此操作”。实际Chrome邮箱正确；标准同源HTTP管理员201，带末尾标点的错误账号401。使用不存在的合成账号在用户Chrome表单复现403，临时诊断只记录请求来源/浏览器元信息，不记录账号、密码、Cookie、请求体或URL查询。

实测：origin=`http://127.0.0.1`，expected/pageOrigin=`http://127.0.0.1:19501`，Sec-Fetch-Site=same-origin，Mode=cors，Dest=empty，JSON=true。根因为实际Chrome来源被去掉端口，旧会话代码仅精确Origin比较；前端把来源403误称业务权限错误。

最小修补：沿用目录接口已采用的独立浏览器同源证明，仅本机19501源站允许上述去端口形态；还必须有same-origin Fetch Metadata、显式same-origin请求模式、empty目标、会话专用头、完整同源Referer、loopback socket与19501/19502 Host、无转发头。不能仅凭去端口Origin或Referer放行。登录/续期/退出前端明确mode及专用头；正式HTTPS、其他Origin/CORS及授权/12h/撤销/来源审计不放宽。来源拒绝使用安全AUTH_ORIGIN_REJECTED文案，业务403仍无权，不显示服务端原始详情。移除临时诊断打印。

目标仍仅本机专用合成环境，不改旧服务、数据库或页面布局、不增加权限、不调用付费模型。单元先复现后修补，真实HTTP逐项缺失/伪造拒绝、真实Chrome合成输入从来源403到预期凭据401，再验证真实合成管理员/科研人员登录及会话回归。真实资料不代审。
