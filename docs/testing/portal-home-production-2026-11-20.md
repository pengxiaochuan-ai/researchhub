# 生产根地址默认P002 · 上线验收

日期：2026-11-20。用户明确要求生产域名默认进入P002，本轮已上线。

- 正式域名：https://hub.pengxc.com/ ，结果：https://hub.pengxc.com/pages/p002/ 。/index.html同样进入门户；原P002与旧P00明确路径保留。
- 代码：017d2967979c6e820324b6bff69050096798e7fc。
- 远端plan：44682767330，frontend=true/backend=false/databaseChanged=false，上一成功基线hub-runtime-6e6ffbaa-44679992177001。
- 成功发布：https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44682997314 ，tag=hub-runtime-017d2967-44682997314001；镜像复用、真实Docker/Postgres隔离升级失败回退演练、实际切换、认证/只读业务浏览器和最终成功指针均通过。

## 实际业务结果

真实Chrome访问根地址、index、query/hash及外部returnTo参数四组都停留固定同源P002；参数/锚点保留，不将查询参数解释为跳转目的地。禁用JS时进入固定门户路径，仅作为入口兜底，不代表P002完整功能支持禁用JS。

P003/P004/P005/P007/P008/P009/P011全部实际加载6.3KB独立Logo WebP，无reference-1请求；P003卡片没有演示入口，真实登录/注册/找回/帮助保留。账号页三张复访图片3/3命中cache，CDP传输0，实际immutable响应；根HTML为text/html且未配置长期immutable。旧P00直接入口仍可访问，0pageerror和0业务写。Chrome15组结果、截图与录屏已留存。

生产Apply与Finalize回执相匹配，backendPreserved记录容器ID、image ID/reference、Config摘要、StartedAt、restartCount、.env.prod SHA。固定版本的后端保全校验及其他服务/历史任务保全均通过，无数据库迁移或后台重启。

## 验证与边界

本机22项相关测试（20组件/会话/准入/缓存+2根入口）和完整构建通过；独立评审确认固定同源replace不构成开放重定向。真实域名新增验证不提交注册、找回密码或科研数据；现有发布流水线真实认证/只读业务smoke单列成功，不冒称真实注册/邮件闭环。

第一次release dispatch在排队期间绑定了主分支新提交7a4094f，已主动取消44682869207；Plan/Apply阶段均skipped，未发生生产切换。随后推送固定版本分支codex/portal-home-release-20261120并以该ref发布，实际head精确为017d296，没有携带其他会话的ops脚本。未使用force push或修改其他会话文件。

构建保留既有大chunk提示；CI有第三方actions Node20弃用提示及公开tenant slug构建ARG命名告警，均非本轮新增凭证或失败。真实正式注册/找回邮件投递仍未在本轮重验。

证据：docs/testing/evidence/portal-home-production-2026-11-20，含local/online截图录屏与result、plan、production-receipts、根HTML前后/响应头、取消前置检查及测试构建日志。
