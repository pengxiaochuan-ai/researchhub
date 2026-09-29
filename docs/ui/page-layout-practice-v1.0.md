# 岐研页面布局实施规范 v1.0

状态：Active  
不修改 Frozen Token。尺寸、颜色、字号一律引用 `demo-ui-foundation-v1.0.md`。  
来源：A01、AI01、P01、H01 的布局对齐。优化其他页面或新增页面时按本文件执行。

## 优化边界

- 高保真图仍是业务内容母版。只修正可读性、对齐、滚动和状态色，不重组正文，不改信息架构。
- 不在业务页重新定义全局字体、颜色、圆角、阴影、Topbar、Sidebar 或用户身份区。
- 间距只用 `4 / 8 / 12 / 16 / 24 / 32 / 48`。页面左右留白是 24px，栏与栏、标题区与正文之间是 16px。

## 主区域必须带 platform-main

业务页的 `<main>` 必须写 `class="platform-main"`。公共样式只对这个 class 设置：

```css
body[data-platform-header="true"] .platform-main {
  padding-top: 64px !important;
}
```

64px 等于 `--layout-topbar`。历史页面常见 `main { padding-top: 70px }`，那是旧版 70px 页头的偏移。顶栏已经是 64px，多出来的 6px 会在顶栏下沿和面包屑之间露出画布色。

这是和顶部导航的间距，不是和左侧导航的间距。左侧贴齐由公共规则 `main { margin-left: var(--layout-sidebar) }` 负责，不依赖 `platform-main`。

| 页面 | main 上内边距 | 原因 |
| --- | --- | --- |
| 有公共页头的页面 | 64px | 顶栏高度，面包屑紧贴顶栏下沿 |
| P01 | 80px | 无面包屑和页头，64px 顶栏再加 16px 内容间距 |

页面自己的 `padding-top` 不得再写成 70px。若页面样式使用 `!important` 覆盖 padding，有页头的页面水平方向必须是 0，避免和标题卡片的 24px 外边距叠成 48px。

## 页头与正文左缘对齐

公共页头 `section.qiyan-page-context` 宽度 100%，背景从侧栏右缘开始。不要给这一整块再加水平 margin 或 padding。

| 区域 | 水平关系 |
| --- | --- |
| 页头背景 | 贴侧栏，无额外间隙 |
| 面包屑文字 | 左内边距 24px（`--layout-page-padding`） |
| 标题卡片 | 左右外边距 24px，下外边距 16px |
| 上下文导航 | 左右内边距 24px |
| 正文 | 左右留白 24px，与标题卡片左缘对齐 |
| 多栏间距 | 16px（`--layout-content-gap`） |

有公共页头时，正文容器自己留 24px，`main` 不再加水平 padding。P01 没有公共页头，24px 直接写在 `main` 上。

## 字号与换行

工作区可见文字不得小于 Caption（12px / 18）。历史页里的 8–11px 缩略字号，按角色升到下表，不新造字号。

| 角色 | 使用 |
| --- | --- |
| 页面标题 | H1，24 / 34 / 600 |
| 区块标题 | H2，20 / 28 / 600 |
| 卡片标题 | H3，16 / 24 / 600 |
| 正文、按钮、Tab | Body，14 / 22 |
| 说明 | Secondary，13 / 20 |
| 标签、时间、元数据 | Caption，12 / 18 |

中文筛选项、Tab、表头不得在词中间换行。一行放不下时，把筛选项拆成「标签 + 当前值」：标签用 `--text-tertiary`，值用 14px / 500，并保持 `white-space: nowrap`。

## 高度

不要用固定高度裁切中文。卡片、筛选条、列表行、说明文字用内容高度；需要占位时写 `min-height`，不写会把第二行切掉的 `height`。

## 滚动

Topbar 和 Sidebar 固定。`body` 与 `#root` 不滚动。

普通页面由 `main` 纵向滚动：`height: 100vh`，`overflow-y: auto`。

多栏工作台（如 AI01）由各栏自己滚动，输入区不跟着消息走：

- `main` 使用 `display: flex; flex-direction: column; overflow: hidden`，并保留 `platform-main` 的 64px 上内边距。
- 工作区 `flex: 1 1 0; min-height: 0; overflow: hidden`。缺 `min-height: 0` 时，子栏会按内容撑高，外层再 `overflow: hidden`，列表会被裁掉且没有滚动条。
- 每一栏 `height: 100%; min-height: 0; overflow: auto`。
- 对话列里，消息区滚动，输入框 `flex: none` 钉在列底。输入框随文字变高，达到页面内上限后在框内滚动。上限不写入 Foundation Token。

## 状态色

- 增长、完成、正向变化使用 `--success`。不要把这类数字放在 `--danger` 上。
- 当前选中行使用 `--brand-soft`，并用 `--brand-primary` 标出当前行。不要用危险色浅底表示选中。
- AI 入口继续用 Brand Purple，不另做一套渐变。

## 参照页

优化尚未对齐的页面时，先对照已经按本规范落地的四页，不要从更早的压缩包样式反推：

| 页面 | 对照点 |
| --- | --- |
| A01 | 筛选不换行、选中行品牌色、正向指标用成功色、正文 24px / 栏间距 16px |
| AI01 | `platform-main`、页头贴顶栏、三栏独立滚动、输入框钉底并向上增高 |
| P01 | 无页头，主区 `80px 24px 24px`，字号不低于 12px |
| H01 | 有页头时 main 水平 padding 为 0，正文 24px 与标题卡片对齐 |
| C01 | `platform-main`，页头贴顶栏，正文 24px，筛选在页头之下。研究列表、研究分布地图、趋势分析在页内切换。查看方案进入 C03 |
| C03 | `platform-main`，页头贴顶栏。正文为试验信息、侧栏要点和岐研 AI 解读 |
| T01 | `platform-main`，页头贴顶栏，正文 24px。筛选下是团队卡片列表，可在页内切到地图。查看详情进入 T02 |
| T02 | `platform-main`，页头贴顶栏。正文为团队抬头、页内标签和右侧成员机构 |
| R01 | `platform-main`，页头贴顶栏，正文 24px。筛选下是研究者卡片。查看详情进入 R02 |
| R02 | `platform-main`，页头贴顶栏。正文为当前任职与成果数字、页内标签、左侧研究说明和右侧任职、团队与合作 |
| E01 | `platform-main`，页头贴顶栏。正文三栏：筛选、论文列表、选中论文。左栏条件区滚动，底部固定应用或清空；结果区标签是已生效条件 |
| E02 | `platform-main`，页头贴顶栏。论文抬头下是页内标签，标签滚动时停在顶栏下；右侧是研究价值与证据质量 |
| E03、O01、S01 | `platform-main`，页头贴顶栏，正文 24px，字号不低于 12px |
| S02–S06、Q01、G01、G02、O02、A02 | 公共 Shell 已带 `platform-main`；筛选不换行，选中行用品牌浅底，正向指标用成功色 |

## 变更规则

本文件只解释既有 Token 怎么用到页面上。要改 Token 数值、Shell 尺寸或一级导航，仍按 Foundation 的变更规则：新 ADR、升级 Foundation 版本、1440px 下做 19 页回归。
