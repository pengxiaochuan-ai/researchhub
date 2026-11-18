# WF05 只读待访视合同

`GET /api/research-studies/:id/due-visits`：只允许limit与cursor。limit字符串1..100，默认5；cursor是最大2048字符base64url严格JSON，字段为schema=1、actor、authVersion（非负整数，0合法）、tenant、studyId、day（YYYY-MM-DD）、timeZone=Asia/Shanghai、afterId。无未知字段；每次当前native authorize返回DB actor后比较。跨day返回409 `DUE_VISIT_DAY_CHANGED`；非法/错scope/身份/版本400，失权按原native401/403，不制造空结果。

响应200：`{studyId,day,timeZone:'Asia/Shanghai',items,nextCursor}`；每项只含canonical visitId、Subject id及假名subjectId、Enrollment/Protocol/VisitPlan必要标识与访视名称/代码、原status/scheduleState、targetDate/windowStart/windowEnd和只读attention标签。不能返回姓名/人口学/答案、临床分数、文件内容或未授权范围。today时间边界来自同一注入clock的北京时间日界[start,end)，不相信浏览器日期或可编辑query。

筛选：全部实体exact tenant/group/project；SubjectVisit/Subject/Enrollment/Protocol具该字段者要求acceptanceFixture=false，VisitPlan无该字段，仅以精确scope和固定protocol父链核验，Subject未删除；Enrollment状态enrolled/grouped/in_progress，Visit状态planned/due_soon/overdue/in_progress/deviation，scheduleState=scheduled；Visit的Enrollment/Plan/Protocol与Subject父链必须一致。只收in_progress或windowStart<end；windowStart为空才允许targetDate<end。无日期不从其他字段填补。窗口已结束仍未完成者属于逾期待访视；即使窗口为未来日期，已有in_progress事实仍保留为实际进行中。标签不写回原status。终止/撤回、完成/取消、pending_anchor和明天及以后才开始者排除。

查询先完整筛选再orderBy id asc、take limit+1，nextCursor用本页最后实际ID；不对旧core.list的局部页客户端过滤。读取最小投影，不为卡片复用逐表单/文件的昂贵完整访视投影。父链不一致时明确拒绝，不展示其他版本标题。原S09GET再核完整权限/用途/当前版本，点击列表链接无任何POST。

原controller仅注册新GET分派与native read授权依赖；旧visits/participation/报告接口不动。所有读取在原withResearchStudyTransaction及授权锁内；不新增DDL、RLS、权限、worker、业务状态、receipt或审计行。服务测试必须证明无写模型方法被调用。

日期语义裁定：按北京时间日历日，不按当前钟点。今天23:00开始的窗口在今天10:00读取时仍列为今日安排，不得标作已开始；明天开始者不列。Protocol允许executing和合法superseded，逐行核自己的固定父链，不绑定S01当前执行方案。

客户端实测精简：首请求limit=5，明确查看更多limit=20；服务端合法范围1..100、cursor绑定/先筛分页完全不变。每次客户端按当次请求上限核结果长度；跨日回到limit=5的今天第一页，不带旧cursor。
