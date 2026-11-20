# 账号三页导航与门户对齐 · 验证记录 2026-11-19

## 范围与实现

用户要求P003／P004／P005导航文字颜色与位置和P002一致。新增AccountPortalHeader及局部CSS，只在PublicLayout账号三页选择；P002、帮助、学术发起、资料页旧header及工作区Shell保持。新增科研全流程／适用人群对应P002锚点，匹配五导航和独立登录／免费注册按钮；普通深色#071342、hover／focus蓝#0956ff，16px／550；账号页不伪高亮平台介绍，登录／注册入口按本页aria-current标记。

菜单支持原生按钮、aria-controls／expanded、Esc返回焦点、外点关闭、导航收起及断点状态清理。表单和后端／认证／审核／重置逻辑未改，管理员无新增权限。

## 四层结果

已实现→19501加载→真实Chrome及当前IAB执行→研发观察三页与P002布局、颜色和任务路径符合目标；用户视觉与生产另验。独立源码复核未发现必修项。

- 36项现有视觉SSR、account-session、registration-admission、auth-entry-route及auth-session测试通过；构建退出0，6.04s，保留既有大chunk提示。git diff --check通过。
- 35项真实界面检查：三页在1920／1440／1024／901／768／390／320，共21组；对照P002品牌和五项导航x／y／宽／高，在测量精度内一致。桌面104px／手机90px，菜单和账号按钮位置相同；普通色与hover色均检查，无横向溢出。
- 1440下注册／找回右侧文字、字段属性及全部链接与先前基线JSON相同。当前登录卡片及认证测试不变。
- 七个真实目标实际点击：P002 home／process／audience、P007、P008、P003、P004，URL与预期一致；没有业务提交。
- 手机菜单7条可见链接，Esc关闭并回焦点、外点关闭、桌面再回手机收起、实际导航通过。P007／P008／P006继续用旧公共header。
- 原生Chrome200%：innerWidth720／scrollWidth720、DPR2、scale1、header90px，菜单可展开、正文16px。不是仅调视口。当前IAB实看找回页五导航及两个按钮；桌面及手机打开菜单截图实看。
- 0 pageerror／业务POST／邮件／密码修改／模型调用，认证匿名401按预期保留。

初验在连续resize后立即检查菜单收起失败；用MediaQueryListEvent.matches事件快照替代读取可能已变化的当前断点，并让验收等待实际收起状态，完整复验35项通过。failure.json保留，最终结果result.json；原生200%检查不涉及该断点切换，结果仍适用。

## 证据

目录docs/testing/evidence/account-navigation-2026-11-19/：before.json／portal-detail.json与原同视口截图、after.json／三页七宽PNG、mobile-open.png、navigation-preview.png／navigation-header.png、after-iab.png、native200.json／png、result.json、video/／native-video/与tests／build／browser／native日志。统一用户步骤在《用户验证与操作手册》账号三页导航专项。
