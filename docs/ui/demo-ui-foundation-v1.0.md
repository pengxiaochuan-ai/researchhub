# 岐研 Demo UI Foundation v1.1

状态：Frozen  
主验收视口：1440px Desktop  
实现来源：`src/design-tokens.css`

2026-10-20：按[ADR-0004](../decisions/0004-scoped-reading-typography.md)追加显式Reading角色；原有数值保持不变，文件路径保留。阅读角色先在E02样板验证，不自动扩展到所有工作区正文。

## 适用范围（2026-10-19 澄清）

本文件的字号、间距及 Shell 约束适用于科研工作区和管理治理工作区。P00、P001、P002 等开放首页及 P003–P009 门户页面按其页面职责使用门户布局，不套用侧栏、64px 工作区顶栏或 14px 正文。开放门户的阅读字号及响应式验收见 [门户排版与可读性规范](portal-typography-v1.0.md)。

2026-10-19仅澄清既有作用域与颜色使用条件；2026-10-20经ADR-0004追加Reading Token并在E02显式使用。既有Token数值和Shell尺寸不变；公共Button的行为契约见[UI/UE规则](frontend-ui-ue-rules-v1.0.md)，不能再将本文件理解为“运行代码未修改”。

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
| Reading | 16 / 28 | 400 | 显式长篇阅读正文；不是表单/表格默认字号 |
| Secondary | 13 / 20 | 400 | 描述与辅助信息 |
| Caption | 12 / 18 | 400/500 | 标签、时间、元数据 |
| Button / Tab | 14 / 22 | 500 | 操作和标签导航 |

12px 是工作区低优先级元数据的下限，不是所有说明文字的默认字号；操作说明、重要限制和长段正文应按其信息角色使用 Body 或 Secondary。表中的 Display/H1/H2/H3 是视觉 Token 名称，不能据此跳过 HTML 的标题语义层级；普通业务页标题使用 H1，Display 用于需要强化的工作区概览标题。

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

颜色是否可用于文字，必须结合实际背景检查。`--text-tertiary: #8B98AC` 在白底的对比度约 2.92:1，不能作为需要阅读的普通文字（包括筛选标签）的默认颜色；此类辅助文字优先用 `--text-secondary`（白底约 5.10:1）。保留 tertiary Token 供适用的装饰或非文字场景，不能将 Token 存在等同于文字对比度达标。比值按 W3C 相对亮度公式计算，透明背景、图片和渐变需另行核验。

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

2026-10-20执行范围补充：19页是ADR-001的历史最低回归集；当前必须从`platform-pages.json`读取页面清单，对全部受影响消费者回归，不能用固定19页替代。新增实施与交互检查见[UI/UE规则](frontend-ui-ue-rules-v1.0.md)。本补充不改变任何Frozen Token数值。

