# 学术发起与帮助导航连贯 · 验证记录 2026-11-19

## 范围与实现

用户接受核对P007／P008导航，复用现有AccountPortalHeader，扩展P009帮助详情以保持索引→文章→返回路径一致。只新增三页导航选择、当前栏目语义和蓝色底线；不改main或后台。P007／P008为aria-current=page，P009帮助为location；账号导航没有误选普通栏目，P006／P010仍旧header，P002和工作区保持。

## 四层结果与验证

已实现→19501加载→真实Chrome／IAB执行→研发观察导航与任务连续；用户视觉和生产部署另验。独立源码复核无必修项。

- 26项现有help-content、login-research-visual、page-copy、auth-entry-route及shared-button测试通过；构建退出0，6.18s，既有大chunk提示保留，git diff --check通过。
- 39项真实浏览器检查：三页在1920／1440／1024／901／768／390／320共21组，与P002对照品牌、五导航、按钮／菜单x/y/宽高一致；普通深色与当前蓝色、16px／550正确，无横向溢出。
- 1440下P007／P008／报告文章main文字、链接及控件内容／属性与修改前JSON完全相同；源码未改任何业务表单或正文文件。
- 帮助检索Word→唯一文章→详情保留帮助location→返回26篇与page高亮实际通过。七个导航目标实际点击正确，手机开合／Esc回焦点／外点／跨断点和实际导航通过。
- P006／P010旧导航保持，P003／P004／P005共享导航回归无普通栏目误选。
- 原生Chrome200%：innerWidth720／scrollWidth720、DPR2、scale1、header90px、正文16px，菜单可展开；不是只调视口。实看P007／P008桌面及当前IAB，截图和录屏留存。
- 0 pageerror／业务POST／模型／邮件或密码变更，匿名身份401保持，不修改审批或研究资料。

初验外点测试点击了被展开菜单遮住的帮助标题，Playwright因真实遮挡停止；改点可见页边空白后完整通过，未为通过测试改产品。账号回归同时限定普通栏目选择器，避开合理标记的隐藏手机版账号入口。failure.json保留，最终result.json通过39项。

## 证据

目录docs/testing/evidence/public-navigation-2026-11-19/：before-main.json／三页前图、三页七宽PNG、p007-preview／p008-preview及header裁图、mobile-open、p007-iab／p008-iab、result.json、native200.json／png、video/／native-video/、tests／build／browser／native日志。几何母版来自同日account-navigation证据中的P002实测。用户步骤统一维护在《用户验证与操作手册》本专项。
