# WP09首切片实测：K06–K08技术交接（专业AC10待验）

## 2026-10-28 新合成AI验收与真实Chrome

用户批准累计20具名任务/12真实请求/5元；本机新凭据保留历史9请求/88笔费用，其他模块旧报价过期校验保持。费用/预算专项23项、项目纯测试408项、旧内核1054项通过；聚合脚本在pnpm自检阶段失败，现有Vite直接构建成功，保全检查通过（691旧源码、115表41128前序行、旧进程/旧scope、原79笔前缀）。

新管理员U04资产—目标组合产生1条此前未运行的AI任务，真实检索查询“当前合成资料的研究人群、针灸干预、对照、结局与研究限制”，`kb_search`实际走原KnowledgeService/pgvector；真实Provider用量known，来源逐项可读，人工意见/固定历史可用。Chrome以新记录完成5项：管理员新AI结果、引用展开、16px/28px、1440/390布局和另一账号拒读；PNG/WebM与API网络状态留存。新增1请求、¥0.031734；累计11任务/10请求/89笔known/¥1.931292，0held/unknown/在途，付费开关false。证据：[AI任务](/Users/mac/aisciencesys/docs/test/evidence/2026-10-28-researchhub-wp09-acceptance/ai-live-acceptance-admin-fixture-54a0d167/result.json)、[浏览器](/Users/mac/aisciencesys/docs/test/evidence/2026-10-28-researchhub-wp09-acceptance/browser-dd11dea1/result.json)、[桌面AI截图](/Users/mac/aisciencesys/docs/test/evidence/2026-10-28-researchhub-wp09-acceptance/browser-dd11dea1/admin-ai-1440.png)、[移动AI截图](/Users/mac/aisciencesys/docs/test/evidence/2026-10-28-researchhub-wp09-acceptance/browser-dd11dea1/admin-ai-390.png)。

人工观察：移动视图中`coverage`等固定来源声明直接呈现长JSON，虽无横向溢出，科研人员阅读和判断仍费力。此项留作AC10专业评阅与后续UI呈现优化，不把浏览器脚本通过等同于交互体验已获用户认可；本轮未扩大页面改动。

AC10仍请用户用此未预运行合成任务审看双端版本、声明差异、AI缺口解释与来源，并亲自选择“通过／有条件通过／不通过”及阻碍项。技术脚本不替代专业签认。以下2026-10-26材料为历史检查点。

## K08当前技术交接（2026-10-26，AC10待用户）

K06界面、K07联调及K08唯一独立代码总评审的技术工作已完成；专业AC10尚未签署，不称完整WP09/AI-15、一期或生产验收。独立原结论为With fixes（0 Critical、4 Important、无新增Minor），原文保留；主实施逐项RED→GREEN修补，不冒称独立二次复签。修补涉及明确倍数/分数表述的输入/资料/输出边界、空访视映射未声明、依据选择跨轮询保留及同基准自检提示；回归另修复在途轮询误取消历史目标读取。只改本用途，不改旧内核/权限/共享底座。

最新证据：browser-5ce391ba两账号26项（含真实在途轮询）；browser-auth-0d9780ee两账号12项；browser-visual-c05c9683两账号原生Chrome200%/键盘/字体；browser-review-97b2ea20两账号11项（本人新记录两次显式意见保存，不增AI）；前序本轮flow-dc2290c7的22项真实PG/CAS/幂等/意见链仍保留，不盲重跑。review-readback-92bc6049读取32记录126版本，0摘要受影响、0历史改写，三份原始真实模型输出通过新严格契约免费回放。free-gates-dba74990：404纯测试、1054旧内核测试、构建/保全/空白全部通过；691旧源码、115表41128前序行、三旧scope和八旧进程不变。PNG/WebM、失败与原评审均留痕。

