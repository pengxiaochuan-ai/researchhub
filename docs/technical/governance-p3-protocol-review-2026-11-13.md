# P3内部方案审核：API与既有数据契约

2026-11-13。本机专用合成环境技术交接；用户签收、临床政策和生产发布独立未验。[逐项证据](../testing/governance-p3-2026-11-13.md)。

## 接口

| 接口 | 行为与来源 |
| --- | --- |
| `GET /api/research-studies/protocol-reviews?status=pending_review&limit=20&cursor=…` | 保留原待审队列，当前有权管理Study的固定方案版本；不从Hub可见性推出审批权 |
| `GET /api/research-studies/protocol-decisions?limit=20&cursor=…` | 新增当前可管理范围内的真实决定。默认20，最大100；单次至多扫描25个研究目录项，未扫完续游标，不伪装全量空集 |
| `GET /api/research-studies/:id/protocols/:protocolId/release-receipts/:requestKey?action=…&requestHash=…` | 本人原操作只读核对，允许`check/submit/return/approve/activate/policy`；`policy`对应原`protocol.policy.save`。当前管理权＋真实方案父链成立后，仅读取同租户当前账号的原key并匹配action/target。无记录`{found:false}`，有记录`{found:true,result}`。WF03新增可选64位小写hex requestHash：校验原hash及proofVersion1的actor/authVersion/Study/Protocol/action/key/hash；冲突409，缺严格证明409，不把旧回执升级。旧无hashGET保持兼容 |
| 原`GET .../release`及`POST .../check,submit,return,approve,activate` | 原服务、状态机和各自200保持；原S11／固定版S07卡片可在一次确认内依次批准、fresh release后启用，仍是两个独立原生动作和审计。政策／引用／检查／版本及同事务门禁不变；提交可先原生检查、fresh gate有效后提交 |

均沿原认证、无缓存、Nest错误映射及研究事务；写请求仍校验同源JSON。没有新表、DDL、GRANT、角色、外部服务或旧系统代码改动。

WF03的check/submit新增可选成对`policyVersionId/expectedPolicyHash`，旧body兼容；新流程绑定确认时的原政策。协议行锁后先核原saved receipt，已成功事实不被后来政策变更抹去；仅新写再验latest policy及状态。release增加`approvedPolicy:{id,contentHash}|null`、`canSubmitWithCheck`和`canApproveAndActivate`；批准仍按真实actor的独立审核门禁，Hub负责人身份不自动获得审批权。完整增量与实际边界见[T05技术记录](research-t05-t06-2026-11-12.md)及[WF03工程合同](../planning/study-workflow-simplification-2026-11-17/briefs/wf03-api-contract.md)。

## 现有表的复用

- `rh_research.project_intent/study_binding`：真实产品Study与执行项目父链、合法目录发现。
- `public.study_protocol_version/visit_plan/visit_requirement`：固定设计与访视／采集版本，排除`acceptanceFixture=true`。
- `public.study_execution_policy_version`及既有release check：原审批和启用政策，不将软件合成案例“不适用”当临床政策。
- `public.audit_log`：仅投影`study_protocol_transition`且`meta.to=draft`、`study_protocol_approve`、`study_protocol_activate`三类真实事件。Hub封套审计不重复计入决定；退回和批准属于同一Protocol时仍是不同事件。
- `rh_research.operation`：原本人提交回执；历史批准结果保持原`approved`快照，当前方案可已`executing`，两者分别显示／核对，不覆盖旧结果。

决定列表固定字段：`studyId/studyTitle`、`protocol{id,title,versionNumber,status}`、`decision{id,kind,createdAt,actorName,reason}`。决定时间来自审计`createdAt`，人名按同租户账号安全字段解析；未知为null，不从`updatedAt/approvedBy`猜决定。退回只取原reason，不返回原meta、凭证、邮箱或政策哈希。

分页按原研究目录顺序、研究内真实决定时间倒序及审计ID稳定断开并列；不是全租户最新排序或完整审计时间线。游标固定类型并绑定tenant/account/authVersion、研究、目录续读位置、最后真实事件时间和ID。每页重新核当前身份、租户、真实Study父链、活动项目、功能开通和原管理权限；只对当前不可见Study的404跳过，不吞掉权限或服务故障。

## 页面与失败恢复

G01沿原Shell，仅获批正文改为待审核／已处理两列表；无演示委员会、假AI审查或导出。固定S07链接带严格枚举`reviewTab=pending|processed`，与既有G02返回上下文互斥。S07返回按钮与面包屑保留该页签，刷新／安全登录回跳保持同Study和Protocol；不接受任意return URL。

G01在焦点／可见变化时重新读取；继续读取从第一页重建已打开范围并替换，拒绝重复项／游标，20秒整段读取期限。失权、失败或身份不可核对时撤下旧集合，epoch与渲染身份双重阻止迟到数据。后台读取不续期。

S07未知操作的“核对”只GET；`found:false`保留原键和输入，不自动POST。明确点击“重新提交原操作”才沿原key／body重试；原服务事务锁和幂等回执防重复决定。WF03复合意图核回检查／批准只保存已知阶段并等待明确继续，不自动串写；已成功的步骤不重放。核回最终提交／启用后清意图并重读当前状态，不能把历史批准直接当当前启用。先前unknown重试4xx仍保留原pending；身份／URL变化隔离内存及旧确认，原最小恢复标记保留，失权内容不回显。仅在途写、未知或未保存输入保护离页，纯GET及已知阶段本身不误拦。

## 本机运行与验收约束

仅用户批准的一新课题／Study、两个Protocol版本及派生合成表单／结局／政策；不调用旧fixture初始化器，不建账号或授角色。原owner当前真实新Study管理权和admin无需加入Study的默认权限分别验证；权限撤销PG用例仅改新Study关系并整事务回滚。

独立评审1 Important已集中修补：当前集合变化时重建而非合并旧行。五宽与原生200%、14/22、真实按钮可达及异常恢复有证；G01旧1280px根宽只作本页窄屏消费者修正。生产、真正外部伦理、多中心和专业用户签收均未执行，未扩大共享底座。

最终固定版本补充：S07“查看研究方案”携带当前Protocol ID进入S02，不默认选择其他草稿。真实浏览器先RED（缺protocolId）再GREEN（同一v1），无业务写；最后590前端及8.02秒隔离构建通过，既有大包告警保留。
