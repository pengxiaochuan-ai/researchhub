## 2026-11-20 · 生产根地址已设为P002首页

已发布代码017d296，成功发布44682997314。访问https://hub.pengxc.com/或/index.html自动进入/pages/p002/，保留query/hash；固定同源跳转，无JS兜底只保证进入门户，不保证完整功能。真实域名Chrome15组结果通过：四种根地址、无JS、七公开页、旧P00直接入口、3/3图片复访缓存0传输、0页面错误/业务写。账号三图/四公开页Logo小图及P003演示入口清理同批上线。

本次仅前端：生产回执确认后台容器/镜像/配置/启动时间/.env.prod摘要保持，旧服务和历史任务保持，无数据库迁移。[线上验收](../testing/portal-home-production-2026-11-20.md)。

# 生产根地址默认门户首页

日期：2026-11-20。用户授权将 https://hub.pengxc.com/ 默认进入P002，并在生产生效。

最小变更：根index.html固定跳到/pages/p002/，保留原query/hash，replace避免返回旧首页再跳转；无JavaScript时通过noscript meta refresh进入相同固定目标。根页面标题沿门户品牌，P002原路由、页内锚点和全部其他页面不改。不接受URL参数作为跳转目标，query/hash只附加到固定站内路径。

本次仅前端发布，携带已完成且尚未上线的P003/P004/P005图片优化、P007/P008/P009/P011共享Logo小图及P003演示入口清理。使用最新main已成功发布的后端基线，不携带共享工作区未提交更改；先plan证明backend=false/databaseChanged=false，再release。科研/管理权限、后台/API/数据库不改。

验收：单元及真实静态HTTP、真实Chrome根地址/直接P002/query/hash/无JS/返回历史、导航、账号与共享Logo冷热缓存，远端发布及保全回执、真实HTTPS首访复访截图录屏。各层结果分别记录，未发布成功不称线上完成。