本轮0新Provider/费用；累计仍10job/9实际HTTP/88笔known/¥1.899558，paid=false、任务额度已满，不因余额自动续跑。只用专用合成库，七个本机服务就绪，不接临床库、不动旧服务、不发布。用户可先阅读已有结果并体验意见闭环；正式AC10的新合成AI任务须另确认。后续仍保留11/04、11/06全一期复估和11月中旬交付目标，不借本片销掉其余业务/AI/正式治理。

完整证据与AC10验收卡见本片实测文档，原评审与作者复验见planning同日目录code-review.md；61项最终源码摘要见implementation-k08-checkpoint.json。Notion同步状态以最终回读收据为准。下方K06/K07“待总评审”和更早停止点均为历史，不恢复旧任务。


## 用户专业AC10验收卡（待签，不由技术测试代签）

K08证据补充：纯反例RED及最终48项GREEN在`k08-review-fixes/`，全量404项另由最终门禁证明。中间pure-green.log的失败是混合英文摘录未按测试预期切句，原实现保守拒绝整句并未漏放；用明确换行分隔定性句后通过，未放松过滤。最初新映射测试误追加已存在的followup访视导致配置重复，修正测试夹具后才取有效非空对照，不把夹具错误记成产品缺陷。历史目标读取75d84716失败、58ceb8d0普通时序通过、1a88087c受控在途稳定RED及5ce391ba最终GREEN均保留，不能只挑普通时序通过掩盖竞态。完整原评审、作者逐项闭环与原包/最终源码摘要分列存档。

当前可在本机登录后，从本人方法候选进入“核对复用条件”，阅读已有真实AI结果并核对来源、免费规则及本人意见历史；阅读不产生新费用。正式AC10仍要求用户选择未预运行的合成例，新增AI任务前另行确认任务额度（原10任务已满，不能借余下HTTP或费用余额自动续跑）。

请由用户确认：①双端固定版本与实际来源可追溯；②“声明相同／声明不同／未检查”不会被误读为临床适用性；③AI解释能帮助理解具体缺口，未检查不会被说成已核对；④能判断哪些可参考、哪些需修改、哪些暂不采用，并保存自己的理由；⑤切换依据、等待阅读、来源回看和历史核对不丢输入、不误套用；⑥没有共享、审批、锁库、发布、导出或自动应用。结论填写“通过／有条件通过／不通过”，附阻碍完成任务的具体项；验收人、日期和结论留空至本人确认。专业判断不能由自动脚本打分替代。

## K06/K07本轮证据（不新增模型）

### 四层与验收映射

| 标准 | 技术证据 | 专业/范围限制 |
| --- | --- | --- |
| AC01 双端绑定 | K01 readiness-e8e70124、K03 source-head-50921d78及当前真实UI固定双端/版本读取 | 不把派生目标称新独立PICO确认 |
| AC02 声明规则 | 手写golden及当前399纯套件；真实两账号逐组呈现 | 不是临床等效/总体适用结论 |
| AC03 只写新对象 | 当前preservation verify-approved：691源/115表41128行/三scope/旧进程/原79前缀 | WP09新记录/意见及已批9个Provider费用在准许增量内，不要求全部整库不变 |
| AC04 原子/幂等 | K03/K04真实双连接/故障回滚、dc2290c7真实PG CAS与提交后丢响应同键 | 原回执和失败不重置；新意见版本计容量 |
| AC05 真实Agent | K05 owner-selected-reconciled/admin-selected/general真实成功、revoke-final真实在途拒交付；K06读实际三类来源 | 本轮不新增模型，不是完整OpenCode/联网或新专业样例验收 |
| AC06 科学/引用 | 当前模型契约/数值反例、真实Provider轨迹和严格A/T/K来源；无自动修复 | 程序展示数值；LLM只定性解释 |
| AC07 意见/历史 | dc2290c7真实规则→AI明确确认、同消息分批保存；d72086b8固定历史只读 | 原资产/target不写，未检查仍保留 |
| AC08 当前授权 | dc2290c7真实U02/U03单独撤销；03bf0b6a精确非首项/历史/迟到200/换账号/退出 | 撤销只改本轮wp09 scope并原字节恢复，不改旧角色或旧scope；K05原父对象PG门禁沿用 |
| AC09 UI/文档/评审 | 本轮五视口/真实200%/键盘/PNG/WebM及产品/使用/测试文档 | K08唯一独立代码总评审及最终Notion回读尚待，暂不记完整通过 |
| AC10 用户专业效果 | 待用户用未预运行合成材料评阅 | 技术结果不能代签；新AI样例任务须另批，因为10job已满 |

