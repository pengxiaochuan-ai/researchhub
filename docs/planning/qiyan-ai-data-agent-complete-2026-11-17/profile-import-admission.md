## 2026-11-17 用户已批准 D01/U01/S01/W01/F01，当前串行实施中

准确清单和上限均已获用户批准。P1–P5桌面本机合成首闭环已实际执行及独立复评：2会话、2被试、2上传/预检、1确认计划、1次成功导入、1file/task、2Profile、10笔业务审计，未超原上限，0模型调用。表权限及只读parser patch已应用；本机独立服务已加载。用户本人待回看，390/200%既有布局限制单列，不标全页体验通过。[最终证据](../../testing/qiyan-subject-profile-import-2026-11-17.md)。以下“待确认/未应用”为原申请历史。

# Excel档案首闭环 · 准确增量清单

2026-11-17。用户已要求实施“普通新会话→Excel被试档案确认导入→处理结果回看”。[业务规格](../../product/qiyan-ai-subject-profile-import-2026-11-17.md)及[准确DDL](../../../server/ai-agent/subject-profile-import-schema.sql)供评审；本单不重复申请已批准的raw执行器或管理员权限规则。

## D01：1张Hub表及本表最小DML

在现有rh_ai schema新增subject_profile_imports，只有本轮确认快照/状态/回执/审计关联；唯一请求键、CAS、不可变身份与快照、来源当前预检/文件版本、真实目标父链和native权限、真实complete档案任务/文件/Profile回执约束、强制RLS。程序账号aisci_app仅本表SELECT/INSERT/UPDATE；不授DELETE，不给PUBLIC，不改旧表、角色或其他GRANT。新增guard trigger函数仅由本表触发器执行，PUBLIC EXECUTE撤销。

新表原由：旧imports固定为编号/CRF并关联旧grant与协议/表单；扩模式会波及旧schema验收。旧原生messages、knowledge-state会返回完整Message.meta，不能存目标档案快照而只在新UI投影，来源会话未失权而目标失权时会泄漏。新隔离表是当前总影响面较小的选择，不是虚构“技术上只能建表”。

记录中不保存原始姓名/identityMap，仅固定所选表、识别记录序号与假名目标；提交从同SHA字节临时构建native映射。结果逐字段比真实Profile，不以complete假通过；所有读接口保持来源＋目标双重当前授权，新表RLS不是授权替代品。

## U01：原区域局部适配

仅在原AI01预检/通用确认位置，对确定性识别为档案的XLSX显示研究、工作表、假名映射和本次字段→“确认导入档案”→结果/原S03链接。保持Shell、消息、输入、上传按钮、文件列表及普通CRF分支布局；只在多研究/多表/歧义时补选，不露内部hash或请求键，不加独立向导或新页签。保持原key恢复与未知状态冻结。

## S01：旧档案解析器只读接口提取

仅`app/server/src/ingest/subject-profile-import.ts`及对应测试：把现有读取工作簿/表头/身份列/字段列的原代码提成公开只读`inspectSubjectProfileWorkbook`，原importSubjectProfileWorkbook也调用它。算法、别名、数值/布尔转换和写入不变；Hub预览据此复用相同识别规则，不复制一套字段正则或假装有未实现Skill。准确[拟议patch](profile-workbook-inspection.proposed.patch)及[source checkpoint](profile-workbook-source-checkpoint.json)未应用；不改旧Ingest事务接口或其他旧源码。

## W01：精确执行范围

新Hub档案服务手工构造本租户raw执行器，复用已批准executeClaimed，只执行本次确认产生的一个新任务。全局deployment scope/原Worker默认启停不改；不注册Nest生命周期，不bootstrap/kick轮询/recover。Ingest.kick使用无扫描调度器。原件在事务外真实存储读取验SHA后，仅以已验证字节作本地只读缓存，原生解析/确认与回执在同一受限PG事务原子提交。任何旧重复任务或版本/权限变化拒绝，不覆盖旧记录。

## F01：具名合成验收上限

仅专用合成库、原owner/admin、当前Study。最多2个新普通会话、2个admin新假名被试、4份新XLSX暂存/预检、4份新确认计划，以及1次成功确认（最多1个新ModalityFile/ProcessingTask、2份SubjectProfile）及相应原生ProcessingStatus，业务审计累计最多24笔（不含正常登录/会话续期）。源字节由程序合成，留作本机体验；历史对象只读。重复、歧义、缺绑定、坏文件、源/权限/版本失效及失败回滚先以纯测试/单事务回滚验证，不堆持久失败数据；admin正向，owner按当前native权限拒绝，不补角色或旧grant。

## 继续自动推进的范围

批准上述准确增量后，完成DDL/RLS回滚测试→服务/原子确认/结果回读→原区域接线→具名真实上传与浏览器→独立总评/集中修补→用户验证与操作手册及Notion。当前目录串行，不改旧科学算法、不调用模型、无费用/云资源/远端配置/正式发布；本机服务重载与共享端口在现有协调窗口内执行，不切换旧服务。遇到超清单变化再讨论。

状态：待D01/U01/S01/W01/F01准确增量确认。已写SQL及原生只读接口patch供审阅，**尚未执行DDL/GRANT、修改该旧解析器或创建具名对象，未启用新接口**；确认前继续免费纯契约、适配和只读核对。
