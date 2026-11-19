# 生产AI与资产问题验证 · 2026-11-20

## 原始失败

原admin与owner在真实hub.pengxc.com均复现岐研AI无会话权限、A01空态。证据`.tmp/production-ai-assets-20261120/reproduction.json`及4截图。AI agents=[]、status.enabled=false，模型连接条件不满足且付费/knowledge-chat消费者关闭；无Agent缺失或Access缺失原因。历史接口503。A01 overview200真实空态，无脚本异常；代码business家族/绑定项目过滤已独立复核，但生产旧registry数量未直接统计，不称数据不存在或丢失。

## 免费误报修补

从生产main 0e0f969干净构造，仅availability helper、准确HubAgentPanel补丁与相关测试，不混入本机未发布采集链。6项状态测试及3项历史回归共9项通过；覆盖实际disabled原因、真正Access拒绝、旧agents不解锁、未知disabled保守拒绝及旧本机status兼容。原工作区依赖链接已失效，候选按main现有pnpm11.19.0冻结锁独立安装；Vite构建4.90秒通过，不改工作区依赖。

实际Chrome以候选HTTP dist替换静态资源，保留生产域名，API真实请求生产：原两账号各一次disabled显示准确提示，输入/新建禁用、history和knowledge-state请求均0；另以受控Access拒绝响应验证原权限提示与禁用仍保留。共3检查、3截图/2录屏，无页面异常和非预期请求失败，无新科研会话/任务、模型调用或费用。受控拒绝不冒称生产权限已改变。证据`.tmp/production-ai-assets-20261120/preview/`。

独立只读评审未见新增P1/P2；确认未ready不提前读历史，旧资产仍需只读兼容而非取消过滤，既有enqueue围栏不能代签仅新任务认领。免费修补main/生产回执待后续追加。当前AI实际启用与旧资产显示尚未恢复，需按专项准确范围确认实施，不以本次UI测试签署两项业务已恢复。

## 第一项资产修正准备

真实生产原catalog按scope返回：admin原Project10/StudyB4，owner各2；default overview遗漏这些scope。readAssetOverviewScopes将binding与registry范围去重合并，继续app角色逐范围原授权/来源校验，新增未绑定范围不开放创建。11相关测试及独立PG只读SQL通过，0写/0模型/0Worker；独立总评无P1/P2。仅恢复已支持的business资产统计，27份legacy尚未恢复。发布后与上述原生可见集合逐ID比较，不能把42原始登记当可见数。

免费AI误报修补95d9a73/44566718840已实际生产成功，原两账号真实静态/API均复验准确提示、输入/新建禁用、历史请求0，未调模型；不能据此说AI已启用。
# 持续启用增补证据（2026-11-20）

- 资产范围修复bf2c8e2生产浏览器通过：admin14份、owner4份，统计与列表ID吻合，创建范围不扩大；证据business-assets-restored.json及两角色截图。
- 独立依赖环境53项运行时测试通过；发布脚本14组测试文件通过。覆盖持久账本、2次/1元、unknown保留、同key重放、固定归属、回滚支持、诊断零消费者和原生失败不发布。
- 免费原生路径验证到达禁网Provider捕获1次，0网络请求/0Worker/0数据库写。该回退产物丢弃，不当真实AI验收。
- 免费生产预检44579796787通过：两账号各4474字节，保守预占172692微元/次；原623任务hash不变，旧服务身份不变。仅私有admission/ledger及原.env.prod封存路径写入，模型/Worker仍OFF。
- 前三轮免费预检在建campaign前停止，保留失败记录：原长查询没有命中；精确ChiCTR2300073486也没有当前获准命中。实际HTTP只读核对ChiCTR2300077209对当前账号返回1份来源，因此两角色采用该当前获准来源测试，不放宽用途。实际付费调用/持续ON及用户业务签收仍待后续证据。


## 生产持续ON及最新真实结果（2026-11-20）