代码实现、本机配置/授权、真实请求执行三层有技术证据；业务专业标准仍待用户。该映射不复活前序WP待办，不将17项未证明AI入口或生产准备删成二期。

证据统一在 `/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/`，不含密码、Cookie或连接串。

| 命令（均scripts/下、--mode local-synthetic） | 当前实际结果 |
| --- | --- |
| asset-applicability-browser.mjs | browser-d72086b8，两账号26组；五视口1440/1366/1920/390/320、已有真实AI/来源、固定目标历史、无AI历史目标、错误/混合/重复路由拒绝及无旧动作 |
| asset-applicability-browser-flows.mjs --resume-file …/browser-flows-e31a5d3e/records.json | browser-flows-dc2290c7，两账号22组；前次owner新记录显式续验，admin新UI创建；真实保存、CAS、丢响应同键、读失败恢复、实际U02/U03撤销、规则→真实AI依据显式确认和分批意见，不增job |
| asset-applicability-browser-auth.mjs | browser-auth-03bf0b6a，两账号12组；非首项记录/固定历史精确探针、真实scope在途撤销/恢复、旧200不复活、实际Cookie切账号及退出清私有内容 |
| asset-applicability-browser-visual.mjs | browser-visual-b6fa3363，两账号原生Chrome设置200%、真实键盘Enter/Space、Reading16/28、input和重要限制14/22，PNG/WebM；不是仅改视口冒充缩放 |
| node --test scripts/asset-applicability-session.test.mjs | 5项真实纯函数/transport边界，RED→GREEN；固定版本、严格query/源标识、意见理由/null/0/false |
| asset-applicability-free-gates.mjs | free-gates-99436190，399纯＋1054旧内核、构建/保全/空白通过；后续本片路由窄修另跑最终门禁，不以该旧运行代替最终 |

前序K05三份真实成功结果及真实在途撤销沿用其原Provider轨迹；本轮仅真实HTTP读取/新意见版本，没有新Provider或编造AI结果。Node localstorage实验性提示及构建chunk告警保留。控制台/网络的受控409/断网/撤权是反例，不称零HTTP错误；成功浏览器套件0 pageerror，不等于完整无障碍合规。

失败留痕：browser-294ca543为未实施UI的RED；01dd8636为旧演示提示RED；fed8c190为无AI历史误禁目标读取RED；55291845为错误A01新族继承旧按钮RED，均后续最小修补。browser-flows-a86ee96f准确等待实际U03撤销状态后暴露探针200未传播细分失效，修补后dc2290c7通过；更早47c4f3d9的U03等待仅判断reading卸载，不构成在途撤销证据。593d1107/d0e73fb4分别含测试自身不支持isFocused/忽略fieldset禁用问题；e31a5d3e含异步选项尚未到达就检查分页的测试错误，未据此改后台。auth-934a1aa9选到30版只读夹具，后改只读选择有效非首项而不修改该旧记录。browser-aee46aa2与scope撤销脚本误并行，实际403保留且该运行不计绿；其后顺序重跑d72086b8通过。移动早期截图捕捉既有侧栏动画中间态，最终等待动画结束且核对main溢出，未改Frozen Shell。

受控有状态脚本不可盲跑：owner续验记录及真实意见历史保留，每条30版/每账号30条上限不重置。重新执行须读取精确新记录/当前版本，必要用同轮已留存records.json显式续验。未修改旧115表41128前序行、691旧源码、三旧scope或旧8进程；不再执行旧stateful harness。原79笔前缀不变，全部88笔known/¥1.899558，本轮新增0。

