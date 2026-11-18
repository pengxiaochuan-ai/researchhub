# ResearchHub Collector 本地项目骨架实施计划

> 本计划只对应用户 2026-10-31 “建立项目”的授权；不等于批准采集来源、数据库角色、云部署或真实运行。

**目标**：在 `/Users/mac/aisciencesys/researchhub-collector` 建立平级、独立 Git/Python 项目，可安装、可离线验证，默认不能访问外站。

**依据**：[采集设计评审稿](../specs/2026-10-31-hub-collector-design.md)及 [ADR-0005](../../decisions/0005-collector-web-framework.md)。

**范围**：Python 3.11+、Scrapy 主网页框架、Scrapling 可选增强、分开的 API/网页通道目录、来源目录的默认拒绝门禁、v1 关键词原文、保守 Scrapy 设置和离线测试。APScheduler 只固定依赖，不启动任务。候选/版本通道契约留到首个来源与数据库设计获批后实现；无真实 spider、无数据库/Hub 写入口、无后台进程、无远端配置或付费调用。

**文件职责**：`pyproject.toml` 锁定依赖；`src/hub_collector/keywords.py` 保存原检索式；`policy.py` 验证来源授权；`__main__.py` 提供离线状态/配置检查；`settings.py` 提供 Scrapy 保守默认值；`tests/` 验证关键词、授权拒绝、CLI 与配置；`README.md` 写明已实现/未实现及后续门槛。

## 任务 1：离线默认拒绝

1. 先写测试：空目录与 draft 来源校验通过但始终为 0 个获准来源；任何本地“approved”声明均拒绝。观察预期失败。
2. 实现最小目录校验与 CLI；运行单项和全套测试。具名审核必须由后续 Hub 审核链提供，不能由本地 JSON 自称完成。
3. 添加项目元数据、独立 `.gitignore` 与可安装包；验证 `validate-config` 在空策略下明确显示 0 个可采来源。

## 任务 2：双路径与关键词契约

1. 先写测试：v1 原文保持 39＋8 个有序词；Scrapy 的 robots、每域并发、延迟与自动限速有保守默认值。观察预期失败。
2. 实现最小关键词与 Scrapy 配置；保留 `api`/`web` 独立目录但不写假适配器；运行全套测试。
3. 添加 Scrapy 配置并用框架自检确认 robots、每域并发、延迟和 AutoThrottle；当前没有 spider，真实 spider 的允许域白名单须逐站核准后配置；Scrapling 不在默认环境安装或启用。

## 任务 3：交接

1. 记录本机安装、测试、CLI 实际输出和依赖版本；只初始化本地 Git，不创建远端仓库。
2. 同步 ResearchHub 文档索引与 Notion；核查没有触及旧系统、临床库、专用合成库、真实站点、云或付费服务。
3. 明确下一阶段需要逐站具名批准后才可写首个真实适配器及候选入库链。

**验收**：新目录存在且是独立 Git；隔离环境能安装；全部离线测试通过；默认来源配置为 0、网络/调度均未启动；README 的能力状态不把骨架误称为双路径采集已实现。

## 2026-10-31 本机执行证据

- `uv sync --python 3.12` 成功，创建项目独立 `.venv`；Scrapy 2.19.0、APScheduler 3.11.3 已安装，Scrapling 0.5 仅为可选依赖且默认未安装。
- `uv run python -m unittest discover -s tests -v`：7 项通过（先观察关键测试失败再实现；补测草稿夹带批准标记）；`uv build` 生成 sdist 与 wheel 成功。
- `uv run hub-collector validate-config config/sources.json`：`approved sources: 0`；`uv run scrapy list`：空列表；`uv run scrapy settings --get ROBOTSTXT_OBEY`：`True`。
- 仅新建本地平级项目及文档，未连接外站/数据库/Hub，未启动定时进程、云资源或付费服务。此证据只支持“骨架可运行”，不支持真实采集/入库/页面/AI验收。
- 独立只读总评审无阻断项；按评审修正域白名单表述与草稿批准标记校验。
