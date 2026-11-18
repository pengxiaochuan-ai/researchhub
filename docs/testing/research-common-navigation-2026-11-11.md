# 我的科研常用课题导航 · 本机验收

日期2026-11-11。仅响应用户“把新入口并入『我的科研』常用导航”。P01课题卡片增加新建/全部入口，侧栏“我的科研”下增加课题与草稿二级入口；保留五个一级导航、旧研究设计/项目链接。后台、角色、数据模型、旧记录与19501装配不改，本轮未重载服务。点击常用导航只跳页；浏览器验收另显式保存一份本轮合成课题并建立研究，无真实受试者资料或模型调用。

## 技术证据

| 检查 | 结果及实际范围 |
| --- | --- |
| 单元/SSR与路由 | [25项通过](evidence/research-common-navigation-2026-11-11/unit.log)，覆盖既有布局/旧Study链接、固定新路由、未核验P01隐藏动作、真实/演示路由与权限客户端；新增契约首次RED见unit-red.log |
| 构建 | [Vite通过](evidence/research-common-navigation-2026-11-11/build.log)，既有大chunk提示保留；旧Nest源码未变，本次未重复构建 |
| 真实主链4组 | [首轮逐请求/时间与已通过检查](evidence/research-common-navigation-2026-11-11/after-31c409f1/failure.json)：P01键盘新建→未保存时点侧栏/Esc保输入→保存→建立研究；侧栏列表/概览往返与P01全部课题；390/320可达/无整页横溢出/14px；管理员可读新课题，viewer无创建组且读研究404，原研究设计捷径保留 |
| 演示专项 | [独立补验通过](evidence/research-common-navigation-2026-11-11/demo-result.json)：在登录页明确返回Q02并进入演示，仍为原演示列表/身份，没有新增真实常用侧栏入口。未把演示P01原登录回退当作本轮已修能力 |
| 汇总 | [阶段组合结果](evidence/research-common-navigation-2026-11-11/summary.json)，主链4组和独立演示专项分列，不冒称完整脚本一次运行全绿。页面无pageerror，0模型/渠道/计算请求 |
| PG持久回读 | [只读核对](evidence/research-common-navigation-2026-11-11/postgres.json)：本轮意图/研究/原执行项目父链匹配当前租户及owner，创建者成员1条，正式Protocol 0；没有授予viewer创建权限 |
| 独立代码评审 | 只读Agent核对链接不继承旧Study参数、原项目/草稿入口、真实模式及未核验门控、五个一级导航、原生链接的未保存拦截与折叠样式，无必须修复项 |

## UI/UE与保留边界

[1440修改前](evidence/research-common-navigation-2026-11-11/before/p01-1440.png)与[修改后](evidence/research-common-navigation-2026-11-11/after-31c409f1/p01-1440.png)使用同视口、同原账号。前后metrics.json实测顶栏/侧栏外框、问候区、统计区域完全相同；主区/右栏位置宽度不变，右课题卡片因新增动作自然增高，后续动态卡片相应下移；侧栏其余一级项顺序不变，位置随新增二级入口下移。不声称全页面像素完全一致。

[390px](evidence/research-common-navigation-2026-11-11/after-31c409f1/p01-390.png)、[320px](evidence/research-common-navigation-2026-11-11/after-31c409f1/p01-320.png)中侧栏沿原移动规则隐藏，用户从首页原课题卡片操作；新链接14/22，原生链接支持键盘。当前管理员[列表截图](evidence/research-common-navigation-2026-11-11/after-31c409f1/admin-projects.png)保留；after-31c409f1/video和demo-video内为实际WebM。未改其他正文区域/字号，原生200%本次未重跑，不称全部视觉专项完成。

## 已知轨迹与限制

主链前4组均通过后，测试错误等待进入演示后到P01；原默认返回实际为Q02，因此超时，failure.json与录屏保留。只修测试目标并单独复验演示Q02，未修改产品鉴权。尝试显式演示P01观察到原登录回退，属于既有路径，未扩大本轮修复。额外PG只读检查首个查询误写created_by字段，按真实schema的owner_id及studyProtocolVersion修正后通过，未写库。首轮失败不隐去，也不据此重跑已通过写入链制造更多课题。

四层：代码与19501实际入口已启用；真实HTTP/Chrome/PG执行及合成软件产物有据；用户最终导航体验签收和生产发布仍待完成。正式访视/问卷/数据录入/分析不在本轮。新版入口直接沿用现有权限，不能从“导航可见”推断有研究创建或私有数据权限。
