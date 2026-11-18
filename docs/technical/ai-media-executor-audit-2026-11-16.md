# 岐研AI · ASR与视觉执行器核查

2026-11-16。用户本轮要求：核查现有执行器，明确转写、画面摘要与原视频时间点的对应规则。本轮为**免费只读核查＋设计**；没有接通新业务、修改页面/权限/旧系统、创建表、重载服务或进行模型推理。没有读取患者视频或远端配置；没有调用旧VideoAnnotator。运行观察只代表本次快照，不保证之后仍相同。

## 1. 已核实的结果

| 项 | 本次事实 | 能证明什么／不能证明什么 |
| --- | --- | --- |
| 旧系统当前代码 | `app/server/src/ingest/media-inspection.ts`仅调用ffprobe读取格式/时长/流；旧raw-video/raw-audio Skill由`skill-visibility-policy.ts`明确退役 | 能复用归档、读取、检查与父链；没有当前ASR/视觉摘要适配器。历史服务进程存在不等于可恢复调用 |
| Hub当前代码 | `server/ai-agent/session-media.mjs`的`contentUnderstood:false`及`MEDIA_CONTENT_UNAVAILABLE`真实存在；登记只引用检查结果 | 现有上传/登记不是内容理解；不得提前删除不可用提示或将文件名送模冒充视频结果 |
| 本机资源 | Apple Silicon arm64、64GiB内存；Python3.12.13位于另一项目既有venv | 可作为离线验证候选；不把该venv当Hub正式运行依赖，不安装/升级或修改它 |
| ASR软件 | openai-whisper20250625、faster-whisper1.2.1、CTranslate2 4.7.1、torch2.11.0已安装 | 软件存在；尚无本轮真实转写、速度或中文专业准确率证据 |
| Whisper权重 | tiny/base/small/medium的实际SHA256与已装Whisper官方模型表一致 | 现有可用权重候选；不是已完成中文转写验收 |
| Whisper large-v3 | 本机同名文件存在，但SHA256不匹配 | 本轮排除。可能不完整或并非对应权重；不自动下载覆盖，不靠文件名判定可用 |
| Faster-Whisper缓存 | base的本地snapshot完整，CPU int8、单线程断网初始化通过；small缺`model.bin` | base可离线加载；small当前不能作为已就绪模型。base使用`vocabulary.txt`，不是凭缺少`vocabulary.json`误判失败 |
| 视觉服务 | 本机LM Studio 1234的只读模型清单可达，列有`qwen3.5-9b`、`qwen/qwen3.6-35b-a3b`等，声明vision=true；当时全部loaded_instances为空 | 有模型与图像输入候选，但尚未加载或发图片请求；不能宣称视觉实际可用或已验收 |
| 退役链 | 观察到旧VideoAnnotator进程；工作区现行规则仍禁止恢复旧检测Skill | 未请求其接口、未读取其项目文件/真实材料、未将其作为本片可复用摘要服务 |

Faster-Whisper base离线初始化使用固定本地snapshot、`local_files_only=True`、`HF_HUB_OFFLINE=1`及禁止网络连接；调用`WhisperModel`构造器但不调用`transcribe`。首次初始化0.198秒，落盘证据时复核0.178秒；都不是转写吞吐或SLA。CPU支持float32/int8/int8_float32。可重复核查脚本`inventory.py`、实际`inventory.json/log`保存在私有`.tmp/ai-media-understanding-audit-2026-11-16/`：6个视觉候选、已加载0、推理请求0、业务写入0、远端请求0（仅有1次本机模型元数据GET）。

补充环境差异：在Hub目录直接执行`python3`实际落到Xcode Python3.9，缺少faster-whisper；明确使用已观察的另一项目Python3.12绝对解释器才可初始化。首次隐式解释器失败单独保留为`implicit-python-rejected.log`，不据此修改Hub PATH或旧venv。该差异进一步说明“本机有安装”不等于“Hub运行环境已装配”。

## 2. 复用方案比较

| 路径 | 优点 | 当前代价/限制 | 建议 |
| --- | --- | --- | --- |
| 已有本机ASR＋LM Studio图像模型 | 不新增云资源或外送；已有权重可减少安装；便于合成验收 | 缺Hub适配器、任务/证据持久层、视觉真实请求及中文准确率/长视频性能证据 | **首选验证路径，尚未批准为正式部署选型** |
| 新增ASR/视觉云API | 可独立扩容、降低本机资源要求 | 需要明确供应商、数据流、费用/业务计费、凭证与权限，当前未核准 | 暂不调用，不以此作为默认回退 |
| 恢复旧VideoAnnotator/退役Skill | 历史有部分视频检测代码/进程 | 当前明确退役，且不是已证明的通用转写/摘要服务 | 不采用 |

