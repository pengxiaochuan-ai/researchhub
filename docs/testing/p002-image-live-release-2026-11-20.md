# P002图片优化线上发布与真实域名验收

2026-11-20。用户明确授权发布并复测；真实入口 https://hub.pengxc.com/pages/p002/ 。仅发布已验收P002图片/按区加载/内容校验缓存及必要的前端单独发布控制，未混入共享工作区其他未提交功能。代码fce3375db9a6f512d7352f0eddcf42a3dff5e2ed，发布tag hub-runtime-fce3375d-44674219803001，[成功工作流](https://github.com/pengxiaochuan-ai/researchhub/actions/runs/44674219803)。

## 实际效果

| 项目 | 发布前 | 发布后 |
| --- | ---: | ---: |
| 真实域名首屏图片传输 | 17,509,826 B | 2,341,043 B |
| 再次访问的首屏新图 | 原图刷新仍17.51MB | 17/17命中缓存，0 B |
| 整页图片传输 | 首屏已加载全部原图 | 6,104,096 B，按区加载 |
| 完整reference截图请求 | 7张 | 0张 |

首屏约减少87%。独立全新Chrome匿名上下文，无Playwright网络route（避免关闭缓存）；使用--no-proxy-server仅绕开本机系统代理，不修改系统/服务器网络。实际HTTPS七区、footer、返回区段与再次访问共10项通过，47裁片全部加载，图片请求HTTP200且具名WebP实际immutable，0页面错误/科研业务写；保留JSON、PNG和WebM。单次受控测试不冒充真实用户群体RUM或稳定耗时SLA。

## 后台保全与四层结果

代码/构建：隔离远端main快照仅引入本轮P002实现和50素材；目标单元、发布控制、Docker/HTTP/PostgreSQL隔离发布回退演练全部通过。新控制在后台内容完全一致时保原镜像tag、原档SHA/sourceGit/Core，只替换前端，正常维护成功指针，失败回退也不重启后台。

现场装配/真实执行：远端plan明确frontend=true/backend=false/databaseChanged=false；发布、认证/只读业务浏览器检查、最终成功指针均通过。实际生产回执backendPreserved核对容器ID、image ID/reference、Config摘要、StartedAt、RestartCount及.env.prod SHA全程相同；旧服务、历史任务摘要保持，无迁移、无权限/额度/ledger修改。

业务结果：真实域名冷启动、整页图片、缓存已按上表实际观察；外观/导航/图示原交互保持（本机50素材无损像素校验、7区几何全文/390/原生200%已有验收）。未新增付费模型、邮件或科研数据操作。CI登录检查包含正常认证请求，不把它称为完全零HTTP写。

## 中途发现与处理

1. 44672510515计划通过。首次44672655430在隔离演练前因残留新backend tag引用失败，尚未生产切换；修正fixture使用实际复用镜像并补门禁。
2. 44673116531演练通过，切换前被旧执行策略校验拦截，未完成发布；修正纯前端路径以已核对的当前后端状态作配置校验，原后台变更仍严格执行既有控制策略；未知/矛盾配置继续拒绝，保全快照防漂移。未为过门禁修改生产AI审批、额度或配置。
3. 最终44674219803全链成功，再执行本机真实域名10项专项。生产回执仅取真实Apply/Finalize阶段与准确tag，不把同日志中的单元/Docker合成回执冒称生产证据。

证据：`docs/testing/evidence/p002-image-live-release-2026-11-20/`。before/为上线前真实域名JSON/PNG；online/为上线后10项结果、7区截图和录屏；production-receipts.json为真实生产保全/最终确认；preflight-plan.json与最终manifest绑定实际版本。首次/第二次失败日志仅保留私有.tmp供追溯，Notion不含秘密或完整运行配置。
