# P005找回密码左侧视觉 · 验证记录 2026-11-19

## 范围与结果

用户确认统一P005左侧，三账号入口直接复用LoginResearchVisual，删除旧左侧文字网络JSX。只更新PublicPages两处视觉及CSS注释、既有视觉测试范围；右侧LoginSession、AccountAccess及演示表单、找回／重置逻辑、路由与后端权限保持。管理员和研究者没有新增操作或数据影响。

代码已实现→19501加载→真实匿名Chrome及当前IAB执行→研发观察三页视觉一致；用户视觉和生产另验。未配置分支只验证共享组件／源码，没有另起未配置环境。

## 验证

- 15项login-research-visual（SSR与入口范围）、account-session、registration-admission及auth-entry-route检查通过；构建退出0，5.57s，既有大chunk提示保留。独立复核无必修项，git diff --check通过。
- 15项浏览器检查，七宽1920／1440／1024／901／768／390／320无横向溢出；1440下右侧文字、字段类型／名称／必填／长度／autocomplete和所有链接地址与修改前JSON完全相同。
- 空邮箱校验与下一帧焦点正常，不发请求；减少动态效果下轨道和六节点animationName为none；阻断图片显示刷新提示，表单保持，解除后刷新恢复。
- 合成reset链接只测试新密码字段展示和hash清除，没有提交密码或重置账号；P003／P004同一视觉保持。当前IAB实际显示找回页与科研循环图，未改用户会话。
- 原生Chrome200%为innerWidth720／scrollWidth720、DPR2、scale1、正文16px，不是仅调视口。实看桌面1440截图。
- 0 pageerror／账号业务POST／找回邮件／密码修改／模型调用。相关请求被监测，未以视觉检查触发账号业务。

## 证据

目录docs/testing/evidence/p005-research-visual-2026-11-19/：before-form.json、before-1440.png、七宽registration-*（复用脚本名，实际内容为P005）、reset-preview.png、reduced-motion／image-failure、native200.json／png、result.json、video/及native-video/、tests／build／browser／native日志。用户步骤维护在《用户验证与操作手册》P005专项。
