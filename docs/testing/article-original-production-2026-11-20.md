# 单篇文章原件补传与生产真实问答验证

## 结论

用户已批准仅补传PMC13691533同字节原件，并继续原定1次生产调用。该技术闭环已完成；专业复核发现3项P2，未将其标为专业质量全部通过。未增加模型调用额度，未改页面布局、数据库结构、审核、用途或角色/成员权限。

## 实际执行与四层证据

1. 代码：main 5c3819c8／精确c5已由44747638591同版发布；本轮没有替换业务服务或改旧系统。既有126项runtime测试、6个PG全回滚案例及独立总评证据保留。
2. 配置：独立researchhub、standard、原admin与当前Study。模型及knowledge-chat/knowledge-import Worker保持开启；只读核实当前账号、真实父对象、现有AI用途和JATS元数据。
3. 原件：44751777047只新增1个现有OSS对象；长度150195，SHA-256为48556afca3235223e18adf8f82b03b46223d34b3af29be13a0b0e01a80944967。写前现有对象缺失；禁止覆盖头、Content-MD5、禁用上传自动重试、版本状态检查及写后读回SHA/长度均保留。最终固定PMC13691533.1／article:70，重建6片段。原件操作数据库写入0、模型调用0，容器身份未变。
4. 实际请求：从生产原页面发送，任务cmwp2d1dz0008oi077zie5a6q、本人会话cmwp2d0fx0003oi07w6oosq6g；DeepSeek-v4-pro真实HTTP1次、无Mock，4174输入＋315输出＝4489 Token。原生任务completed、attempts=1、预留settled；44752634435只读核对started1/completed1/unknown0。保守费用上界46071 microCNY，原生产累计158463 microCNY＜1000000，未充值/续额/手动对账。
5. 界面：原页面“核对本次证据→返回这篇原文”实际点击通过，E02 URL携带同版本、SHA及审核70；来源接口current，浏览器pageerror0，保留截图与录屏。回答区与原有布局未修改。

## 保护与临时传递

- 623旧任务hash仍735bdccbbc401c67285f0dd9714a2bed，175历史queued；原账本SHA仍8c4840344ddc553ac1436ae59f2da336eb2480bbec0633050e55588cf38aedd1。44752194102与44752634435均完成只读核验，既有资产/角色/Access守恒。
- 现有contents:read无法读取draft附件；未提高令牌权限，改用仅存固定压缩文件的一次性加密传递值，不是凭证。正文/密钥未公开提交。draft、该临时值及服务器4个分块已清理。没有新数据库、环境、容器、云资源或临床数据。
- 原生产页面NoSuchKey失败记录保留，发生在模型请求前，消耗0；本轮唯一生产模型请求已用完，不自动重试。
- 临时运维助手封存在codex/article-original-restore-20261120／f358cf20；不会将临时覆盖的运维workflow合并为默认只读入口或再触发补传。辅助器的错误输出随后补了脱敏保护并免费测试通过，不重跑生产操作。

## 专业复核：3项P2未关闭

1. 研究类型段把“共病建模＋电针干预”只关联fragment-2，该段仅含动物购置/饲养/伦理；同包fragment-1有相应支持，应完整关联1＋2。不是整包之外编造，但段落级引用不完整。
2. coverage将讨论标为已定位、fragment-4标limitations，但实际内容为胃排空及肠推进测量方法；不能宣称已定位讨论/局限章节。
3. “原文数值依据”展示整段摘要，其中主要是5-HT、IL-6等名称，缺少量化测量值；未编造数字，但标签与粒度容易误导。

主要观察、原文尚未阐明因果关系及明确标为AI推断的参考价值有依据，不能据此掩盖上述P2。历史回答不静默改写；后续先设计兼容既有固定包的最小修正并免费回归，真实模型复验另行确认，不扩大本轮调用次数。

## 复验入口

admin登录后打开https://hub.pengxc.com/pages/ai01/?articleId=pmc-PMC13691533，查看已生成回答，无需再次发送。点击“核对本次证据”及“返回这篇原文”，核对PMC13691533.1、article:70及固定原文。最终用户专业验收仍由用户确认；其他文章的原件完整性未在本轮全面核验。

私有证据：`.tmp/article-original-restore-20261120/`下restore-result.json、temporary-cleanup.json、post-inspect.json、final-billing-check.json；`.tmp/article-runtime-parity-20261120/article-production-after-original.json`及answer/source-after-original截图、录屏。GitHub公开日志不含原件正文、密钥或密码。
