# 生产根地址默认门户首页

日期：2026-11-20。用户授权将 https://hub.pengxc.com/ 默认进入P002，并在生产生效。

最小变更：根index.html固定跳到/pages/p002/，保留原query/hash，replace避免返回旧首页再跳转；无JavaScript时通过noscript meta refresh进入相同固定目标。根页面标题沿门户品牌，P002原路由、页内锚点和全部其他页面不改。不接受URL参数作为跳转目标，query/hash只附加到固定站内路径。

本次仅前端发布，携带已完成且尚未上线的P003/P004/P005图片优化、P007/P008/P009/P011共享Logo小图及P003演示入口清理。使用最新main已成功发布的后端基线，不携带共享工作区未提交更改；先plan证明backend=false/databaseChanged=false，再release。科研/管理权限、后台/API/数据库不改。

验收：单元及真实静态HTTP、真实Chrome根地址/直接P002/query/hash/无JS/返回历史、导航、账号与共享Logo冷热缓存，远端发布及保全回执、真实HTTPS首访复访截图录屏。各层结果分别记录，未发布成功不称线上完成。
