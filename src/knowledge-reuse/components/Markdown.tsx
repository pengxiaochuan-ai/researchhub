import {createElement, type HTMLAttributes} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeResearchMarkdown } from './markdown-normalization';

/**
 * 统一的 Markdown 渲染（Agent 回复用）。
 * 🔴 关键：宽表格 / 代码块用 overflow-x-auto 在气泡内横向滚动，绝不撑破/溢出白色气泡。
 * 供工作台对话气泡与数据 Agent 面板共用。
 */
const components: Components = {
  // 宽表格：外层可横向滚动，不撑破容器
  table: (props) => (
    <div className="my-2 max-w-full overflow-x-auto">
      {/* w-full + 自动布局 → 单元格换行铺满容器；超宽多列时外层再横向滚动，绝不溢出气泡 */}
      <table className="w-full border-collapse text-[13px]" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-ink-50" {...props} />,
  th: (props) => <th className="border border-ink-200 px-2 py-1 text-left font-medium text-ink-700" {...props} />,
  td: (props) => <td className="border border-ink-100 px-2 py-1 align-top break-words" {...props} />,
  // 代码块：横向滚动，不换行不溢出
  pre: (props) => <pre className="my-2 max-w-full overflow-x-auto rounded-lg bg-ink-800 p-3 text-[12px] leading-relaxed text-ink-50" {...props} />,
  code: ({ className, ...props }) =>
    /language-/.test(className || '') ? (
      <code className={className} {...props} />
    ) : (
      <code className="rounded bg-ink-100 px-1 py-0.5 text-[12px] text-brand-700" {...props} />
    ),
  h1: (props) => <h1 className="mb-2 mt-3 text-base font-semibold text-ink-900 first:mt-0" {...props} />,
  h2: (props) => <h2 className="mb-2 mt-3 text-[15px] font-semibold text-ink-900 first:mt-0" {...props} />,
  h3: (props) => <h3 className="mb-1 mt-2.5 text-sm font-semibold text-ink-800 first:mt-0" {...props} />,
  h4: (props) => <h4 className="mb-1 mt-2 text-sm font-semibold text-ink-700 first:mt-0" {...props} />,
  p: (props) => <p className="my-1.5 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => <ul className="my-1.5 list-disc space-y-0.5 pl-5" {...props} />,
  ol: (props) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  // 模型正文不是可信 URL 来源：历史消息中的链接也降级为纯文本。
  // 真正可点击的知识引用由后端 citation 元数据单独渲染。
  a: ({ children }) => (
    <span className="text-ink-700 underline decoration-dotted" title="模型生成链接已禁用">
      {children}
    </span>
  ),
  blockquote: (props) => <blockquote className="my-2 border-l-2 border-brand-200 bg-brand-50/40 py-1 pl-3 text-ink-600" {...props} />,
  hr: () => <hr className="my-3 border-ink-100" />,
  strong: (props) => <strong className="font-semibold text-ink-900" {...props} />,
};

export default function Markdown({ children, allowImages = true, headingOffset = 0, trustedLinks = [] }: { children: string; allowImages?: boolean; headingOffset?: 0 | 2; trustedLinks?: readonly string[] }) {
  // Embedded document headings must not compete with the workspace's single page h1.
  // The default chat renderer is unchanged; only the explicit nested-document mode shifts tags.
  const nestedHeadings: Components = headingOffset === 2 ? Object.fromEntries([1,2,3,4,5,6].map(level => ['h'+level, ({node: _node, ...props}: HTMLAttributes<HTMLHeadingElement> & {node?: unknown}) => createElement('h'+Math.min(6,level+2), props)])) : {};
  // Opt-in only for exact URLs from a currently verified backend projection.
  // Default consumers and arbitrary model links retain the old text-only rule.
  const verifiedLinks: Components = trustedLinks.length ? {a: ({href,children}) => {
    try {const url=new URL(href ?? '');if(trustedLinks.includes(href ?? '')&&url.protocol==='https:'&&!url.username&&!url.password&&!url.port)return <a href={url.href} target="_blank" rel="noopener noreferrer">{children}</a>;} catch {}
    return <span className="text-ink-700 underline decoration-dotted" title="模型生成链接已禁用">{children}</span>;
  }} : {};
  return (
    <div className="min-w-0 break-words text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={allowImages ? {...components,...verifiedLinks,...nestedHeadings} : {
        ...components,
        ...verifiedLinks,
        ...nestedHeadings,
        // Model text cannot initiate browser requests; document previews keep
        // their existing image handling through the default prop.
        img: ({ alt }) => <span>【模型图片未加载{alt ? `：${alt}` : ''}】</span>,
      }}>
        {normalizeResearchMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}

