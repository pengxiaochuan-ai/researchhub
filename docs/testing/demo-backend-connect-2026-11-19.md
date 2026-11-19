# Hub统一配置与独立后端接线准备验证

2026-11-19。用户明确：数据库密码统一合并进Hub /srv/researchhub/ops/.env.prod，保留原参数；旧aisci配置/服务及官网不动；来源manifest人为截断，不再全量复验。当前是最终脚本及接线准备交付，尚未获得服务器新账号实连成功回执，不冒称后端已上线。

## 数据库助手

8项单元通过：DSN特殊字符编码、真实库/role/权限/marker拒绝、原参数/注释保留及0600备份、fsync故障不留半配置、已有文件写失败保持原文、重复managed键拒绝、跨进程侧锁竞争、新值换行注入拒绝。同目录0600临时写与fsync后原子安装，完整读改写由.env.prod.lock覆盖；其他写者的原文漂移检查保留。SIGTERM触发正常临时PGPASS清理，SIGKILL边界不冒称可保证。

新具名rh-db-connect-20261119-v2本机PG16、真实官方13.23客户端：owner/app两新角色只读认证通过；错误app口令未写配置；冒号/@/反斜线口令正确编码和认证；文件0600与check复连通过。加入public enum后复现默认search_path与runtime指纹不一致，先红后将查询统一pg_catalog转绿；configure实际保存的指纹与runtime口径相同。正确已存DSN可不prompt复用并再次实连，未读取旧配置。私有证据.tmp/backend-connect-20261119/test-receipt.json，原失败保留，不涉及临床库。

## HTTP与部署元数据

7项代理加1项实际静态进程HTTP通过，并在独立Node22镜像只读/network-none容器重跑通过；原Origin守门另1项通过。验证固定私网目标、请求URL不能换主机、原Origin/Cookie/Set-Cookie、Connection提名与Forwarded族清理、320KB二进制multipart原字节/Range206、真实401无演示回退、502/不重试、浏览器关闭释放未完成流和停滞超时。新Compose前端已移除全量env_file，只获显式HTTP设置；Docker加入代理模块和VITE构建参数声明，未改页面布局。

元数据profile新增2项隐私测试及原8项通过。GitHub只读44491795860和44493323628实跑成功：ECS x86_64/Python3.6.8，Hub旧静态镜像、8083和researchhub_default；约16GB内存、可用约13.6GB，磁盘余约25.9GB，现有S3键名/传输器存在；无DB查询/远端写入。线上静态/health200但API404。S3键存在不代表桶探活或原件恢复已完成。

独立评审依次发现并关闭配置失败残留与并发覆盖P2，最后指纹口径及已存口令复用、前端秘密隔离复核通过。正式接线仍须实证researchhub-api网络alias和真实VITE_AUTH_TENANT_SLUG构建值，不能由本机HTTP替代。amd64构建、S3/原件、目标API及真实浏览器仍待执行。

## 最终交付

私有包researchhub-db-connect-final-20261119.zip，13,394字节，SHA256=06f793558e598dea819da7ec163f8b0229ebe1c418e568a1ba2e470e6edd0ba3。包内完整SHA与ZIP CRC通过，脚本字节等于受审版本、Python3.6语法通过。不含任何凭据或业务数据；历史包保留，本次用户仅使用final。部署步骤见[实施说明](../technical/demo-backend-connect-2026-11-19.md)。本机测试不代签目标连接/发布/客户页面验收。

## 现场接通结果

API运行44508811755成功，full启动已实际核新数据库身份/marker/结构及现有存储桶只读探活；认证未登录401。前端运行44509082815成功，仅Hub静态服务替换，前端环境无DB/JWT/S3/SMTP秘密，同源/api/auth/me=401、/health=200；旧ops/official-site容器identity/image/status与新researchhub六类历史任务摘要不变。

Chrome真实目标https://hub.pengxc.com：owner/admin两账号均login201→P01、me200，P01/H01/E01/K01/A01十组页面各有真实业务接口200，0 pageerror、0非认证错误；未登录阶段me401为预期。保留12截图及2录屏。初次受本机系统代理影响ERR_CONNECTION_CLOSED，无登录提交；测试Chrome单进程--no-proxy-server后通过，未改系统代理或服务器网络。

A01真实正式目录目前为0：runtime只读family=business（rhab-）目录，不纳入旧具名测试资产。历史数据没有删除或自动转换，不以演示回退掩盖。论文领域统计部分仍待口径核验。AI/mail/workers仍关闭；解析、方法执行和对象完整恢复/原件读取尚未验收，不称这些功能已生产可用。会话签发有真实认证写入，无科研业务变更/模型调用/邮件。本轮能力仅为独立数据库、后端、线上前端的真实登录与目录读取闭环。

私有证据目录`.tmp/backend-deploy-20261119/`：api-receipt.json、front-receipt.json、browser/result.json、12张PNG及video下2份webm。配置/口令/会话材料不得进入公开Git或Notion；文档只同步非秘密结果。源码/包私有，公开main仅受审Hub自有代码与部署控制；工作区其他线程页面修改未混入。
