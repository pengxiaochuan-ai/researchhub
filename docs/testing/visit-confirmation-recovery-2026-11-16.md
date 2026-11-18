# 访视确认中断与结果反馈修复验证

2026-11-16。**本机代码、19501装配及真实合成执行已验证，用户专业体验待核。** 本轮仅修复双角色走查的UX01，不包含长页定位、角色提示和课题状态展示。一次独立代码审查未发现本轮剩余P0/P1/P2；不宣称临床/生产验收。

## 修复后的操作

| 场景 | 现在如何反馈 | 操作人下一步 |
|---|---|---|
| 已有状态读取尚未结束 | 原确认框保留，显示“正在核对当前状态，尚未执行本次操作”；确认暂不可用，取消/Esc可用 | 等待当前读取结束，在同一弹窗确认；无需关闭重开 |
| 当前读取失败，尚未发送 | 显示“本次尚未执行，输入仍保留”，并保留原因 | 在原弹窗“重新核对当前状态”；核对后在原弹窗确认 |
| 已发出请求，结果尚未确认 | 原确认框保留；显示结果尚未确认，不把未知写成未执行 | 先核对当前状态，再“核对本次操作结果”；只查原键回执；查无回执仍未知 |
| 写入及当前状态均已核实 | 关闭确认框，提交成功后继续下一表或进入审阅清单；完访显示完成 | 按当前主要动作继续；刷新不重放 |

执行中确认和取消均禁用，重复点击不产生第二次POST。只有显式查过原结果、原内容仍保留且当前权限允许时，才提供“以原内容重试”，仍使用原requestKey和原内容。更正、单项审核/锁定及重新核对完成依据复用同一保护；本地放弃输入仍用原确认。

## 已证实的原因与最小修复

quiet读取占用reader但busy仍false，用户可确认；send随后拒绝而零POST，读取成功又抹掉错误。另两处原确认先关闭再异步写，完访遇verified失效后blocked早退，零POST却失去确认上下文。

现在hook显式返回checking，稳定holdConfirmation只暂停新quiet读；既有在途读和显式核对保持。原站内确认等待真实结果，不先关闭；身份、authVersion或页面范围变化拒绝旧意图。纯访视动作显式assignmentId:null，避免在末表详情完访后误匹配为另一项操作。提交成功的衔接信号绑定身份/授权版本/Study/访视/表单，等待当前状态核对完成后再消费；不能用pending渲染的旧闭包吞掉继续动作。

实际走查中的底层连接断开原因尚未定位。本轮修复的是确认/反馈/恢复语义，不冒称根治网络。原服务端权限、独立审阅、固定版本/来源、CAS、原生回执及逐项审计保持；原题/计分、H5/CSV、Shell/卡片/按钮位置不改。

## 测试与真实执行

| 项目 | 本轮结果与证据 |
|---|---|
| 实际hook测试 | 13项，先RED 8失败/5通过，再全部GREEN；包括在途读取、保持/释放、未执行反馈、身份/authVersion、双击、丢响应、已保存回读失败、409、404未知；hook-red.log / hook-green.log |
| 实际组件/衔接测试 | 18项GREEN，原完访未决/verified失效时提前关闭已先RED；dialog-red.log / dialog-green.log |
| 前端完整测试目录 | 最终887项：886通过、0失败、1既有420.47MiB大文件opt-in专项跳过；frontend-all-final.log。13/18项包含其中，不重复相加 |
| 后端相关原契约 | 访视/表单/批审路由30项通过；backend-related.log。后端源码未改；不能将该纯测冒称PG执行 |
| 构建 | pnpm build通过，4.71秒；build-final.log。原有大于500kB chunk提醒保留 |
| 19501真实浏览器+PG | 原两账号、新合成subject的BASELINE，41字段按原表填写，三表一次独立审锁，再独立完访并刷新；8项主链/恢复核验通过，16张新PNG及4份WebM文件留证（含上下文初始页） |
| 独立代码审查 | 4生产文件＋旧快照＋31项定向独立实跑通过；无剩余P0/P1/P2，见[independent-review/review.md](evidence/visit-confirmation-recovery-2026-11-16/independent-review/review.md) |