K08独立代码评审/最终技术交接尚待，AC10永久待用户用未预运行合成材料评审。完整AI-15、其余AI和正式治理不由本片销项，11/04与11/06全量复估保持。

## K05技术验证与对账收尾完成（2026-10-26）

2026-10-26：K05技术验证及本轮对账收尾已完成。原owner/admin各成功一轮、未预运行通用新例成功；最后具名任务在真实Provider在途撤U03后以APPLICABILITY_SCOPE_RESTRICTED终止且0assistant。仅新purpose采用模型明确选sourceIds→后端严格校验/确定性引用渲染，回模后先重验当前授权、最终原子提交仍再验；旧内核/角色/科学数值规则不改。累计10job（3成功/7失败，含1笔Provider前Token额度拒绝）、9次真实HTTP，88笔费用全部known，累计¥1.899558/¥5；上限10job/12HTTP，原79笔和全部失败保留，不充值/续额/自动重试，paid=false且0在途。本轮6笔已知Token预留均按分别批准的范围，经既有合成平台管理员与旧BillingService完成真实用量对账，0新额度/权限/历史预留修改；最后2601 Token已结算，不再有本轮待对账项。最终394纯测试/1054旧内核、构建/保全/空白通过，SDD Task5已登记complete。仅K05技术范围通过，不等于WP09整片交接或专业验收：K06新UI/K07全链/K08唯一独立评审及专业AC10未完成，当前请求止于K05，不自动开始K06。现有两账号身份页Chrome回归不是新工作台浏览器验收；以下早期停止点/待批/旧上限均为历史。

## K05续验当前停止点与待评审契约

2026-10-26 K05续验：用户已批准最多10个任务（含已失败任务），实际Provider HTTP累计仍最多8、原累计费用¥5且不充值/续额/自动重试。当前4个付费任务／4次HTTP均known但未交付AI回答，83笔费用记录累计¥1.715166，held/unknown为0；scope已恢复paidAiApproved=false。前三次缺行内引用/引用超限/问句不合格；第四次原始输出仍缺行内引用并含未定义pico分组，本次配对输入压缩又引入整数索引不被旧数值守门识别的兼容缺陷，不能归因于旧系统单方。原691源码、115表41128前序行、三旧scope/角色及旧服务保全；不改旧内核/权限/科学数值规则、不重置79笔原前缀或失败计数。连续修补失败后暂停付费，等待评审仅限新分支的输出契约调整：模型明确选择来源标识，后端严格验证后确定性渲染引用；这是待批准建议，不是已实施/模型成功。K05未通过，K06–K08、真实Chrome及专业AC10均未开始/未验。以下较早4/6任务待批、81笔及2失败等状态仅为历史。

## 最新F01实测：真实调用但无AI交付（2026-10-26）

本轮用户批准重新公开核价及4job/8HTTP/原累计¥5。官方人民币峰值输入9、输出27微元每token；每HTTP≤8192字节/输出1536token，八次最坏预留¥3.280896。私有审批冻结原79笔完整账本及审批前两免费失败probe。新增显式`verify-approved`只允许登记attempt对应费用追加，默认`verify`仍严格79笔整文件不变，保全基线未重写。

