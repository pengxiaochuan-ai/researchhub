# A02 Q05 附件与受控Markdown导出

2026-11-13｜仅原两合成账号、具名新资产/四新文件，专用合成库。本阶段技术退出通过；Q06副本/B、Q07 AI、Q08整页独评及专业/生产签收仍未完成。

## 四层证据

| 层次 | 实测事实 |
| --- | --- |
| 代码 | 固定版附件元数据/字节完整性、HEAD/Range、按用途当前授权、开流后交付前重验/取消、固定版Markdown及原操作重试；不启动旧ExportJob |
| 本机启用 | 四具名TXT/MD在既有本机存储与research_artifact_file绑定各自新资产v1；owned约束追加升级及用途参数消歧已应用。owned重载2次，最终PID51348、19501～19507七服务ready |
| 真实执行 | 两角色Chrome实际4附件/2Markdown，文件保存后逐份核对字节/hash/名称；首次实际200回包替换503后沿原key重试，不增第二事件。HTTP真实HEAD/206/416、错版404、缺标记/跨源403和异Range同key409 |
| 阶段结果 | 四新文件、8次授权事件（4附件GET、2导出、1Range、1真实退出前获准但未交付）；不能把8次授权说成8次成功保存。原七Tab/500px右栏/9px间距及字体保持，整页业务/专业签收仍待后续 |

## 数据与保护

新族10资产/31固定版，总事件53→65：4次附件绑定＋8次文件/Markdown授权。四评论/九评论事实不变；owner/admin方案revision19/18，两数据集各5。旧只读10/20、A01 10/15/39及四文件/暂存manifest、F03、两账号authVersion5/角色和public保护摘要保持。没有新模型/费用/Study B/副本/目标草稿/旧系统源码改动。

本机重载40891→49996，HEAD修补后49996→51348；不改local-knowledge/full-study源码及其数据。九条历史方法running和155历史queued按既有ID/时间保留，当前新在途0。首次after调用误覆盖pre-runtime样本，运行日志保留；脚本已区分--after输出，runtime.json明确这一证据限制，不重造旧样本。

## 真实失败与修补

1. 首次真实库脚本的requestKey带文件扩展名句点，被严格格式拒绝；修测试键，外事务全部回滚，无持久夹具。装配调用遗漏lazy渲染/range函数造成两单测失败，补正确依赖，未改旧模块。
2. HEAD实际400：框架GET自动处理HEAD先于显式Head装饰器，代码误要求GET操作key。真实HTTP失败＋回归单测RED后，在传输入口按req.method判HEAD；实际HEAD200且无body/新增授权事件。不是修改旧Range解析器。
3. **用途隔离缺陷**：owned detail_actor_can_use函数的purpose参数与access_request.purpose列同名。自由目的为read_body且仅批准正文时，原SQL误把其他用途判断为真；普通自由目的又错误拒绝合法export。真实PG先保存“canExport true而应false”的RED；追加独立owned迁移用$3引用形参，原D02等已执行SQL/hash不改。随后真实PG验证正文不授download/export、完整许可可导出、已授权后实际撤销grant再做交付前检查，正确403且未交付流关闭。全在外事务回滚，新持久许可0，未改任何角色或旧系统代码。

## 测试与录屏

证据：`docs/planning/research-assets-product-2026-11-12/evidence/a02-q05/`。

- `pg.json`：真实app角色四文件绑定回滚、HEAD/206/416、hash篡改/跨版、实际旧Markdown水印和稳定重放；新持久文件0。之后的`files-fixtures.json`才是已批准四新文件的真实落库。
- `purposes-pg.json`：真实许可表按用途隔离和交付前实际撤销，外事务全回滚。原purpose-shadow-red及诊断失败完整保留。
- `browser.json`：双账号6份实际浏览器下载、7次HTTP（中断后同key重试），6个授权事件，JS错误0；`http.json`追加1个真实Range授权，其余拒绝/HEAD/重放不增事件。
- `readonly.json`：附件列表真实503仅清该区并重读；持有服务器实际200文件响应后真实退出，客户端下载事件0、私有区清空；新增1条authorized审计不能称交付成功。测得500px/9px/无横溢，实际稳定截图已查看。
- `backend-closure.log`：`node --test scripts/*assets*.test.mjs` 165/165；`frontend-final.log`：`node --test tests/*.test.mjs` 688/688；`build-final.log`隔离构建9.92秒。构建现有>500kB包体提示保留，不扩大到全局拆包。
- owner/admin主视频11.40/9.48秒，故障/退出6.80秒；1910×1075视口、1910×1074编码，三段全量解码通过。

## 接口与读取语义

GET `/:id/versions/:version/files`只返回当前正文权下的真实附件。固定版无文件返回真实空数组，不借别版文件；旧目录族明确不支持新文件能力。GET/HEAD `/:id/versions/:version/files/:fileId/content`；GET/HEAD `/:id/versions/:version/markdown`。GET必须原requestKey、固定actor/authVersion、asset-catalog-v1自定义标记；来源Origin如存在须本机同源，Sec-Fetch-Site如存在必须same-origin，跨源/无标记拒绝，不放宽原POST防护。HEAD只读不增asset事件。

下载需当前read_body+download，导出需read_body+export，拥有者/当前tenant_admin仍走真实父链/源版/hash/状态/额度。GET按actor、固定绑定、用途和Range计算原请求摘要；同键同输入沿原授权，不同Range409；当前授权丢失时不因旧回执继续交付。事件为file_accessed/markdown_exported且phase=authorized，只表示获准读取，不保证网络/操作系统已保存；UI收到并校验完整Blob后提示查看浏览器下载记录。

## 复用与迁移决定

复用旧StorageService的put/getBuffer及文件检查、旧parseKnowledgeSourceRange（Hub层把非法/越界映射416），旧renderResearchArtifact('markdown',…)。文件≤1MiB，先完整校验hash，再用标准Readable内存流和独立当前授权检查交付，避免完整性核验后再打开对象存储出现字节变化；不重复实现文件库或Worker。导出时间固定为原版本时间，包含原正文/固定资产版本/原始来源/许可/未经审核水印，重试字节稳定。没有DOCX/PDF或自动应用。

首次Q05扩展源hash54a43a…64d3f2、fingerprint e549ec…5e853→f27ebc…4b21f；用途参数修正源hash14946f…d9daa0、f27ebc…4b21f→ef11e7cadaea5e0ac8620dca7221e611e8b826b34ff64ffa2ad07e774435e290。各完整hash见schema-apply/purpose-guard-apply日志；旧SQL/回执不重写、public定义/角色不改。
