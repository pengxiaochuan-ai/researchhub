# 岐研 Demo UI Foundation v1.0

状态：Frozen  
主验收视口：1440px Desktop  
实现来源：`src/design-tokens.css`

## Foundation

### Layout Tokens

| Token | 值 | 用途 |
| --- | ---: | --- |
| `--layout-topbar` | 64px | 固定全局顶部栏 |
| `--layout-sidebar` | 220px | 固定平台左侧栏 |
| `--layout-page-padding` | 24px | 页面左右留白 |
| `--layout-breadcrumb` | 40px | L1 Breadcrumb |
| `--layout-page-header` | 88px | L2 页面标题区，允许 80–96px |
| `--layout-context-nav` | 48px | L3 上下文导航 |
| `--layout-content-gap` | 16px | 页面内容间距 |

主内容起点为 `x = 220px`。Topbar、Sidebar、Breadcrumb、Page Header 和 Context Navigation 的坐标不能由业务页面覆盖。

### Typography

中文字体：`PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif`。  
英文和数字：`Inter, system-ui, sans-serif`。  
禁止在工作区使用宋体、楷体和书法字体。

| Token | Size / Line-height | Weight | 用途 |
| --- | --- | ---: | --- |
| Display | 28 / 40 | 600 | 页面主标题 |
| H1 | 24 / 34 | 600 | 重要业务标题 |
| H2 | 20 / 28 | 600 | 一级 Section |
| H3 | 16 / 24 | 600 | Card 标题 |
| Body | 14 / 22 | 400 | 正文 |
| Secondary | 13 / 20 | 400 | 描述与辅助信息 |
| Caption | 12 / 18 | 400/500 | 标签、时间、元数据 |
| Button / Tab | 14 / 22 | 500 | 操作和标签导航 |

### Spacing Scale

只允许 `4 / 8 / 12 / 16 / 24 / 32 / 48`。新增 CSS 不得引入 5、7、10、14、18、20 等任意间距；历史页面逐步迁移。

### Color Tokens

```css
--brand-primary: #5746F5;
--brand-hover: #4938E8;
--brand-soft: #F0EDFF;
--text-primary: #0F2347;
--text-secondary: #5F6F89;
--text-tertiary: #8B98AC;
--border: #E3E8F1;
--surface: #FFFFFF;
--canvas: #F6F8FC;
--success: #0BA981;
--warning: #F59E0B;
--danger: #EF4444;
--info: #3B82F6;
```

AI 组件使用 Brand Purple，不建立第二套 AI 渐变视觉系统。

### Radius / Border / Shadow

- Tag：4px。
- Button：6px。
- Input / Card：8px。
- Major Card：12px。
- Border：`1px solid #E3E8F1`。
- Default Card：仅边框，无常规浮层阴影。
- Floating：`0 4px 12px rgba(17,24,39,.06)`。
- Drawer / Popover：`0 8px 24px rgba(17,24,39,.10)`。

## Shell

固定顺序：Global Topbar → Platform Sidebar → Breadcrumb → Page Header → Context Navigation（可选）→ Page Content。

## Components

公共组件按以下层级维护：Card、Button、Badge、Input、Evidence Row、AI Interpretation、Decision Panel、Metric。业务页面只能组合公共组件，不得重新定义全局字号、颜色、圆角、Shell 尺寸或阴影。

## 变更规则

页面怎么使用这些 Token（顶栏贴合、24px / 16px、字号下限、滚动）见 `page-layout-practice-v1.0.md`。该文件不改变本文件中的 Token。

修改 Frozen Token 必须：

1. 新建 ADR 说明原因和影响页面。
2. 更新本文件版本号。
3. 在 1440px 下完成 19 页视觉回归。

