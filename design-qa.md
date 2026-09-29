# Design QA — O02 右侧 UI 复刻

## Comparison Target

- Source visual truth: `C:\Users\石海波\AppData\Local\Temp\codex-clipboard-f9a1425b-a035-4c95-a1aa-abf798b4bb43.png`。
- Content and computed-style reference: `http://localhost:5173/` 的 O02 研究机会详情状态。
- Implementation: `http://127.0.0.1:4175/pages/o02/`。
- Implementation screenshot: Codex In-app Browser 当前任务中的 1280 × 720 浏览器捕获；浏览器仅返回内存图像，无持久化截图路径。
- Viewport: 1280 × 720 CSS px，devicePixelRatio ≈ 1。
- State: 页面默认状态，未滚动，右栏 AI 综合研判与顶部研究潜力卡可见。

## Full-view Comparison Evidence

- 源图、参考页右栏和实现页右栏已在同一任务中打开并按相同视口检查。
- O02 顶部右侧呈现“研究潜力 / 高 / 保存机会”，局部导航右侧呈现“分享 / 导出 / 形成研究问题”。
- AI 研判面板位于首屏右栏，旧“与我的匹配度”和旧 AI 解读面板已移除，无重复内容。

## Focused Region Comparison Evidence

| Surface | Reference | Implementation | Result |
| --- | ---: | ---: | --- |
| AI panel | 380 × 424px | 380 × 423px | 通过，1px 浏览器取整差 |
| AI title row | 378 × 54px | 378 × 54px | 通过 |
| AI icon | 29 × 29px，#5746EA，7px radius | 29 × 29px，#5746EA，7px radius | 通过 |
| Reason sections | 118 / 79 / 88px | 118 / 79 / 88px | 通过 |
| Score cards | 114 × 46px，6px gap | 114 × 46px，6px gap | 通过 |
| AI boundary | 354 × 67px，#F2F0FF | 354 × 67px，#F2F0FF | 通过 |
| Potential card | 220 × 133px | 220 × 133px | 通过 |

## Required Fidelity Surfaces

- Fonts and typography：按参考页逐项复制 14px 标题、10.8px 标签、12.8px 问题标题、11.8/17.936px 正文及 10.3px 评分说明。通过。
- Spacing and layout rhythm：标题区 10×12px padding、9px gap；内容区 9×12px；评分区 5px top margin / 6px gap；边界区 7/12/9px margin。通过。
- Colors and visual tokens：面板、标签、绿色评分、紫色图标、边界提示背景与参考页计算色值一致。通过。
- Image and icon fidelity：按用户要求保留“岐研 AI”左侧原 Sparkles SVG，未替换；尺寸调整为参考页 16px 图标 / 29px底座。通过。
- Copy and content：AI 综合研判、缺口重要性、三项可研究性判断、AI 边界及研究潜力文案均来自参考页。通过。

## Comparison History

### Round 1 — blocked

- P1：实现面板宽 340px、高 467px，参考为 380px、高 424px。
- P1：标题区 68px、图标 34px 渐变底，参考为 54px、29px 纯色底。
- P2：评分卡 58px，参考为 46px；正文、标签和边界提示字号偏小。
- P2：顶部研究潜力卡高度、按钮宽度和字重不一致。

### Round 2 — passed

- 直接采用参考页 DOM 的计算样式值修正宽高、间距、字号、行高、颜色、边框和圆角。
- 浏览器重新捕获后，上述 focused-region 尺寸全部对齐；仅面板总高存在 1px 浏览器取整差。
- 控制台 error / warn：0。

## Final result

passed
