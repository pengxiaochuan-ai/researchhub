## 2026-11-19 · 公开页面统一排版复核

参考：用户已签收P002首屏/流程减负版并明确授权推广公开页。P003/4/5/7/8/9/10正文/11列表详情统一76%/12%外框、40/30/20/16/14角色；900px窄屏24px、账号1200px降列，文章/表单内层限宽。P007满幅背景与内部容器分离，手机取消展示强制换行以避免标题孤行。

真实Chrome90页面宽度案例/同宽前后比较、26篇帮助、真实动态API、账号校验与状态恢复、原生200%留证，既有导航与全文/链接/字段保持；只读独立复核无P0-P2。工作区/P006不套新标准；不把本机结果当生产或客户满意度。截图、测量、录屏及命令统一见[验收记录](docs/testing/public-ui-standard-2026-11-19.md)。

# P002后五区与页脚减负推广 · 2026-11-19

source visual truth: 用户已签收的P002首屏/流程风格（前轮selected-first.png与hero-1920.png），及本轮 `docs/testing/evidence/p002-full-page-light-2026-11-19/before-*-1440.png`。implementation: 同目录 `assets/community/growth/audience/join/footer-1440.png`，1440×1080 CSS/像素、DPR1；另核对1920/390/320。`comparison.png`在同一输入等宽比较1440推广前后（归一到964px宽），`overview.png`用于全页节奏；不是将旧内容当逐像素复刻目标。明确批准的76%/12%、30/20/16/14与原内容/原构图决定本轮差异。

五面：原中文字体与清楚层级、共同体/长机构名自然换行；正文对齐/卡片和原图比例/48–64px区段节奏；原蓝紫与深色加入配色、弱化底部重复装饰；既有照片和图示完整保留且不替换绘制；全部正文/标签/真实活动安排/合成标识/授权/公司备案与原链接保留。焦点证据为1920机构卡、1440资产/共同体、390加入和320页脚；位图标签以实际渲染另看，不冒充DOM字号。

comparison history: 独立首评P2为1920机构名“所”孤行，balance修复后出现拆开“高校”的P3；最终局部keep-all保持三个词完整，九宽逐字Range断言通过，最新1920/1440/320截图及独立最终复核无P0/P1/P2/P3。截图初次抓到入场半透明，保存iteration-entering-assets-1440.png，等待entered和有限动画/opacity结束后重拍；未修改产品动效凑截图。

17相关测试、九宽/交互15聚合组、3受控恢复、原生200%6区、构建5.89s通过。0页面脚本异常、0业务写；独立复评无剩余问题。IAB实际后五区约76%/30px，原节点点击切换说明14px。页签后台hidden沿前轮未实际观察边界，不因逻辑不变冒称运行验证。用户前两区已确认，本轮后五区主观视觉与生产另验。

final result: passed

# P002首屏与科研流程区减负 · 2026-11-19

source visual truth: `docs/testing/evidence/p002-entry-light-2026-11-19/selected-first.png`（用户本轮两图中第一张，1419×1108）。implementation: 同目录`hero-1920.png`（1920×1500 CSS/像素，DPR1），另看1440/390首屏和320流程。`comparison.png`将两图放在同一1928×790输入，以等宽964px显示，分别等比约0.679/0.502；不对实际页面做zoom。源图生成的近似字号/约81%边界，按用户明确40/30/20/16与76%目标纠正；导航/完整首屏文案/原素材约束优先于位图估算。状态均为首页默认研究证据与第四阶段选中。

五面核对：字体沿原PingFang/YaHei/system栈，桌面H1/H2/卡片/正文40/30/20/16，1440自然三行与1920两行且不裁字；正文76%/12%准确，五卡240px左右与单条AI栏；原蓝紫/浅底色及轻边框一致；照片、透明循环与五阶段图片继续原资产，未用新绘图/占位替换；首屏逐字不变，流程短句与责任单条符合批准稿。focused evidence为1440标题/项目长名称、390首屏及320卡片/参与入口的实际截图，图中位图标签另行视觉核对。首屏到流程的原锚点/注册、鼠标/键盘/自动高亮与恢复、reduced-motion/图片失败刷新均有本轮证据。

