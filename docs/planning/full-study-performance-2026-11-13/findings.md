# 当前事实与待证假设

已验收更正版：38次显式process POST实测35.967–53.335秒，中位45.418秒；另1次由create派发。两个bulk review曾在Node内置300秒响应头等待中断，但每轮39个原生审核最终提交，按原子收据恢复本地journal。提高AbortSignal预算未覆盖该传输上限，前轮仅修了验收工具传输，产品长路径仍待优化。

旧单根profile在事务内六类授权读取去重后约3.55秒/3065次DB调用；这不是本轮新测量，不能当当前接口已经提速。当前core.project仍逐访视/问卷调用原生读取，process/review/receipt路径的重复次数与事务保护需进一步定位。

当前运行核实为owned PID65361，19501–19507健康；本轮未重载或发业务写。原验收结果保留，使用新证据目录full-study-performance-2026-11-13。

## 2026-11-14更新（以上为起始时点历史）

当前owned运行已受控加载为PID93884。stage1完成24个新原生计算，客户端有响应23个（create含1片）、1个原response随真实客户端中断丢失，原key精确GET已证明完成，未重新POST。此阶段单项仍有17–25秒波动，不能拿最初10.15秒宣称稳定达标；原36–53秒基准与stage1分层保留。

单根before3.877秒/3065逻辑调用，配对读取+ID锁去重后3.235/2.921秒、1573逻辑调用；不是实际HTTP。下一最小候选仅固定protocol/policy读：validateCase已持protocol共享行锁，原更新路径先独占同锁，approved policy由数据库禁止修改。需精确scope/id/args、只读单project、写/上下文变化即失效，不扩enrollment。
