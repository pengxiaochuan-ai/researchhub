# B08 本机追加目的费用与失败停线

## 2026-11-04 · 累计10元追加复验与配额阻断

用户批准累计10元；本轮追加最多5个新任务／请求（累计19请求／原20任务上限），原两合成账号／Study／两篇PMC不变，不充值、不续旧模块价或权限。独立目的守门已在本机启用，原93笔及旧B07/B08收据／历史保全。新综述真实6片输入、四段JSON与弱推荐／阶段／人群限定通过作者支持度核对；owner新任务在Provider前Token配额拒绝，没有调用或费用。现累计保守2.103291元、15/19实际请求、17/20任务、在途0；病例新产物和研究者AC07仍待，B08不销项。仅提议将B08具名2248 Tokens失败预留经原BillingService对账，未擅自执行／增额度／动其他历史。本页旧B08 max14／2次／5元及halt/resume全部保留，仅新acceptance许可按历史93笔前缀追加。完整契约：article-ai-ten-yuan-acceptance-2026-11-04.md。详见[最新测试与确认项](../testing/article-ai-ten-yuan-acceptance-2026-11-04.md)。

## 2026-11-04 · 用户明确继续后只恢复原剩余一次

新增只读`.resume.json`，绑定原halt／B08／首attempt前缀，单独有效核价与原14请求／20任务／5元，原文件和失败不删不改；Job与执行上下文含resumeHash，Provider前重验。不准owner重复其已用一次。admin现已真实用完，累计2.073564元、14/14请求、15/20任务、93笔known、local held0；旧WP09仍PRICE_EXPIRED，没有给它续价或开放新权限。完整输入路径实测成功但专业未通过，[结果与限制](../testing/article-ai-input-repair-2026-11-04.md)。

本文件只记录用户明确同意的2次新真实复验之本机守门，不是生产价格／权限／部署改造。

`LocalArticleFeeGuard`仅显式支持B07原许可及一层B08 follow-up：原91笔、原13任务、原scope、原B07批准文本hash和两笔attempts hash一起封存；新文件和attempts独立，新增最多2任务／2请求、每账号一次，累计14请求／20任务／5元。旧模块报价和12次准入值不续，只有旧本机WP09已登记外部费用识别允许累计14，不给予它新调用权。

共享账本仍逐笔known真实usage结算，峰值保守9/27计价，最坏两请求1.9584元；不存在未知即免费或失败次数清零。读取旧B07许可时只校验历史报价结构，不将其过期当新B08许可；新用途报价有独立到期时间、最多24h。当前结果为一笔已知失败，累计13请求／14任务／2.044566元。

失败后新增私有`b08-fee-approval.json.halt.json`，绑定本B08 approvalHash，原因仅ARTICLE_VALIDATION_FAILED，模式0600；其存在使canStart=false、code=ARTICLE_VALIDATION_HALTED。剩余1次仍如实显示，不删失败、不改收据、不续价；恢复需要新明确决定，程序不会清除marker。原key幂等回读不重新准入；任何新key均429且不建新对象。

`local-knowledge-ai`只在启动时发现私有B08许可才装配follow-up；不存在时保留B07。执行脚本以--execute显式选择，非空attempts禁止重跑，任一失败写停线标记并结束序列。当前实际失败先于该catch补强，已按同一类API单独补记halt，确认在途0后仅重启owned本机，使HTTP/browser也拒绝后续调用。无旧科研源码／Billing／权限／表改动。

边界／专业结论及新发现的旧最终摘要4000字符裁切见[本次失败复验](../testing/article-ai-b08-rerun-2026-11-04.md)。尚未修复Provider消息与完整包一致性；不能用门禁测试通过宣称两份新解读完成。
