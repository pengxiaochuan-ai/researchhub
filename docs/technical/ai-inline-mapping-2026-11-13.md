# 一般研究表格 · 原位字段对应契约

2026-11-14装配核验：共享协调解除后实测最终指纹顺序已加载，本会话重载0。原两账号真实CSV/XLSX各一份暂存/预检，actual mapping_required选择及带mappingHash请求已执行；已提交答卷按原生规则拒绝覆盖，GET/刷新保留选择，原成功回执可回查。新增持久上传/预检各2，业务对象/计划/模型0。原生新目标成功写入仅真实PG回滚证明，不能写成共享页面已新增正式答卷；详见[当前证据](../testing/ai-inline-mapping-2026-11-13.md)。

日期：2026-11-13。[实施范围](../planning/qiyan-ai-file-data-2026-11-12/inline-mapping-implementation.md)。仅原AI01预检区域，无新表/依赖、模型调用或角色变更；不扩大原合成scope。代码已实现，目标装配/真实请求状态见[验收记录](../testing/ai-inline-mapping-2026-11-13.md)。

## 复用及响应

沿POST `/sessions/:id/research-data-imports`，不新增入口或全局API。明确映射继续原planned响应；一般表格存在数据列歧义/缺少必填对应时，先读取当前原件、固定表单和visit.import授权，返回state=mapping_required、confirmationReady=false。该响应不创建导入计划/审计、被试、访视或答卷；原key回执found=false不是已写入。

mapping描述为hub-data-mapping-choice.v1，含hash、mode、automatic、columns、fields、requiredKeys。automatic使用原fileId/sheet/column/targetKey；columns包含原列名/位置及合法targetKeys；fields只返回当前可读固定表单的key/label/type/unit/required，不返回其他Study/账号内容。字段候选按精确key→规范key→唯一标签，与自动规则同源，不通过score等泛词推断临床含义。同一工作表多个源列竞争同一目标时移出automatic，由用户明确保留一列；不同工作表独立覆盖必填。

## 选择及确认

用户只选择未决数据列或“不导入此列”。核对沿原POST增加mapping及mappingHash；hash固定原previewHash、真实Study、FormHash、方案/政策和当前permissionRef及完整描述。后端重读当前源/固定表单，拒绝过期指纹(DATA_IMPORT_MAPPING_CHANGED)、漏自动绑定、伪造列/字段、多重源/目标及未覆盖必填。显式映射不再先运行会抛歧义的自动匹配；原单位和值检查仍执行。

指纹必须在按当前字段匹配/解码值之前核对；字段删除或kg→m时先返回MAPPING_CHANGED，不能误作普通字段/单位错误。malformed mapping（null条目/空条目等）在输入层400拒绝。确定的UNIT_REQUIRED/INVALID_ROWS/MAPPING_REQUIRED保留可编辑选择标记，核对状态及刷新GET都能恢复；未知请求仍锁定原key。403/404立即关闭选择区。仅同名目标的转换及确认摘要携带targetDisambiguator，普通字段旧投影不增加该属性。

通过后复用原compileImportConfirmation，将实际mapping固定到原快照；原确认仍事务内重验当前权限/源SHA/目标父对象/版本及确定性换算，原生CRF/审计/回执/幂等保持。客户端字段选择不是业务授权，无法开放其他Study或新对象。

身份/访视/研究绑定结构错误、直接身份列、公式、重复表头等本片保持原拒绝；不以原位选择清除其processing issues。异维度、单位缺失、NA/非法数值、已有正式录入及无权对象不因选好字段而放行。旧legacy预检/已有确认快照不升级或重算规则版本。

## 状态与恢复

前端严格绑定identity/session/preflight id+version。mapping响应及用户选择保存在该账号/会话的sessionStorage标记，不含原始数据行或凭证；每次刷新先真实GET目标/当前状态，当前授权可用才恢复未提交选择，不自动重放POST。切账号/会话/来源屏蔽旧状态和迟到响应。

核对字段只是准备，原确认导入才写业务对象。未知准备请求保留原key、mappingHash与选择，先GET原回执；没有找到才允许明确重试同次请求。失败保留输入；目标指纹变化提供“重新核对字段”，重新取得描述后再选，不强迫重传原件。已提交答卷及旧账本不因重核字段修改。

## UI范围

仅原ResearchDataImport内增加按需fieldset/列选择/核对字段，沿共享Button及现有select；正常明确表格不新增选择。说明/列名14/22，原生select保留平台行高与至少36px高度，小屏44px；同名目标按label+key+unit区分，唯一标签不额外暴露内部key。原Shell/三栏、上传、关联Study及确认位置保持；不把组件验证当全站移动验收。
