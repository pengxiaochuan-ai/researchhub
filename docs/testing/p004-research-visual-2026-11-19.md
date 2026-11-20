# P004注册页左侧科研视觉 · 验证记录 2026-11-19

## 范围与实现

仅P004左侧参考P003，复用LoginResearchVisual，不创建新视觉组件或素材。科研循环透明图、原标题介绍、蓝紫柔光、节点／轨道动效和reduced-motion保持一致；注册真实／未配置分支均选择该组件，P005保持原story。CSS仅更新作用域注释，没有改表单或全局样式。右侧AccountAccess及原注册／验证／审核路径不变，后台、管理端和权限无增量。

## 目标与验证

代码已实现→19501加载→真实匿名Chrome执行→研发观察符合统一视觉目标；用户视觉和生产部署另验。历史IAB截图停留P003，未注销其会话；该观察不足以确定固定跳转规则。本次门户委托验收已用两已批准身份实际确认P004→P01，其他合法加入状态按本人加入状态页办理。匿名视觉另在独立Chrome实测，不能将IAB的登录截图冒充注册页。

- 15项现有login-research-visual（SSR及两注册分支）、account-session、registration-admission与auth-entry-route测试通过；旧测试标题及选择范围随共享组件用途同步。
- 构建退出0，5.19s，既有大chunk提示保留；git diff --check通过。独立只读源码复核无必修项。
- 15项真实浏览器检查：1920／1440／1024／901／768／390／320完整图文与表单无横向溢出；1440下右侧文字、input类型／名称／必填／长度／autocomplete、全部链接和地址与修改前JSON逐项完全相同。
- 空邮箱校验及下一帧焦点正常，不发请求；减少动态效果时7个轨道／节点animationName均none；阻断图片时有真实加载失败提示，表单保持，解除后刷新恢复。
- 受控合成验证链接仅验证两字段展示与hash清除，未提交／创建账号；P003保留同一视觉，P005原文字网络保持。未配置环境的分支仅源码／SSR范围验证，未另起未配置运行环境。
- 原生Chrome200%：innerWidth720／scrollWidth720、DPR2、scale1、正文16px；不是仅缩视口。实看1440首屏与390手机截图。
- 0 pageerror／注册POST／账号写入／邮件发送／模型调用。匿名auth/me预期401不算业务失败。

初验脚本将错误全文定位到两处、且立即检查尚未到下一帧的焦点，先失败；修正选择器并等待焦点后完整复验通过，没有修改注册组件。原failure.json保留供核对，最终结果为result.json。

## 证据

目录docs/testing/evidence/p004-research-visual-2026-11-19/：before-form.json、before-1440.png、七宽registration-*、registration-preview／mobile-preview、reduced-motion／image-failure、native200.json／png、result.json、signed-in-redirect-iab.png、video/／native-video/与tests／build／browser／native日志。统一用户步骤在《用户验证与操作手册》P004专项。

11-19门户整体验收已纠正“固定跳P003”的历史解释，原截图保留；以[整体验收](portal-delivery-acceptance-2026-11-19.md)与统一手册当前步骤为准，未修改注册逻辑。
