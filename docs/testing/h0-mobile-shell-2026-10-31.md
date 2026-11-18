# H0 真实领域页移动端 Shell 本机实测

日期：2026-10-31。仅专用合成环境 `127.0.0.1:19501`，无模型调用、数据库写入、远端资源或真实发布。

## 可复现问题与修补

- 修补前 H01 在 390px CSS 视口，固定侧栏仍显示，正文宽度 154px，页内导航文字挤压。RED 证据：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-h0-mobile-shell/browser-dfb2c847/result.json`；此前真实来源浏览器证据也有 `mobile-shell-content-width-154px` 告警。
- 真实模式 H01/H05 加入已有移动 Shell 消费者清单；小屏收起固定侧栏、正文回流，并提供「平台导航」展开原五项一级导航。关闭时侧栏 `inert`，打开后首项获得焦点；打开期间页头和正文 `inert`，Tab/Shift+Tab 留在抽屉与关闭按钮内。Esc、遮罩及按钮均可关闭并归还焦点，切回宽屏恢复背景交互。H01 页内导航保留完整 14px 操作字号，在导航容器内横向滚动，按钮不缩字或互相覆盖。
- 独立只读评审指出一级导航不可达、52 页证据路径含旧日期及打开抽屉后焦点可逃入背景。前两项已修补；焦点问题以新增浏览器 RED 断言复现（`browser-530a7f8b/`），再补背景 `inert` 与键盘循环。52 页桌面 Shell 冒烟已在本轮脚本按当前清单重跑并写入同日证据目录。原 `html[data-page]` 扩展选择器未在 H01 命中，已撤回；显式演示未接入本轮真实模式移动菜单。

## 本机技术结果

| 检查 | 结果 |
| --- | --- |
| H01/H05 390×844 | 正文各 374px，侧栏收起且不可聚焦，根无横向溢出，页头品牌与账号不重叠；五项平台导航可打开/关闭/点击；抽屉打开后背景不可聚焦 |
| H01/H05 320px | 正文各 304px，H01 页内导航完整且可横向滚动；Tab/Shift+Tab 留在抽屉内，Esc/遮罩/按钮关闭并归焦 |
| H01/H05 1440×900 | 原固定侧栏宽 220px、正文左偏移 228px（含原 body 8px margin）保持；没有手机浮钮 |
| H01/H05 Chrome 原生 200% | `outerWidth=1440`、`innerWidth=720`、`devicePixelRatio=2`、`visualViewport.scale=1`；正文各 704px、根无横向溢出；不是模拟视口；抽屉焦点限制通过 |
| 宽屏切换 | H01 打开抽屉后切至 1440px，页头/正文和侧栏恢复可聚焦；切回 390px，关闭的侧栏重新不可聚焦 |
| H01 真实公开接口 | 前后 `GET /api/hub-sources/external-documents` 两视口均 200；未审来源仍不展示，修补后 390px 告警消失 |
| 显式演示 | 320px 下未设置真实模式标记、未出现本轮手机导航；原演示页面窄屏布局未纳入本轮适配 |
| 构建与回归 | `node --test tests/real-mode-route.test.mjs` 3/3；`pnpm run build` 成功；本轮脚本按当前 `platform-pages.json` 对 52 页逐页做桌面 Shell 冒烟，非 52 页业务/手机验收 |

最终 Playwright 截图、录屏、17 项断言（含焦点循环及宽屏恢复）及 52 页清单：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-h0-mobile-shell/browser-61f0540a/`。展开菜单截图等待侧栏过渡稳定后拍摄。最终接口复测：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-31-h0-external-projection/browser-fea63901/`，桌面和手机均 200 且无告警。构建只报告既有大 chunk 提示，不代表失败。

四层边界：代码及本机目标环境配置/真实 Chrome 路径已验证；本次不涉及 AI 模型执行；“视觉与交互更顺畅”的专业用户验收仍由用户体验确认，不称生产发布或全站手机适配。真实公开来源仍为 0 条管理员批准，页面如实为空态。
