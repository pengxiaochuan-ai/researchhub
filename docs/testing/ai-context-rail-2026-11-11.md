# 岐研AI右栏精简 · 验证与交接

对应[用户确认规格](../product/ai-context-rail-2026-11-11.md)。仅AI01真实模式：去除常驻说明，按实际文章证据决定是否有右栏；没有重做Agent、权限、数据/计费或旧服务。

## 四层验收

1. **代码**：普通/未核验状态两栏；真实ready文章才加`workspace-with-context`及证据栏，paused/error/restricted/loading不构造旧文章内容。删除固定上下文说明、跨页“可用能力”及通用“参考范围”卡片，不移动来源到不可见处：普通检索引用/阅读范围仍跟随对应回答，文章保留标题、版本、原文回链、选取范围/遗漏与可展开原文。封存回答仍优先显示当时固定证据；无新研究选择器，不把技术scope冒充当前业务研究。
2. **目标环境**：本机既有PID62019运行时，19501–19507七服务ready；Vite实际提供新布局。不需重启或修改API/Worker，旧服务/临床库不动，不是生产发布。
3. **实际请求**：owner/admin各真实登录、读取本人历史及PMC13672493当前获准文章，普通→文章→展开证据→刷新→普通闭环。记录API写请求为0（登录除外），0模型请求或新增科研任务；没有改审核、文章、旧任务或账本。
4. **用户任务**：实际Chrome1440/1024/768/390/320宽度；普通聊天1440下宽893px，左栏248px不变，无空白第三列，长回答仍48rem上限。文章只有真实证据栏，原文可展开及回链；未缩小14/22操作字与16/28阅读字。受控延迟响应、同文档历史切换后释放迟到文章、来源403均不恢复旧栏。0 pageerror。已目视检查桌面普通/文章与320px证据截图；保留既有移动纵向堆叠，不冒称全站/原生200%或专业模型质量验收。

## 测试结果

- `tests/layout-restoration.test.mjs`与`tests/article-ai-ui.test.mjs`先RED（未核验仍有卡片、旧证据栏），最小修改后24/24 GREEN。原封存证据、原文定位、安全Markdown及自适应输入测试保留。
- 完整单元/真实合成PG/原Worker回归：`node --test --test-concurrency=1 tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`最终416/416，122.7秒，无跳过。默认并行首轮有旧Worker测试结束后的异步Prisma空响应，未通过；原Worker单独2/2通过，随后整套串行通过。无旧代码或测试harness修补，不抹去首轮日志。
- `scripts/ai-conversation-ui.test.mjs`与`ai-command-ui.test.mjs`16/16，46.8秒：发送/排队、Enter/IME、编辑软删、历史时间分组、首问标题、分页与滚动、迟到/撤权继续通过。
- `scripts/ai-context-rail-ui.test.mjs`三项：双账号真实五视口及文章核对；受控延迟/403。原全页返回与补充的同文档SPA迟到回归均通过；最终三项再整跑留记录。无自动消息提交。
- `npm run build`6.21秒通过，保留既有大包提示。独立只读评审跑24项SSR/布局并检查实际桌面/文章截图，未发现Critical/Important；最终总评结果与本轮主实施者日志共同留证。

## 可复核证据与限制

`.tmp/ai-context-rail-2026-11-11/`：red/green、suite/suite-final、worker-isolated、interaction、browser/browser-final、spa-late、build日志，real-results.json，双账号ordinary/article五视口PNG、denied-article.png与video/WebM。测试用登录信息保留在原私有配置，未写入文档或Notion。

旧文章任务若原本“提交结果待核对”，本轮只读显示，不代为重试/结算或声称修复。普通Hub没有已实现的显式业务Study绑定，本轮没有虚构研究栏；未来接通真实绑定时再按实际对象展示。去掉通用静态提示不等于放宽来源、权限或科学规则。最终视觉和实际科研使用效果仍由用户验收。