| 证据/命令（scripts/下，均显式local-synthetic） | 实际证明与限制 |
| --- | --- |
| asset-applicability-fee.test.mjs | 六项临时原预算文件RED→GREEN：第九请求/第五任务/审批前probe、unknown/过期/尺寸/原前缀变更拒绝；无模型 |
| messages-preflight-5d0193a6 | 原PG四组：processing绑定/通用发送拒绝/可信真实父对象typed结果/错父及跨账号拒绝；构造Message及改job全回滚，admission stub，不是真AI |
| runtime-preflight-2119de44 | 两账号四组真实HTTP：purpose state/source分流、通用聊天403/F01 false403、六意图body拒绝；撤U03后state/source403且规则可读；0job/message/version新增 |
| provider-preflight-a8485718 | 原DeepSeekProvider最终组装8050字节/JSON/1536输出/原KB快速路径；HTTP本机拦截，无真实密钥或远程请求，不是模型成功 |
| ai-live-owner-838df54c | 原Agent/真实kb_search/pgvector/DeepSeek，1HTTP/known¥0.051876；缺A/T行内引用等，APPLICABILITY_AI_OUTPUT_INVALID，0assistant |
| ai-live-admin-c0aa68c8 | 1真实HTTP/known¥0.054018；部分组20/16引用超过12，且空泛模板，拒绝/0assistant |

两次新增¥0.105894，合计81笔known/¥1.624860，held/unknown为0，原79笔不改。真实工具查询/URL/来源/时间/用量/失败状态和原文保留在私有trace及具名证据；两个ai-live注册文件禁止自动重放。免费修订提示不是新真实成功，不补引用/删引用/修JSON/放宽parser以造成功；已补每项12引用边界回归。

费用开关现false。保留原四类独立验证需总job上限4→6，**新增2job待批、门禁仍4/8/¥5**。K05未通过，K06–K08/本片真实Chrome及AC10未验。新消息边界可用≠AI业务成功；以下“未核价/0调用/旧PID/370”为历史。


2026-10-26，已按用户批准串行实施K01–K04及K05免费前半。仅`wp01_test_full_baseline`、原owner/admin/当前Study、本人本轮新核对记录和U04新夹具。未核价、未调用模型/新增费用，未开放共享/审批/锁库/发布/导出；K06页面/真实Chrome、K07全链、K08唯一独立代码评审及用户专业AC10未做。

## 本轮证据

全部目录位于父仓库`docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/`。历史切片截图/模型原文不充当本轮AI或浏览器证据。

| 阶段/命令（ResearchHub根） | 实际结果 |
| --- | --- |
| `node scripts/asset-applicability-api.mjs --case readiness --mode local-synthetic` | readiness-e8e70124五组：原两账号完整同tx资产/目标、引用派生目标与新Session创建后全回滚；真实双连接原授权锁串行 |
| `node scripts/asset-applicability-activate.mjs --mode local-synthetic` | activate-40d9b134：仅一次新purpose审计；原两账号精确pairs，0600/0700、7日期限、付费false；原grant不变 |
| `node scripts/asset-applicability-boundaries.mjs --case basis-session --mode local-synthetic` | basis-session-d1f94061两账号：跨人/错目标/缺审计/原A02隔离副本、新会话不改旧行，generic-send拒绝；全部回滚 |
| `node scripts/asset-applicability-create-read.mjs --mode local-synthetic` | create-read-0adaaf7a：原Artifact v1/Source/seal与唯一新Session、回执、双账号仅本人；同键回原/异输入409 |
| `node scripts/asset-applicability-atomic.mjs --mode local-synthetic` | atomic-e8af1729七项：Session/Artifact/Version/Source/业务审计/回执写后逐项命中回滚；故意未命中也强制abort |
| `node scripts/asset-applicability-source-head.mjs --mode local-synthetic` | source-head-50921d78四组：仅U04新子/新目标换版和改回均不复活、双连接同key唯一、原源更新实际等待创建锁 |
| `node scripts/asset-applicability-opinions-pg.mjs --mode local-synthetic` | opinions-39da8f7b两账号：分批/修订/历史、两连接同base仅一成功、无变化422、跨动作key409、成功重试与U01/U02/U03精确撤销；不改旧角色 |
| `node scripts/asset-applicability-atomic.mjs --case opinions --mode local-synthetic` | atomic-opinions-ff561ee9五项实际版本/Source/审计/回执及未命中探针回滚 |
| `node scripts/asset-applicability-capacity.mjs --mode local-synthetic` | capacity-903003e9：21份有效记录真实分页20；跨根30条账户容量/容量后原成功key查询；以上临时行全回滚。另1份本人新测试记录按正常事务保存30版并保留，第31版拒绝，原成功key仍可查 |
| `node scripts/asset-applicability-http.mjs --mode local-synthetic` | http-d2fc5f03两账号实际同源登录/创建/读取/意见/历史/CAS/同键回原、未知及重复query、原始32KiB含encoded ID、他人403和治理路由404；不是浏览器UI |
| `node --test scripts/asset-applicability-ai-contract.test.mjs` | 11项定性白名单、三类来源/同组引用、数字/英文/Unicode拒绝、真实path唯一与空binding拒绝；仅纯代码契约，不是模型执行 |
| `node scripts/asset-applicability-queue-preflight.mjs --mode local-synthetic` | queue-preflight-b79a31e9：原Queue＋真实PG，job/Version/Source/receipt/尾部五点实写及全回滚。paidAdmission为隔离stub、Worker=[]，真实费用授权未通过，0模型 |
| `node scripts/asset-applicability-ai-preflight.mjs --mode local-synthetic` | ai-preflight-d2141a2a：真实本机POST jobs返回F01未批403；新目的通用state/source读取403，job/message/version零新增 |
| `node scripts/asset-applicability-free-gates.mjs --mode local-synthetic` | 最新free-gates-b260fe4f：370纯测试＋1054既有已编译内核、Hub构建、只读保全和git空白检查均0；原Node/chunk告警保留 |

