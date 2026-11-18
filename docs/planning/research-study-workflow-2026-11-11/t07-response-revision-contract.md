
## 转版与采集共同锁序

迁移执行先锁 project → target protocol → 全部 subject → enrollment → visit → task。所有会与之竞争的写入在取得任一 subject 锁之前，先在相同作用域对 project 和所绑定 protocol 取共享行锁，再按统一顺序锁并重新读取被试与入组绑定。批量写入须在全部 subject 预锁之前完成 project/protocol 预锁；仅在逐项 helper 内补锁不足以修复倒序。既有外键、同意门禁和迁移排他锁不得弱化。先在受保护合成库复现实际外键取锁竞争，再分别验证写入先、迁移先及失败事务不留半写；覆盖范围以真实服务/双事务证据为准。

raw worker 的任务 claim 原本先于发布回调加行锁。为避免与 `project → processing_task` 批量导入及排队的转版形成三方环，`withWorkerPublication` 允许受信任服务在当前授权验证后、claim 行锁前执行可选的同事务前置锁；默认调用顺序不变，回调不能接受客户端指定或启动外部工作。raw 发布使用该钩子先锁 project/protocol，再锁 claim 和 subject，锁后复核绑定。`raw-worker-lock-pg.json` 验证 project 等待时 processing_task 可被独立 NOWAIT 取得，转版式修改提交后旧 worker 不发布；此例不等同完整真实转版执行。
