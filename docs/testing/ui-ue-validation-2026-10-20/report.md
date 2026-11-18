# UI/UE V1.1样板整改与新浏览器实测

日期：2026-10-20。用户当前要求：修改文档或页面并进行新的浏览器实测，通过实际动作明确视觉与交互规则。

## 结论与范围

E02阅读/解读抽屉、Q01录入和共享Button已进行代码整改及新一轮技术验证；规则升至[V1.1](../../ui/frontend-ui-ue-rules-v1.0.md)。不是全站重新设计，也不等于真实科研AI或后端能力验收。

| 层面 | 本轮结果 |
| --- | --- |
| 科研前端 | E02阅读、来源/复制、固定解读抽屉；Q01错误定位、草稿状态、失败恢复、离开保护 |
| 公共组件/管理侧 | Button原生契约；当前实际渲染消费者E02、S05、Q01、G01、A01、A02冒烟，不更改治理权限 |
| 后台/数据库 | 无接口、数据模型、租户或任务扫描改动；仅复用既有本机demo store |
| 公共基础 | ADR-0004新增显式Reading Token；旧Token值、Shell尺寸/导航、门户母版不变 |
| 代码与配置 | 当前目录分支codex/ui-ue-validation；保留已有未提交改动，未提交/推送/部署 |
| 业务效果 | 真实研究者阅读舒适度与专业产物仍待用户评审；未测试生产、真实AI、账号或患者流程 |

## 修改前的问题与落地规则

| 修改前实测/代码问题 | 本轮修正与规则 |
| --- | --- |
| 摘要13px/20px，1920视口阅读行宽1235px | 显式Reading16/28，正文行宽上限48rem；密集输入、操作仍14/22 |
| “引用”按钮仅换文字，没有写剪贴板 | 真实写入成功才反馈；演示引用保留未核验标记，拒绝时提供全文 |
| 抽屉复制拒绝仍显示已复制 | 失败alert+手动复制，不假成功；重试不把错误区混入产物 |
| 打开抽屉焦点留在背景 | 初始焦点、双向Tab约束、背景inert、Esc/遮罩/关闭及焦点归还 |
| 固定内容按钮显示生成摘要 | 改为展开/收起示例；说明未调用AI；未接入导出明确禁用 |
| 慢复制期间切页签，结果提示可能指错对象 | 复制期间页签禁用，完成恢复，切页签清除旧反馈 |
| 部分语义标签浅灰/评级浅绿，白底对比不足 | E02组件范围内改用现有secondary/primary文字色，不改变Frozen色值 |
| Q01没有字段错误、保存与离开反馈不完整 | 分草稿/下一步校验，首错聚焦，输入保留，仅真实编辑差异触发离开保护 |
| 公共Button不透传type/disabled/loading | 真实原生button契约，受控忙碌态、防重复、失败后调用者恢复 |

独立代码审查发现了“失败后复制污染”“慢复制切页签竞态”“语义标签对比度”三项，均在本轮修正并复测。没有引入新运行依赖或第二套组件库。

## 环境与可复现命令

本地既有Vite服务：`http://localhost:5173`。Playwright使用桌面已有运行时与系统Google Chrome，不安装浏览器。实际浏览器版本、DPR、录屏文件见[最终指标](after/metrics.json)。原生Chrome200%验证独立进行，不能由自动化的三种viewport替代。

```sh
node --test tests/*.test.mjs
pnpm run build
UI_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PLAYWRIGHT_MODULE=/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
node scripts/ui-ue-browser.mjs
UI_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PLAYWRIGHT_MODULE=/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
node scripts/ui-ue-regression.mjs
git diff --check
```

`--baseline`是整改前反例采集模式，原运行按预期失败并保留证据；修复后再运行不能重新制造历史基线。测试夹具在`tests/fixtures/`，不在平台清单/导航内，不随当前Vite多入口发布。

## 字号与布局的实测差异

| CSS视口 | E02整改前正文/行宽 | 整改后正文/行宽 | 结果 |
| --- | --- | --- | --- |
| 1440×900 | 13/20，755px | 16/28，755px | Reading生效，不缩字 |
| 1366×768 | 13/20，681px | 16/28，681px | 重排无主区横向溢出 |
| 1920×1200 | 13/20，1235px | 16/28，768px | 宽屏不无限拉长行宽 |