- 同版发布68485cd／44591439969成功，无数据库迁移。独立总评无新增P1/P2；持续ON及原ledger挂载在普通发布中实际保留。
- 前后只读44592505628、44592783480：researchhub模型true、唯一knowledge-chat，原623条任务MD5均735bdccbbc401c67285f0dd9714a2bed；原175 queued未被认领；旧资产六类计数/hash与旧服务/官网身份均不变。
- 真实Chrome原admin/owner：A01分别31／14份，业务14／4、严格旧原创17／10；A02固定版正文200，合成标识可见；无页面异常、无只读详情自动files/reuse-options/recommendations请求、无alert。真实管理GET及完整actor/authVersion/Study/Origin/请求标记的POST均403、ASSET_CATALOG_LEGACY_READ_ONLY。截图和录屏：`.tmp/production-ai-assets-20261120/assets-final/`。
- 唯一付费管理员请求原session cmwnvm0a70004t707r5hv4rk7／原requestKey重放，首次有效入队201、新job cmwnwt3ao0006r107l7h5yqqu被认领。dispatch已知：1023+667=1690 tokens，feeUpperMicros27216；native任务failed、QA_MODEL_NOT_DELIVERABLE，无assistant。首次质量拒绝具体分项未持久化，不猜测为某一种原因，不能称专业问答通过。
- 原失败脚本/初始化/缺Study头/前置503及本次失败证据均保留，未覆盖。已消耗管理员1任务/1实际请求，owner未创建；不会自动重试、清账或续额；配置保持ON。
- 免费最小诊断仅先调用原assertAnswer，再将统一拒绝转为7个固定枚举，无正文/被拒数值。红→绿记录：answer-reasons-red.log、answer-reasons-green.log；37相关回归通过。独立合成容器原sealed NativeCore的valid/empty/unsupported-numeric/raw-data-request四例通过，4次假Provider、0外部模型、0数据库写；native-answer-reasons.log。此测试不替代生产真实成功回答。
- 四层验收：代码与目标启用已举证，真实调用已发生；最终业务回答未通过。用户业务签收仍待反馈。新增第3任务/请求已提出确认，未获批准不执行。

## 第二次真实结果与引用提示最小修补

1546ac1／44593900870发布成功；只读44594585254确认持续ON、原1次账本未变。owner新会话cmwnxbhox0002n5076tuuzpdu／新任务cmwnxbjhc0007n507qvln60gv原生提交201、真实认领及模型执行，终态QA_CITATION_INVALID，无assistant。只读44595366888确认2会话/2任务/2known请求：第二次1023输入＋671输出＝1694 tokens，峰价27324微元；累计54540微元（0.05454元）。原623/hash、旧资产摘要、旧服务与官网仍不变，模型/唯一knowledge-chat仍ON。

定位到实际送出的Reporter system并未携带ctx.kbGrounding要求的[n]契约，原绑定只替换问题。仅Hub最终提示追加原引用规则与缺失数值不补要求，保持原system、原问题/证据、assertAnswer及数值/来源校验；无模型补造引用、无取消拦截。红→绿citation-prompt-red/green.log，38项相关回归通过；sealed NativeCore原路径实际最终提示捕获加四反例通过（native-citation-prompt.log），0额外网络模型/0DB写。修补只能证明提示契约已送达，尚无修后付费真实回答，不代签业务通过。

资产另经两角色实际鼠标/下拉切历史版：admin v3→v2，owner v4→v3及返回正文均成功200、无alert/脚本异常；assets-navigation-verified/保留截图与录屏。首轮精确label测试定位器超时，未产生业务写入，原失败assets-navigation/保留。管理员失败问题、额度禁用及“不自动重试”页面回读通过（readback/），未恢复权限误报。

原两次任务/请求已全部消耗。先前3次提议尚未获答，不执行任何扩额；若两账号均需修后真实复验，准确需求是累计4任务/4请求、仍1元，需用户新确认，保留全部原任务和账本。最终专业验收与用户签收仍未通过。
