# F07 · 个人记录验收

日期：2026-11-20。验证目标为本轮owned19661/19662/19663独立合成环境；生产、旧服务、旧队列及付费模型均未操作。

## 四层状态

| 切片 | 代码 | 本机配置启用 | 真实请求执行 | 业务结果 |
| --- | --- | --- | --- | --- |
| 三模板、固定来源与私库 | 已实现 | 本轮普通成员精确role补knowledge/edit；真实UI本人建private库 | 原生CRUD/review/search及真实Chrome完成 | 保存、本人审核、刷新检索、来源/隔离/CAS通过；窄屏限制见下 |
| AI主动追加 | 已实现 | 本环境未开放资料问答，没有合法真实回答 | 仅免费纯函数/组件契约，无模型/真实回答采纳 | 用户确认并入K01问答验收，单列待验 |
| 生产部署/客户签收 | 本轮不执行 | 未启用 | 未执行 | 未签收 |

## 真实业务结果

完整新样例：[result.json](evidence/f07-knowledge-2026-11-20/8f1e96a7-9085-4dc2-bd19-8cabeee12ab7/result.json)。三角色Chrome、原生请求及录屏，pageerror=0、modelCalls=0。

- 普通研究者本人UI创建private库及一份原创合成原材料，再分别创建阅读笔记、研究想法、指导记录；模板先仅内存，原POST记录正文为空；本人补充、保存、审核后刷新并通过原生全文检索找回。
- 保存未审核时原生检索不收录；本人沿原审核后可检索，不改审核门或管理员权限。
- 固定资料链接包含实际version/hash；打开原资料成功。脏稿点击关联资料，Esc/继续编辑均保留内容和路由；源改版后旧链接明确失效，不展示latest替代。
- 管理员与另一研究者在原生列表不见私库，直接tree/doc读取403/404。真实第二客户端保存推进版本后，浏览器保存409并精确保留未提交稿；服务器保留另一客户端新版本。
- 同一浏览器真实Cookie切为管理员，旧frame的私库读写拒绝且当前草稿保留；刷新后旧私库与旧稿不残留。

## 浏览器与限制

保持原Shell及K01三栏/窄屏标签页断点。1440视口中iframe不足1280会沿原标签页，1920才显示原三栏，不为截图强改断点。390默认展开220px侧栏挤压工作区，已发现内iframe横向裁切；属于本轮保留的既有Shell窄屏限制，不能写390默认可用。真实点击既有“收起菜单”后文字虽隐藏，侧栏占位仍220px、iframe仍120px，故也不是390px可用恢复路径；未扩大修改全局Shell。其他宽度、原生200%和模板dialog键盘结果在本节追加。

## 免费验证及失败留痕

F06/F07最终相关纯函数/会话/Shell/配置/报告来源回归55/55（跨组不重复累加）；模板/来源/采纳逻辑的测试使用明确的合成契约对象，不是实际AI交付。构建通过，原有大chunk提示保留。最终命令与结果在本节追加。

前序0039201d、2cf35c2e、bc2396de、8e1e870f等run保留：实际保存/检索/拒绝已完成后，harness因status含重新加载列表、库树异步就绪或深链编辑tab下搜索框隐藏而误超时；仅修测试等待与locator，不改产品迎合测试。最终完整通过为上方8f1e96a7。同样保留390默认展开的真实布局失败，不掩盖为测试问题。

随机密码、DSN、Cookie及私密配置不入本文/Git/Notion。证据PNG/WebM沿既有gitignore仅本机保存，不force-add。用户步骤只维护[统一手册](../product/用户验证与操作手册.md)。

## 最终专项证据

- [统一工程索引](evidence/f07-knowledge-2026-11-20/verification-index.json)保留全部主链、配置、失败、焦点修复与390限制；完整主链8f1e96a7通过。
- 免费采纳组件契约：[result.json](evidence/f07-adoption-contract-2026-11-20/b4a32554-b66b-4737-a7f1-3a486a41d19d/result.json)，7项检查、51次模拟API、0自动PATCH、0后端/数据库/模型请求、0pageerror，明确contract_mock_not_ai_execution。覆盖延迟核源时新编辑保留、doc/version/readonly/identity变化拒绝、真实WikiEditor与preview模型图片/HTML零img和模型外链零a、实际POST docId加载模板dirty但不自动写正文。
- 最终相关回归55/55：`node --test tests/knowledge-records.test.mjs tests/knowledge-session.test.mjs tests/knowledge-ai-session.test.mjs tests/k01-shell-slots.test.mjs tests/session-material-session.test.mjs scripts/f07-knowledge-rehearsal.test.mjs server/hub-assets/contract.test.mjs server/hub-assets/draft-workspace.test.mjs server/hub-assets/source-reader.test.mjs server/hub-assets/report-source-migration.test.mjs server/hub-assets/report-source-verifier.test.mjs server/research-runtime/hub-asset-bridge.test.mjs`，本机日志`.tmp/f06-f07-final-unit.log`。
- 原创来源真实PG回归1/1仍通过；报告真实PG/HTTP/Chrome及来源失效另见F06专项，不与55项混称纯单测或生产验收。最终构建日志`.tmp/f06-f07-final-build.log`。
- [响应式及焦点复验](evidence/f07-knowledge-responsive-2026-11-20/d6a95e1d-21d9-424e-8773-a6b4d00b9627/result.json)：720/1440/1920和原生200%无横向溢出；新建dialog16次Tab不逸出、Esc关闭、焦点回开窗按钮。390展开及收起仍受现Shell占位限制，整体responsive report如实passed:false，不以其他尺寸通过覆盖。
- [P01入口及取消复验](evidence/f07-knowledge-entry-2026-11-20/2663f735-0483-4d6d-a6c7-6d2dce092252/result.json)：原“个人知识库”直接进入K01并自动选当前合法目标上下文，无需ID；指导记录弹窗取消恢复开窗焦点，无业务写。

真实发现的新建弹窗焦点缺陷已仅在本轮KnowledgeBasePage记录新建/重命名开窗前opener、取消/Esc后requestAnimationFrame恢复，未改全局模态策略或Shell。红证据cfb7b597保留，修后仅重跑响应式/键盘，不反复重做业务链。AI真实采纳按用户明确确认并入K01待验，不能称F07全部完成。
