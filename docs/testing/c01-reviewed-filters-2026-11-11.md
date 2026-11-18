# C01三个筛选 · 本机验证

2026-11-11。[规格](../product/c01-reviewed-filters-2026-11-11.md)。当前目录串行实施＋独立只读总评，仅专用合成环境。

## 结果与边界

原研究类型、疾病、干预方式select已启用，只从当前公开完整列表读取选项；研究类型/干预必须摘要已审核，疾病复用书目公开原值。不从标题/药物推分类，不合并不同原文；三个筛选精确AND，任一组干预满足即匹配，再与原题名/注册号/疾病/来源关键词AND。原五select和重置不新增控件，其他状态仍禁用。

当前真实数据1研究类型、2疾病、6干预原文；匿名/owner/admin列表/选项完全一致。重置清关键词及三条件；成功重读只保留仍有效选择，身份核验/失败禁用，实际身份改变清条件，同账号刷新不清。详情返回/整页重载沿原默认初始状态，不新增跨页或持久筛选。

没有后端业务改动、数据/审核/角色/Schema写入，AI片段逐字不变，68条原queued逐行保全；未重启任何服务。0模型调用/新增费用、无云/远端配置或发布。

## 自动与实际验证

| 项目 | 实际结果 |
| --- | --- |
| TDD | 纯函数/组件从缺模块/导出RED到GREEN；新增4逻辑＋2组件，聚焦含旧行2共8。验证原文精确/多组/去重/AND/关键词范围/无结果/空值/旧或未审核数据、刷新选择及同账号/身份变化合同 |
| 完整前端 | 347/347，串行tests/*.test.mjs，无跳过 |
| 相关后端/真PG/真HTTP | 13/13，复用当前审核/源头/哈希/版本/租户隔离门禁；不宣称全部旧后端测试 |
| 三身份与保全 | c01-reviewed-filters-check.mjs verify通过：实际列表/选项/组合匹配、源/版本/提取/审核/授权聚合哈希、原AI和68queued保持。保全复用上轮只读快照导出，原CLI受main guard，旧baseline未改 |
| 构建 | pnpm run build最终成功4.01s，原>500k chunk警告保留；没有lint/typecheck脚本，不宣称已运行 |
| 科研人员浏览器 | 类型2→加疾病1→冲突干预0→兼容三条件1→关键词冲突0→重置2；选第二疾病/干预后原“刷新会话”保留值和1条，进入同ID C03核对、原返回 |
| 管理员浏览器 | 三兼容条件1→同ID C03→返回默认列表；冲突0→重置2，窄屏组合及Tab类型→疾病正常 |
| 布局/字号 | 1421×1419默认工具栏及标签几何最大差0.07px，原12列序和原字号/横滚保持。三个select锁定原约65px宽，完整原文选项/title不省造分类；select仍原12px，表格正文14/22，未暗调全局字体 |
| 响应式 | 实际1045×1194、389×1260主内容无横向溢出；窄屏原布局换行和宽表原横滚保持，未声称320px/200%实测 |
| 控制台 | 留存开发HMR重复createRoot警告，最终完整重新加载0新增warn/error；一次未串行聚焦Vite端口警告留存，最终串行完整回归干净通过 |

## 独立评审及一次修正

c01_filters_review只读指定文件，亲跑新增6测试通过，未写DB/API/文件。无Critical/Important，1 Minor为无结果提示仍“请调整搜索词”。主实施按本轮恢复验收修为“请调整筛选条件或搜索词，或点击重置。”，先真实浏览器确认新提示不可见RED，再同场景新提示可见GREEN，最终347前端及构建重跑；没有独立二次复审声明。

Set-aside的其他状态/地图/趋势/权限/API/审核模型及其他会话dirty均不扩改。撤审后条件清理由纯函数和已有PG合同证明，没有为验收实际撤回来源；未做网络故障/未知身份浏览器注入，不以正常成功掩盖未实测项。本机技术交接与用户专业体验/生产发布分开。

## 证据索引

目录`docs/testing/evidence/c01-reviewed-filters-2026-11-11/`。

- logic/controls/identity-red.log、logic.log、focused.log、focused-final.log：RED及8聚焦；初次非串行警告保留。
- frontend-final.log、backend.log、build-final.log：347/13/最终构建。
- before-api.json、api-verification.json、http-final.log：原68任务、源/审核/AI和三身份真实保全。
- before-layout.json、after-default-layout.json、before.png、after-default.png、layout-verification.json：原工具栏差异量化。
- owner-cases.json、owner-empty.txt/png、owner-filtered.png：全部科研人员条件/恢复/同账号刷新。
- recovery-copy-red/green.json、owner-empty-final.png：评审文案修补实证。
- admin-filtered.json/png、admin-recovery.json、admin-c03.txt：管理员及同篇详情。
- narrow-layout.json/png、medium-layout.json/png：实际有效视口、原控件/列序及字体。
- final-owner.png/txt、console-all.json、console-fresh.json：最终入口与警告区分。

下一项建议：核对C01原日期列的来源更新时间，与注册日期明确区分后再补齐；本轮不自动实施。