建议首个免费能力验证先用Faster-Whisper base证明闭环，再用已校验Whisper small/medium比较合成中文术语；不预判base已经达到科研人员可用质量。视觉优先验证体积较小的本地`qwen3.5-9b`，必要时再比较已存在的35B模型；此为工程推荐，不代表用户已选定。加载/卸载视觉模型会改变共享模型运行状态，本轮未执行。

后续部署需要Hub自己可重复构建的Python依赖/媒体执行进程，现有公共权重只读复用。不能让正式Hub依赖其他项目venv的偶然版本；新安装、模型下载、共享模型装卸、部署及运行权限在实施规格中冻结，不能借本次核查自动扩围。

## 3. 还缺的真正接线

1. 独立受控媒体执行器：音轨解码/分段、ASR、真实PTS抽帧及本地图像请求；不能把这些放进持PG锁的API事务或旧通用Worker。
2. 内容任务与证据持久层：原件SHA/版本、执行器/权重/提示版本、租约/尝试、独立分支状态、覆盖清单、片段/帧证据和引用；本轮没有新增表或写入许可。
3. Hub真实Agent分支：旧普通对话边界明确不接收原始视频/逐字转写，Hub目前也主动拒绝视频内容问题。应新增受控媒体工具，仅向研究Agent交付当前有权的最小证据/定性结果；不全局放开旧输入边界，不把原视频/逐字转写/文件路径放进旧通用prompt。
4. 接入业务用量与资源限额：本地ASR/视觉不伪造Provider Token账单；如后续用付费模型，复用租户/账号额度、并发预留和实际用量结算，不恢复临时开发额度。
5. 双角色合成整链及专业可用性：当前只能证明安装/元数据/离线加载，尚缺真实中文音频转写、图像请求、时间回链和用户验收。具体对应规则见[处理与时间来源契约](../product/qiyan-ai-media-content-contract-2026-11-16.md)。

## 4. 四层结论

| 层 | 本轮结果 |
| --- | --- |
| 代码有执行路径 | 上传/检查/登记已有；ASR/视觉内容工具尚无Hub接线 |
| 目标配置可用 | ASR base离线初始化通过；视觉API/模型元数据存在，当时未加载 |
| 真实请求实际执行 | 本轮转写请求0、图像推理0、付费调用0；初始化不等于推理 |
| 用户业务结果达标 | 未验证，不使用“内容理解已上线/已验收”措辞 |

## 5. 官方依据与边界

- [Whisper转写实现](https://github.com/openai/whisper/blob/main/whisper/transcribe.py)：ASR片段/词级对齐是识别输出，不能当精确人工标注。
- [Faster-Whisper](https://github.com/SYSTRAN/faster-whisper)及[加载实现](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py)：核对本地加载、片段/词级时间及VAD选项；本机具体版本仍以实际包为准。
- [LM Studio模型清单](https://lmstudio.ai/docs/developer/rest/list)：区分vision声明与loaded_instances；二者不能替代真实图像请求。
- [FFmpeg showinfo](https://ffmpeg.org/ffmpeg-filters.html#showinfo)与[ffprobe](https://ffmpeg.org/ffprobe.html)：真实PTS/时间基由媒体工具提供，不能用平均fps推算可变帧率位置。

未访问云控制台/远端配置、临床库或用户原始视频；不自动修复模型缓存。shared19501未被本轮重载或修改，未向其他会话发送协调消息。

## 6. 本次文档验真与独立评审

已检查两份文档的相对链接、库存证据断言及坐标示例计算，`document-checks.json`通过；可执行业务没有变化，因此不运行应用构建/数据库或浏览器功能用例，不据此宣称能力验收。`inventory.json`中的远端请求0仅指执行器探测，公开官方文档查阅不在该运行记录内；本轮并非“全程断网”，模型初始化阶段确实禁止网络。

一次独立只读评审核对两份文档及指定旧/Hub源码，结论：无重要阻断。重点覆盖PTS/播放器/音频时间域、VAD不二次还原、ASR估计、抽样覆盖、材料/授权边界及四层状态。评审没有连接HTTP/PG/模型或写文件；此结论是设计和现状审查，不代替后续实际工具执行/时间回放/研究者验收。技术事实已核实，新的处理契约仍为待用户评审建议稿。

本轮相关代码指纹前后相同，文档链接和证据检查通过。两份新文档及现有产品基线/变更、视频规格、版本记录和索引已同步Notion，保留其他会话内容；使用说明不适用，因为用户操作尚无变化。[Notion核查](https://app.notion.com/p/41a56479ab58810cb6e6d87b96869abf) · [Notion规则建议稿](https://app.notion.com/p/41a56479ab5881f99128ed9e7a51529d)。
