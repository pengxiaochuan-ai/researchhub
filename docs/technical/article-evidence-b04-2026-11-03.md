# B04 固定单篇证据包与提交契约

状态：B04本机后端免费技术阶段完成；依据已批准[规格第5–7节](../product/bilingual-article-ai-spec-2026-11-02.md)。仅合成环境，无付费调用/新权限/表/旧内核修改，未启用B05页面入口。真实执行证据与边界见[记录](../testing/article-evidence-b04-2026-11-03.md)。

## 范围与来源

服务端生成ArticleBinding四字段及规范化contextKey（UTF-8≤768字节），只接受当前获准PMC。直接按recordId取得当前AI投影；不按问题全Hub检索。摘要、正文、表格文字最多6片/每片1200/合计6000字符；使用原存储字段的归一化文本offset与实际length定位。能从保存JATS安全解析并精确对应正文的段落才标注结构锚点，否则明确字段offset降级，不编造页码。图像/附件只登记缺件，不作为模型输入。

包保存binding、当前各字段审核版本、题名/DOI/原始链接、coverage/omissions、片段及packHash；hash覆盖实际文字、顺序和定位。旧hubSources仍为同一文章一项，单独保留兼容旧1200窗口的来源快照。当前验证逐片重建并比较完整确定性包，非首片变更也拒绝。

coverage.sections记录本次实际选中段落的methods/results/discussion原章节名，无精确定位填null并登记not-located；有定位但限额未选则not-selected，不把“未定位”说成“原文绝对没有”。覆盖/缺件与真实locator一并进入旧Agent工具结果及包哈希，不只写在provenance中。

## 接口与恢复

- `GET /api/hub-sources/article-context/:recordId`：当前Agent/Study授权，返回binding、coverage和existingSessionId/latestTask；可选requestKey精确查本人同绑定任务，不创建对象。
- `POST /api/sessions/hub-source`：只增可选articleBinding，服务端重验后创建/复用本人Study固定版本会话；普通Hub调用不变。
- 原knowledge-messages新article分支：明确发送时封存包到job.payload，原requestKey保持；同会话原事务锁内最多1在途，竞争请求回滚其消息并返回在途任务，不增加预留。key输入不符409。
- 原knowledge-state：articleContext和最多20个job摘要（requestKey/inputHash），助手历史按完整包当前验证后交付；失效遮蔽，不交付旧正文/来源。
- 原knowledge-sources：article分支验证完整pack后交付该文章全部本次片段；不是仅验首个来源。

## 执行与提交

入队时封存；执行从持久Session/context和job.payload恢复，绑定/包/当前授权相符才进入旧科研Agent只读工具槽。工具、Provider前后、最终提交和历史读取均重验。最终提交复用原来源锁，锁内验证完整包后才INSERT助手；不更改原权限/科学数值/计费守门，不自动网络/重试/换篇。

所有错误沿现有`{code,message}`，无权不回显内容；读接口no-store。article状态最多20个本人任务含requestKey/inputHash；历史交付同时核对其completed任务、payload完整包和唯一hubSources，撤回后清除meta内来源/原文。真实HTTP新增单篇付费明确返回403/ARTICLE_PAID_NOT_APPROVED，待B07目的限定费用门禁，不因其他模块续价自动解锁。免费替身不代签实际Provider及专业结果。

接口需携带原X-Study-Group-Id/X-Research-Project-Id和同源认证；不接受客户端正文/tenant/contextKey。证据包policyVersion为rh-article-evidence-v1，packHash覆盖builder规定顺序的JSON（含全部文字/定位/元数据/缺件）；JSONB往返后按当前原件重建，比较键序无关的完整对象，数组顺序仍须一致。兼容旧来源snippetHash独立按原窗口生成，新片段按实际长度封存，不放宽旧验证器。
