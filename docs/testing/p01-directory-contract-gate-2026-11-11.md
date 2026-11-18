# P01课题入口契约与全量前端门禁复核

2026-11-11。当前请求仅核对并修复P01课题入口测试与现行契约的不一致、恢复上一轮全量前端门禁；不恢复历史双入口、不重设计P01、不扩后端/权限或改业务数据。

## 核对与最小计划

旧失败已留在C01仅列表证据中：旧fixture只传overview的studyGroups，要求新建/全部链接。当前目录已包含别项实施后的修正：PersonalOverview接projectDirectory，preview最多5条、同源total、footer“查看更多课题”，空态按canCreateProject显示新建；旧overview/任务/本人草稿独立保留。当前layout-restoration已传ready目录并验证footer和精确Study链接，personal-project-directory-preview另覆盖空态能力、loading/error/restricted/unverified。本轮保留既有改动，不为制造修复而重写或回退产品。

1. 复核P01调用链、GET /api/research-directory、客户端验证及测试fixture；先重跑既有专项与完整前端判断当前状态。
2. 若仍有契约问题，只修实际不一致的测试，保留断言强度；如发现真实接口/权限/布局需变更，另确认范围，不借测试任务改产品。
3. 使用原两合成账号实际API及浏览器验证P01预览/总数/入口与Q02完整列表同源、精确详情往返，不创建/保存对象；独立只读评审、构建及当前全量前端日志，记录未测项、产品/版本和Notion。

## UI/UE与边界

本轮不修改页面/样式或业务交互，真实用户路径仍为P01找课题→查看更多课题→Q02→已授权对象→返回。搜索/空态/当前身份/权限与原14/22保持。仅现有专用合成环境，无模型/费用/角色/旧服务/重启/云/远端配置/发布；不盲跑带种子、迁移或旧业务写入的历史脚本。前序RED和当前目录已有修正分别归属，不冒称本轮新写代码使旧测试变绿。

## 结果：全量前端门禁已恢复

进入本轮时旧双入口/旧studyGroups断言已由当前目录其他实施改为projectDirectory/footer，首次专项23/23、全量382/382。未将这份已有修正归为本轮新实现。本轮进一步修补唯一入口测试的API契约完整性：tests/layout-restoration.test.mjs调用真实validateResearchDirectory，旧不完整fixture先出现RESEARCH_DIRECTORY_INVALID_RESPONSE（1/1失败），补齐id/kind/summary/updatedAt/nextCursor及逐项capabilities后通过；故意令旧overview总数9/旧课题与目录total1不同，断言拒绝旧内容、旧数并验证目录计数出现三处。footer、精确Study参数及未核验无入口断言保留，不放宽验证器。

最终专项23/23、全量前端382/382（0 fail/skip/cancel）、后端目录/授权提示纯契约10/10；构建4.23s通过，原>500k chunk警告保留。构建发生于测试fixture修改前，随后仅测试与文档修改，运行代码未变；不为重复确认盲重跑构建。没有lint/typecheck脚本，不称已运行。“全量”仅指上一轮node --test --test-concurrency=1 tests/*.test.mjs前端门禁，不代表全部后台、旧系统、AI专业效果或生产验收。数量包含共享目录其他新测试，不全部归本轮。

## 实际接口和浏览器

原owner/admin登录后仅GET /research-directory及/my-research/overview，复用客户端readResearchDirectoryRange/validateResearchDirectory：分别13/22条，limit5预览精确等于完整目录前5，无重复，原overview仍保留旧契约。未运行其他账号或写业务操作。5个相关运行文件在API验证前后SHA256一致，见api.json；本轮未修改任何产品源码/样式/API/后端或权限。

真实浏览器分别P01→footer→Q02→同一首篇现有Study→返回列表。两个账号P01预览5条、三处13/22与完整列表总数一致，完整列表前5标题/链接与P01逐项一致；管理员首屏20条/总22。键盘footer下一项为原“本人研究草稿”折叠，14px/22px、实际1421×1419/DPR1.34；人工查看最终截图保留原布局，无本轮页面重设计。最终恢复owner P01，0 warn/error，未创建、保存、审批或发布对象。

账号恢复第一轮过早goto P01打断登录，实际回登录页，保留此操作失败事实；未据此修改认证或权限。等待真实owner登录成功和目录加载后恢复正常。未测320px、原生200%、视频、浏览器故障注入或真实撤权；本轮没有UI改动，不借前序其他实施的缩放/录屏证据冒称本轮复测。仅当前合成环境，0模型/费用/角色变化/旧服务/重启/云资源/远端配置/真实发布。

## 独立评审与交接

唯一独立只读总评无Critical/Important/Minor，独立重跑指定3文件23/23；评审进程有Vite WebSocket端口占用提示（exit0），如实保留，不为此改测试服务器或放宽测试。主进程最终日志以实际命令为准。共享未跟踪文件不能靠Git diff还原本轮变化，以本轮RED日志、精确修改描述与当前文件为据；没有独立二次复签或用户专业签收。

证据目录docs/testing/evidence/p01-directory-contract-gate-2026-11-11/：focused/frontend/build基线，contract-red、focused-final/frontend-final/backend日志，api.json、owner/admin P01/Q02测量和PNG、Study截图、final-owner.png、browser-result.json、console.json。旧C01的375/376为前序历史，未改写旧失败日志；本记录解除当前P01全量前端门禁失败，不将前序其他保留项一并销项。

## 文档同步状态

本地测试记录、产品基线/变更/版本和课题living spec已更新。Notion部分既有页可读取，但搜索、科研课题规格fetch及新建本轮测试页连续返回连接传输失败；新增请求未得到page id，远端是否写入无法确认，未盲重试或追加未经确认的重复页。本轮Notion同步未完成，现有远端文档未宣称已更新，恢复后须先按本轮唯一标题检索去重再继续。失败回执见notion-sync.json。此状态不影响本机382项前端门禁通过，但不将文档同步门槛标为完成。

建议下一项：Notion连接恢复后，按本轮唯一标题核对并补齐验证记录同步，确保远端验收状态与本机门禁结果一致；不因测试恢复自动精简或开发新功能。
