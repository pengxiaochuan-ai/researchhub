# A01剩余体验与录屏收口验收

2026-11-13｜本轮仅执行用户明确要求的异常提示、鼠标复测与录屏，不开发其他页面。当前目录串行实施，专用合成库、原owner/admin及原Study；旧系统源码/服务/角色/权限/临床/云/远端配置/付费AI/发布均未触碰，未新建资产/版本/文件/许可，不重arm旧探针。

## 本轮结论

**三项技术收口已完成，可交用户进行A01业务体验验收。** 之前单次独评的Minor共享协作假loading，以及鼠标入口与实时录屏缺项已补齐；这不是用户专业签收或生产上线，也不代表完整60项或A02其余功能完成。没有再发第二轮整页独评。

| 项目 | 实证 |
| --- | --- |
| 协作失败提示 | 原Collaborations在value缺失时不区分状态，一律显示loading。新增blocked与其余辅助区同源；error/未登录/待选择Study显示明确不可用，真实loading及已核空列表保留。SSR亲见RED→GREEN；Chrome独立context只针对协作GET注入503，原表/预览清除、统计—/局部无loading，解除故障后鼠标点原重新读取恢复真实许可历史 |
| 鼠标恢复 | 原本人量表v1/rev5输入原因，仅测试context在POST发送前abort，未知输入先保留。鼠标点更多→继续上次操作，实际click isTrusted=true、detail=1、pointerType=mouse，原弹窗打开；鼠标核对GET原key，真实后端200/not_found，明确放弃输入。标准鼠标路径未复现旧单次无效，不凭猜测改交互。此项不冒称新一轮提交后丢响应；真正提交后503/原key一次证据仍沿用C07历史 |
| 实时录屏 | 复用旧项目已安装Playwright1.63/本机Chrome及ffmpeg，在独立context配置recordVideo，未安装依赖、未接管原用户标签。原生实时Chrome渲染录制，不拼接截图；owner27.44秒、admin17.48秒，原VP8 WebM与H264 MP4均保留，实际1910×1074/25fps。配置视口1910×1075，编码器实际高度1074按元数据如实记录；截图保留1075。完整解码无错误并回看中末帧及故障关键截图，开始保留真实页面加载过程 |
| 双角色页面链 | 两账号各走五主Tab、四预览、真实API与当前Study；owner可见6/admin10。1910×1075、右栏350/gap16、六卡、14/22、无根横溢出。Chrome主栏1213px（与前轮IAB动态主栏不是同一渲染环境，未拿它冒称跨浏览器像素相同）；本轮未改CSS/Shell/原区域 |
| 写入与隔离 | context禁止所有非认证业务写，唯一具名trash请求发送前中止；正常auth/login与renew沿现有会话规则。不新增/恢复权限，不直接修改浏览器存储，不触发模型。PG/HTTP前后10资产/15版/39事件/trash0，F03两份v2和旧KB/docs保持；4绑定文件仍在。旧V1两角色各5正读＋5拒绝、P01资产排除及精确public/Role/旧10-20守门仍通过 |

## 检查与证据

- `evidence/a01-close/collaboration-red.log`／`collaboration-green.log`：仅失败呈现语义的RED→GREEN，未改业务契约。
- `frontend-final.log` **623/623**；`backend-final.log` **112/112**；`build-final.log` **5.39秒**，原>500kB告警保留。`diff-check.log`限定原共享接线/产品文件无空白错误，不声称整个脏工作树洁净。
- `browser-result.json`／`closure-verified.json`：真实双角色、pointer事件、所有API路径与HTTP状态（无Cookie/口令）、模拟故障边界、业务转发0、页面异常0、视频hash。
- `before.json`／`after.json`／`http-final.json`：专用库和当前实例13672实证，无临床库；新族10/15/39、旧数据/角色/public严校通过。最终当前环境七服务原样，无本轮重启。
- `owner-collaboration-failed.png`／`owner-collaboration-recovered.png`：故障与恢复；`owner-recovery-unknown.png`／`owner-recovery-opened-by-mouse.png`／`owner-recovery-not-sent-confirmed.png`：真实鼠标与原结果核对；两账号五Tab/四预览/最终图谱各PNG留存。
- `owner.mp4`、`admin.mp4`：供播放；原始`owner.webm`、`admin.webm`保留。`video-metadata.json`、`video-contact-sheet.png`及首/中/末解码帧为录像质量证据，不用拼图冒充录像。

首轮验收脚本因错误使用“创建”定位实际“登记”表头而超时；第二轮UI全部走完，但脚本把正常`/auth/renew`当成业务写而拦截，整体未通过。两轮失败原日志/JSON/视频保留。修正测试定位和认证续期白名单后第三轮全部通过，非修改产品权限或绕过业务门禁，未重放真实业务。

## 当前交接边界

- A01 C01～C07本机技术收口完成；剩余是用户按实际科研任务进行业务/专业体验签收，真实部署与生产全扫描仍另行确认。
- 读取失败、未提交故障与已经提交但回执未知是不同事实，本轮录像只对前两者新增证据；不改旧提交后503账本。
- 原录屏缺口由当前用户明确要求录屏、根AGENTS明确要求Playwright录屏后，直接复用现有安装补齐；未以新增软件/权限/费用替代。
- 接下来不因本报告自动切A02或其他模块。建议先由用户完成A01业务验收，再按既定顺序推进A02。
