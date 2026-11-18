# 岐研AI输入完整性修复验收 · 2026-11-12

最新后续：两道被截坏的完整原题已各完成一次真实浏览器发送、工具/模型/PG/API/刷新及独立专业复核。长输入链路通过；WHO/Harvard比较未完成，NCCIH来源一致但四段超三段且局限总结不足，整体部分通过。4次真实调用6350Token自动正常结算；无重试或产品规则改动。[完整原题复验](smart-search-full-question-2026-11-12.md)。下文原轮记录保留，不以本次结论覆盖历史。

状态：代码实现、本机合成环境启用、真实接口/数据库及两角色浏览器输入闭环通过；非生产，不扩大为联网/解读专业质量整体通过。当前目录串行实施＋独立agent_input_boundary_review。规格见[研究问题完整输入](../product/ai-question-length-2026-11-12.md)。

## 修复与四层证据

1. **代码：**统一`src/agent-question.js`，trim后2–4000 Unicode码点；移除普通/单篇/待执行编辑原生maxlength。超限完整保留、原位aria错误、禁发送/保存/Enter，缩短自动解除；Hook及后端独立拒绝。路由、文献规划、实际单篇新旧模型输入和Agent专用Hub检索同契约；默认E01仍100。未修改旧系统、表结构、权限、计费、URL/出站规则、模型预算或证据上限，未改布局/CSS/两行自适应。
2. **本机启用：**11:24在processing=0、当前consumer queued/waiting=0后仅重载既有本机合成runtime，PID89387→938；七服务均ready，身份配置指纹相等、571条Job完整hash不变。历史isolated-test的queued不认领/不清理。见`reload.json`。重载前真实4001请求仍报2–100，未当作已启用；重载后4001请求正确报4000。
3. **真实输入：**owner/admin各一份具名新会话，经原UI发送4000字符（URL位于末尾），commands HTTP201与真实PG content/originalText全等。编辑含非BMP字符长问PATCH200、刷新回读全等；4001字符绕UI调用commands及knowledge-messages均400，消息数量不增。智能搜索保持OFF，问题含URL会进入既有澄清，不建模型Job；原UI软取消本轮指令保留记录，两个新会话各jobs/reservations/usage=0。未实际执行翻译、不改变队列或扩权。
4. **用户可见：**owner/admin普通＋单篇四入口、隔离Composer发送/编辑fixture均完成真实Chrome；1366×768、1440×900、1920×1200实测14px/22px，输入高度60→上限148内滚→删除后60；长问题/URL完整，4000非BMP字符可编辑，4001保留且Enter不写，缩短解除，Shift+Enter换行。真实会话编辑/刷新有截图WebM。未测原生200%缩放/手机，不据桌面结果宣称全站无障碍通过。

## 测试、失败保留与独立复核

- `red-valid.log`5项核心RED；最初`red.log`有测试导出名误写，修正后才得到有效RED。`composer-red.log`为旧maxlength的组件RED；真实`browser-red.log`证实286字符问题被截为100，末尾URL丢失。
- 最终`regression-final.log`510/510（前端tests及本次相关规划/单篇/查询/路由），`smart-billing-regression.log`48/48，定向`pg.log`2/2（完整回滚命令/入队/CAS＋真实只读长问无假命中）；`build.log`4.74s，原>500kB chunk警告保留。
- 第一轮全量500/502：旧单篇测试仍断言maxLength100，已按新契约更新；另source-review-copy在本轮未修改模块失败。后续该模块被并发工作更新，最终510/510；未为本次输入修复改治理代码。原失败日志保留，不假称首轮全绿。
- 独立评审发现历史单非BMP问题：旧UTF16最小长度曾允许单emoji，新码点规则会使其历史回读失效。先`legacy-red.log`再修复；仅read=true、completed、已绑定原文/hash的GENERAL历史容许1码点/2UTF16宽字符，原文或route变化仍拒绝，新请求仍至少2码点。`legacy-green.log`14/14，独立最后源码复核关闭此项，无待处理代码发现。
- 实际模型输入构造测试证明4000中英文/非BMP问题全文进入新旧单篇消息并绑定hash；本轮不需要真实付费模型请求，未进行新回答科学质量验收。搜索工具240、URL2048、证据片段1200/总6000及Token预算仍原规则，不能把输入放长当作全文读取/更大模型预算。

## 合成夹具操作事故（保留、不清理）

独立评审误运行既有`conversation-commands.test.mjs`，新增13个rh-aiq会话、221消息和8个测试Job（queued5/failed2/completed1）；之后主线程又误用`server/ai-agent/*.test.mjs`通配符纳入同一持久用例，确认后停止该runner，又新增同数量。两次合计26会话/442消息/16测试Job；schedule是数组替身，completed为测试直接设态，不是实际模型完成。后续已改为显式纯测试清单。原始事故文件含精确ID/时间范围；不擅自删除或改历史状态。

误纳入的defaults/general等PG用例在自己的事务回滚，未保留新角色/授权；原两账号权限未为本次改变。没有临床库、旧服务、云/远端配置/发布或真实模型调用。事故与正常本轮两份软取消会话分开记录，不拿额外夹具充当业务验收产物。

## 证据位置与交接

`.tmp/ai-question-length-2026-11-12/`：规格/有效RED/回归/构建/两份事故文件；`browser-final-1794454152235/`含四入口三尺寸、超限及fixture编辑截图和WebM；`live-1794453926957/result.json`含真实两账号session/command ID、请求/编辑/刷新/软取消和0Job/预留/用量；`reload.json`为安全启用证据。原失败与中间结果均保留，不提交Git或发布。

产品基线/变更/版本/使用说明/九Skill、技术与前端架构已同步；Notion按原目录创建本轮[规格](https://app.notion.com/p/41656479ab58816a85a2f4822dfb60aa)和[验收](https://app.notion.com/p/41656479ab588147b4d6e20e0925c4f4)，七份既有living页仅前置本轮状态，保留其他并发内容。限定源文件语法与diff-check通过。本轮未做Git提交、旧任务清理或生产发布。

最后状态核对：文档同步期间本机运行PID另变为3069（非本轮再次重载），七服务ready；以当前实例重新登录owner，4001字符实际HTTP400含4000提示，目标commands前后全等，见`final-runtime.json`。本轮安全重载89387→938的历史证据保留，不把其PID冒称永久当前实例。

建议后续单独验收：使用完整研究问题与来源URL再测智能搜索新回答的来源一致性，继续区分原文事实与AI推论；不是本轮自动新增模型调用授权。
