# H01两项次要结局纳入 · V2本机验证

确认及实施起点：2026-11-10；收口：2026-11-11（Asia/Shanghai）。[规格与小步计划](../product/h01-publication-secondary-outcomes-2026-11-10.md) · [当前逐篇依据](../product/h01-publication-intake-2026-11-10.md)。证据目录：`docs/testing/evidence/h01-publication-secondary-outcomes-2026-11-10/`。

## 结果与范围

仅将PMC13550960、PMC13637160从pending改为include，补充用户确认依据及理由；顶层规则升至`RH-PAPER-BROAD-2026-11-10-V2`。全部13项的记录ID、原文版本、SHA256、DOI、题名、类型和逐字证据均未改变。V1原清单保存为`manifest-v1.json`，V1实测目录保留，不覆写。

实际接口：11篇纳入、0项待核验、2篇本口径不纳入；类型为review3、human_clinical1、animal_mechanism2、systematic_review1、case_report2、bibliometric1、protocol1。病例/方案不当作疗效确证或已完成临床试验。E01仍13条获准来源，原展示/AI许可、审核状态及全局scope_version草稿不变。背景提及、未知新来源和冲突不自动纳入。

## 测试证据

- `red.log`：新增当前清单测试先失败9!=11。仅清单最小改动后`unit.log`4/4通过。
- `targeted-final.log`：12/12纯身份/组件/真实PG通过。含两项纳入、病例/方案类型、原pending2文案保留、0待核验无旧说明；两项各自摘要缺失或合法新版本时降至10篇/待核验1项。公开撤回、私有、hash/版本变化及标识/容量守门保持。PG全部在强制回滚封装内。
- 初次`targeted.log`中新增夹具的`test-invalid-version`被既有CHECK约束拒绝；按数据库格式修为PMCID+.2后通过。未修改/删除数据库约束，原失败保留。
- `frontend.log`：全前端311/311通过。上一轮文章问答输入框失败是当时结果，保留原证据；本轮同目录该测试已通过，本轮未修改该模块，不把其变化归功于本次清单改动。
- `backend.log`：29/29相关Hub、目录、分类筛选及真实PG通过。`http.log`：3/3真实接口通过，匿名/owner/admin同口径，未知Hub仍404。
- `build.log`：构建成功4.94s，既有大于500kB chunk警告保留，不冒称无警告。项目无独立lint/typecheck脚本，本轮未新增或虚报。

## 本机环境与保全

仅`wp01_test_full_baseline`专用合成库及owned本机独立服务。重载前`before-runtime.json`确认20条排队任务均queued、无执行中任务/owner/lease、无在途导入；未取消/排空/认领。只重载本机owned服务，未触碰旧服务或云端。

`api.log`及`api-verification.json`：三身份五项为2/11/3/3/3，论文规则V2、0待核验、2不纳入，E01来源13；原20条queued记录的状态/时间/租约、全部PMC原文/审核指纹及原3团队档案/草稿指纹均未变化。业务写0（除既有账号签发/退出认证会话），模型调用/新增费用0，无新角色/权限/Schema、远端配置访问或真实发布。

## 真实浏览器与UI/UE

CUA内Playwright使用现有IAB页面及真实本机接口。owner、匿名、admin分别实际看到11篇和“按已确认领域规则纳入”，均有PNG；已恢复owner并保留H01供体验。原导航进E01显示“已加载13/13篇论文”，再返回H01，不修改来源或筛选。

- 原五卡DOM/CSS/交互未改，仅既有数据及无待核验说明分支生效。1421×1419桌面对照`before-layout.json`、`owner-layout.json`的五卡x/y/width/height最大差0；数字28px，说明14px。
- 手机实际389×1260：五卡及说明scrollWidth=clientWidth、说明14px；根宽390对视口389的既有1px差未扩修。临时viewport已重置。不冒称本轮测过320px或原生200%。
- `console.json`当前warn/error0；本轮未追加网络503/超时/乱序响应故障注入，相关既有纯组件空/未知/失败/0契约保持，不将其混称浏览器故障验收。
- 无新建/编辑/表单/审批等交互，键盘模态、写入冲突测试不适用。本轮不等于全站无障碍、专业疗效验证、管理员逐篇签认或生产发布。

回归观察：H01下方领域动态的旧论文来源目录显示0，而E01当前13条；统计卡11篇正确，前后基线均有该旧目录现象。本轮不改此模块，登记为下一项建议，避免把统计接线扩为页面改造。

## 独立总评与文档

既有独立评审代理只读核对V1/V2全部字段，确认仅指定两项和规则顶层变更，无剩余阻断；独立pure身份/组件8/8通过。未代签真实PG/HTTP/浏览器或用户专业验收。评审结论见`review.md`。

产品基线、变更/版本/使用说明、H0与H01规格、API/前端架构及逐篇清单已同步当前V2，V1历史保留；Notion同步以本轮`notion-sync.json`的实际写入回执为准。
