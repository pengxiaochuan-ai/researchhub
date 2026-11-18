# 文件分析与研究数据入库 · 独立设计评审

2026-11-12，file_data_design_review。范围仅主规格与复用清单、相关源码；只读，无测试/网络/模型/数据库/配置/文件写入。不代表功能或专业验收。

结论：nothing important left。两份文档与关键源码一致，覆盖私有库真实tenant/group/project/owner范围、private不可assignment、已审核通用检索与独立草稿读取、真实Study绑定、确认前零业务写、data工具类型隔离、一次确认、批次原子性与恢复；全部有效旧能力快照及逐项验收已作为实施门槛。

额外边界确认：现有Study resolver并不能把read/configure自动视为collect授权，旧Ingest有独立authorizeIngestInTransaction；作者在规格明确“可读不等于可导入”，选择及提交必须核当前导入授权/政策/能力，不顺便启用整个正式采集。未增加用户问题或确认次数。

后续：提交用户评审规格，批准后再展开测试先行小步代码计划；DDL/权限/收费/云/远端配置及旧后台影响逐项执行前确认。使用说明不增加未交付操作；页面与产品代码均未修改。
