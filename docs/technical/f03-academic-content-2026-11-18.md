# F03资讯与活动发布：接口、存储与运行

2026-11-18。对应已确认[F03 V0.2](../product/f03-academic-content-publishing-spec-2026-11-17.md)。当前本机合成三页已启用，同身份403保输入、换身份隐藏及详情读取失权后的按钮恢复均已补验。生产未部署，真实内容、学术准确性与权利由内容责任人提供。

## 页面与权限

- G02 `/pages/g02/?view=academic-content`：当前有效、role及isTenantAdmin均有效且F01获准的管理员维护。原治理总览只增加“资讯与活动”常用管理，不改变其他队列或计数。
- H01 `/pages/h01/?hubKey=lingshu-xinyu&section=updates`：新增摘要、分类/活动状态/标题摘要搜索目录、详情。原领域指标、图谱和获准论文来源块保留；此动态正文不作为文献自动入库或AI语料。
- P002第四屏：原共同体区域后最多3条已发布公开活动，服务端排序；无内容/读取失败分别显示，不补造活动。固定公开接口，即使浏览器已有成员Cookie也不交付成员资料。
- `contentId/type/phase/q`及管理端`status/page`仅接精确路由，登录返回不携带令牌或任意参数；H01一般页面继续公开，不扩大为全页受保护。

## 独立存储

`rh_academic.content`保存当前草稿、revision和当前发布指针；`version`是不可改固定发布版；`event`是不可改操作、原请求hash/键、回执和撤下理由。三个表FORCE RLS；原始JSON含内部权利及资料字段，只允许当前获准管理员直接读取。公开/成员读取走服务事务内固定租户、固定Hub、当前身份和白名单投影，不给应用角色开放原始表。

保存草稿不改前台发布指针；发布重新验证正文、来源、内容使用依据、活动条件字段和逐项资料依据，固定版本+指针+事件+审计同事务。撤下清交付指针、保留管理历史；资料key绑定固定版本，新版或撤下后旧key不可重解释。

复用授权锁和F01当前准入，管理员要求`role=tenant_admin`和`isTenantAdmin=true`，每次请求核active账号/租户/Hub及authVersion；不按邮箱或客户端角色兜底。所有读写禁缓存，资源跳转也重新核定。

## API

| 路径（均在`/api`下） | 行为 |
| --- | --- |
| `public/hubs/:hubKey/academic-content[/:id]` | 固定公开当前版；列表只回卡片元数据，不回正文/资源/权利 |
| `hubs/:hubKey/academic-content[/:id]` | 当前获准成员读取合法公开及成员当前版 |
| 上述详情`/:id/resources/:key` | 当前范围/发布版/自身依据通过后302原站；不抓取原站，不代理全文 |
| `hubs/:hubKey/content-management` GET/POST | 管理列表/创建仅标题草稿，默认members |
| 管理`/:id` GET/PATCH | 当前草稿详情/带baseRevision保存 |
| 管理`/:id/publications` POST | 一次发布核对后提交固定版本 |
| 管理`/:id/withdrawals` POST | 带原因撤下 |
| 管理`/:id/history` GET | 管理历史，不公开旧版本 |
| 管理`[/:id]/operations/:requestKey` GET | 原action/baseRevision/hash核定committed/unsubmitted/superseded；未知创建无id路径 |

列表支持type/phase/q和稳定cursor（绑定范围、身份、authVersion和筛选），上限20；管理列表status/type/q/page。门户仅event+portal排序+limit≤3。公开路径只在独立公开Controller标公共，成员/管理路径继续守门；错误不回数据库栈。

正文首期纯文本，React文本渲染；摘要首段确定性提取160字，可修改。来源链接和资料只支持有对应范围依据的HTTPS原站URL；不接受凭证、明显私网或危险协议。允许普通PDF页码片段；无后台Fetch。已有资产/来源引用需另接精确用途验证，首期未开放。明确起止时刻和北京时间；全天日期模式未开放。

写请求256KiB：本机入口仅对F03管理POST/PATCH安装定向JSON parser；独立research-runtime沿用已有全局256KiB、同源及JSON格式策略。两入口均显式注册三个Controller，不自动迁移或扫描旧任务。

## 恢复与维护

请求键由系统管理。未知写结果保存按actor绑定的原操作，先GET核原回执；确定未提交才允许显式原内容重试，不自动重放发布。superseded保原输入，取当前版本对照；冲突核对后仍需用户再次决定。浏览器刷新/关闭保留beforeunload；普通业务确认使用共享ConfirmDialog。

当前本机由既有`local-knowledge.mjs`启动，2026-11-18受控重载PID60760；该PID是验收时点记录，后续使用前以status核实。独立research-runtime仅临时19732验证后关闭，无新增常驻API或Worker。

迁移脚本`f03-academic-content-migration.mjs`要求显式prepare→predict整事务回滚→apply→check，仅限已防护合成目标；源hash与schema定义hash校验。schema删除会删除已发布内容和审计，不提供自动DROP回退。需要停交付时先由管理员撤下或停挂F03入口，保留表/历史；迁移、运行配置和真实内容发布分别验收。

[完整技术/业务证据](../testing/f03-academic-content-2026-11-18.md)；所有用户操作与反馈统一维护[手册F03专节](../product/用户验证与操作手册.md#f03--学术资讯通知与活动本机待用户验证)。

## 2026-11-18 · 本机PATCH来源兼容

F03独立http-policy对固定本机Hub草稿PATCH复用既有完整浏览器证明，补端口剥离Origin场景；全局session及生产同源不变。原请求不改写为POST，不新增来源白名单或权限。新PID68621为本轮验收时点；[故障及复验](../testing/f03-origin-patch-2026-11-18.md)，不是生产启用。
