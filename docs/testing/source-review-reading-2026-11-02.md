# 来源审核阅读与连续操作：本机技术交接

## 补充：半宽范围与保存后自动续审

用户仅追加两项，本机已实施：桌面范围下拉约原宽50%（1440视口原637px→312.5px），确认按钮紧邻，14/22不变；600px以下保留可读全宽。确认保存成功后重读真实队列，按当前类型/搜索/状态自动下一待审项、定位新标题。标题下反馈明确上一对象/范围，新对象仍未放行。没有下一项保留当前并提示；失败/冲突/队列重读失败不跳篇或自动重试。下文历史“保存后保留当前”不再是现行流程。

本轮四层：代码实现、本机启用、实际请求链路已验证；最终用户视觉/专业体验仍待本人确认。G02总览/Shell/后端/权限/原记录保持，无模型调用、费用、临床库、旧服务、云、远端配置或发布变更。原两篇PMC只读，保存仅新具名合成夹具，finally将自身暂不放行保留历史。

- RED→GREEN：新增fresh队列/筛选/无下一项测试，先因缺导出失败；浏览器半宽断言先发现旧637px未缩。最终`node --test tests/*.test.mjs` **156/156**，独立针对性5项通过。
- `node --test --test-concurrency=1 server/hub-sources/pmc-reading-pg.test.mjs server/hub-sources/object-review-pg.test.mjs` **7/7**真实PG/HTTP；`pnpm build`成功，既有chunk/HMR提示保留；`git diff --check`通过。
- `node scripts/pmc-reading-browser.mjs --mode local-synthetic` **17组**，[最终只读记录](evidence/pmc-reading-99a1aea3/result.json)：原两篇、桌面1366/1920、390/320、原生200%、队列底端/60帧、阅读/键盘/故障恢复/身份清理等，无原决定POST。
- `node scripts/source-review-confirm-browser.mjs --mode local-synthetic` **7组**，[最终真实保存记录](evidence/review-confirm-9eaed9a7/result.json)：半宽、选择0POST/仍404、显式确认仅1笔真实POST201、自动下一项且新项未放行；未保存输入不随切篇、原租户/单行范围、注入503不跳不重试、真实并发409不覆盖/不跳篇、末项留原对象提示。前序队列摘要前后相同、pageerror0，最终三行均暂不放行。PNG与WebM留存；初版7组通过`0f0669f5`保留但最终以`9eaed9a7`为准。
- 独立只读代码总评审无遗留阻断；建议的上一项名称与身份迟到冲突反馈守门已落实，不把评审者称实际浏览器/DB执行者。

失败留痕：`review-confirm-5a481744`保留半宽RED；`review-confirm-07c6d241`发现自动下一项后再次点同队列项会清空scope却不触发重读，导致确认持续禁用，修为同key只定位，最终真实流程重测通过。各失败夹具仅自身暂不放行保留历史；不覆盖旧任务或删除失败来刷绿。产品/版本/使用说明/架构/规格/计划同步本轮增量，Notion对应既有页增量保留其他任务。

![当前半宽范围与确认](evidence/pmc-reading-99a1aea3/review-actions.png)

本轮[实际保存后新项仍未放行](evidence/review-confirm-9eaed9a7/saved-public.png)、[失败不保存](evidence/review-confirm-9eaed9a7/failed-not-saved.png)。技术结果不代签用户专业体验/整站或生产验收。

## 补充：下拉选择与确认保存

用户已确认直接实施，仅审核操作区改为**原三值下拉＋确认保存**。当前已生效范围与未保存输入分开；未审核空占位、已有统一决定回填原值；选择不请求，确认复用原decide/授权/事务，无二次确认。快照key隔离对象、状态、版本、资产/决定与行批次范围。原总览/Shell/队列高度和后端不改，14/22操作字号保持。

四层：代码与本机环境已启用；真实读取与新具名合成夹具确认保存已执行；最终视觉/专业体验待用户。无模型/费用、临床库、旧服务、云、远端配置、权限或真实发布变更，不替用户放行原文章。

