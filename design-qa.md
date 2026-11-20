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

# 公开动态与帮助详情延续横幅 · 2026-11-19

source visual truth为现行同栏目列表：`docs/testing/evidence/public-detail-banners-2026-11-19/list-academic-1435.png`与`list-help-1435.png`；implementation为同目录`academic-1435.png`与`help-1435.png`。全部1435×1096 CSS／像素、DPR1，不需归一；状态为同一公开活动及报告帮助正文。源与实现同一比较输入查看，完整视图比较层级，焦点核对横幅、唯一文章h1和920px帮助阅读卡；另核对320窄屏及200%。

两栏目各自列表／详情横幅图片URL、取景、尺寸和位置实测完全相等；标题视觉32／手机28、正文16沿现有规则。详情横幅栏目名为p，文章为唯一h1。列表文字／链接／控件与修改前相同，全部26帮助正文／链接与前相同。字体、间距、配色、图片质量与内容均核对，独立只读复评无本轮P0／P1／P2。

48相关测试、26浏览器检查、九宽和两详情原生200%通过。初验脚本将select不存在的placeholder=undefined与JSON省略属性相比较，已统一JSON序列化后完整通过，未为此改产品；原失败留作harness-failure.json。IAB旧连接卡顿，重新打开帮助详情可见，但截图连接再次超时；正式视觉证据为独立Chrome真实截图，不把未完成的IAB链路写成通过。无业务写或科研模型请求，无新素材。

final result: passed

# P008第三版问答横幅 · 2026-11-19

source visual truth: `docs/testing/evidence/p008-questions-2026-11-19/selected-third-mock.png`，用户最近帮助三图中的第三张，1435×1096。implementation screenshot: 同目录`implementation-1435.png`，1435×1096 CSS／像素，DPR1，无需密度归一。源／实现同一输入查看，状态同为未筛选帮助中心、26篇、四列卡片。

完整画面对照层级，重点核对横幅和门户导航、右侧气泡全形、手机标题与输入重排。标题／卡片／正文32／20／16px、搜索760px及原卡片自然高度遵守项目现行约束，不追随生成稿近似字形放大或压缩。桌面220px、手机180px；不复用书籍／台历、不加客服或AI能力。字体、间距、颜色、图片质量与文案均核对。

浏览器17项及独立只读视觉复评无P0／P1／P2；main全部文字／链接／控件与修改前相同、P009正文相同，门户导航横纵坐标／字号与高度同值。九宽、原生200%、图片失败、搜索／分类／详情刷新返回及当前IAB通过，pageerror0，0业务写。背景内置image_gen生成单列留痕，浏览器无科研模型请求。源与实现差异为上述现有字号／内容宽度硬约束，无额外未修问题。

final result: passed

# P011第一版写实书桌横幅 · 2026-11-19

source visual truth: `docs/testing/evidence/p011-daylight-2026-11-19/selected-first-mock.png`（用户最近三张图中第一张，1487×1058）。implementation screenshot: 同目录`implementation-1487.png`；viewport1487×1058 CSS px，截图1487×1058像素，DPR1，无需密度缩放。state为匿名P011活动列表、同三条实际活动；源与实现同一比较输入查看。

完整图比较布局／层级，焦点核对1487横幅、1920及2219宽屏物体与左侧衔接、320窄屏标题／筛选。主标题32px、卡片20px、正文16px及1440px最大内容宽沿原项目规则，不照生成位图的近似字形放大标题或压缩卡片；横幅220px在已讨论200–240范围，手机180px。复制、搜索／筛选、详情刷新／返回、图片失败、原生200%及菜单已实测。无页面异常或内容业务写；浏览器无科研模型请求，背景素材生成单列留痕。

comparison history: 首次cover大屏裁掉台历，保留`iteration-cover-1487.png`；最终原图等比、显示宽上限1440px、靠右及44%纵向位置，完整台历和主要书籍保留。拉远草稿主体过小，未接入产品。最新完整图及九宽证据已复验，独立只读复评无P0/P1/P2；字体／间距／颜色／图片质量与内容五面均核对。P3仅为未来经用户反馈微调装饰取景，不影响当前任务。详情和后台／权限保持；不是完整无障碍认证或生产发布证明。

final result: passed

# P007背景连续延展 · 2026-11-19

本轮视觉依据为用户要求背景向左延展，优先于第三版旧左右分区。比较wide-background/before-after.png（修改前／后均1440×650、DPR1），另看完整after-1440及1024／1025边界、手机截图。源背景由原图向左扩展，不拉伸人物；字号、正文、入口与Hero高度保持。左侧硬边消失、标题与介绍可读，无P0/P1/P2。独立只读复核通过；Chrome十宽、原生200%及当前IAB均有证，用户视觉及生产另验。证据：docs/testing/evidence/p007-redesign-2026-11-19/wide-background/。

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

## P007第三版视觉验收 · 2026-11-19

source visual truth：`/Users/mac/.codex/generated_images/01a1e765-0f63-7be2-a0bd-9de7b0eed6e6/exec-9554b471-cbc0-4476-b567-bace1b15d70d.png`（1159×1358）。实际：`docs/testing/evidence/p007-redesign-2026-11-19/after-1159.png`，1159 CSS px、DPR1，比较其首1358px；无密度拉伸。完整对照：`design-comparison-final.png`，另看768／320聚焦区域及`after-preview.png`。状态：默认静态截图，实际按钮、键盘、减少动态效果另外实测。

五面检查：中文系统字体按门户角色（桌面正文18／手机16），现有蓝紫色、左文右人物主视觉、证据重点区与右侧两行、参与方式顺序均保持选定方向。背景支持和示意／暂停控件为既有必要信息补充，原公共header未重做。素材约179KB，高分辨率，无可读虚构身份／研究数据。

历史P2：768px文案叠图；提高上下排断点至1024后，十宽及相邻断点截图无叠图。间距比较后收紧桌面Hero与区块留白；正文不使用透明渐隐，避免短时降低对比。最终无P0/P1/P2；P3为生成图局部与装饰光线差异。未把审核限制、素材性质或AI责任因母版省略而删除。

真实Chrome／IAB路径、暂停与Enter续播、reduced-motion及原生200%已验。0 pageerror；匿名身份GET预期401及构建大chunk告警完整登记，非“全零”。用户视觉签收与生产另计。

final result: passed

完整证据：`docs/testing/p007-researcher-initiative-2026-11-19.md`。
