# 单篇文章共同后端验证（实施中）

用户已批准精确c5私有兼容及本机、生产各一次真实请求；不改页面布局、旧源码、角色、成员或数据库结构。生产验证尚未完成，不能视为完整交付。

- 原页面context、ensure、commands/send、state、source接同一文章执行模块；资料读取器仅随环境绑定变化。原知识库及其他本机业务分支保留。
- 精确待发布代码126项runtime测试通过。另有文章控制器原commands禁网契约、固定原件SHA/长度、同轮原件缓存、队列事务分流及14项执行配置测试。
- 精确待发布代码真实PG六场景全回滚：admin/owner成功、无逐Study成员管理员、非法JSON、未知用量、入队前authVersion撤销、Provider返回时正文撤审。HTTP为合成响应，真实模型调用0；撤权零新消息/任务，撤审无答案，已知70Token结算，未知用量待核。
- 已用封包副本复现55→c5精确摘要；原核心和数据库模型未修改。standard仅接受精确55↔c5切换，其他摘要拒绝；旧85↔55规则保留。
- 本机19501原位启动c5，原页面context/state/commands均200，正常额度、输入可用、无pageerror，截图/录屏保留。原历史会话仍保留，不自动重跑。
- 本机实际通过原页面commands发送1次，文章PMC13691533，交付定性解释及1条current固定版来源。未自动重试。本次保守费用45936 microCNY，累计2318904 microCNY，低于原5000000上限；旧账本内容未改。
- 仍待：生产同版发布、既有获准原件和原页面核验、获批生产1请求、来源点击及历史175排队/账本/旧服务保护复核。

私有证据位于`.tmp/article-runtime-parity-20261120/`，包括sealed-native-pg.log、sealed-source-suite-third.log、browser-free.json、article-local-real.json及截图/录屏。测试通过不替代用户专业验收。
