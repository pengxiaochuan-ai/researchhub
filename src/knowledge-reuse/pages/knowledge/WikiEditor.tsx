import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Placeholder } from '@tiptap/extension-placeholder';
import Markdown_ from '../../components/Markdown';
import { useSystemDialog } from '../../components/SystemDialogProvider';
import { Link2, Image as ImageIcon } from 'lucide-react';

/**
 * 知识库文档编辑器（ADR-0003）。canonical = Markdown。三模式：
 *  - wysiwyg：TipTap 富文本（Confluence 式，默认）
 *  - markdown：源码 textarea
 *  - preview：只读渲染（复用 Markdown.tsx）
 * value/onChange 都以 Markdown 字符串为准。
 */
export type WikiMode = 'wysiwyg' | 'markdown' | 'preview';

const btn = (active: boolean) =>
  `rounded px-2 py-1 text-xs ${active ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:bg-ink-100'}`;

function Toolbar({
  editor,
  requestText,
}: {
  editor: Editor;
  requestText: (options: {
    title: string;
    message: string;
    inputLabel?: string;
    placeholder?: string;
  }) => Promise<string | null>;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force((n) => n + 1);
    editor.on('selectionUpdate', h);
    editor.on('transaction', h);
    return () => { editor.off('selectionUpdate', h); editor.off('transaction', h); };
  }, [editor]);
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-200 px-2 py-1.5">
      <button className={btn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
      <button className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <span className="mx-1 h-4 w-px bg-ink-200" />
      <button className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button className={btn(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()}>&lt;/&gt;</button>
      <span className="mx-1 h-4 w-px bg-ink-200" />
      <button className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• 列表</button>
      <button className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 列表</button>
      <button className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝ 引用</button>
      <button className={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>代码块</button>
      <span className="mx-1 h-4 w-px bg-ink-200" />
      <button className={btn(false)} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ 表格</button>
      <button
        className={btn(editor.isActive('link'))}
        onClick={() => {
          void (async () => {
            const url = await requestText({
              title: '插入链接',
              message: '请输入链接地址',
              inputLabel: '链接地址',
              placeholder: 'https://',
            });
            if (url && url.trim()) {
              editor.chain().focus().setLink({ href: url.trim() }).run();
            } else {
              editor.chain().focus().unsetLink().run();
            }
          })();
        }}
      >
        <Link2 aria-hidden="true" width="14" height="14" className="inline"/> 链接
      </button>
      <button
        className={btn(false)}
        onClick={() => {
          void (async () => {
            const url = await requestText({
              title: '插入图片',
              message: '请输入图片地址(URL)',
              inputLabel: '图片地址',
              placeholder: 'https://',
            });
            if (url && url.trim()) {
              editor.chain().focus().setImage({ src: url.trim() }).run();
            }
          })();
        }}
      >
        <ImageIcon aria-hidden="true" width="14" height="14" className="inline"/> 图片
      </button>
      <button className={btn(false)} onClick={() => editor.chain().focus().undo().run()}>↶</button>
      <button className={btn(false)} onClick={() => editor.chain().focus().redo().run()}>↷</button>
    </div>
  );
}

export default function WikiEditor({
  value, onChange, editable = true, mode, placeholder = '开始编写知识文档…支持富文本 / Markdown / 预览三种模式',
}: {
  value: string;
  onChange: (md: string) => void;
  editable?: boolean;
  mode: WikiMode;
  placeholder?: string;
}) {
  // onChange 用 ref 承载，避免稳定 editor 的 onUpdate 闭包读到旧回调
  const onChangeRef = useRef(onChange);
  const { requestText } = useSystemDialog();
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // 🔴 稳定单实例：**不随 mode 重建**。此前用 useEditor(deps=[mode]) 会在「切到富文本」时于渲染期
  //   重建 editor，EditorContent 撞上过渡态实例抛错；加之全站无 error boundary → 整棵 React 树卸载=整页白屏。
  //   改为单实例 + 下方 useEffect 显式同步内容，既不 stale 也不崩。
  const editor = useEditor({
    editable: editable && mode === 'wysiwyg',
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand-600 underline' } }),
      Image,
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      // tiptap-markdown 提供 storage.markdown.getMarkdown()
      const md = (editor.storage as any).markdown?.getMarkdown?.() ?? '';
      onChangeRef.current(md);
    },
  });

  // 外部 value 变化（切文档）/ 切回富文本时安全同步内容；setContent 容错，绝不让解析异常掀翻 React 树
  useEffect(() => {
    if (!editor || editor.isDestroyed || mode !== 'wysiwyg') return;
    const cur = (editor.storage as any).markdown?.getMarkdown?.() ?? '';
    if (value !== cur) {
      try {
        editor.commands.setContent(value || '', { emitUpdate: false });
      } catch (e) {
        // 极端 markdown 解析失败时降级：保留原内容，不崩溃
        console.warn('[WikiEditor] setContent 失败，已忽略：', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor, mode]);

  useEffect(() => { editor?.setEditable(editable && mode === 'wysiwyg', false); }, [editor, editable, mode]);

  if (mode === 'preview') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {value?.trim() ? <Markdown_>{value}</Markdown_> : <div className="text-sm text-ink-400">（空文档）</div>}
      </div>
    );
  }
  if (mode === 'markdown') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!editable}
        placeholder={placeholder}
        className="min-h-0 flex-1 resize-none px-6 py-4 font-mono text-[13px] leading-relaxed text-ink-800 outline-none disabled:bg-ink-50"
      />
    );
  }
  // wysiwyg
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {editable && editor && <Toolbar editor={editor} requestText={requestText} />}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <EditorContent editor={editor} className="tiptap-prose text-sm leading-relaxed" />
      </div>
    </div>
  );
}

