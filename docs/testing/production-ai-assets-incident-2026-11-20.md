# 生产AI与资产问题验证 · 2026-11-20

## 原始失败

原admin与owner在真实hub.pengxc.com均复现岐研AI无会话权限、A01空态。证据`.tmp/production-ai-assets-20261120/reproduction.json`及4截图。AI agents=[]、status.enabled=false，模型连接条件不满足且付费/knowledge-chat消费者关闭；无Agent缺失或Access缺失原因。历史接口503。A01 overview200真实空态，无脚本异常；代码business家族/绑定项目过滤已独立复核，但生产旧registry数量未直接统计，不称数据不存在或丢失。

## 免费误报修补

从生产main 0e0f969干净构造，仅availability helper、准确HubAgentPanel补丁与相关测试，不混入本机未发布采集链。6项状态测试及3项历史回归共9项通过；覆盖实际disabled原因、真正Access拒绝、旧agents不解锁、未知disabled保守拒绝及旧本机status兼容。原工作区依赖链接已失效，候选按main现有pnpm11.19.0冻结锁独立安装；Vite构建4.90秒通过，不改工作区依赖。

实际Chrome以候选HTTP dist替换静态资源，保留生产域名，API真实请求生产：原两账号各一次disabled显示准确提示，输入/新建禁用、history和knowledge-state请求均0；另以受控Access拒绝响应验证原权限提示与禁用仍保留。共3检查、3截图/2录屏，无页面异常和非预期请求失败，无新科研会话/任务、模型调用或费用。受控拒绝不冒称生产权限已改变。证据`.tmp/production-ai-assets-20261120/preview/`。

独立只读评审未见新增P1/P2；确认未ready不提前读历史，旧资产仍需只读兼容而非取消过滤，既有enqueue围栏不能代签仅新任务认领。免费修补main/生产回执待后续追加。当前AI实际启用与旧资产显示尚未恢复，需按专项准确范围确认实施，不以本次UI测试签署两项业务已恢复。

## 第一项资产修正准备

真实生产原catalog按scope返回：admin原Project10/StudyB4，owner各2；default overview遗漏这些scope。readAssetOverviewScopes将binding与registry范围去重合并，继续app角色逐范围原授权/来源校验，新增未绑定范围不开放创建。11相关测试及独立PG只读SQL通过，0写/0模型/0Worker；独立总评无P1/P2。仅恢复已支持的business资产统计，27份legacy尚未恢复。发布后与上述原生可见集合逐ID比较，不能把42原始登记当可见数。

免费AI误报修补95d9a73/44566718840已实际生产成功，原两账号真实静态/API均复验准确提示、输入/新建禁用、历史请求0，未调模型；不能据此说AI已启用。
