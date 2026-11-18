# T18 更正后新报告验收合同（准备态）

此候选独立于基线报告执行器，保留 fail-closed sentinel；当前不请求、不连接数据库、不更正或创建任何事实。待根完成基线报告逐页 QA、原主更正/旧依据失效/新快照和新 Methods 真实验收，且 S10 稳定冻结、执行器经独审后，才可由主循环执行。此阶段只核通用合成软件，不表示临床或生产。

## 不可替代的输入

固定读取 benchmark、原 capture/basis/method 与根 QA 后 `t18-main-report-current`、`t18-main-correction-current`、`t18-corrected-method-current`。对文件内容逐一SHA绑定：原报告是 passed、released、真实受控 DOCX 且同原 Run；correction 为 passed 的 correction-and-new-basis-only，并绑定原 capture/basis/method/report 四个文件摘要；新 Methods 为 passed、completed/confirmed、原 plan、新 snapshot、新 Run 且其 correctionSha/basisSha 精确匹配输入。任一文件/来源/原身份未知均在请求前停线；独立基线 pointer 不被覆盖。固定 generic-v2 oracle SHA 与 correction.expected 对照，不能根据大模型重新计算。

## 当前来源与新报告

真实 GET 同原计划已批准版本和新快照，完整 manifest 等于 correction.preview；新计划审核id保持旧值，质量门与快照id均不同于原版。ONSITE 仅当前第2修订 `value=1`，`optional_value=0`、`completed=false` 不变，旧第1修订仍可精确读；其他 H5/CSV 全部原答卷ref/answer/version/日期/历史和导入来源不变。三访视必须 completed/current，新固定表单、revision、当前 responseVersion/父链逐格一致。新 Run 的整个 dataSources.analysisBasis 与新 snapshot basis 一致、人工确认及唯一 Worker dispatch 真实证据齐全；逐 `fieldKey→key` 核 `oracle.correction.expected`。

新 S06 Run 回链进入 S10，唯一新 artifact/version=1；不得复用/覆盖原报告、旧快照、旧 Run 或重复创建。独立 state/journal/evidence/pointer，目标报告与原报告 artifactId 必须不同。通过同一真实 admin 显式 create/review/release/export，fresh authVersion/current role 与 runtime PID/ready/ids 在每业务 POST 前重验，先持久原键，未知仅原 actor GET 原回执后停线，不自动新POST。现有报告按同 Run 查重；其他基线或独立报告不作为重复。旧报告仍保持历史并由当前依据失效门守住，不用重新发布旧版本伪装新报告。

## Word 和输出

仅当前 released、授权与DOCX服务可用时显式真实导出、ready后浏览器同源受控下载；校验文件服务摘要、大小与实际bytes；通过本地标准库Word XML验证真表格与每项 fixed Run 原字符串/中文字段、单位和固定JSON路径，不以假Word或Mock证明交付。复用纯 `research-t18-report-docx-verify.py`，运行与证据独立于基线。输出技术结果为 provisional，含四个 admin 原键/身份、固定 Run/新 snapshot、新 artifact/job/file、下载路径、输入SHA、日志及截图/视频；根逐页查看、明确 QA 后才可写 passed 及 corrected-report pointer。保留失败和原状态，不发送邮件，不改主例或旧事实。


## 当前已验源码守门（共享目录并行编辑增量）

另一个用户会话正在修改共享登录返回的A02分支，原S10四核心源未变；不得为追逐SHA自动吸纳未验证依赖。根只在独立审阅与真实begin/end同源窗口通过后写私有 `t18-ui-freeze-proof.json`（approved、manifest路径及精确摘要）。报告验收器启动一次读取该证明，随后每次业务POST前、原键写journal之后再次校验同一manifest和其中各源字节；有漂移即禁止新写、保原journal，按原GET交主循环核对，不换键重放或自动更新证明。最后交付亦核同一源码证明。此守门不暂停/修改其他用户会话，不表示要求共享目录永久不再修改，也不将本页证明扩称为所有旧页面源码冻结。