- SSR2项先因3按钮/缺下拉RED，改后GREEN；全前端`node --test tests/*.test.mjs` **155/155**，覆盖空占位/原三值/单确认/说明/忙碌与未变更禁用。
- 相关真实PG/HTTP `node --test --test-concurrency=1 server/hub-sources/pmc-reading-pg.test.mjs server/hub-sources/object-review-pg.test.mjs` **7/7**；原权限、原子提交、真实父范围不退化。构建及diff检查通过，既有chunk/HMR提示保留。
- `node scripts/pmc-reading-browser.mjs --mode local-synthetic` **17组**：[读取机器记录](evidence/pmc-reading-4792c784/result.json)。当时原两篇均已有用户真实决定，按当前状态回填，不覆盖为先前“待审”；切范围无POST。1366/1920/390/320、原生200%、队列到底/末端、阅读定位、键盘/退出/失败恢复均重跑。
- `node scripts/source-review-confirm-browser.mjs --mode local-synthetic` **6组真实保存链路**：[最终机器记录](evidence/review-confirm-5fa52f11/result.json)。只用本轮新批次两来源三合成行：选中后0POST/公共404；明确确认201、在途禁用、真实重读；切篇不带选择；公开→租户→单行暂不放行、兄弟行保持；混合批次无默认值；注入503不假保存/自动重试，重核后恢复；实际并发决定409不覆盖。最终本轮全部夹具暂不放行，前序队列摘要不变、pageerror0、模型0。
- 独立代码总评审无阻断，独立SSR2通过；评审未操作DB/浏览器，不代替实际执行或专业确认。

截图已打开核验，PNG和WebM留存：

![选择未保存](evidence/review-confirm-5fa52f11/selected-not-saved.png)

![确认后生效](evidence/review-confirm-5fa52f11/saved-public.png)

另见[390px操作区](evidence/pmc-reading-4792c784/actions-390.png)、[320px](evidence/pmc-reading-4792c784/actions-320.png)、[失败不假成功](evidence/review-confirm-5fa52f11/failed-not-saved.png)。

失败留痕：`pmc-reading-4ba790f0`原脚本硬编码旧待审，但用户已放行；改为核对当时原决定，未改用户数据。`review-confirm-77db517f`在子行标题变化但实际范围尚未回读时过早断言，改为等待当前单行/批次实际作用域，不加sleep、不改后台；失败批次在finally只对自身暂不放行、历史保留，不复用为通过。最终新夹具为`review-confirm-5fa52f11`，原对象分别按两份最终记录保全。没有代审原PMC或付费AI。

产品、说明、规格、架构及[小步计划](../planning/source-review-confirm-2026-11-02.md)同轮更新，Notion按原页增量同步。下文是此前轮次，“三按钮”等旧口径和数量不当当前界面。

## 补充：队列到底与首次操作说明

用户本轮要求仅两项，现已完成本机技术修补，专业体验待用户确认：

- 桌面队列从当前实际位置填满可视窗口剩余高度，内部滚动，底部常规留16px；真页末端同时受详情容器底边约束，标题不被64px公共顶栏遮住。手机仍为原页面滚动/列表与详情切换，不强套桌面滚动。
- 公开、租户内、暂不放行三个原按钮各自下方常驻14/22说明，通过`aria-describedby`关联，分别解释访客/组织成员的可见范围、AI检索及保留内容。选择仍一次保存，不加弹窗、勾选、权限或自动AI任务。

先RED：原900px视口队列y80、高597、底677，剩余223px；[本轮失败截图](evidence/pmc-reading-419c94c9/)，新增两项真实JSX/SSR因缺少说明组件失败。实现后两项SSR转绿。独立评审补查真页底端，新增60帧用例又复现队列top48进入顶栏：[底端失败证据](evidence/pmc-reading-20a7f301/)。根因高度仅跟自身位置/视口，没有父容器末端约束；修为同时约束顶部80、视口底16及父容器底边，不改公共Shell或掩盖失败测试。

最终验证：

- `node --test tests/*.test.mjs`：**155/155**；新SSR两项验证说明常驻/关联、原3个按钮、忙碌/不可用/当前状态禁用和无附加确认。
- `node --test --test-concurrency=1 server/hub-sources/pmc-reading-pg.test.mjs server/hub-sources/object-review-pg.test.mjs`：**7/7**真实PG/HTTP，读取权限、原一次决定/原子失败/范围/CAS不退化。未改后端实现，PG变更回滚，不替原文章放行。
- `pnpm build`及`git diff --check`通过；既有chunk大小/HMR端口提示按原边界保留，不扩打包或测试设施。
- `node scripts/pmc-reading-browser.mjs --mode local-synthetic`：**17组通过**，[最终机器记录](evidence/pmc-reading-63d279aa/result.json)。首屏及深阅读队列到底、内部滚动不带动详情、真页底端静置60帧及回上方稳定；各按钮说明真实可见/14px；1366/1920/390/320、原生200%、两账号、读取失败恢复、键盘及退出迟到200等前序任务链均重跑。截图和9份WebM在[本轮证据目录](evidence/pmc-reading-63d279aa/)。初版16组通过证据`992f97d5`仅作历史，以最终17组为准。
- 原全部队列/决定摘要前后相同：`a75d3f6b7ad37378476f1754f07ced6e65761e9bc6cc5fa82acfee37cd5fcef4`；pageerror=0、模型调用=0。只用专用合成环境、原账号和原对象只读，没有新权限/原文章决定/临床库/旧服务/云/远端配置/发布改动。
- 独立只读代码评审最终无阻断项，说明语义与原权限一致、单飞/CAS路径复用、监听清理/窄屏及底部约束已核查；浏览器结果由主实施提供，不冒称评审者实际操作浏览器。

