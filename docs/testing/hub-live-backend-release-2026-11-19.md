# 独立Hub线上接通验证

> 最新现场结论：独立researchhub→API→线上前端已实际接通；2角色×5页读取与2次登录共12检查通过，独立总评通过。44509764134再次verify成功且不重启。资产仅空态、知识资料仅目录读取；正文/附件/解析/方法与AI/邮件不在本轮完成范围。

## 范围

只发布ResearchHub独立API及前端，目标RDS researchhub。沿用既有VPC连接、OSS与云助手，不改aisci或旧服务/官网，不执行模型、邮件或历史任务。

## 本机已验证

- hub-runtime-artifacts.test.py：5项，私有源码路径/类型/摘要与镜像产物契约。
- hub-runtime-bootstrap.test.py：3项，下载SHA与幂等复用、错误下载不落正式文件、配置按数据读取且重复键拒绝。
- hub-runtime-server.test.py：11项，DB绑定/原参数保留、JWT与存储配置、历史任务防变、仅本轮API清理、前端秘密隔离、项目身份及SystemExit中断清理。
- hub-frontend-rollback.test.py：4项，原静态镜像回退保留安全Compose、已安全模板可恢复、双legacy模板拒绝启动。
- Python3.6语法及Shell语法检查通过。原DB助手原生PostgreSQL13客户端/独立PG16测试证据见demo-backend-connect测试文档。

## 真实目标环境

用户回传ownerConnected/appConnected/configSaved均true，唯一配置/srv/researchhub/ops/.env.prod。amd64构建44502950789已成功且私有上传。实际API启用、前端接通与两角色真实浏览器验收尚待执行，不以此处单元测试替代。

镜像身份补测：真实只读44508332094证明loaded ID等于受审归档Config SHA；11项测试加入受审归档推导与错SHA/错tag/错Config路径hash/逃逸/软硬链接/重复成员拒绝。前端4项含归档、Compose和加载ID漂移在up前拒绝。失败44507634919、44507915917保留，不覆写为成功。

## 现场接通结果

API运行44508811755成功，full启动已实际核新数据库身份/marker/结构及现有存储桶只读探活；认证未登录401。前端运行44509082815成功，仅Hub静态服务替换，前端环境无DB/JWT/S3/SMTP秘密，同源/api/auth/me=401、/health=200；旧ops/official-site容器identity/image/status与新researchhub六类历史任务摘要不变。

Chrome真实目标https://hub.pengxc.com：owner/admin两账号均login201→P01、me200，P01/H01/E01/K01/A01十组页面各有真实业务接口200，0 pageerror、0非认证错误；未登录阶段me401为预期。保留12截图及2录屏。初次受本机系统代理影响ERR_CONNECTION_CLOSED，无登录提交；测试Chrome单进程--no-proxy-server后通过，未改系统代理或服务器网络。

A01真实正式目录目前为0：runtime只读family=business（rhab-）目录，不纳入旧具名测试资产。历史数据没有删除或自动转换，不以演示回退掩盖。论文领域统计部分仍待口径核验。AI/mail/workers仍关闭；解析、方法执行和对象完整恢复/原件读取尚未验收，不称这些功能已生产可用。会话签发有真实认证写入，无科研业务变更/模型调用/邮件。本轮能力仅为独立数据库、后端、线上前端的真实登录与目录读取闭环。

私有证据目录`.tmp/backend-deploy-20261119/`：api-receipt.json、front-receipt.json、browser/result.json、12张PNG及video下2份webm。配置/口令/会话材料不得进入公开Git或Notion；文档只同步非秘密结果。源码/包私有，公开main仅受审Hub自有代码与部署控制；工作区其他线程页面修改未混入。