comparison history: 首轮520px以上图形及左侧垂直居中造成较大顶部留空，已将图示上限520px、左侧顶对齐后重拍。独立复评指出旧移动规则隐藏参与入口，已在本轮局部CSS显式inline-flex；12宽/交互18组复跑，`process-320.png`入口可见，独立最终复核无P0/P1/P2。原测试读交错字体/异步活动加载状态的误差均记录为harness问题，没有改产品凑断言。

17相关测试、18聚合浏览器组（含12宽）、原生Chrome200%和构建5.17s通过；0业务写。IAB刷新已看到新版并核对76%/40/30/20/16；其viewport工具返回宽3184而非请求1920，不冒充固定尺寸证据。页签后台visibilitychange在独立自动化Chrome未实际触发，原逻辑未改，保持未测；离屏/减少动态效果实测通过。本机技术通过，用户视觉签收/生产另验。

final result: passed

# Design QA — O02 右侧 UI 复刻

## Comparison Target

- Source visual truth: `C:\Users\石海波\AppData\Local\Temp\codex-clipboard-f9a1425b-a035-4c95-a1aa-abf798b4bb43.png`。
- Content and computed-style reference: `http://localhost:5173/` 的 O02 研究机会详情状态。
- Implementation: `http://127.0.0.1:4175/pages/o02/`。
- Implementation screenshot: Codex In-app Browser 当前任务中的 1280 × 720 浏览器捕获；浏览器仅返回内存图像，无持久化截图路径。
- Viewport: 1280 × 720 CSS px，devicePixelRatio ≈ 1。
- State: 页面默认状态，未滚动，右栏 AI 综合研判与顶部研究潜力卡可见。

## Full-view Comparison Evidence

- 源图、参考页右栏和实现页右栏已在同一任务中打开并按相同视口检查。
- O02 顶部右侧呈现“研究潜力 / 高 / 保存机会”，局部导航右侧呈现“分享 / 导出 / 形成研究问题”。
- AI 研判面板位于首屏右栏，旧“与我的匹配度”和旧 AI 解读面板已移除，无重复内容。

## Focused Region Comparison Evidence

| Surface | Reference | Implementation | Result |
| --- | ---: | ---: | --- |
| AI panel | 380 × 424px | 380 × 423px | 通过，1px 浏览器取整差 |
| AI title row | 378 × 54px | 378 × 54px | 通过 |
| AI icon | 29 × 29px，#5746EA，7px radius | 29 × 29px，#5746EA，7px radius | 通过 |
| Reason sections | 118 / 79 / 88px | 118 / 79 / 88px | 通过 |
| Score cards | 114 × 46px，6px gap | 114 × 46px，6px gap | 通过 |
| AI boundary | 354 × 67px，#F2F0FF | 354 × 67px，#F2F0FF | 通过 |
| Potential card | 220 × 133px | 220 × 133px | 通过 |

## Required Fidelity Surfaces

- Fonts and typography：按参考页逐项复制 14px 标题、10.8px 标签、12.8px 问题标题、11.8/17.936px 正文及 10.3px 评分说明。通过。
- Spacing and layout rhythm：标题区 10×12px padding、9px gap；内容区 9×12px；评分区 5px top margin / 6px gap；边界区 7/12/9px margin。通过。
- Colors and visual tokens：面板、标签、绿色评分、紫色图标、边界提示背景与参考页计算色值一致。通过。
- Image and icon fidelity：按用户要求保留“岐研 AI”左侧原 Sparkles SVG，未替换；尺寸调整为参考页 16px 图标 / 29px底座。通过。
- Copy and content：AI 综合研判、缺口重要性、三项可研究性判断、AI 边界及研究潜力文案均来自参考页。通过。

## Comparison History

### Round 1 — blocked

- P1：实现面板宽 340px、高 467px，参考为 380px、高 424px。
- P1：标题区 68px、图标 34px 渐变底，参考为 54px、29px 纯色底。
- P2：评分卡 58px，参考为 46px；正文、标签和边界提示字号偏小。
- P2：顶部研究潜力卡高度、按钮宽度和字重不一致。

### Round 2 — passed

- 直接采用参考页 DOM 的计算样式值修正宽高、间距、字号、行高、颜色、边框和圆角。
- 浏览器重新捕获后，上述 focused-region 尺寸全部对齐；仅面板总高存在 1px 浏览器取整差。
- 控制台 error / warn：0。

## Final result

passed
