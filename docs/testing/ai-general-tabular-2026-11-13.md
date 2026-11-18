## 2026-11-13 · 一般表格带单位真实写入完成（本机）

前序免费预检后，用户批准的独立具名增量已实际完成：双账号各一次页面确认，4份固定CRF及4revision，确定单位换算/0/false/来源和失败恢复均已证实。旧4例、角色/grant及原152预留保持，0Provider。[本轮完整证据](ai-general-unit-write-2026-11-13.md)。下方仅预检/待正式写入为原阶段事实，未删除或改写。

# 一般研究表格映射与质控 · 本机验证

2026-11-13。仅本轮[规格](../planning/qiyan-ai-file-data-2026-11-12/p06-general-tabular-implementation.md)及[契约](../technical/ai-general-tabular-2026-11-13.md)，不恢复历史延期项目。新规则已装载本机PID75250；原两账号真实CSV/XLSX上传/预检、字段画像/单位/缺失/混合提示、刷新与隔离已验证。真实Study映射及原生校验在PG回滚中证明，未把新预检会话扩为可正式导入。模型0、无新表/权限/额度/正式导入/旧账本对账。仅本轮技术交接，用户专业效果与生产另行。

## 已取得证据

| 项目 | 证据 | 已观察结果 |
| --- | --- | --- |
| 规则RED→GREEN | .tmp/p06-tabular-rules-red.log、green.log | 原列名/单位、别名、唯一标签/歧义、同维度换算、缺/异单位、超精度、0/false/空值/NA |
| 原生解析与映射 | .tmp/p06-tabular-integration-red.log、green.log；backend-green.log | 新/legacy版本分离，CSV/XLSX同型转换，原值不改，非法值整批拒绝；包括前序契约不累加 |
| 真PG新规则 | .tmp/p06-tabular-current-pg.log | 双账号真实app事务暂存/预检/原目标/计划及恢复；当前Form标签→0/false规范化，具名新行全回滚，未提交被试/访视 |
| 真PG旧回归 | .tmp/p06-tabular-legacy-pg.log | 3项通过：原空GUC真实入口、固定队列选择、P05来源/CRF读取及恢复；全回滚/Provider0 |
| 前端 | .tmp/p06-tabular-ui-red.log、green.log；frontend.log | 9定向及当时648全量通过，保留单位和质控用户文案，不增加页面或确认步骤 |
| 构建 | .tmp/p06-tabular-build.log | 隔离输出p06-general-build，8.31秒通过，原有大包告警保留 |
| Chrome组件 | .tmp/ai-file-data-2026-11-12/p06-general-ui-1794567946159 | 实际确定性引擎生成受控组件输入，六宽1440/1280/1024/768/390/320、14/22、原值2500/false/NA、唯一确认按钮与PNG/WebM，无页异常；不是生产API或真实导入 |

上述表格保留评审前阶段证据；最终修补后56核心、4真实PG（新规则1＋旧回归3）、652当前前端通过，见`.tmp/p06-tabular-reviewed-core.log`、`reviewed-pg.log`、`reviewed-frontend.log`，不重复累加。最终隔离构建4.62秒，见`reviewed-build.log`；组件六宽最终证据`p06-general-ui-1794568287483`，原值/单位与唯一确认保持。

用户明确答复“可以安排重载，模拟验收已结束”后，强READ ONLY查到本租户Job只有completed/failed/原155 queued，没有running/processing/claimed；经owned stop/start保留数据装载PID75250，七服务健康。后续另一会话通知其已恢复V2采集、一条只读GET与重载重叠，将按原journal续读；此处保留该事实，不将瞬时无Job解释为所有Study操作已结束，也不称无任何请求受影响。之后不再重载或改共享入口。

## 唯一独立评审与集中修补

唯一`general_tabular_final_review`为0Critical/3Important/1Minor；作者一次集中修补，未二次独评。缺源单位不得补目标单位；“治疗后”等语境限定不能剥离成单位；新版本直接身份/重复表头/匹配统一NFKC；布尔外围空格trim但原值保留。具体反例见`p06-tabular-review-red.log`、`review-minor-red.log`及`reviewed-core.log`。评审误将staging.test当纯测试运行，其具名新Session/上传/预检/审计在单一真实app事务中以rollback Symbol结束，内存Map存储，未持久化/调模型/重载；保留披露，不隐去。

## 真实HTTP与Chrome

`p06-general-browser-1794568341549/result.json`：原owner/admin各新建一个具名私有会话，仅CSV/XLSX各一份、各3行与一个预检；实际响应固定`general-tabular.v1`，体重(g)为数值/已记录2/空1/零1，布尔false1，备注混合类型且NA原样。真实页面显示单位/类型/空值，刷新不重复POST；admin跨owner预检403/404，0页面异常/0越界请求/0Provider/0正式导入。原来源会话不变。较早截图可能仍在上传或核对中，不以它作为最终稳定展示，原对象只读回看见`readback/`截图和WebM。

新会话`research-data-import-targets`仍为空：现有许可明确限原P05来源会话/Study，本轮不扩权。不能把预检成功当作任意会话/任意Study正式导入能力。真正单位换算由确定性规则测试及相同原生校验契约证明；尚无获准、带目标单位的新正式CRF写入样例，不声称该层业务专业验收已完成。

新后端装载后再次运行原P06双账号只读HTTP/Chrome回归，证据见`p06-tabular-loaded-legacy-browser.log`及其result目录：原批次/0/false/固定来源保持，不新增模型；旧152笔预留指纹再次一致（`p06-tabular-original-ledger-final.log`），未处理未知旧用量。未删除任何新旧文件、任务或回执。

## 交接与限制

产品/使用/版本/专项文档及Notion同步本轮已取得和未取得证据。一般预检可自动识别，唯一明确标签可映射；未识别单位/列名歧义需核对原表或固定Form，不新增手动多步配置。不宣称未知列均已入库、任意数据算法或全Study质量工作台完成。窄屏沿既有AI工作区滚动，组件六宽可读性与实际页面截图分开；原AI工作区窄屏的历史列表/输入区占位没有在本轮擅自重排。用户专业效果签收、带单位实际正式写入样例及生产仍待后续确认。

最后的真实写入验证需要新的具名目标/最小对象授权，已列[可评审清单](../planning/qiyan-ai-file-data-2026-11-12/authorization-general-tabular-write.md)，未执行。不修改原无单位表单或自动扩大旧grant来绕过此边界；本轮整体不冒称该层业务闭环完成。
