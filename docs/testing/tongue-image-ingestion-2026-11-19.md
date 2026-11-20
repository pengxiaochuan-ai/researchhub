# 舌图上传、归档与原访视回看验收

2026-11-19。范围严格来自本轮三步请求；[产品规格](../product/tongue-image-ingestion-2026-11-19.md)、[技术契约](../technical/tongue-image-ingestion-2026-11-19.md)。目标仅本机19501与wp01_test_full_baseline，通用合成图，不使用患者资料/模型/邮件/生产。用户已要求自主完整验收，本轮不再次请求签认或让用户代操作。

## 四层结果

| 层 | 实际证据与结果 |
| --- | --- |
| 代码 | 前端/客户端51项相关回归、后端19项契约、29项真实PG检查通过，无跳过。PNG/JPG/JPEG、伪格式/上限/完整解码、未知结果/重试/来源变更/权限和旧视频兼容均有正反例。 |
| 装配 | 独立评审后精确升级原2约束和原guard，只有本机合成库；19501重载后7服务ready。原182表数据不因重载改变，schema就绪明确核验。 |
| 真实请求 | Chrome在原S09进入AI，当前Study/受试者/访视自动核对带入；全新800×600 PNG与JPEG各一次上传、一次prepare、一次confirm。返回原访视查看原图与登记记录，刷新0重复写。原图下载SHA逐字节相同。 |
| 业务结果 | 两图均为本次访视的tongue/raw/needs_review，无算法任务/特征，S04也能回看；未授权owner的研究侧读404、本人会话侧读403，未登录401。已有视频仍可播放。符合本轮“能上传、核对归档、回原访视原图/记录”的操作结果；不代签真实临床或生产。 |

## UI/UE实测

保原Shell/上传/登记布局。实际1440×1000改前截图与改后同视口对照；320/390/1024/1366/1440/1920图卡自身无横溢出，原图naturalWidth/Height均800/600，登记按钮14/22。实际Chrome设置200%：CSS720×456、DPR2、scale1，额外CDP物理截图1440×912，登记按钮元素命中通过。原窄屏固定侧栏覆盖等Shell留项保持，本轮不是全站手机/无障碍验收。

实际组件7项和独立图片浏览器9项（8场景+父，含PNG/JPG/JPEG、25MiB/格式拒绝、原确认丢响应后只读恢复、失权/迟到、图片503清图并原src一键重试）通过；另40项媒体浏览器组覆盖旧视频及图片，均通过。上述组有重叠，不把计数相加为唯一用例总数。复制/删除/编辑历史原件、临床图像质量评定不适用本轮。

保留真实失败：旧浏览器脚本首轮误用历史默认19613，后显式19501；类型专属错误文案回归后保留视频原词、舌图按类型显示。新只读验收脚本第二尺寸仍找“查看原图”，实际原图已展开，改为识别展开态，未重复上传或改业务。隔离harness初始化检查对象和旧“回执”选择器错误均保留原日志，修正后重跑；无真实业务失败被伪装成功。

## 旧数据保护

182表中177表完整count/hash不变。仅新增本轮1个来源会话、2个媒体上传、2个登记、2个ModalityFile及本轮原审计；剔除确切新ID/本轮新增审计后，另5表旧行逐项count/hash也相同。Subject/档案/同意/访视/答卷/Feature/权限/Token/模型均保持。175历史模型任务仍原样，0活跃分析/模型租约/当前派发任务，不恢复旧队列。

## 证据索引

目录：`docs/testing/evidence/tongue-image-ingestion-2026-11-19/`。

- `before/`：六入口改前截图及合成对象；`schema-applied.json`：根实际升级与精确hash。
- `backend-delivery.json`、`backend-contract-tests.log`、`backend-pg-tests.log`：源码摘要、19/29检查，包含完整解码、直接SQL SAVEPOINT负例、当前授权/旧grant/视频及精确up/down；全部新PG写入ROLLBACK。
- `live/result.json`、PNG/JPEG截图与WebM：真实一次上传/确认、原图SHA与0重复/0算法。
- `readback/result.json`：15项实际只读/角色/尺寸检查；`readback/native200-physical.{json,png}`：真实200%与按钮命中；`readback/subject-original.png`、`legacy-video.png`。
- `before-restart.json`、`after-restart.json`、`after-acceptance.json`、`preservation-final.json`：重载及旧数据保全。
- `isolated-browser-*/`：组件隔离浏览器PNG/WebM，受控故障与真实请求分开记录；最终独评和汇总见本目录最终清单。

构建通过，保留现有大于500KiB bundle提示；`git diff --check`通过。没有提交/推送、生产发布或更改其他会话的业务。
