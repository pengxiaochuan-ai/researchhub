# P007研究者共创版 · 本机验证 2026-11-19

用户选定第三版人物共创视觉。实现独立P007组件／作用域CSS及两张生成示意素材；PublicPages仅引入并替换旧Initiative，公共导航和其他页保持。

## 四层结果

1. 代码：研究者主视觉、三项参与价值、三类参与入口、背景／支持限制、动效停续与减少动态效果已实现。生成素材明确标识为示意，不代表真实专家团队。
2. 目标：19501现有Vite实际提供组件、样式及两张WebP，无新开关／服务／后端变更。
3. 执行：真实Chrome十宽、原生200%、当前IAB实际浏览和门户往返；无业务写入。
4. 结果：研发观察主视觉、内容与入口符合选定第三版方向，已修平板文案叠图；用户主观吸引力、满意度待反馈，生产未发布／未验。

## 检查与证据

- `shared-button`＋`auth-entry-route`既有单元16/16通过。实际组件SSR核对H1唯一、关键入口、暂停按钮及示意／授权／合作／AI说明通过；首次React18 fetchPriority警告已改为小写标准属性并复核。
- 最终构建退出0，5.75s；保留既有大chunk警告，不冒称全仓无告警。
- Chrome宽1920／1440／1159／1025／1024／901／900／768／390／320：两图片实际加载，无根和主要正文／入口横向越界，桌面正文18px／手机16px，五个入口均实际点击到现有目标。注册及登录只打开、不提交。
- 页内参与锚点、鼠标暂停／键盘Enter续播、主图视图外停止、reduced-motion静态化均通过。系统减少动态效果时不保留误导的播放按钮。转后台／隐藏由visibilitychange停动，未单独执行window blur测试。
- 原生Chrome200%：innerWidth720、scrollWidth720、DPR2、visualViewport.scale1；暂停及页内入口可用，截图和WebM留存。不是用窄视口冒充缩放。
- P003／P004／P008无P007节点，桌面公共main仍48px padding；P007规则不匹配其他公共页。管理员、科研人员沿同一公开页面；没有新增权限、管理操作或后台对象，不操作真实申请／内容发布。
- 当前IAB：P007暂停状态真实变化、学术活动入口实际显示当前可见活动；经P002主导航再次进入P007，两图均实际加载，根宽与scrollWidth同为1495。IAB截图记录的是桌面布局；最终间距细调以后Chrome截图为最终视觉。
- 0 pageerror、0业务POST。匿名现有身份核验`/api/auth/me`返回401，控制台保留对应网络提示，未称“控制台全零”。首轮脚本将这些预期401误计为失败；后续按实际响应URL核对只允许该端点401，其余异常仍阻断。全部响应保存在checks.json。

## 视觉审阅与修复

选定图1159×1358与实际1159 CSS px、DPR1的首1358px并排比较：`design-comparison-final.png`。另看完整页面、768及320图，核对五个面：字号、间距节奏、品牌色、素材质量、内容真实性。保留现有公共header，新增示意／动效控制及下部原背景／支持限制；这些为真实内容与现有规范所需，不以设计稿省略为由删除。

初次独立审阅发现P2：768px仍左右排导致标题孤行、导语叠照片。上下排断点先由760→900；独审发现901px仍有单字孤行，最终提高至1024，补1025／1024及901／900／768真实截图，十宽复验通过。另移除呈现动效的透明度变化，正文保持足对比；只保留轻微位移。主图与书本均为生成素材，共约179KB，不含实际团队或研究数据。

最终视觉无未解决P0／P1／P2；源图光线连线的装饰差异、生成画面局部差别属于P3，不影响文字、入口与研究场景。没有把人物图做成背景中的假专家介绍。

证据目录：`docs/testing/evidence/p007-redesign-2026-11-19/`，包含前后IAB、after-*、checks.json、failure.json（初轮失败保留）、native200.json／png、reduced-motion.png、route-*、video/及native-video/。构建日志`.tmp/p007-redesign-build.log`。

统一用户步骤见[用户验证与操作手册](../product/用户验证与操作手册.md#2026-11-19--p007学术发起第三版复验)。

## 2026-11-19 · 首屏背景连续性复验

用户要求背景向左横向延展。以原场景outpaint生成宽图2172×724、81152字节；桌面figure inset0覆盖全宽，object-fit:cover保持人物比例。picture在1024px及以下继续原图与上下排；标签换算坐标，文案、入口及Hero高度保持，无业务权限或后台改动。

真实组件SSR检查响应式源、尺寸、示意标识及已删除文案；Chrome十宽核对currentSrc及桌面scene left0且等于视口宽，五入口、暂停、reduced-motion均通过。0 pageerror与0业务写，匿名身份GET预期401保留。原生200%为720CSSpx、DPR2、scale1，无溢出；构建退出0，5.78s（既有大chunk告警保留）。当前IAB实载宽图，scene从原612.61px起变为left0且与Hero同宽约1494.20px。

同1440×650 CSSpx、DPR1的wide-background/before-after.png并排检查：竖直硬边消失，背景连续、文字可读、人物比例正常。独立只读复核1024／1025／1440截图未发现必须修问题，320／390仍使用原图。最新PNG、checks.json、native200及WebM位于wide-background/；IAB为wide-before-iab.png与wide-after-iab.png。研发视觉通过，用户主观反馈及生产另验。

## 2026-11-19 · 底部AI行移除复验

按用户反馈移除独立AI标识及整句，并清理桌面／移动专用CSS。实际组件SSR确认目标文案与占位不存在，原注册／登录／团队入口保持。当前IAB实载无该行；真实Chrome1440／320核对背景区bottom等于公共footer top，无额外占位或横向溢出，PNG／WebM及copy-removal-checks.json留证。构建退出0，耗时见本轮日志`.tmp/p007-copy-removal-build.log`。原AI行历史截图保留，最新截图为ai-copy-removed-iab.png与copy-removal-*。本轮未改公共页脚或其他页面。

## 2026-11-19 · 移除动效控件复验

用户明确去掉播放／暂停按钮。只删P007手动paused状态、图标／Button导入、notes控件及专用CSS；系统减少动态效果、页面可见性和IntersectionObserver自动启停保留。桌面Hero最小500px，移动端不保留原60px控件占位；正文、人物背景、导航、权限及后台无增量。

21项既有page-copy、login-research-visual、shared-button及auth-entry-route测试通过；构建退出0，6.21s，既有大chunk提示保留。13项真实界面检查通过：五宽1920／1440／1024／390／320无控件或专用区域，无横向溢出；普通动效实际running、滚动参与区后motion=off；系统reduce实际animationName=none，且无额外提示；main正文仅去掉旧按钮词语，原所有链接逐项相等；五原入口实际到正确路径。原生200%为720CSSpx／scrollWidth720、DPR2／scale1、正文16px；当前IAB实看无控件。独立源码复核无必修项，git diff --check通过，0 pageerror／业务POST／模型。

代码已实现→19501加载→真实浏览器执行→研发观察符合移除目标；用户视觉及生产另验。截图／录屏和result.json（13项）、native200.json／png、after-iab.png及四项日志在docs/testing/evidence/p007-remove-motion-control-2026-11-19/。旧暂停验证为历史记录，以本段与统一手册最新步骤为准。
