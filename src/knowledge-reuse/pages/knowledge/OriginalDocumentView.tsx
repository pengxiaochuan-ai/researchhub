import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import {
  isInlineKnowledgeSource,
  type KnowledgeSourceFileMeta,
} from './knowledge-document-view';

export default function OriginalDocumentView({
  docId,
  sourceFile,
}: {
  docId: string;
  sourceFile: KnowledgeSourceFileMeta;
}) {
  const [objectUrl, setObjectUrl] = useState('');
  const [filename, setFilename] = useState(sourceFile.filename);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let nextUrl = '';
    setObjectUrl('');
    setError('');
    setFilename(sourceFile.filename);
    api.download(`/knowledge/docs/${docId}/source`)
      .then((result) => {
        if (!alive) return;
        nextUrl = URL.createObjectURL(result.blob);
        setFilename(result.filename || sourceFile.filename);
        setObjectUrl(nextUrl);
      })
      .catch((reason) => {
        if (!alive) return;
        setError(reason instanceof ApiError ? reason.message : '原始文献加载失败');
      });
    return () => {
      alive = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [attempt, docId, sourceFile.filename]);

  if (error) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-ink-50 p-6 text-center" role="alert">
        <div>
          <div className="text-sm font-medium text-red-700">{error}</div>
          <button className="btn-outline mt-3 text-sm" onClick={() => setAttempt((value) => value + 1)}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-ink-50 text-sm text-ink-500" aria-busy="true">
        正在安全加载原始文献…
      </div>
    );
  }

  const inline = isInlineKnowledgeSource(sourceFile.contentType);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ink-50">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-white px-4 py-2 text-xs text-ink-500">
        <span>原件按上传内容保留；抽取文本仅用于检索、编辑与审核。</span>
        <a className="btn-outline px-3 py-1 text-xs" href={objectUrl} download={filename}>
          下载原件
        </a>
      </div>
      {sourceFile.contentType === 'application/pdf' ? (
        <iframe
          title="原始 PDF 文献"
          src={`${objectUrl}#toolbar=1&navpanes=0`}
          className="min-h-0 flex-1 border-0 bg-white"
        />
      ) : inline ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <img src={objectUrl} alt="原始文献" className="mx-auto max-h-full max-w-full bg-white object-contain" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
          <div className="max-w-md rounded-xl border border-ink-200 bg-white p-6">
            <div className="text-base font-semibold text-ink-800">原始 {sourceFile.extension.toUpperCase()} 文献已保留</div>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              浏览器不安全内嵌或无法准确显示该格式。请下载后使用本机应用查看，版式不会经过 Markdown 转换。
            </p>
            <a className="btn-primary mt-4 inline-flex text-sm" href={objectUrl} download={filename}>
              下载并查看原件
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

