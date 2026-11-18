# 正式答卷不可变修订历史读取契约

状态：实现中；内部事务核心，不代表 HTTP、页面或业务验收。调用方传已有 scope/actor/transaction。先复用当前正式答卷读取，重验授权、被试/入组/访视及当前同意；随后仅按 scope、response、assignment 与 revisionNo 精确读取实际历史，detail 另核 contentHash。每条重建 `formal-response-v1` 原始封套并复算 hash，不匹配或版本未知明确冲突，不修复数据。返回固定 FormVersion ID、历史答案/可空分数、来源、实际 actor 类型/ID、原因、变更、来源提交时间、创建时间与固定 ref；不含 H5 token。锁后核对父链与当前绑定、已批准政策。旧 submitted 无 revision 返回 `legacyUnversioned:true`、空列表，detail 返回明确 `FORM_LEGACY_UNVERSIONED`，不回填；普通未提交无修订列表为空。list 按 revisionNo 严格倒序 `limit` 1–100，beforeRevisionNo 独占，lookahead 定位下一游标。Hub 对 cursor 绑定 actor/authVersion/Study/assignment。更正不覆盖旧值；0、false 与未评分 null 原样保留。错误、撤权、撤回、跨 assignment/ref、hash 损坏均拒绝，不从当前 projection 补历史。

验证：`app/server/.tmp/t08-history` 独立全量 TypeScript 编译通过，history 哈希单元与 DataQuery 两项回归通过；`researchhub/.tmp/t08-history-pg.tap` 为受保护合成 scope 的真实 PG 回滚测试，覆盖更正后读取原值、倒序分页、wrong hash/跨 assignment/租户、撤权/撤回、旧版无历史，以及真实未评分的 0/false/null。哈希损坏/未知版本由纯单元测试验证，未修改不可变数据库历史以制造损坏。无 HTTP、页面或目标运行时接线。

Hub 适配：在已授权 Study 同一事务调用 history 核心。响应携带 Study/assignment；列表 limit 和只读 detail 固定 ref，cursor 经 HMAC 绑定 tenant/actor/authVersion/Study/assignment 与顺序，拒绝篡改和跨上下文复用。进程签名密钥默认随机重启失效，多进程须由组装层传同一稳定密钥；仅返回 actor ID，不返回 H5 token。
