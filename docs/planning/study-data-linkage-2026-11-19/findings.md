# 当前任务发现

2026-11-19：已确认旧“标准数据”是被试档案与状态列表（不是全部标准化/可分析结果）；原始数据为项目内文件/照片/处理任务。Hub已有Study绑定、Subject/Enrollment/Visit核心；需按现行AI上传及结果契约逐项核实。旧专项记录只作参考，不继承其未批准的增量。

并发现场：共享树有门户、帮助中心、文案清理与会话等改动，均非本任务；不覆盖。19501及19611运行归属待当前工具结果核对。本任务先纯源码清单，尚无业务写入。

当前现场：19501原PID99513仍监听，19611未监听；未重载。原Subjects读取仅按当前subjects权限或精确导入/媒体授权集合；不能用Study可读推导全被试数据可读。server/research-capture/file-links.mjs已有访视内文件→任务→指标及签名来源，controller已装配。RealAiWorkspace的hubAiHref/route.uploadStudyId可携带Study默认值，但被试/访视与明确返回尚需核对；AI来源会话与目标Study是两条父链，不能因URL默认值迁移会话或扩大数据授权。旧导入文档有阶段限制，必须以当前代码/装配核验。

本轮启动两个只读原生子Agent分别核对AI/后端契约与页面缺口。用户无编排配置文件，沿当前原生模型，无外部Provider选择。检索中遇到不存在文件/未匹配shell glob，已改用rg --files定位；无写入影响。

核对后实施结论：不新增研究级数据总数（原S03目录不能冒充全研究标准化统计）；S04新/data仅在当前data菜单/真实租户管理员权返回Subject/Profile白名单与无visit原件，其余明确受限。原file-links特征值刻意隐藏，本轮通过单独canReadFeatureValues、当前data权/同意/完整固定父链、完整任务及核验SHA扩展值/单位/版本，不按hash推值。

AI档案Excel与普通CRF导入分开；多被试Excel原件挂carrier且常无visit，不按carrier冒认全部被试。暂不新增跨会话确认批次索引，仅沿原本人精确来源结果；当前档案读真实SubjectProfile，历史批次仍由AI回执证明。原始独立音频/图片/EEG/fNIRS不在AI共享上传accept/dispatch，本轮不声称全模态处理。

四页面通过hash定位，不扩严格业务query。AI路由增加uploadSubjectId/uploadVisitId且校验层级；登录/会话过期/新建会话保留，同会话history保留、主动切其他历史会话清除采集上下文，避免将旧目标带给他会话。新上下文先GET Study及Subject/Visit真实父链，视频还经ingest-targets校验后预填；原current/pending优先。
