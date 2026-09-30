# 岐研前端页面整合工程

本工程将各个高保真页面保持为独立路由与入口，在同一个 Vite 服务中访问。已有压缩包页面保留各自的 `src`，后续同一产品线页面可复用 `pages/shared/` 中的平台组件，但页面编号、入口和母版映射始终独立，因此同名文件不会覆盖。

## 开发前必读

项目已经冻结 **岐研 Demo UI Foundation v1.0** 和 **Navigation & Page Header Standard v1.0**。人工开发者及 AI 编程工具必须先阅读 [项目文档中心](docs/README.md) 和 [AGENTS.md](AGENTS.md)。业务页面不得自行重新设计 Topbar、Sidebar、Breadcrumb、Page Header 或 Context Navigation。

公共实现入口：

- `src/design-tokens.css`：Design / Layout Tokens。
- `src/platform-header.js`：统一 Topbar 和用户身份。
- `src/platform-shell.js`：统一 Sidebar、Breadcrumb、Page Header 和 Context Navigation。
- `src/platform-navigation.js`：全局路由。
- `src/page-linking.js`：页面联动和公共 Shell 挂载。

## 启动

```powershell
pnpm install
pnpm dev
```

访问根地址后进入开放性首页。登录后进入“我的科研”。生产构建与本地预览：

```powershell
pnpm build
pnpm preview
```

构建产物 `dist` 不提交到 Git。本地构建后也可以用静态服务查看：

```powershell
node ./scripts/serve-dist.mjs
```

## 已接入页面

| 页面编号 | 页面 | 路由 |
| --- | --- | --- |
| P00 | 开放性首页 | `/pages/p00/` |
| P01 | 我的科研 | `/pages/p01/` |
| H05 | 领域研究 | `/pages/h05/` |
| H01 | 针灸治疗情志病 | `/pages/h01/` |
| H02 | 创建 Research Hub · 基本信息 | `/pages/h02/` |
| H03 | 创建 Research Hub · 研究范围 | `/pages/h03/` |
| H04 | 创建 Research Hub · AI 检查与确认 | `/pages/h04/` |
| AI01 | 岐研 AI | `/pages/ai01/` |
| E01 | 研究证据 | `/pages/e01/` |
| E02 | 证据详情 | `/pages/e02/` |
| E03 | AI 证据抽屉 | `/pages/e03/` |
| S01 | 课题概览 | `/pages/s01/` |
| S02 | 研究设计详情 | `/pages/s02/` |
| S03 | 受试者管理 | `/pages/s03/` |
| S04 | 受试者详情 | `/pages/s04/` |
| S05 | 数据质量详情 | `/pages/s05/` |
| S06 | 研究分析结果 | `/pages/s06/` |
| Q01 | 研究课题 | `/pages/q01/` |
| G01 | 人工审查与审批 | `/pages/g01/` |
| G02 | 管理与治理 | `/pages/g02/` |
| O01 | 研究机会 | `/pages/o01/` |
| O02 | 研究机会详情 | `/pages/o02/` |
| A01 | 科研资产 | `/pages/a01/` |
| A02 | 资产详情与复用 | `/pages/a02/` |

页面来源、参考截图和源压缩包 SHA256 记录在 `platform-pages.json`。

## 后续接入新页面

使用独立页面编号接入，脚本发现同名目录时会立即停止，不会覆盖已有页面：

```powershell
./scripts/Add-Page.ps1 -ArchivePath ../Q01-example.zip -PageId q01 -Title '研究问题' -Screen '../screens/question/Q01-research-question.png'
```

接入后只需要完成两项人工连接：

1. 在 `src/platform-navigation.js` 增加需要出现在通用导航中的页面映射。
2. 在相关页面的现有按钮或链接上添加 `goToPage('q01')`，不新增页面内容或改动页面结构。
3. 在 `src/platform-shell.js` 登记 Breadcrumb、页面标题和 Context Navigation 映射。
4. 按 `docs/testing/ui-acceptance.md` 完成构建和浏览器回归。

## 部署

公开地址定为 `https://hub.pengxc.com`。发布方式与 [official-site](https://github.com/pengxiaochuan-ai/official-site) 相同：`main` 分支构建 Docker 镜像，上传到 OSS `releases/researchhub/`，再由阿里云云助手在 ECS 上切换。不使用 SSH。

```text
main
  → Research Hub CI
  → Deploy Research Hub
  → OSS releases/researchhub/<release-tag>/
  → 云助手 RunCommand
  → /srv/researchhub/ops
  → Docker Compose 项目 researchhub，ECS 端口 8083
  → ALB 主机名 hub.pengxc.com，健康检查 /health
```

官网使用 `8082` 和 `/srv/official-site/ops`。科研平台 `aisciencesys` 使用 `/srv/aisci`，Web 端口是 `80`（本地编排为 `8080`）。本服务使用 `8083` 和 `/srv/researchhub/ops`。发布只操作 Compose 项目 `researchhub`，不清理全机镜像，也不使用 `80`、`8080`、`8082`。

### 阿里云解析

在 `pengxc.com` 增加一条主机记录：

| 记录类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| CNAME | `hub` | 现有 ALB 的域名，与 `www.pengxc.com` 相同 |

ALB 增加一条 HTTPS 规则：主机名 `hub.pengxc.com` 转发到服务组 `researchhub`，后端端口 `8083`，健康检查 `GET /health`，期望 `200`。安全组只允许 ALB 访问 TCP `8083`。

### 首次发布前

把 `researchhub` 加入组织 Actions Secrets 的授权仓库。需要的 Secret 与官网相同：

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `ALIYUN_ECS_INSTANCE_ID`
- `OSS_ACCESS_KEY`
- `OSS_SECRET_KEY`
- `OSS_BUCKET`
- `OSS_ENDPOINT`

ECS 上执行一次初始化。真实密钥不要写入 Git：

```bash
sudo install -d -m 0700 /srv/researchhub/ops
sudo install -m 0600 /dev/null /srv/researchhub/ops/.env.prod
sudo install -m 0600 /dev/null /srv/researchhub/ops/.env.release
```

`.env.prod` 使用 `env.prod.example`。`.env.release` 使用 `env.release.example`，填写只能读取 `releases/researchhub/*` 的 OSS 凭据。

本地容器：

```bash
docker build -t researchhub .
docker run --rm -p 8083:3000 researchhub
```

健康检查：`curl -fsS http://127.0.0.1:8083/health`。

回滚时在 GitHub Actions 运行 `Rollback Research Hub`，填入 OSS 中已有的发布标签，并输入 `ROLLBACK`。

## 整合约束

- 一张高保真母版对应一个 `pages/<页面编号>/` 入口目录。
- 不把不同压缩包的 `src` 目录合并。
- 同一产品线允许复用 `pages/shared/` 的平台组件，但页面内容、母版映射和路由保持独立。
- 高保真图是唯一视觉母版；后续反馈只修视觉偏差，不重组页面结构或改写页面内容。
- 原始 ZIP、screens 和 Product Baseline 保留在工程外层，作为受控来源，不参与构建。
