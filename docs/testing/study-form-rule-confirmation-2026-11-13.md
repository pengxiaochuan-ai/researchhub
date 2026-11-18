# 表5项目操作规则v1：确认后复验

日期：2026-11-13。用户直接回复“采用上述首版规则（建议）”，已确认舌脉类别由临床评定者选择、双脉同有待复核、不适用/无法判断/漏答分开且不补0。本次仅规则确认与固定配置复核，不改变原表赋分或创建真实研究绑定。

## 配置与历史保全

canonical版本：`fang-2023-table5-5e34d90ff887-source-v1-project-policy-v1`，状态confirmed，reviewedBy为project-user-confirmation，reviewedAt为2026-11-13T09:18:47.000Z（本次回复记录时间）。原12项、阈值、组合、14字段和采集渠道不变；父进程逐字段核对仅versionTag、status、reviewedBy、reviewedAt四字段变化。

- 新profile原文件SHA256：2a00b9a139fa5db210e47fa4f483217a2337d18e80a7913e9198fbfa9d9654ca。
- pending原件归档SHA256：031bb15099b50fcebc7321091acdc55b9985bc24376bf4bdbba827d6626402ea；旧专用验收脚本固定读取该归档，保留旧参数及已存证据，不覆盖数据库历史。
- 规则确认记录：docs/planning/study-form-electronic-scoring-2026-11-13/rule-confirmation-v1.json。确认来源没有冒称具体PI账号或论文/团标原文给出了这些操作细则。

## 本轮验证

1. 配置定向RED为2通过/7预期失败；修改后9/9通过，含显式pending克隆仍不产生完整分、已确认canonical的24分、不适用、未知、漏答和双脉分支。合并相关回归66/66通过，不把重叠数量累加。
2. `study-form-rule-confirmation.mjs --prepare/--backend-ready`在guard校验的本机合成库中用正常管理员/API新建独立Study，原样保存已批准canonical snapshot、schema/scoring和审计。1被试1答卷3修订：完整24分且组合符合→N/A total/diagnosis=null、complete=true/scoreComplete=false→双脉review_required且无总分。三份固定历史HTTP读取与PG原哈希重算通过。
3. `study-form-rule-browser.mjs --local-synthetic`在真实19501/Chrome只读核对上述三份固定修订，原题名、有/无、N/A、总分/组合与复核原因正确，PNG/WebM保留；没有重复填写或更改历史。
4. 正常API只读检索当前租户全部36条课题元数据（nextCursor=null），均带合成标识，未找到可确认的正式题名绑定。范围仅当前本机租户，不声称其他环境也没有课题；actualStudyBinding继续null。

证据：`docs/testing/evidence/study-form-rule-confirmation-2026-11-13/`下的rule-http-result.json、browser/result.json、visible-project-metadata.json及config/。没有服务重启、共享入口/前端/算法改动、患者读取、邮件、模型、DDL或权限变化；此前PHQ9/移动/原生200%证据保留，不将旧测试结果改写成当前时点执行。

## 四层状态

代码/配置已实现；19501实际使用的新固定版已在独立合成Study保存；实际HTTP/PG/Chrome执行有证。用户的三项操作规则确认已取得；实际课题组、PI、真实Study绑定/启用和整体业务签认仍未完成。项目规则定版不等于整个方案或所有核心表单已定版；五主症及其他原有未决项没有被此次确认覆盖。