Q01另测上述三种桌面视口，输入保持14/22，内容区无横向溢出，详见最终指标的`formMetrics`。E02固定Shell保持既有滚动结构；窄工作区改为单列，解读抽屉内部纵向滚动，页签可横向操作。

同视口截图：

- 阅读[修改前](before/e02-reading-1440.png)与[修改后](after/e02-reading-1440.png)；宽屏[修改后](after/e02-reading-1920.png)。
- Q01[首次打开](after/q01-1440.png)、[校验定位](after/q01-validation.png)、[保存失败](after/q01-save-failure.png)、[修正后](after/q01-corrected.png)及[进入S07](after/q01-to-s07.png)。
- 解读[复制失败/手动路径](after/e02-ai-copy-failure.png)；[共享按钮夹具](after/shared-button-contract.png)。

原生200%：Chrome菜单/AX明确显示200%，滚动阅读区域后可阅读正文；解读抽屉能打开，焦点进入关闭按钮，Esc可退出并回到入口；随后恢复100%。截图与AX仅作为本地证据，原生截图包含浏览器界面，已用窄路径.gitignore排除提交，不上传Notion。浏览器DOM通道在该原生标签超时，因此没有伪造200%时的CSS视口/DPR测量；本轮也未完整测Q01的原生200%、全站放大、400%或手机入口，不能宣称全站缩放/无障碍通过。

## 测试结果与失败保留

- 单元/集成：35/35通过，0跳过，见[日志](unit-integration.log)。Button13项、Q01新校验5项均先取得真实断言红测再绿；既有demo store/路由10项与P002图片7项回归。
- E02/Q01/Button真实浏览器：最终17项检查通过，控制台无新错误；具体项目和最终WebM视频路径见`after/metrics.json`。使用真实剪贴板读回、原生键盘/鼠标、真实localStorage写入/刷新；失败注入只针对隔离测试上下文的clipboard或Storage原型，不冒充后端请求。
- 构建通过，2357模块；保留既有大于500kB分包提示，非本轮新增性能优化交付。见[构建输出](build.log)。
- 50页全部取得1440截图并检查HTTP、Shell计数及公共Button实际type/字号。第一轮严格扫描为47通过、3页有React key告警，原始[结果](regression/results.json)保留；核对相关页面源码未改动后，最终[分类结果](regression/results-with-classified-warnings.json)为50页结构/按钮检查通过，其中3页保留已知告警，不能宣称零告警或50页UE通过。
- 已知告警：P01 Rail；AI01 MainAnswer/ContextRail；E03 Drawer缺稳定key。它们不是本轮Button消费者，也未使用新Reading角色；本轮只登记，不扩大修改范围。最终脚本仅对这些精确告警分类，其余错误仍失败。
- 独立视觉抽查H01/O01/O02/S01/A01/A02/AI01/G02八张1440截图，未发现本轮Button正常态样式漂移或新增Shell/分栏异常。S01既有柱图横轴标签仍拥挤，登记为后续页面任务，不据此恢复全站重构；本轮E02/Q01前后图另由主代理检查。

浏览器任务链覆盖：首次进入→编辑/校验失败→字段定位→不完整草稿保存→刷新恢复→编辑后取消离开保留→存储拒绝保留输入→恢复重试→完整PICO进入同一课题S07。成功/失败反馈与本机存储一致，不因进入S07宣称AI生成完成。

## 评审边界与后续采用方式

本轮技术样板可供用户审阅；后续模块直接复用V1.1规则、Reading角色、Button契约和相应浏览器反例，不复制E02示例医学内容。其他页面仍按各自任务逐页治理；全站真实任务可用性、完整对比度/读屏、真实服务幂等/冲突/撤权/AI人工确认均未验收。旧系统、生产环境、共享表和私有Study授权不在本轮实施范围。

同步文档：FoundationV1.1、ADR-0004、UI/UE V1.1、Layout、AGENTS、UI验收规范、产品基线/变更、使用说明和文档入口。Notion同步结果另见本任务规划目录的`notion-sync.json`；同步不上传原生浏览器截图、录屏、患者资料或凭证。
