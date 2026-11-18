# C01隐藏招募状态 · 本机验证

2026-11-11。[一期规则](../product/c01-phase1-no-recruitment-2026-11-11.md)。仅当前C01精简，未开发或关联内部课题招募，不改C03/旧服务/权限/后端/源数据。

## 结果

- 招募筛选与列表列移除，原12→11列；3可用筛选＋1禁用研究状态，日期/来源/原详情路径及原字号保持。原提示不再提招募开发进度。
- 显式演示列表、字段设置及页头承诺同样移除；评审漏项修补后，C01演示地图只显示研究机构，不含招募模式/点/图例/指标/明细列/新增招募卡。共享MapView默认不变，原样例与数据库均不删。
- 单元TDD初始3项RED→GREEN，地图反例再RED→GREEN；聚焦24通过，最终完整前端366/366（含当前共享目录其他新增测试，不全归本轮），相关真实PG/HTTP6/6，build4.36s。原>500k chunk警告保留；没有lint/typecheck脚本，不称已运行。
- 原源/版本/提取/审核/授权聚合hash、原AI片段、92原queued逐行保全，公开实际API仍两条，不写源/审核/角色，无模型调用/费用/重启/云/远端配置或发布。

## 实际浏览器

科研人员默认2→疾病1→冲突干预0→重置2→注册号搜索1→同ID C03→原返回。管理员同页11列/4控件且无招募状态。窄屏实际389×1260，main无外溢，正文14/22；Tab从干预跳过禁用研究状态到重置，无隐藏招募焦点。显式演示从P003原“进入演示模式”新临时页验证，字段设置10个可选列无招募、总11列；地图无招募文字/模式/标记，只余地区明细。演示标识保留，临时页已关闭；最终恢复owner真实C01。

1421×1419前后工具栏外框完全一致。删控件后搜索框沿原flex自然变宽，表格1618.53→1556.53px，减62px；不把有意精简称为原12列不变，不改CSS/字体/主区域。最终完整重载0新增warn/error。恢复账号首次等待owner标题时实际仍admin，未推断认证产品错误或修权限；重新按可见退出→登录→owner标题确认后恢复成功，保留此测试恢复事实。

## 独立评审、修补与保留项

一次只读独立总评：无Critical；演示地图招募入口1 Important，作者核对属C01可达同功能入口，以scoped showRecruitment=false修补，新增SSR反例先失败再通过，实际演示地图核验及最终366/build重跑。无独立二次复评声明。

原演示字段设置隐藏其他列后空态固定colSpan的问题为既有Minor，保留待该功能后续处理；本次只把默认12减11，不扩展自定义列逻辑。C03/内部招募、其他dirty、专业验收、生产均搁置且不销项。320px、原生200%、故障注入/撤权浏览器及录屏未测（当前浏览器仅截图/视口能力）；PG反例回滚，不真实撤回任何来源。

证据目录docs/testing/evidence/c01-no-recruitment-2026-11-11/：red.log/focused.log/map-red.log/map-green.log、frontend-final.log/backend.log/build-final.log；before-api.json/preservation.json；before.json/after.json及PNG；owner-cases.json/admin.json/narrow.json及PNG；demo-verification.json/demo-map.png；final-owner.json/png、console-fresh.json。

建议下一项：确认C01保存检索/导出的首期取舍，继续减少不可用入口；不自动隐藏或新增实现。
