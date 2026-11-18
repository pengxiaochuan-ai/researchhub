# Hub 专属 PubMed MCP

这是 ResearchHub 后端依赖，不是 Codex 插件或桌面 MCP 配置。用于九项医学 Skill 的真实公开文献读取；不向服务传递私有病例、账号信息、模型密钥或数据库配置。

## 固定依赖与本机验证

- Node.js >=24。
- `@cyanheads/pubmed-mcp-server` 2.11.1，第三方 Apache-2.0 项目，不是 NCBI 官方 MCP。
- `@modelcontextprotocol/sdk` 1.32.2；以本目录 lockfile 固定传递依赖。
- 实际握手 `server.version` 为 `0.13.19`，与安装包版本分开留痕，不改写成相同版本。

在本目录执行 `npm ci --ignore-scripts --no-fund --no-audit`。在 ResearchHub 根目录执行：

```sh
node --test server/ai-agent/*.test.mjs integrations/pubmed-mcp/egress.test.mjs
node scripts/qiyan-skills-preflight.mjs --discover-only
node scripts/qiyan-skills-preflight.mjs
```

最后一条会读取公开 NCBI/PMC 资料，不产生模型调用。预检 OpenCode 使用不可用的本机模型端点和假密钥；其通过只能证明装配，不能证明真实模型执行或九项能力上线。

## 执行边界

`launch.mjs` 无论由 OpenCode 还是后端 SDK 启动，均重建最小环境；仅保留已核准的 HTTPS 公开来源，逐跳校验重定向。联系邮箱为 `cooperation@pengxc.com`，自动重试为零、并发一；不继承宿主模型或数据库凭证。当前按单进程限速，正式多实例仍需与采集项目协调 NCBI 总限速。

后端 `server/ai-agent/pubmed-mcp.mjs` 使用官方 SDK，并限定本地 Skill 声明的 11 项操作。未获显式授权不启动；调用前及交付前再次检查；取消关闭该任务专属 MCP 进程，迟到结果不交付。工具 Schema 与每次调用、出站状态保存在本次私有运行目录。

公开实时查询结果不自动成为管理员审核后的 Hub 资料。读取正文也不代表全文、图片或补充材料均已完整取得；以实际截断和缺失回执为准。完整验证及当前未启用范围见 [测试记录](../../docs/testing/qiyan-nine-skills-2026-11-06.md)。
