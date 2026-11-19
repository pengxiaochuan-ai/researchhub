# 生产AI与资产空态排查 · 2026-11-20

## 用户原反馈与真实复现

admin登录岐研AI显示“当前账号没有此会话的使用权限”，科研资产无数据。生产源码为97c8973，main文档头0e0f969。本轮在真实域名使用原admin/owner原生登录复现，两账号相同，未发送问题、运行模型或修改科研数据。

- `/api/agents` 200返回空数组；`/api/knowledge/ai-status` 200返回enabled=false、HUB_CHAT_NOT_CONFIGURED，原因MODEL_NOT_CONFIGURED、MODEL_DISABLED、CONSUMER_DISABLED。没有返回ACCESS_NOT_GRANTED或AGENT_NOT_CONFIGURED：不是本次证据中的管理员缺少Agent授权。
- 历史会话读取503，因为生产chat.history同样要求运行就绪。HubAgentPanel忽略status.enabled及原因，只把agents空数组当作restricted，造成权限误报；初始化还在状态核验结束前读历史，产生额外503。
- 资产总览200真实空态，无脚本异常。生产assets.mjs仅加载business家族，SQL只读rhab-%，且只遍历study_binding中的执行项目。旧具名合成资产不进入该正式目录；不能据此说数据库没有资产或数据丢失。当前生产rhab/non-rhab数量及绑定覆盖尚未取得直接数据库统计，需只读核验。

本机19612的ssh监听经核实属于Colima转发，不是生产数据库/服务器连接，不能将它的结果当生产统计。没有尝试读取旧aisci库。

## 当前免费最小修补

区分unavailable与restricted：全局模型/服务未就绪显示“科研AI暂未启用”，真正ACCESS_NOT_GRANTED仍保持受限；旧本机status契约兼容。未ready前不读取历史，不建立新会话、不发送或解锁输入。原版面/导航/权限不变。当前工作区未发布的采集改动保留，仅从main构造本次准确补丁。

## 实际业务恢复所需的独立确认范围

生产AI不能靠取消权限检查修复。推荐仅原两个体验账号、独立researchhub合成租户、最多2个具名新会话/任务及2次真实请求，新增费用累计最多1元、不充值、不自动重试；核对公开价格、现有模型路由/密钥可用性后启用，仅knowledge-chat。沿用已有Agent与Access，不新增角色/成员/Token或云资源，不启用其他Worker。必须先取得生产历史队列计数并证明仅认领本轮新任务；达不到此条件先停，不让历史任务消耗费用。旧服务和官网不切换、不改配置；若必须读取旧服务配置复用密钥，只读并仅在受控进程内传递，不输出秘密。

资产推荐先只读统计原registry家族、原项目绑定、审核/来源有效性，再为原admin/owner兼容展示当前租户已获准旧合成样例，保持原ID、版本、来源、用途、审核和合成标记；正式rhab目录保留。不能简单取消前缀，不能照搬本机硬编码actor/预算适配，不能改ID、补造审核事件或自动迁移正式资产。首批只读，不新增共享、AI用途或导出授权；不开放给新账号。若需要新表、GRANT、改写历史数据或额外权限，另行停下确认。

当前只有误报修补及方案准备，不宣称AI已启用或资产展示已恢复。生产启用与付费调用须确认上述范围；验证时分别记录代码、目标启用、实际请求和业务产物，不以测试全绿代签。

## 用户批准与保持启用（2026-11-20）

用户已明确批准上述最小恢复范围，并追加“保持模型/Worker开启”。因此科研问答与knowledge-chat在安全准入完成后持续开启，预算/次数门禁保持；额度耗尽不自动关闭配置，也不再调模型、不自动续额，其他Worker仍关闭。2次上限计算实际Provider请求，含内部多轮；1元是新增累计费用。

先用既有Cloud Assistant在Hub自身容器内执行固定只读统计（事务READ ONLY、researchhub/租户/角色/marker身份重验），仅输出资产ID/状态/绑定、队列计数与摘要、两账号当前授权及模型路由/密钥存在布尔，不输出正文/凭据，不启动应用或Worker。旧配置仅只读匹配DeepSeek字段是否存在。诊断与发布共用锁；不对aisci查询或写入，不改旧服务配置。

独立评审确认原生knowledge-chat的resumePending会恢复同租户历史任务；现有enqueue围栏不足。后续必须在生命周期前绑定精确获准job ID/账号/会话的认领范围，并对真实Provider dispatch持久预占次数/费用，任何绕过上下文的模型或Opencode调用默认拒绝。不能只按时间/账号筛选，也不能以两个前台请求代替实际调用上限。

## 已取得生产元数据与第一项资产修正

真实只读inspection 44569366507：researchhub内42登记（15 business、27 legacy）；历史knowledge-chat 623条，其中175 queued，当前模型/Worker关闭；两账号Access启用，配置v2路由DeepSeek V4 Pro存在，Hub密钥缺失，旧服务密钥存在。数据未丢失。

实际原生scoped catalog：admin在原Project可读10、Study B可读4，owner各可读2；默认overview却只枚举Study binding，遗漏这些已可读业务资产。因此先把登记真实Group/Project范围并入只读overview，仍逐范围app角色授权；新增读取范围不进入creationScopes，不创建绑定/Study或权限。旧legacy家族兼容仍单独保留原分类/来源校验，不用取消过滤替代。