广域首跑未配置媒体测试默认19613，34项因连接拒绝失败，原frontend-all-first.log保留。改用现有19501同源隔离夹具并串行重跑后达到上述最终结果，没有修改媒体模块或测试断言掩盖失败。隔离夹具只在内存运行，不把它当成访视真实业务证据。

### 实际故障与结果

- 扣住真实GET 200后打开确认：在途状态可见，Esc不写且原输入/触发点焦点保持；重开后同一确认框等待读取完成。确认打开时两次focus不新起quiet读。
- 扣住首表真实提交200的浏览器响应：执行中确认/取消禁用，鼠标重复点击确认位置仍仅1次POST。
- 将第二表的真实GET 200在浏览器端断开：原弹窗保留，显示尚未执行；输入保留，0提交；弹窗内只读核对后确认成功。
- 第三表提交200后丢弃浏览器响应：服务端已提交、答案一致；在原弹窗按原键GET找回并正常进入集中审阅，恢复阶段0新POST。
- 审阅者逐份手选三表，一次确认审阅锁定；批审不会自动完成访视。完访200后丢弃浏览器响应，同样按原键GET找回并刷新保持完成，0第二次完访。

这些是显式受控的浏览器传输故障，真实server200证明见submit-busy-server-accepted.json、submit-unknown-server-accepted.json、complete-unknown-server-accepted.json；没有伪造成功响应。3条预期ERR_CONNECTION_RESET单列，非预期console错误、pageerror、意外原生弹窗及越界写入均0。原生PG审计验证提交/审核通过/锁定各3条、study_visit_complete与researchhub.visit.complete各1条，提交人与审阅人为不同账号。

本轮共22个按钮/探测动作，包含刻意制造故障后的只读恢复、一次取消重开和重复点击探测；不将其当正常流程点击基线或耗时节省百分比。必要填题与专业阅读仍由人完成。

## 范围与原记录保护

仅原合成Study新增一名SYNTHETIC-rh-confirm-1f451ac6-UX01受试者、三条参与事实、一次入组和派生访视；只对新BASELINE采集/审阅/完访，另一派生访视未开展。没有新增账号、组、角色、Study、DDL/grant、外发邮件、模型调用或生产部署。科研人员与管理员复用同一页面与后端能力，未增加治理页入口。

原8个已存在BASELINE及其答卷在前后API完整哈希一致；更早已获用户核对通过的316完整统计行、审计/修订/快照/文件及Word保护比较通过。运行前后6个产品源文件哈希保持（其中本轮4个修改、2个共享依赖未改），没有提交/重置共享工作区他人增量。

本次只验证1440与390下相关确认及结果。新弹窗内容、错误和恢复动作可见；既有390 Shell拥挤仍可见，未扩大改版。未新测原生200%或完整屏幕阅读器；上一轮长页定位与角色提示UX02–05继续留项。

## 可核对产物

- [真实浏览器结果、网络与8项核验](evidence/visit-confirmation-recovery-2026-11-16/browser/result.json)
- [PG原生审计](evidence/visit-confirmation-recovery-2026-11-16/browser/native-proof.json) · [最终答案与访视](evidence/visit-confirmation-recovery-2026-11-16/browser/final-captures.json)
- [旧8基线：前](evidence/visit-confirmation-recovery-2026-11-16/browser/existing-before.json) / [后](evidence/visit-confirmation-recovery-2026-11-16/browser/existing-after.json)
- [原研究保护：前](evidence/visit-capture-review-flow-2026-11-16/preservation/before-confirmation-ui-990c8500.json) / [后](evidence/visit-capture-review-flow-2026-11-16/preservation/after-confirmation-ui-7a24dc28.json)
- [截图与录屏索引](evidence/visit-confirmation-recovery-2026-11-16/gallery.md)

四层状态：代码已实现；19501已加载；新合成案例真实执行已验证；用户专业体验待核，临床和生产另行验收。
