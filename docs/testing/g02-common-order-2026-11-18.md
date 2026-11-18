# G02常用管理上移：局部布局验证

2026-11-18。用户已明确批准仅改总览模块顺序与间距，原路径、权限及业务保持。对应[living spec](../product/g02-action-overview-2026-11-11.md)。

当前：已在明确窗口完成两文件局部调整，本机热更新生效；26项定向单元/集成、两角色真实Chrome五宽、原入口逐项往返和键盘顺序通过，构建5.22秒。原生200%真实Chrome缩放、DOM/字号/命中/边界及原始surface截图均通过，原截图片段保留为证据采集历史。主服务未重载、业务写入0，未变角色/账号/Study/内容/后台；普通登录发生在WF10新before冻结前，按共享窗口交接。

验证不执行审批、结算、发布、保存或生成任务；模块内入口仅导航和读取。沿现有纯契约/集成测试，真实Playwright截图/录屏及构建分别留证，最终用户视觉判断待本人反馈。窗口释放前不PG/HTTP/Chrome，不保存会引发共享Vite刷新的页面文件。

## 实际差异与结果

- 原common section整段从“需关注”后移到“待处理事项”前，只增加局部class；移除新旧common行后，其余JSX字节完全一致。权限判断、href、hooks/handlers不变。
- CSS只有common作用域3条及移动端padding1条：桌面标题/按钮同排，窄屏自然换行，保原横向对齐、44px点击区、14/22及焦点样式。未改变全局Shell、导航或其他卡片。
- 1440×900管理员入口y1122→273，区高118→78；科研账号入口y813→273、区高同样118→78。admin原5入口、owner原1入口前后逐项text/href一致，没有新增可见权限。
- 两角色1440/1366/1920/390/320均无根/入口文字横向溢出，原main/hero/context几何相同；原折叠规则保持。每个可见入口实际点击并返回，最后入口Tab后进入“所属模块”，DOM/视觉顺序一致。
- `before.json`、`after.json`、PNG和WebM在`evidence/g02-common-order-2026-11-18/`；实际非auth写请求0、pageerror0。26项回归见本轮offline日志；初评/具体差异只读评审均无待修发现。

## 原生200%截图边界

真实Chrome设置为2倍，innerWidth720、devicePixelRatio2、visualViewport.scale1，非仅改视口。DOM保留全部原5入口且边界/44px命中通过；Playwright截图按CSS尺寸却被原生Chrome按DIP处理，导致fullPage/视口PNG裁切。原始`after-native200-fullpage-initial.png`与`after-native200.png`保留，不能单靠它们证明完整入口区视觉。随后已直接按浏览器原生surface/DIP补证：`native200-capture.json`及`native200-surface.png`/`native200-dip.png`，原始1440×913截图含全部5入口，已打开核对，未改页面或伪造图像。该补证只有一次admin原登录及GET，无业务写入；根WF10新before捕获前已关闭独立profile并明确归还窗口。
