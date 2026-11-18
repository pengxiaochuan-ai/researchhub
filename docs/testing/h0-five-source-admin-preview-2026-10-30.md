# H0 五份初始来源管理员预览 · 本机验证

日期：2026-10-30；范围：专用合成 PostgreSQL `wp01_test_full_baseline` 和本机 ResearchHub `127.0.0.1:19501`。未访问临床库、旧服务、云资源、远端配置或付费模型；未新增审核权限或决定。

## 四层结果

1. 代码：G02 真实模式新增外部来源只读元数据区，服务端使用当前 `source.review` 授权；未接外部原文、审批或 AI。
2. 目标环境：已重启本机具名合成运行时；七项本机服务就绪。`node scripts/hub-initial-five-verify.mjs --verify` 回读为 5 文档、5 版本、5 原文件、0 审核决定，跨租户 0；应用角色不能读原文件或写决定。
3. 真实执行：`node --test scripts/hub-initial-five.test.mjs scripts/hub-source-schema.test.mjs server/hub-sources/*.test.mjs` 28/28 通过。真实 HTTP 匿名 401、科研人员 403、当前管理员 200 且恰好五条；错误租户与过期授权拒绝，`Cache-Control: no-store` 生效。`npm run build` 通过，只有既有大包提示。真实 in-app 浏览器以本机合成管理员登录 G02，确认五条、分型、版本哈希、原始疾病单列；H01 显示当前获准来源 0 条。桌面截图：[G02 管理员预览](evidence/h0-external-preview-2026-10-30/g02-admin-preview-desktop.png)、[H01 未审核空态](evidence/h0-external-preview-2026-10-30/h01-unreviewed-still-empty.png)。本轮浏览器工具未提供录屏能力，故不能声称录屏已完成。
4. 业务结果：管理员可核对目录，但五份仍未具名权利/内容审核，用户端与 AI 均不能使用；未完成专业验收、外部资料审核放行或生产发布。

独立总评审提示的新接口缓存风险已补 `no-store` 并经 HTTP 回归；原 G02 工作簿区在账号切换后可能保留旧画面，属既有页面残余风险，服务端提交继续守门，本切片未扩大修补。

下一步需先逐份核实展示与 AI 检索的用途权利依据，再明确批准 `external_review_decision` 的最小写权限和对应 G02 审核动作；不能用工作簿表单替代。
