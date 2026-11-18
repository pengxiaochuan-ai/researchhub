# G02整合核对

当前共同文件保持前轮并发版本：独立GovernanceProtocolReviews追加到待办后，支持状态写死ethics，但governanceModules.ethics.adapters仍为空。会破坏统一排序/去重/总数及未支持提示；需接成第四适配器。

parseReviewPage已有严格studyId/protocolId/version/status/时间/游标校验与formalUrl。新总览不得根据邮箱或可见菜单放宽其后端权限；内部方案审核不能代替IRB。

来源时间来自最近审核决定createdAt，不是来源更新时间。所选system全部403而其他类ready时不能显示需关注0。

2026-11-11的失败、通过JSON和视频全部保留。本轮证据另开2026-11-12目录。

本轮实际POST登录/GET核验：admin、owner的现有protocol-reviews均200、各1项，无后续游标，故无需重启任何服务。owner具有原Study管理权时可见该方案，不能沿用前轮“owner总览必为空”的旧测试假设。

S07正式方案入口有严格scope读取、未保存保护、原页返回概览与公共面包屑。仅补合法治理返回上下文，不把固定方案转成新草稿，不触碰审批/激活动作。

浏览器首轮前11组通过，切owner时UI出现两条同名但不同Study的真实T05方案，随后独立GET只有一条。截图显示owner身份与两条真实时间，期间其他任务在创建/处理T05夹具（新记录00:32:22）。不能按题名去重或据两次库存差异判越权；将owner断言改为本次浏览器实际接收的当前身份HTTP响应之study/protocol组合，避免另发GET对比时库存已变化。保留首轮失败证据，不改产品来迎合库存数量。

17组最新完整浏览器GREEN，body几何断言通过但原生200%的默认viewport PNG仍只截到页头；追加独立的完整页/CDP截图核验，不借DOM判定冒称视觉已看见正文。补充脚本首轮CommonJS包没有named chromium导出，改与主脚本相同的default.chromium兼容取法，不改项目依赖。
