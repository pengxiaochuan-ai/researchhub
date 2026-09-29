# ADR-0002：岐研前端独立发布

## 状态

已接受

## 日期

2026-09-29

## 背景

岐研前端与官网 `official-site`、科研平台部署在同一台 ECS，由同一个 ALB 按域名转发。三者的发布频率和故障范围不同，不能共用 Compose 项目、OSS 前缀、ECS 目录或主机端口。

## 决策

- 公开域名使用 `hub.pengxc.com`。
- 发布链路与官网相同：GitHub Actions 构建镜像，上传到 OSS，阿里云云助手在 ECS 上拉取。不开放 SSH 22。
- OSS 前缀：`releases/researchhub/<release-tag>/`。
- ECS 目录：`/srv/researchhub/ops`。
- Compose 项目名和服务名：`researchhub`。
- 主机端口：`8083`。容器内端口仍是 `3000`。
- ALB 按主机名 `hub.pengxc.com` 转发到该端口，健康检查为 `GET /health`。
- 网站容器只读取 `.env.prod`。OSS 读取凭据只放在 `.env.release`。

## 后果

官网端口 `8082` 和科研平台发布不会被这次发布重启。DNS 需要把 `hub.pengxc.com` 指到现有 ALB。安全组只允许 ALB 访问 TCP `8083`。
