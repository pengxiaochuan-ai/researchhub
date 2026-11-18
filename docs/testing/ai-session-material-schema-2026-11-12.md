# 岐研AI材料关联DDL · 测试与独立评审

当前状态覆盖：以下为首次DDL历史证据。本轮继续指令后，限定应用DML与原Agent file.read v2已真实启用，原无权负例改为按声明访问profile验证，并新增真实应用角色正向/跨scope负例；未放宽结构/租户隔离。P02上传与恢复另见[当前记录](ai-session-material-upload-2026-11-12.md)，不再等待重复授权。

2026-11-12，仅新增表授权，不是上传/AI交付或生产验收。[结构和迁移](../technical/ai-session-material-schema-2026-11-12.md) · [授权剩余项](../planning/qiyan-ai-file-data-2026-11-12/authorization-slice1.md)。

## 真实PostgreSQL与RED→GREEN

新测试先因迁移未实现3项失败，`schema-red.log`。随后发现Prisma不能反序列化advisory-lock void返回、assert错误参数和回收站夹具缺原有必填事实，分别按真实错误修正，没有削弱旧约束。25项定向最终通过，`schema-review-green.log`。

覆盖：精确合成目标、空结构/兼容重入、旧依赖缺列/缺键拒绝、本人真实scope/session、管理员不代读owner、缺账号context、research_data禁用、初始ready拒绝、请求唯一、scope不可改、版本递增、真实原件hash/创建人/任务父链、未审核draft可ready、warning/回收/错误hash拒绝、已移除不复活、旧清理兼容、原文变更后失效、RLS漂移/无回执拒绝。新增应用身份负向测试确认未GRANT时42501，不把superuser当普通身份验证RLS。

PG用例仅本轮随机具名合成会话/库/doc/source/import，整事务抛专用回滚标记；实际确认测试namespace不存在遗留会话/库。持久关联表0行，不运行会扫描或重建历史任务的通配套件。

## 唯一独立只读评审与作者处理

评审`file_data_design_review`：Critical 0、Important 3、Minor 0；原结论需修补，没有第二次独立复签。

1. RESTRICT引用阻止原K01删除空库/历史导入：真实回滚测试先以23503失败；改为历史逻辑引用＋新绑定父锁校验，原库及会话删除通过，历史快照不抹掉。
2. 原文编辑后固定版本校验阻止失效/移除：测试先报MATERIAL_READY_INVALID；仅减权过渡允许保留原快照，所有scope/owner/版本与来源不可替换仍生效，GREEN。
3. 迁移未检查旧依赖：测试先因guard缺失失败；补必要列/类型/可空/PK/唯一/级联结构核验及hash，真实依赖通过、删列/缺键输入拒绝。

作者一次修补RED→GREEN：`schema-review-red.log`的相关4子项失败（含父用例共5失败），随后25/25定向通过；完整组合534/534通过，见`schema-reviewed-suite.log`。此后另补应用无权负例，最终命令及数量见下节，不覆盖旧日志。

评审未判断三项：①应用正向RLS待具体GRANT；②当时尚未持久建表，后由作者真实执行/重入记录补证；③上传/AI后续尚未实现。作者判定均不算该能力通过，也不以“超出本片”隐藏依赖。

## 构建、浏览器与未通过项

隔离临时outDir构建6.09秒通过，`schema-build.log`；原大于500kB chunk告警保留，不覆盖运行dist。

真实Chrome1440×900，原owner/admin的AI01/K01截图与WebM在`baseline-1794491032996/`，main查看owner-AI01/admin-K01实际截图；页面异常0、14/22输入、智能搜索默认OFF、上传仍禁用。K01旧自动POST `/api/sessions/knowledge`每账号一次，被只读测试拦住，故baseline结果false/partial（2次拦截，0业务写/上传/模型），不是新表造成也不扩修。没有窄屏/200%或新上传验收声明。

全部证据位于`.tmp/ai-file-data-2026-11-12/`，不上传私密runtime/密码/凭据到Notion。首段持久DDL后权限检查42501与后续OID核验分别保留，见技术文档；当前仅schema子项完成，仍等具体应用表权限及file.read配置授权。

## 最终验证命令

```sh
node --test tests/*.test.mjs server/ai-agent/session-material-contract.test.mjs server/ai-agent/session-material-schema.test.mjs server/ai-agent/session-material-schema-pg.test.mjs server/ai-agent/network-intent.test.mjs scripts/ai-file-material-readiness.test.mjs
```

最终535/535通过、0跳过，输出记`schema-final-suite.log`（含26项DDL/PG检查）。原全量运行的Vite测试WebSocket端口占用告警仍保留。实际上传、工具执行、模型费用、科研专业与完整页面任务链本轮均未发生，不将新表存在或测试绿色当作完整四层交付。
