# 整合工程开发基准

唯一开发目录：`/Users/haiboshi/work/git/pengxc/researchhub/integrated-platform`。

现有工程为 React 18 + Vite 多页面项目。最新灵枢心域首页已位于 `pages/p002`，代码与此次精修结果一致；后续只修改整合工程。工作区 `outputs/site` 和外层 `frontend/portal-prototype` 为历史快照，不再进行双向同步。外层技术文件与 UI 母版归档进入整合工程的 `docs/reference/lingshu-v1`。

页面入口：

| 页面 | 路由 |
| --- | --- |
| 通用开放首页 | `/pages/p00/`，根地址默认进入 |
| 灵枢心域七屏首页 | `/pages/p002/` |
| 我的科研 | `/pages/p01/` |
| 针灸治疗情志病 Research Hub | `/pages/h01/` |

开发：在整合工程执行 `pnpm dev`。构建：`pnpm run build`。预览可以执行 `pnpm preview --host 127.0.0.1 --port 4174`，避开旧快照的 4173 服务。

此次沿用用户尚未提交的改动，不重置文件，不提交或推送。P002 的页面和静态素材进入同一 Vite 构建；科研工作区继续沿用既有公共 Shell。门户功能设计修订为 V1.1，并调整为现有 React/Vite 架构，尚未实现的注册、登录、学术发起、帮助中心仍按设计与业务规则确认后逐项开发。