![本轮三种决定的常驻说明](evidence/pmc-reading-63d279aa/review-actions.png)

![本轮页面底部队列与标题边界](evidence/pmc-reading-63d279aa/queue-bottom.png)

另见[首屏队列到底](evidence/pmc-reading-63d279aa/queue-entry.png)、[手机说明](evidence/pmc-reading-63d279aa/actions-390.png)。本轮未改G02总览、审核权限、后台逻辑或普通读者页面，未代签专业体验/正式发布；下文是前一轮四项＋六步骤的交接记录，不与本轮计数混算。

日期：2026-11-02。当前任务仅用户批准的“正文定位、切篇位置、完整性分类、长文操作入口”及两篇审查六步骤问题；不是旧S08/S10、采集或共享底座任务恢复。入口：[本机来源审核](http://127.0.0.1:19501/pages/g02/?view=source-review)。

## 结果与六步骤闭环

| 实际操作 | 已落实的修补 | 本轮真实证据 |
| --- | --- | --- |
| 进入、筛选并找到文章 | 合并子功能重复说明；类型/状态计数套用当前其他筛选与搜索，队列标明当前范围；题名保留完整，不猜测缩写 | overview、first-contents及真实计数断言 |
| 展开并核对正文 | 复用保存的同版JATS提供章节/段落/目录、文献编号和真实参考文献；文献可回正文，作者/标识分开且不重复编号 | first-contents、first-reference；HTTP200与原件SHA |
| 判断取得内容和缺失影响 | 摘要、正文、表格、图片、作者附录、PDF六分类；精确指出缺PDF；XML/JATS/TXT归技术副本，未知不说成原文没有；无空表格入口 | first-file-classification；原清单对比测试 |
| 从深处换另一篇 | 当前选中、焦点与新标题一致，滚动到新标题，保持左队列；未决定明确“跳过” | 真实深处切PMC13672493；键盘Enter跳过 |
| 核对图表并返回阅读 | 第二篇2张真实图片原比例/图号/图注保留，2张表格真实th/caption/合并格，正文与图表双向定位；公式/上下标不拼成错误数值 | second-table、second-figure；MathML/TeX/上下标测试 |
| 作决定或继续/恢复 | 长文底部显示当前文章/状态、回到原决定区/原下一篇；跳过不保存，不新增审核步骤；失败明确降级可手动重读，退出清理迟到200 | 四宽度、原生200%、故障恢复与真实退出；原队列摘要前后相同 |

上述是技术实现与实际执行证据，用户对阅读/审核习惯的专业体验确认仍独立保留。G02总览、公共Shell及审核权限/三种决定保持，未代管理员对两篇真实文章作决定。

## 四层交付状态

1. **代码已实现**：原JATS有界确定性转换、具名当前授权只读接口、结构化阅读/完整性/局部连续操作；无新表/角色/依赖。
2. **目标环境已启用**：仅本机`wp01_test_full_baseline`，自有独立runtime已重启加载新路由与解析代码；19501–19507七服务就绪，未动旧服务。没有临床库、外部重抓、模型、费用、云、远端配置或真实发布。
3. **真实请求已执行**：PMC13678665、PMC13672493实际原件/PG/HTTP/Chrome读取；具名admin200、owner403、匿名401/no-store；截图与WebM保存。故障恢复使用明确注入503，不把它称真实后端故障；恢复与身份迟到200来自真实接口。
4. **专业可用性**：本机六步骤与视口技术核对通过，用户是否接受此阅读/连续审核体验待本人体验确认。未逐字逐图复核全篇官方排版、未做完整读屏器/WCAG认证，不代签论文科学质量、内容权利或整站验收。

## 自动测试与构建

- `node --test tests/*.test.mjs`：**153/153**，包括真实React/JSX SSR、完整性、队列和前序前端契约。
- 相关后端命令：**45/45**。包含原35项来源/审核/投影/Agent非收费回归，以及新7项转换＋3项实际PG/HTTP读取。PG变更用回滚事务，原文章持久决定不变。

```sh
node --test --test-concurrency=1 \
  server/hub-sources/object-review*.test.mjs \
  server/hub-sources/external-*.test.mjs \
  server/hub-sources/visible-repository.test.mjs \
  server/hub-sources/review-service.test.mjs \
  server/hub-sources/guidance-clause-service.test.mjs \
  server/hub-sources/registry-detail-service.test.mjs \
  server/hub-sources/agent-retrieval*.test.mjs \
  server/hub-sources/pmc-reading*.test.mjs
```

- `pnpm build`：成功；保留既有WikiEditor/china等chunk超过500kB告警，不为本轮阅读任务扩大打包改造。
- `git diff --check`：通过。部分既有SSR测试仍出现HMR端口占用提示但测试退出0；本轮新SSR关闭HMR，不改其他测试。
- 独立只读代码评审：先关闭公式拍平、预格式文本遗漏、未知状态误称无内容、嵌套xref失链；截图复核再发现引用作者拼接/重复编号，新增失败用例后修补并获得独立增量复核。最终独立运行转换7＋真实JSX/SSR3均通过，无剩余代码阻断；评审未操作DB/浏览器/审核决定。

**基线限制**：此前整组来源后端测试71中59过、12失败，旧PMC夹具硬编码“无批准、expectedVersion=0”，已与用户持久批准冲突；本轮未删除批准/重置数据库或篡改前序测试来刷全绿。本轮45项不是全后端/旧内核全量测试；细节沿[前序交接](source-review-workspace-2026-11-02.md)。

## 最终真实Chrome证据

命令：`node scripts/pmc-reading-browser.mjs --mode local-synthetic`。

最终[机器记录](evidence/pmc-reading-caa02bc1/result.json)：**14组通过、pageerror=0、模型调用=0**。包含1440主路径、1366×768、1920×1200、390×844、320×740、Chrome原生200%（设置页缩放，非CSS模拟）和键盘操作。正文实际16px/28px，操作14px且高度≥44px，无页面横向溢出，底部操作在真实阅读视口内可见并能回到原决定区。原生缩放截图通过窗口表面抓取，避免viewport:null截图裁半假象。

全部原队列/决定摘要在同一最终流程前后相同：`910becd653809db4c247eed94a5c306e49979e61b6e270081c2044a5794a1908`。无保存/放行请求；实际退出另用独立浏览器会话，真实原文200在退出后才释放，不回填旧文章/目录/动作。

截图已打开核验：

![章节目录与当前文章](evidence/pmc-reading-caa02bc1/first-contents.png)

![参考文献与正文回链](evidence/pmc-reading-caa02bc1/first-reference.png)

![真实表头与合并格](evidence/pmc-reading-caa02bc1/second-table.png)

![原比例图片及正文回链](evidence/pmc-reading-caa02bc1/second-figure.png)

其他证据：[完整性/技术副本](evidence/pmc-reading-caa02bc1/first-file-classification.png)、[390](evidence/pmc-reading-caa02bc1/reading-390.png)、[320](evidence/pmc-reading-caa02bc1/reading-320.png)、[原生200%](evidence/pmc-reading-caa02bc1/native200.png)、[退出迟到读取](evidence/pmc-reading-caa02bc1/logout-late-reading.png)、[未变总览](evidence/pmc-reading-caa02bc1/overview.png)。[全部录屏目录](evidence/pmc-reading-caa02bc1/video/)内9份WebM对应实际浏览器会话。

## 失败尝试留痕与范围

- 首轮读取故障测试脚本复用了“必须已见目录”的成功等待，故注入503时超时；改为等待显式降级和重试，不隐去证据：`evidence/pmc-reading-4d33f5aa/`。
- 一轮HTTP回归误与本机runtime重启重叠，2项连接拒绝、其余42过；服务就绪后整组重跑44过，引用增量后最终45过，不把停机期结果当产品授权故障。
- 一轮浏览器与PG回归同时运行时队列前后摘要不一致，未将该轮作为通过：`evidence/pmc-reading-7989603e/`。不据此推断用户原决定变化的原因；最终让浏览器在回归结束后独立执行并完整比对通过。
- 早期通过证据`43c0b7ba`、`e33b9ed0`保留，最终以`caa02bc1`为准。原生200%早期截图裁半已修复采证方式，不修改产品字号掩盖。
- 本轮无正向真实文章保存、付费AI或公开E02新布局测试，前序相应结论不冒作本轮证据。后续如果要将结构化阅读推广到普通读者详情页，需另按既有布局确认规则评审。

## 文档与边界

同步产品基线/变更/版本记录/使用说明、来源审核规格、API和前端架构；实施计划见[小步计划](../planning/source-review-reading-implementation-2026-11-02.md)。当前本机代码交接，不提交整个脏工作区、不改旧项目，不扩到历史专项；Notion对应页同步保留原历史。

Notion已同步上述七份既有文档本轮增量和ResearchHub索引，新增[实施计划](https://app.notion.com/p/40c56479ab5881d8b853c3689ada557f)与[技术交接](https://app.notion.com/p/40c56479ab588162b364c76232584ea4)。仅本轮增量，未覆盖旧内容或删除子页。