## 失败留痕与限制

- 手写完整输入与规则golden含同组相同/差异/未知，并按key并集保留单侧缺项；null与0、false与未声明不混同。没有组级结论/兼容分/临床等效、LLM计算或自动修改方案。
- 新recordId为本次原Service create一次性预分配UUID，Session/Version/Source/审计/回执同事务；不先写再改v1，不改原Service/Schema。目标夹具引用原真实确认出处并标derived_reference_only，不伪造新AI/专业确认。
- JSONB意见键顺序导致并发两个提交都被正文完整性拒绝（opinions-d2ee3556/5b82c026），已固定规则顺序并只读证明当时17个已存新版本仍可读，未重写历史；随后真实CAS通过。
- 30版大事务到23版触发既有20秒P2028，全部回滚，改正常逐次事务保留新测试记录，不扩大超时。容量元数据占位只验证计数且全回滚，不冒充30份可用核对。
- 队列探针曾因raw/wrapped tx传递错误未命中故障，产生2条本轮未认领、无assistant/Worker/模型的queued测试任务；修注入器后五点通过。仅精确两条新行在resolve-free-probes-687e14de标failed/测试未派发，全部消息/版本保留，无删除或历史任务恢复。未来F01审批凭据须列为审批前免费基线，不重置原账本/次数。
- 服务仅本机自有19501–19507重载；最后PID39767、七口ready，旧8服务未动。范围只增加新purpose/新族API与内部只读桥，不扩共享底座或旧角色。

## 四层状态

| 层 | 当前事实 |
| --- | --- |
| 代码 | K01–K04后端/规则/意见与K05纯契约、队列内部提交/最终执行检查已部分实现；真实Provider及消息投影、前端未完成 |
| 目标环境 | 仅本机合成启用免费API、一次新U授权、费用false；不是生产或全AI已启用 |
| 实际执行 | 原服务/PG/HTTP及原Queue隔离回滚已执行；没有本片实际模型、工具检索新轨迹或Chrome UI验证，不能用隔离admission替代F01 |
| 用户业务结果 | AC10未验，完整WP09/AI-15/一期未销项；最终独立评审留K08 |

本片保护691旧源码、115表41128前序行、Schema/旧三scope/原角色/8进程与79笔known账本整文件。0新增模型/费用，原累计¥1.518966/¥5保持；F01前不查询公开价格或派发付费请求。真实AI/页面/浏览器/全链/评审完成后须追加本片新证据，不覆盖本阶段失败。
