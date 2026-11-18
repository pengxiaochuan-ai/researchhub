# AI01阅读空间与多行输入：本机验证

2026-11-06，仅用户要求的两个UI改动。当前目录串行＋同一只读独立评审。专用合成库wp01_test_full_baseline、自有19501–19507环境；无临床库/旧服务/模型调用/权限/云资源/发布变化。没有因读文章而创建新会话、任务或新增Token额度。

## 现象与最小修正

旧单篇textarea固定88px、未接入演示输入框已有的增高逻辑；底部单篇表单与通用开发横幅占位较大。以真实已交付Sjögren综述解读为只读阅读样本，先保存同视口基线，再补4项组件/尺寸反例，观察原5通过/新4失败（缺rows2/增缩逻辑/局部样式），实施后9/9通过。

只修改ArticleAgentPanel的textarea增缩与紧凑footer、article作用域CSS，并在platform-frontend对AI01真实main跳过/移除开发横幅。保留原2–100字、显式发送、键盘Enter/Shift+Enter换行、不自动重发、来源/权限/费用规则；正文16/28、输入14/22。Hub通用问答仅移除同页横幅，不顺带改其输入区；其他页面/演示提示保持。没有新依赖、API/DDL/后端业务改动。

## 实测空间（CSS px，同样短问题）

| 实际视口 | 旧解读区高度 | 新解读区高度 | 增加 | 旧/新底部表单高度 |
| --- | ---: | ---: | ---: | --- |
| 1440×900 | 233 | 419 | 186 | 252 / 170 |
| 1366×768 | 101 | 287 | 186 | 252 / 170 |
| 1920×1200 | 533 | 719 | 186 | 252 / 170 |
| 390×844 | 188 | 292 | 104 | 274 / 174 |
| 320×844 | 166 | 266 | 100 | 296 / 200 |

表为滚动容器可用高度，不代表所有正文一次可见。手机沿用既有外层工作区纵向滚动；发送按钮可滚入视口并通过elementFromPoint命中核对，不因移动端测了横宽就声称全页无障碍通过。未改变左右栏宽、公共Shell/页头/Tab。

## 浏览器验收

命令：`node scripts/article-reading-layout-browser.mjs --baseline`（只记录旧布局，不标通过）；`node scripts/article-reading-layout-browser.mjs`（修改后验收）。真实Chrome隔离上下文，原admin/owner合成账号；读已有解读/原文与费用预览，不点发送，不使用伪造AI回答。登录外页面所有非GET/HEAD API均阻断并计数，结果0次写入尝试、0 Provider。

- [旧布局基线](evidence/article-reading-layout-before-18063b12-ace7-4917-aeb3-baf323d91f78/result.json)。
- [最终真实浏览器结果](evidence/article-reading-layout-after-b7f15060-9606-4230-af8a-45e56b71fc9a/result.json)，同目录PNG/WebM。
- 两账号均60px短输入→104px四行→148px长输入内部滚动→删除收回60px；窄高视口按20vh限制、至少两行。12行文本未丢失，原100字限制不变。
- 相同受控值在1920→320→1920列宽变化时自然折行增高并收回，不靠再次输入触发；刷新恢复原任务问题/回答并重算。
- Enter/Shift+Enter插入换行，Tab至原发送按钮；输入焦点可见，未触发提交。正文末段可滚至thread范围，不被底部表单盖住。
- AI01单篇/通用真实工作台无开发横幅；P01仍保留自身说明；独立显式演示AI01仍有演示标识，没有偷删其他页治理说明。
- 桌面/390/320无整页横向溢出，正文16/28、输入14/22不变；正常流程pageerror/console error为0。未将后台internal回执/版本变成新操作。
- 独立Chrome配置页设原生200%，实际CSS视口720×456、DPR2、visualViewport.scale1；输入按20vh为91.195px，内部滚动，Tab能使发送按钮进入视口且实际命中。保存CDP完整窗口图与viewport图、录屏，不以窄屏模拟200%。原生缩放viewport截图存在既有截幅差异，以完整native200.png及DOM为证；公共页头占位仍较大，本轮未重设计Shell，也不声称该缩放下全页阅读布局已优化完成。

## 免费自动化与独立评审

`node --test tests/article-ai-ui.test.mjs`：9/9，新增4项分别核对受控值/label/rows/disabled/显式提交、增缩及视口上限、边框不裁内容、局部CSS约束。原单篇安全Markdown、来源封存包及既有布局契约回归保持。

`node scripts/business-ai-quota-gates.mjs`：[327/327纯组件/契约、21/21真实合成PG、build/diff通过](evidence/business-ai-quota-gates-ed164693-fbaa-45cf-9152-d00eb3d8b5cd/result.json)，原Agent/Sessions/Queue/Billing源码及原人民币账本hash保全，0 Provider。是相关门禁，不代称旧系统全部维护脚本全量回归。

唯一独立只读审查者/root/article_numeric_review，9项UI测试和脚本语法独立通过，Ready、无Critical/Important/Minor；确认增缩/observer清理、SSR/作用域、演示/其他页横幅不变。未写文件/DB或调用模型；真实浏览器空间增益、缩放及用户阅读舒适度由主实现举证/用户评审，不由Ready代签。

## 四层与用户复验

代码已实现；本机Vite热更新无需中断旧服务；实际已用两身份读取服务端文章/旧解读并操作输入，截图、录屏、字号及几何测量已留证。没有为纯UI修改重做付费解读。专业解读质量本轮不重判，阅读舒适度待用户确认，不是生产发布。

原页面刷新后可体验：阅读已有解读，底部输入四行，再删除成一行，确认输入随内容增缩且解读区不被遮盖；无需点击发送或产生费用。原文/AI推断等必要风险说明继续保留。已有未发送内容请先复制再整页刷新，未新增跨刷新草稿存储承诺。

## 同源文档与Notion

产品规格、基线、变更、版本、使用说明、前端架构和文档索引已同步本轮范围；[Notion规格](https://app.notion.com/p/41056479ab588112ae14d84381be35ee)、[Notion测试交接](https://app.notion.com/p/41056479ab5881c9860bdb29386becb7)新增于原产品/测试章节，既有6页最小追加现行说明，保留全部旧段落/子页，无warnings。没有提交、清理或整体回退dirty工作区。
