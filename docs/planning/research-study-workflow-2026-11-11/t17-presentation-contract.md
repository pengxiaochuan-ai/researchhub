# T17 固定报告专业可读性增量契约

范围：仅新建 formal-analysis-report-v1 报告；不改既有报告记录、统计计算、Worker、UI、权限、数据库结构或运行进程。原三参数模板及无 presentation 的历史报告仍逐字重建原正文、contentBlocks、两项来源和摘要。

新建报告在 contentBlocks[0].presentation 及 data_snapshot 来源 snapshot.presentation 封存 `formal-report-presentation-v1`。变量集合与已批准、经 assertCurrent 重算的 manifest.variables 完全相同；每项含 key、formVersionId、fieldKey、label、valueType、unit、formDefinitionHash。标签、类型、单位只能从该作用域内固定已发布/锁定 FormVersion.schema 按现行 normalizeFormSchema 导出。schema/scoring 的 canonicalManifestHash 必须与每条 manifest cell.source.formDefinitionHash 相同；字段、类型和单位映射不一致拒绝。单位未声明保留 null，不推断单位。

新报告当前读取/审核/发布/导出：先执行现有当前权限、同意、计划、质量及来源重验；在 Run/Artifact/Job 锁之前从可信固定表单重导展示封套；随后按该可信封套重建并比较完整正文、封套、两项来源及摘要。封套存在但未知/非法不得降级旧模板；来源或封套被篡改应拒绝。历史无封套不增加该派生要求。

新正文主表仅名称、指标及原始统计结果；数值与不可估计值直接复制已确认 Run 输出，不重新计算、不四舍五入。变量 key/field/formVersion/schemaHash、每条固定 JSON 路径、Run、算子版本、快照及依据摘要完整放入附录。重复标签允许，通过附录保留别名映射。标签中的 `< > |`、反引号和 `&` 使用受控实体安全显示，Word 单次解码保留其原义，不静默删去阈值符号。

仅 analysis_report 且首个 formal_analysis block 带合法新 presentation 标记时启用新的 DOCX 固定模板分支。将受控 Markdown 的两列表格变为真正 Word 表格；文本和数值只逐项复制，固定 JSON 路径不删除。使用现有标题、页眉、页脚和 docx 库；A4 11906×16838 DXA，边距 1440，表格总宽/列宽/单元格宽一致为 9026 DXA，明确中文字体。其他产物和无标记旧报告保留原 renderer。

验证先 RED：旧模板 golden（正文/来源/摘要）不变；新别名、中文标签、明确/缺失单位、非法/篡改封套、固定 schema 摘要；DOCX ZIP XML 的真实表格、A4/DXA 与原值/附录路径。再做真实 aisci_app 保护 PG（全新合成回滚作用域）及 MinIO put/读回/DOCX 渲染回归、完整 tsc。不得借单元或合成 Run 契约测试宣称真实 Methods/Worker 或主三例业务验收；目标 HTTP、浏览器和最终专业图像验收由主流程接续。
