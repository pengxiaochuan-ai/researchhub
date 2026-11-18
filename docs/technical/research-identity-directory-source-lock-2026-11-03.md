# T01目录来源锁：实施中发现的最小技术授权

日期：2026-11-03。状态：用户已确认的最小来源锁已在专用合成库受控启用；实际app三类来源锁／范围拒绝／原42501权限／双事务阻断及提交后释放均通过。只给有界函数EXECUTE，未授旧来源表UPDATE／DELETE；不增加业务权限。[本轮验证](../testing/t01-directory-implementation-2026-11-03.md)记录实际执行，T01已接通，R01未实施，不再重复原授权门禁。

## 实测事实

现有`aisci_app`对`rh_source.external_document_version`、`pmc_candidate_version`和`source_registry`有SELECT，但没有表级或列级UPDATE授权。用实际app连接、固定合成租户执行`SELECT id … LIMIT 1 FOR SHARE`，三项均被PG以42501拒绝。[原始无密钥记录](../testing/evidence/research-identity-directory-implementation-2026-11-03/directory-source-lock/result.json)。

原`rh_source.hold_review_grants_for_commit()`只锁来源审核授权，不锁具体文档／PMC版本或来源目录行。旧审核代码的受控高权限事务不代表新目录API可在全事务中绕过应用角色／RLS。

既有规格要求来源当前版本／hash／审核状态与目录提交一致，不能以一次普通SELECT替代锁，也不能为绕过42501直接给旧表UPDATE。上文42501为授权前实测；现已按批准方案添加锁函数，T01已启用，旧表授权仍保持，R01未实施。

## 已批准并实施的最小方案

在本轮新增`rh_directory`命名空间增加**一个只提供锁定的受控函数**，采用严格限定的SECURITY DEFINER与固定search_path。REVOKE PUBLIC，仅给既有`aisci_app`该函数EXECUTE；不给应用角色旧来源表UPDATE／DELETE，不增加业务角色或授权。

- 租户／Hub来自服务端可信事务上下文，拒空值、跨Hub和不存在父链；来源kind仅原三类，ID／固定版本／hash全部参数化且精确匹配。
- 先按确定顺序持有原来源审核所用锁，再锁必要的来源父对象／当前固定版本并重验。需要阻止新增版本时锁父对象，不能误认为对子版本FOR SHARE就能阻止追加新版本。函数不可获取任意表名、SQL或URL。
- 函数只SELECT与行／事务锁，不INSERT／UPDATE／DELETE、不返回正文／私有材料；返回必要匹配摘要或拒绝。只在新目录提交事务持有，提交／失败即释放，设置短lock_timeout／statement_timeout，超时明确409／503，不重试批准。
- 当前有效账号／同租户管理员及共同授权锁仍由新目录服务先核对；函数不授予source.review、目录批准、Study或L2／L3资格。
- 作为单独受控附加迁移保存DDL／catalog指纹，不修改已记录的三表V1迁移文本，不新增业务表、不更改旧服务或后台扫描。

这是一项数据库函数执行能力的新增技术授权，初次实施曾按“新增权限先确认”暂停，用户确认后才执行；不是默认同意或重新审批原设计。

## 批准后验证

先RED：当前app行锁42501／未授EXECUTE拒绝；再实现并测试固定scope／父链／hash、PUBLIC不可调用、app不可直接修改来源、超时原子失败及真实双事务中来源撤回／换版不能穿过目录提交。保留原三表／旧表指纹及已审核内容不变。仅本机专用合成库，具名新夹具与原两个账号，仍0模型／外发邮件／云／发布；完成后自动回原Task4–8，不再索要原计划批准。

不推荐给应用角色旧来源表UPDATE或把新目录所有操作搬到高权限连接；前者增加直接改来源能力，后者失去本轮应用角色RLS的可验证边界。
