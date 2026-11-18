import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { api, ApiError } from '../../api/client';
import type { UploadProgress } from '../../api/client';
import { useAuth, isAdmin } from '../../store/auth';
import { useSystemDialog } from '../../components/SystemDialogProvider';
import type { WikiMode } from './WikiEditor';
import KbAgentPanel from './KbAgentPanel';
import VersionDrawer from './VersionDrawer';
import EditorBoundary from './EditorBoundary';
import OriginalDocumentView from './OriginalDocumentView';
import {
  defaultKnowledgeDocumentView,
  type KnowledgeDocumentView,
  type KnowledgeSourceFileMeta,
} from './knowledge-document-view';
import {
  DEFAULT_KNOWLEDGE_PANE_WIDTHS,
  getKnowledgePaneRange,
  getKnowledgeSeparatorKeyDelta,
  KNOWLEDGE_PANE_STORAGE_KEY,
  moveKnowledgeSeparator,
  normalizeKnowledgePaneWidths,
  parseStoredKnowledgePaneWidths,
  resetKnowledgePaneWidth,
  type KnowledgePaneSide,
} from './knowledge-pane-layout';
import {
  DIRECT_IDENTIFIER_DISCARDED,
  directIdentifierDecisionPrompt,
  importNeedsIdentifierDecision,
  isImportTaskTerminal,
} from './knowledge-import-decision';
import KnowledgeBaseDialog, {
  type KnowledgeBaseVisibility,
} from './KnowledgeBaseDialog';
import {
  deleteKnowledgeBaseState,
  moveManageableBaseIds,
  type KnowledgeBaseMoveDirection,
} from './knowledge-base-management';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import {
  partitionKnowledgeTree,
  type KnowledgeTreeNode as TreeNode,
  type PendingKnowledgeDocument,
} from './knowledge-document-sections';
import KnowledgeDocumentTitleDialog from './KnowledgeDocumentTitleDialog';
import KnowledgeDocumentDeleteDialog from './KnowledgeDocumentDeleteDialog';
import KnowledgeTrashDialog from './KnowledgeTrashDialog';
import { BookOpen } from 'lucide-react';
import { canEditKnowledgeScope } from '../../../knowledge-session.js';
import {assertMaterialDocumentVersion} from '../../../session-material-session.js';

const WikiEditor = lazy(() => import('./WikiEditor'));

/* 知识库三区（ADR-0003）：左=知识库+文档树导航+全文检索；中=文档查看/编辑(富文本/Markdown/预览)；右=科研 Agent。
 * embedded=true 时嵌入工作台（外层已有左侧栏）。窄屏(<1280px)三区改 Tab 切换。 */

interface KbBase {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  scope: 'personal' | 'tenant' | 'official';
  visibility: string;
  sortOrder?: number;
  docCount?: number;
  canWrite?: boolean; // 后端契约：当前用户对该库是否可写
  canManage?: boolean; // 后端契约：仅租户管理员（官方库为平台超管）可治理库本身
  unreviewedCount?: number; // 后端契约：库内待审文档数
}
interface DocDetail { id: string; kbId: string; title: string; contentMd: string; reviewed: boolean; status: string; version: number; canEdit: boolean; scope?: string; safetyLevel?: 'allow' | 'warning' | 'blocked'; safetyCodes?: string[]; sourceFile?: KnowledgeSourceFileMeta | null }
interface SearchHit { chunkId: string; docId: string; kbId: string; docTitle: string; kbName: string; snippet: string; score: number; via?: string; page?: number | null; section?: string | null; kind?: string }
/* 批量导入契约（K10 后端）：POST /knowledge/docs/import multipart，字段 files[] + kbId → 逐文件结果 */
interface ImportResult { filename: string; ok: boolean; taskId?: string; status?: string; error?: string }
interface ImportResponse { queued: number; failed: number; results: ImportResult[] }
interface ImportTaskStatus {
  id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed' | 'blocked';
  stage: string;
  progress: number;
  safetyLevel?: 'allow' | 'warning' | 'blocked' | null;
  warnings?: string[] | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  docId?: string | null;
}
interface ImportTaskView extends ImportTaskStatus { filename: string }
interface ImportDecisionResponse {
  id: string;
  status: ImportTaskStatus['status'];
  stage: string;
  progress: number;
  safetyLevel?: ImportTaskStatus['safetyLevel'];
  errorCode?: string | null;
  decision: 'save' | 'discard';
}

type MobileTab = 'tree' | 'editor' | 'agent';
type DocumentTitleDialogState =
  | { mode: 'create'; parentId?: string; parentTitle?: string }
  | { mode: 'rename'; docId: string; title: string };

const SCOPE_LABEL: Record<string, string> = { personal: '我的', tenant: '租户共享', official: '官方' };
const SCOPE_TINT: Record<string, string> = { personal: 'bg-brand-50 text-brand-700', tenant: 'bg-amber-50 text-amber-700', official: 'bg-violet-50 text-violet-700' };
const IMPORT_STAGE_LABEL: Record<string, string> = {
  uploaded: '已上传',
  validating: '校验文件',
  parsing: '解析/OCR',
  safety_check: '隐私检查',
  creating_draft: '生成草稿',
  indexing: '建立索引',
  complete: '完成',
  failed: '失败',
  blocked: '已隔离',
  awaiting_confirmation: '等待用户确认',
  confirmation_accepted: '已确认，继续处理',
  discarded: '用户选择不保存',
};

function formatSafetyCodes(codes?: string[]) {
  const labels: Record<string, string> = {
    row_level_research_table: '疑似被试级表格',
    transcript_like_content: '访谈或质性研究摘录',
    direct_identifier: '直接身份标识',
  };
  const values = (codes || []).map((code) => labels[code] || code);
  return values.length ? values.join('、') : '需要人工复核的内容';
}

export default function KnowledgeBasePage({
  embedded = false,
  managementMode = false,
  initialKbId,
  initialDocId,
  initialImportTaskId,
  initialDocVersion,
  initialContentSha256,
  onRouteChange,
}: {
  embedded?: boolean;
  managementMode?: boolean;
  initialKbId?: string | null;
  initialDocId?: string | null;
  initialImportTaskId?: string | null;
  initialDocVersion?: number | null;
  initialContentSha256?: string | null;
  onRouteChange?: (route: { kbId?: string; docId?: string }) => void;
}) {
  void embedded;
  const { user, scope } = useAuth();
  const admin = isAdmin(user);
  const scopeEditable = canEditKnowledgeScope(user, scope);
  const scopedDocument = useCallback((value: DocDetail) => ({ ...value, canEdit: value.canEdit === true && scopeEditable && !(value.id===initialDocId&&initialDocVersion!=null) }), [scopeEditable,initialDocId,initialDocVersion]);
  const checkLinkedDocument=useCallback(async(value:DocDetail)=>{
    if(value.id===initialDocId)await assertMaterialDocumentVersion(value,{docId:initialDocId,kbId:initialKbId,docVersion:initialDocVersion,contentSha256:initialContentSha256});
  },[initialDocId,initialKbId,initialDocVersion,initialContentSha256]);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const [bases, setBases] = useState<KbBase[]>([]);
  const [kbId, setKbId] = useState('');
  const [aiActivity, setAiActivity] = useState({ dirty:false, inFlight:false });
  const activeKbRef = useRef(kbId);
  activeKbRef.current = kbId;
  const searchEpochRef = useRef(0);
  const importCacheKey = ['rh-knowledge-import', user?.tenantId, user?.accountId, scope?.studyGroupId, scope?.researchProjectId, kbId].join(':');
  const [recoverableImports, setRecoverableImports] = useState<string[]>([]);
  const recoverableNames = useRef(new Map<string, string>());
  useEffect(() => {
    try {
      let cached: {taskIds?:unknown;filenames?:Record<string,unknown>} | string[] = [];
      try { cached = JSON.parse(sessionStorage.getItem(importCacheKey) || '[]') ?? []; } catch { /* The exact current link still provides its recoverable task. */ }
      const value = Array.isArray(cached) ? cached : cached.taskIds;
      recoverableNames.current = new Map(Object.entries((Array.isArray(cached) ? null : cached.filenames) || {}).filter((pair): pair is [string, string] => typeof pair[1] === 'string' && pair[1].length < 500));
      const restored: string[] = Array.isArray(value) && value.length <= 20 && value.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)) ? value : [];
      if(initialImportTaskId && kbId===initialKbId && /^[a-zA-Z0-9_-]{1,160}$/.test(initialImportTaskId) && !restored.includes(initialImportTaskId)) {
        if(restored.length>=20) { setBanner('请先核对本页已有导入进度，再从原会话进入这份资料。'); }
        else restored.push(initialImportTaskId);
      }
      setRecoverableImports(restored);
    } catch { setRecoverableImports([]); }
  }, [importCacheKey,initialImportTaskId,initialKbId,kbId]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [docId, setDocId] = useState('');
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [draftMd, setDraftMd] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [viewMode, setViewMode] = useState<KnowledgeDocumentView>('wysiwyg');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [banner, setBanner] = useState('');
  const [baseDialog, setBaseDialog] = useState<'create' | 'edit' | null>(null);
  const [baseDialogError, setBaseDialogError] = useState('');
  const [managing, setManaging] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [documentTitleDialog, setDocumentTitleDialog] = useState<DocumentTitleDialogState | null>(null);
  const [documentTitleBusy, setDocumentTitleBusy] = useState(false);
  const [documentTitleError, setDocumentTitleError] = useState('');
  const pendingDiscardActionRef = useRef<(() => void) | null>(null);
  const [discardDialog, setDiscardDialog] = useState<{ targetLabel: string } | null>(null);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [deleteDocBusy, setDeleteDocBusy] = useState(false);
  const [deleteDocError, setDeleteDocError] = useState('');
  const [trashOpen, setTrashOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<MobileTab>('tree');
  // 全文/语义检索
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { askConfirmation } = useSystemDialog();
  // 批量导入状态（K10）
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importFails, setImportFails] = useState<ImportResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [importTasks, setImportTasks] = useState<ImportTaskView[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1280);
  const [paneWidths, setPaneWidths] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_KNOWLEDGE_PANE_WIDTHS };
    try {
      return parseStoredKnowledgePaneWidths(window.localStorage.getItem(KNOWLEDGE_PANE_STORAGE_KEY));
    } catch {
      return { ...DEFAULT_KNOWLEDGE_PANE_WIDTHS };
    }
  });

  const paneLayout = useMemo(
    () => normalizeKnowledgePaneWidths(paneWidths, containerWidth),
    [paneWidths, containerWidth],
  );
  const leftPaneRange = useMemo(
    () => getKnowledgePaneRange('left', containerWidth, paneLayout),
    [containerWidth, paneLayout],
  );
  const rightPaneRange = useMemo(
    () => getKnowledgePaneRange('right', containerWidth, paneLayout),
    [containerWidth, paneLayout],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => setContainerWidth(Math.floor(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(KNOWLEDGE_PANE_STORAGE_KEY, JSON.stringify(paneWidths));
    } catch {
      // 隐私模式可能禁用 localStorage；不影响本次会话内调整。
    }
  }, [paneWidths]);

  const resizePane = useCallback((side: KnowledgePaneSide, visualDelta: number) => {
    const measuredWidth = Math.floor(containerRef.current?.getBoundingClientRect().width || containerWidth);
    setPaneWidths((current) => {
      const normalized = normalizeKnowledgePaneWidths(current, measuredWidth);
      return moveKnowledgeSeparator(side, normalized, measuredWidth, visualDelta);
    });
  }, [containerWidth]);

  const resetPane = useCallback((side: KnowledgePaneSide) => {
    setPaneWidths((current) => resetKnowledgePaneWidth(side, current));
  }, []);

  const currentBase = useMemo(() => bases.find((b) => b.id === kbId) || null, [bases, kbId]);
  const manageableBases = useMemo(() => bases.filter((base) => base.canManage), [bases]);
  const manageableIndex = currentBase
    ? manageableBases.findIndex((base) => base.id === currentBase.id)
    : -1;
  const deleteState = currentBase
    ? deleteKnowledgeBaseState(currentBase.docCount ?? 0)
    : deleteKnowledgeBaseState(0);
  // canWrite 未显式为 false 即视为可写（后端会提供；缺字段时不过度限制）
  const canWrite = currentBase?.canWrite === true;
  const documentSections = useMemo(() => partitionKnowledgeTree(tree), [tree]);
  const pendingDocuments = documentSections.pending;
  const reviewedTree = documentSections.reviewedTree;

  useEffect(() => {
    if (!deleteOpen) return;
    function closeDeleteDialog(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !managing) {
        setDeleteOpen(false);
        setDeleteError('');
      }
    }
    window.addEventListener('keydown', closeDeleteDialog);
    return () => window.removeEventListener('keydown', closeDeleteDialog);
  }, [deleteOpen, managing]);

  const loadBases = useCallback(async () => {
    try {
      const list = await api.get<KbBase[]>('/knowledge/bases');
      setBases(list.map(base => ({ ...base, canWrite: base.canWrite === true && scopeEditable, canManage: base.canManage === true && scopeEditable })));
      setKbId((prev) => list.some((base) => base.id === prev) ? prev : list[0]?.id || '');
    } catch (e) { setBanner(e instanceof ApiError ? e.message : '加载知识库失败'); }
  }, [scopeEditable]);
  useEffect(() => { void loadBases(); }, [loadBases]);
  useEffect(() => {
    if (!initialKbId || !bases.some((base) => base.id === initialKbId)) return;
    setKbId(initialKbId);
  }, [bases, initialKbId]);

  const loadTree = useCallback(async (id: string) => {
    if (!id) { setTree([]); return; }
    try { const nodes = await api.get<TreeNode[]>(`/knowledge/bases/${id}/tree`); if (aliveRef.current && activeKbRef.current === id) setTree(nodes); }
    catch (error) { if (aliveRef.current && activeKbRef.current === id) { setTree([]); setBanner(error instanceof ApiError ? error.message : '文档树加载失败，请重新选择知识库重试'); } }
  }, []);
  useEffect(() => {
    setTree([]); setSearchHits([]); setSearched(false); setSearchQ(''); setSearching(false); searchEpochRef.current++;
    void loadTree(kbId);
    if (!initialDocId) {
      setDocId('');
      setDoc(null);
    }
  }, [kbId, loadTree, initialDocId]);

  // One loader below owns the authorized document read. A second initial-link
  // read would reset a reading mode the user already selected while it arrives.
  useEffect(() => {
    if (!initialDocId) return;
    setDocId(initialDocId);
    setTab('editor');
  }, [initialDocId]);

  const reloadDoc = useCallback(async (id: string) => {
    const d = scopedDocument(await api.get<DocDetail>(`/knowledge/docs/${id}`));
    await checkLinkedDocument(d);
    setDoc(d); setDraftMd(d.contentMd); setDraftTitle(d.title); setDirty(false);
    setViewMode((current) => {
      if (current === 'original' && !d.sourceFile) {
        return defaultKnowledgeDocumentView(null, d.canEdit);
      }
      if (!d.canEdit && current !== 'original' && current !== 'preview') {
        return d.sourceFile ? 'original' : 'preview';
      }
      return current;
    });
  }, [scopedDocument,checkLinkedDocument]);

  useEffect(() => {
    if (!docId) { setDoc(null); return; }
    let alive = true;
    setDoc(null);
    api.get<DocDetail>(`/knowledge/docs/${docId}`).then(async(value) => {
      await checkLinkedDocument(value);
      const d = scopedDocument(value);
      if (!alive) return;
      setKbId(d.kbId);
      setDoc(d); setDraftMd(d.contentMd); setDraftTitle(d.title); setDirty(false);
      setViewMode(defaultKnowledgeDocumentView(d.sourceFile, d.canEdit));
    }).catch((error) => { if (alive) { setDoc(null); setBanner(error instanceof ApiError || error?.code==='HUB_PRIVATE_DOCUMENT_CHANGED' ? error.message : '文档加载失败，请重试'); } });
    return () => { alive = false; };
  }, [docId, scopedDocument,checkLinkedDocument]);

  const cancelDiscardNavigation = useCallback(() => {
    pendingDiscardActionRef.current = null;
    setDiscardDialog(null);
  }, []);

  const confirmDiscardNavigation = useCallback(() => {
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    setDiscardDialog(null);
    action?.();
  }, []);

  const requestDiscardNavigation = useCallback((targetLabel: string, action: () => void) => {
    if (saving || importing || aiActivity.inFlight) { setBanner('保存、导入或问答提交仍在进行，请等待完成后再切换文档。'); return; }
    if (!dirty) {
      action();
      return;
    }
    pendingDiscardActionRef.current = action;
    setDiscardDialog({ targetLabel });
  }, [dirty, saving, importing, aiActivity.inFlight]);

  const openDoc = useCallback((id: string) => {
    if (id === docId) { setTab('editor'); return; }
    requestDiscardNavigation('切换到所选文章', () => {
      setDirty(false);
      setDocId(id);
      setTab('editor');
      onRouteChange?.({ kbId, docId: id });
    });
  }, [docId, kbId, onRouteChange, requestDiscardNavigation]);
  const switchKb = useCallback((id: string) => {
    if (id === kbId) return;
    const targetName = bases.find((base) => base.id === id)?.name;
    requestDiscardNavigation(targetName ? `切换到知识库“${targetName}”` : '切换知识库', () => {
      setDirty(false);
      setDocId('');setDoc(null);
      setKbId(id);
      onRouteChange?.({ kbId: id });
    });
  }, [bases, kbId, onRouteChange, requestDiscardNavigation]);

  const toggleExpand = useCallback((id: string) => {
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  function openNewBase() {
    requestDiscardNavigation('新建并切换知识库', () => {
      setBaseDialogError('');
      setBaseDialog('create');
    });
  }

  async function submitBase(input: { name: string; visibility: KnowledgeBaseVisibility }) {
    setManaging(true);
    setBaseDialogError('');
    try {
      if (baseDialog === 'edit' && currentBase) {
        const updated = await api.patch<KbBase>(`/knowledge/bases/${currentBase.id}`, {
          name: input.name,
        });
        setBases((current) => current.map((base) => base.id === updated.id ? { ...base, ...updated } : base));
        setBanner('知识库名称已更新');
      } else {
        const b = await api.post<KbBase>('/knowledge/bases', {
          name: input.name,
          icon: '📚',
          visibility: input.visibility,
        });
        await loadBases();
        setDirty(false);
        setDocId('');setDoc(null);
        setKbId(b.id);
        onRouteChange?.({ kbId: b.id });
      }
      setBaseDialog(null);
    } catch (e) {
      setBaseDialogError(e instanceof ApiError ? e.message : baseDialog === 'edit' ? '修改知识库失败' : '创建知识库失败');
    } finally {
      setManaging(false);
    }
  }

  async function moveBase(direction: KnowledgeBaseMoveDirection) {
    if (!currentBase?.canManage || managing) return;
    const baseIds = moveManageableBaseIds(bases, currentBase.id, direction);
    const currentIds = manageableBases.map((base) => base.id);
    if (baseIds.every((id, index) => id === currentIds[index])) return;
    setManaging(true);
    try {
      const ordered = await api.put<KbBase[]>('/knowledge/bases/order', { baseIds });
      setBases(ordered);
      setBanner(direction === 'up' ? '知识库已上移' : '知识库已下移');
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : '调整知识库顺序失败');
    } finally {
      setManaging(false);
    }
  }

  async function deleteCurrentBase() {
    if (!currentBase?.canManage || deleteState.blocked || managing) return;
    setManaging(true);
    setDeleteError('');
    try {
      await api.del(`/knowledge/bases/${currentBase.id}`);
      setDeleteOpen(false);
      setDocId('');
      setDoc(null);
      await loadBases();
      setBanner('空知识库已删除');
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : '删除知识库失败');
      await loadBases();
    } finally {
      setManaging(false);
    }
  }
  function newDoc(parent?: TreeNode) {
    requestDiscardNavigation('新建并切换到另一篇文章', () => {
      setDocumentTitleError('');
      setDocumentTitleDialog({
        mode: 'create',
        parentId: parent?.id,
        parentTitle: parent?.title,
      });
    });
  }

  function openRenameDocument(node: TreeNode) {
    setDocumentTitleError('');
    setDocumentTitleDialog({ mode: 'rename', docId: node.id, title: node.title });
  }

  function closeDocumentTitleDialog() {
    if (documentTitleBusy) return;
    setDocumentTitleDialog(null);
    setDocumentTitleError('');
  }

  async function submitDocumentTitle(title: string) {
    if (!documentTitleDialog || !kbId || !canWrite || documentTitleBusy) return;
    setDocumentTitleBusy(true);
    setDocumentTitleError('');
    try {
      if (documentTitleDialog.mode === 'create') {
        const d = await api.post<{ id: string }>('/knowledge/docs', {
          kbId,
          parentId: documentTitleDialog.parentId,
          title,
        });
        await loadTree(kbId);
        await loadBases();
        setDirty(false);
        setDocId(d.id);
        setTab('editor');
        onRouteChange?.({ kbId, docId: d.id });
        setBanner('知识文档已创建，当前为待审核草稿');
      } else {
        await api.patch(`/knowledge/docs/${documentTitleDialog.docId}`, { title });
        await loadTree(kbId);
        if (documentTitleDialog.docId === docId) {
          setDoc((current) => current ? { ...current, title } : current);
          setDraftTitle(title);
        }
        setBanner('文章标题已更新');
      }
      setDocumentTitleDialog(null);
    } catch (e) {
      setDocumentTitleError(e instanceof ApiError ? e.message : '保存文章标题失败');
    } finally {
      setDocumentTitleBusy(false);
    }
  }
  async function save() {
    if (!doc || !dirty || saving) return;
    setSaving(true);
    try {
      await api.patch(`/knowledge/docs/${doc.id}`, { title: draftTitle, contentMd: draftMd, baseVersion: doc.version });
      setDirty(false); setBanner('已保存并重建索引'); await loadTree(kbId);
      // 保存成功后版本号 +1（正文变更时后端自增），重载以拿到最新 version 供下次乐观锁
      try { await reloadDoc(doc.id); } catch { setDoc((p) => (p ? { ...p, title: draftTitle, contentMd: draftMd } : p)); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setBanner('文档已被他处更新（409）。当前草稿已保留，请复制草稿，再重新打开文档合并；不会覆盖他人版本。');
      } else {
        setBanner(e instanceof ApiError ? e.message : '保存失败');
      }
    }
    finally { setSaving(false); }
  }
  async function toggleReview() {
    if (!doc || reviewing || dirty) return;
    setReviewing(true);
    try {
      const r = await api.patch<{ reviewed: boolean }>(`/knowledge/docs/${doc.id}/review`, { reviewed: !doc.reviewed });
      setDoc((p) => (p ? { ...p, reviewed: r.reviewed } : p)); await loadBases(); await loadTree(kbId);
    } catch (e) { setBanner(e instanceof ApiError ? e.message : '审核操作失败'); }
    finally { setReviewing(false); }
  }
  async function delDoc() {
    if (!doc) return;
    setDeleteDocError('');
    setDeleteDocOpen(true);
  }

  async function confirmDeleteDoc() {
    if (!doc || deleteDocBusy) return;
    setDeleteDocBusy(true);
    setDeleteDocError('');
    try {
      await api.del(`/knowledge/docs/${doc.id}`);
      setDeleteDocOpen(false);
      setDocId('');
      setDoc(null);
      await loadTree(kbId);
      await loadBases();
      setBanner('文档已移入回收站，30 天内可恢复');
      onRouteChange?.({ kbId });
    }
    catch (e) { setDeleteDocError(e instanceof ApiError ? e.message : '移入回收站失败'); }
    finally { setDeleteDocBusy(false); }
  }

  async function pollImportTasks(
    taskIds: string[],
    filenameById: Map<string, string>,
    initialTasks: ImportTaskView[],
  ) {
    let tasks = initialTasks;
    for (
      let attempt = 0;
      attempt < 900 && tasks.some((task) => !isImportTaskTerminal(task));
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      if (!aliveRef.current) throw new Error('页面已离开，后台导入不自动取消；返回后可恢复本页任务进度。');
      const statuses = await api.post<ImportTaskStatus[]>(
        '/knowledge/docs/import/status',
        { taskIds },
      );
      tasks = statuses.map((task) => ({
        ...task,
        filename: filenameById.get(task.id) || '导入文献',
      }));
      setImportTasks(tasks);
    }
    return tasks;
  }

  async function recoverImports() {
    if (importing || !recoverableImports.length) return;
    setImporting(true);
    try {
      let tasks = await pollImportTasks(recoverableImports, recoverableNames.current, recoverableImports.map(id => ({ id, filename: recoverableNames.current.get(id) || '最近导入资料', status: 'queued', stage: 'uploaded', progress: 0 })));
      for (const task of tasks.filter(importNeedsIdentifierDecision)) {
        const save = await askConfirmation({ title: '恢复导入：需要保存确认', message: directIdentifierDecisionPrompt(task.filename) + `\n\n任务标识：${task.id}。文件名来自本页上传进度记录，请核对后决定。`, confirmLabel: '保存', cancelLabel: '不保存', tone: 'warning' });
        const decided = await api.put<ImportDecisionResponse>(`/knowledge/docs/import/${encodeURIComponent(task.id)}/decision`, { decision: save ? 'save' : 'discard' });
        tasks = tasks.map(current => current.id === task.id ? { ...current, ...decided } : current);
      }
      tasks = await pollImportTasks(recoverableImports, recoverableNames.current, tasks);
      await loadTree(kbId);
      const done = tasks.find(task => task.status === 'complete' && task.docId);
      if (done?.docId) { setDocId(done.docId); setTab('editor'); }
      const unfinished = tasks.filter(task => !isImportTaskTerminal(task));
      setImportFails(tasks.filter(task => task.status !== 'complete' && isImportTaskTerminal(task)).map(task => ({filename:task.filename,ok:false,taskId:task.id,error:task.errorMessage || task.errorCode || '未完成导入，请核对任务状态'})));
      setBanner(`已查询导入状态：完成 ${tasks.filter(task => task.status === 'complete').length} 篇；未完成或被阻断 ${tasks.filter(task => task.status !== 'complete').length} 篇。`);
      if (!unfinished.length) { sessionStorage.removeItem(importCacheKey); setRecoverableImports([]); }
    } catch (error) { setBanner(error instanceof Error ? error.message : '查询导入状态失败，请重试；不会重新上传。'); }
    finally { setImporting(false); }
  }

  function onImport(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!kbId || !canWrite || arr.length === 0) return;
    requestDiscardNavigation('导入并切换到新文章', () => {
      void importFiles(arr);
    });
  }

  async function importFiles(arr: File[]) {
    const form = new FormData();
    for (const f of arr) form.append('files', f); // 后端字段名逐字 files（可多个）
    form.append('kbId', kbId);
    setImporting(true); setImportCount(arr.length); setImportFails([]); setImportTasks([]); setUploadProgress(null);
    try {
      const r = await api.upload<ImportResponse>('/knowledge/docs/import', form, {
        attempts: 1,
        onProgress: setUploadProgress,
      });
      setUploadProgress(null);
      const fails = r.results.filter((x) => !x.ok);
      setImportFails(fails);
      const queued = r.results.filter(
        (item): item is ImportResult & { taskId: string } => item.ok && !!item.taskId,
      );
      setBanner(`已上传 ${r.queued} 篇，正在解析${r.failed ? `；${r.failed} 篇未进入队列` : ''}`);
      let finalTasks: ImportTaskView[] = queued.map((item) => ({
        id: item.taskId,
        filename: item.filename,
        status: 'queued',
        stage: 'uploaded',
        progress: 10,
      }));
      setImportTasks(finalTasks);
      const filenameById = new Map(queued.map((item) => [item.taskId, item.filename]));
      // 最长等待约 30 分钟；用户离开页面不影响后端任务，重新进入仍可从任务 API 查询。
      const taskIds = queued.map((item) => item.taskId);
      try { sessionStorage.setItem(importCacheKey, JSON.stringify({ taskIds, filenames: Object.fromEntries(filenameById) })); recoverableNames.current = filenameById; setRecoverableImports(taskIds); }
      catch { setBanner('导入已提交，但浏览器未能保存进度标识，请勿刷新，等待本页完成。'); }
      finalTasks = await pollImportTasks(taskIds, filenameById, finalTasks);

      const decisionFailures: ImportResult[] = [];
      let acceptedAny = false;
      for (const task of finalTasks.filter(importNeedsIdentifierDecision)) {
        const save = await askConfirmation({
          title: '已识别直接身份标识',
          message: directIdentifierDecisionPrompt(task.filename),
          confirmLabel: '保存',
          cancelLabel: '不保存',
          tone: 'warning',
        });
        const decision = save ? 'save' : 'discard';
        try {
          const decided = await api.put<ImportDecisionResponse>(
            `/knowledge/docs/import/${encodeURIComponent(task.id)}/decision`,
            { decision },
          );
          acceptedAny ||= decision === 'save';
          finalTasks = finalTasks.map((current) =>
            current.id === task.id
              ? {
                  ...current,
                  status: decided.status,
                  stage: decided.stage,
                  progress: decided.progress,
                  safetyLevel: decided.safetyLevel,
                  errorCode: decided.errorCode,
                  errorMessage:
                    decision === 'discard'
                      ? '用户选择不保存含直接身份标识的文献'
                      : null,
                }
              : current,
          );
          setImportTasks(finalTasks);
        } catch (error) {
          decisionFailures.push({
            filename: task.filename,
            ok: false,
            taskId: task.id,
            error:
              error instanceof ApiError
                ? error.message
                : '身份标识保存决定提交失败',
          });
        }
      }
      if (acceptedAny) {
        finalTasks = await pollImportTasks(taskIds, filenameById, finalTasks);
      }

      const taskFailures: ImportResult[] = finalTasks
        .filter(
          (task) =>
            task.status === 'failed' ||
            (task.status === 'blocked' &&
              task.errorCode !== DIRECT_IDENTIFIER_DISCARDED &&
              !importNeedsIdentifierDecision(task)),
        )
        .map((task) => ({
          filename: task.filename,
          ok: false,
          taskId: task.id,
          error:
            task.errorMessage ||
            (task.status === 'blocked' ? '文献未通过安全检查' : '解析失败'),
        }));
      setImportFails([...fails, ...decisionFailures, ...taskFailures]);
      const completed = finalTasks.filter((task) => task.status === 'complete');
      const discarded = finalTasks.filter(
        (task) => task.errorCode === DIRECT_IDENTIFIER_DISCARDED,
      ).length;
      const failedCount = fails.length + decisionFailures.length + taskFailures.length;
      if (finalTasks.every(isImportTaskTerminal)) { try { sessionStorage.removeItem(importCacheKey); } catch {} setRecoverableImports([]); }
      setBanner(
        `成功导入 ${completed.length} 篇${discarded ? `，用户选择不保存 ${discarded} 篇` : ''}${failedCount ? `，失败 ${failedCount} 篇` : ''}`,
      );
      await loadTree(kbId);
      const firstOk = completed.find((task) => task.docId);
      if (firstOk?.docId) {
        setDirty(false);
        setDocId(firstOk.docId);
        setTab('editor');
        onRouteChange?.({ kbId, docId: firstOk.docId });
      }
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : '导入失败');
    } finally {
      setImporting(false);
      setUploadProgress(null);
    }
  }

  async function runSearch() {
    const q = searchQ.trim();
    if (!q) { setSearchHits([]); setSearched(false); return; }
    const epoch = ++searchEpochRef.current;
    setSearching(true); setSearched(true);
    try {
      const hits = await api.post<SearchHit[]>('/knowledge/search', { query: q, kbIds: kbId ? [kbId] : undefined, topK: 8 });
      if (epoch === searchEpochRef.current && aliveRef.current) setSearchHits(hits);
    } catch (e) { if (epoch === searchEpochRef.current && aliveRef.current) { setSearchHits([]); setBanner(e instanceof ApiError ? e.message : '检索失败'); } }
    finally { if (epoch === searchEpochRef.current && aliveRef.current) setSearching(false); }
  }
  function clearSearch() { searchEpochRef.current++; setSearchQ(''); setSearchHits([]); setSearched(false); setSearching(false); }

  useEffect(() => {
    const inFlight = importing || saving || reviewing || managing || documentTitleBusy || deleteDocBusy || aiActivity.inFlight;
    const warn = (event: BeforeUnloadEvent) => { if (dirty || aiActivity.dirty || inFlight) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    window.dispatchEvent(new CustomEvent('knowledge-busy-local', { detail: { busy: dirty || aiActivity.dirty || inFlight, inFlight } }));
    window.parent.postMessage({ type: 'knowledge-busy', busy: dirty || aiActivity.dirty || inFlight, inFlight }, window.location.origin);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, importing, saving, reviewing, managing, documentTitleBusy, deleteDocBusy, aiActivity]);

  const roTitle = '该库只读，你无写权限';
  const paneGridStyle = {
    gridTemplateColumns: `${paneLayout.left}px 6px minmax(480px, 1fr) 6px ${paneLayout.right}px`,
  } satisfies CSSProperties;

  return (
    <div ref={containerRef} className="flex h-full min-h-0 min-w-0 flex-col xl:grid" style={paneGridStyle}>
      {banner && <div role="status" className="knowledge-banner shrink-0 bg-brand-50 px-4 py-2 text-sm text-brand-700">{banner} <button type="button" className="underline" onClick={() => { void loadBases(); void loadTree(kbId); }}>重新加载列表</button></div>}
      {recoverableImports.length > 0 && !importing && <div className="knowledge-banner bg-amber-50 px-4 py-2"><button type="button" onClick={() => requestDiscardNavigation('查看最近导入任务', () => { void recoverImports(); })}>恢复本页导入进度（不重新上传）</button></div>}
      {/* 窄屏 Tab 切换（缺口#9）：桌面 ≥1280px 隐藏，三栏并存 */}
      <div className="flex shrink-0 border-b border-ink-200 bg-white text-sm xl:hidden">
        {([['tree', '文档树'], ['editor', '编辑'], ['agent', '科研 Agent']] as [MobileTab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 ${tab === k ? 'border-b-2 border-brand-600 font-medium text-brand-700' : 'text-ink-500 hover:bg-ink-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 左：知识库 + 检索 + 文档树 */}
      <aside className={`${tab === 'tree' ? 'flex' : 'hidden'} min-h-0 min-w-0 w-full shrink-0 flex-col bg-white max-xl:flex-1 xl:flex xl:w-auto`}>
        <div className="shrink-0 border-b border-ink-200 px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">知识库</span>
            <button onClick={openNewBase} disabled={!scopeEditable} className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50">+ 新建库</button>
          </div>
          <select value={kbId} onChange={(e) => switchKb(e.target.value)} className="input py-1.5 text-sm">
            {bases.length === 0 && <option value="">（暂无，点+新建库）</option>}
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}（{SCOPE_LABEL[b.scope]}）{(b.unreviewedCount ?? 0) > 0 ? ` · 待审${b.unreviewedCount}` : ''}
              </option>
            ))}
          </select>
          {currentBase && (
            <div className="mt-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SCOPE_TINT[currentBase.scope]}`}>{SCOPE_LABEL[currentBase.scope]}</span>
                <span className="text-xs text-ink-400">{currentBase.docCount ?? 0} 文档</span>
                {!canWrite && <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500" title={roTitle}>只读</span>}
                {(currentBase.unreviewedCount ?? 0) > 0 && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700" title="未审核文档不会被科研 Agent 检索接地">
                    待审 {currentBase.unreviewedCount} 篇
                  </span>
                )}
              </div>
              {managementMode && currentBase.canManage && (
                <div className="mt-2 grid grid-cols-4 gap-1" aria-label="知识库管理操作">
                  <button
                    type="button"
                    className="rounded-md border border-ink-200 px-1 py-1.5 text-xs text-ink-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                    onClick={() => { setBaseDialogError(''); setBaseDialog('edit'); }}
                    disabled={managing}
                  >
                    编辑库名
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-ink-200 px-1 py-1.5 text-xs text-ink-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                    onClick={() => { void moveBase('up'); }}
                    disabled={managing || manageableIndex <= 0}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-ink-200 px-1 py-1.5 text-xs text-ink-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                    onClick={() => { void moveBase('down'); }}
                    disabled={managing || manageableIndex < 0 || manageableIndex >= manageableBases.length - 1}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-100 px-1 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                    onClick={() => { setDeleteError(''); setDeleteOpen(true); }}
                    disabled={managing}
                  >
                    删除库
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-b border-ink-100 px-3 py-1.5">
          <button onClick={() => newDoc()} disabled={!kbId || !canWrite} title={!canWrite ? roTitle : undefined}
            className="text-xs text-ink-600 hover:text-brand-600 disabled:opacity-40">+ 新建文档</button>
          <button onClick={() => fileRef.current?.click()} disabled={!kbId || !canWrite || importing}
            title={!canWrite ? roTitle : '支持 PDF / DOC / DOCX / TXT / Markdown，可多选；文献内实验结果、图表可正常导入'}
            className="text-xs text-ink-600 hover:text-brand-600 disabled:opacity-40">
            {importing ? `导入中… ${importCount} 个文件` : '⬆ 批量导入'}
          </button>
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            disabled={!kbId || !canWrite}
            title={!canWrite ? roTitle : '查看 30 天内可恢复的文档'}
            className="ml-auto text-xs text-ink-500 hover:text-brand-600 disabled:opacity-40"
          >
            回收站
          </button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.pptx,.html,.htm,.epub,.msg,.ipynb,.md,.markdown,.txt" className="hidden"
            onChange={(e) => { const fs = e.target.files; if (fs && fs.length) void onImport(fs); e.target.value = ''; }} />
        </div>
        {importing && (
          <div className="shrink-0 border-b border-brand-100 bg-brand-50/70 px-3 py-2 text-xs text-brand-800">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium">
                {uploadProgress ? '正在上传原始文献' : '正在解析、OCR 与建立索引'}
              </span>
              <span>
                {uploadProgress?.percent !== null && uploadProgress?.percent !== undefined
                  ? `${uploadProgress.percent}%`
                  : importTasks.length
                    ? `${Math.round(importTasks.reduce((sum, task) => sum + task.progress, 0) / importTasks.length)}%`
                    : ''}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{
                  width: `${uploadProgress?.percent ?? (importTasks.length
                    ? Math.round(importTasks.reduce((sum, task) => sum + task.progress, 0) / importTasks.length)
                    : 5)}%`,
                }}
              />
            </div>
            {uploadProgress && (
              <div className="mt-1.5 text-ink-500">请耐心等待，文件较大需要时间传输</div>
            )}
            {importTasks.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-ink-500">
                {importTasks.slice(0, 6).map((task) => (
                  <li key={task.id} className="flex justify-between gap-2">
                    <span className="truncate">{task.filename}</span>
                    <span className="shrink-0">{IMPORT_STAGE_LABEL[task.stage] || task.stage} · {task.progress}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {/* 逐文件导入失败清单（可关闭，最多 8 条） */}
        {importFails.length > 0 && (
          <div className="shrink-0 border-b border-ink-100 bg-red-50/60 px-3 py-2 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-red-700">{importFails.length} 篇导入失败</span>
              <button onClick={() => setImportFails([])} className="shrink-0 text-ink-400 hover:text-ink-700" title="关闭">✕</button>
            </div>
            <ul className="space-y-0.5 text-red-600">
              {importFails.slice(0, 8).map((f, i) => (
                <li key={`${f.filename}-${i}`} className="truncate" title={`${f.filename}：${f.error || '导入失败'}`}>
                  {f.filename}：{f.error || '导入失败'}
                </li>
              ))}
              {importFails.length > 8 && <li className="text-ink-400">…等 {importFails.length - 8} 项</li>}
            </ul>
          </div>
        )}
        {/* 全文/语义检索（缺口#4） */}
        <div className="shrink-0 border-b border-ink-100 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch(); } }}
              placeholder="搜索当前知识库内容…" className="input py-1.5 text-xs" />
            {(searchQ || searched) && <button onClick={clearSearch} className="shrink-0 text-xs text-ink-400 hover:text-ink-700" title="清空">✕</button>}
          </div>
          {searching && <div className="mt-2 text-xs text-ink-400">检索中…</div>}
          {searched && !searching && (
            searchHits.length === 0 ? (
              <div className="mt-2 text-xs text-ink-400">无匹配结果</div>
            ) : (
              <ul className="mt-2 space-y-1">
                {searchHits.map((h, i) => (
                  <li key={h.chunkId || `${h.docId}-${i}`}>
                    <button onClick={() => openDoc(h.docId)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-ink-50">
                      <div className="truncate text-xs font-medium text-ink-700">
                        《{h.docTitle}》<span className="font-normal text-ink-400">（{h.kbName}）</span>
                      </div>
                      {(h.page || h.section) && (
                        <div className="mt-0.5 truncate text-xs text-brand-500">
                          {h.page ? `第 ${h.page} 页` : ''}{h.page && h.section ? ' · ' : ''}{h.section || ''}
                        </div>
                      )}
                      <div className="mt-0.5 line-clamp-2 text-xs text-ink-400">{h.snippet}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
        {pendingDocuments.length > 0 && (
          <section
            data-testid="pending-review-section"
            aria-labelledby="pending-review-heading"
            className="shrink-0 border-b border-amber-200 bg-amber-50/60"
          >
            <div className="flex items-start justify-between gap-2 px-3 pb-1 pt-2.5">
              <div>
                <h2 id="pending-review-heading" className="text-xs font-semibold text-amber-900">
                  待审核（{pendingDocuments.length}）
                </h2>
                <p className="mt-0.5 text-xs leading-4 text-amber-700">审核通过后进入知识文章</p>
              </div>
              <span className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-medium text-amber-700">优先处理</span>
            </div>
            <div className="max-h-40 overflow-y-auto px-2 pb-2">
              <PendingReviewList
                documents={pendingDocuments}
                activeId={docId}
                canWrite={canWrite}
                onOpen={openDoc}
                onNew={newDoc}
                onRename={openRenameDocument}
              />
            </div>
          </section>
        )}
        <section data-testid="reviewed-document-tree" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            知识文章
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {tree.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-ink-400">暂无文档{canWrite ? '，点「+ 新建文档」或「⬆ 批量导入」' : ''}</div>
            ) : reviewedTree.length === 0 ? (
              <div className="px-2 py-5 text-center text-xs leading-5 text-ink-400">暂无已审核文章<br />请先处理上方待审核内容</div>
            ) : (
              <Tree nodes={reviewedTree} depth={0} activeId={docId} canWrite={canWrite} collapsed={collapsed} onOpen={openDoc} onNew={newDoc} onRename={openRenameDocument} onToggle={toggleExpand} />
            )}
          </div>
        </section>
      </aside>

      <KnowledgePaneSeparator
        side="left"
        label="调整知识库导航栏宽度"
        value={paneLayout.left}
        min={leftPaneRange.min}
        max={leftPaneRange.max}
        onMove={resizePane}
        onReset={resetPane}
      />

      {/* 中：文档查看/编辑 */}
      <main className={`${tab === 'editor' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col bg-white xl:flex`}>
        {!doc ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-ink-50"><BookOpen aria-hidden="true"/></div>
              <div className="text-sm font-medium text-ink-600">选择或新建一篇知识文档</div>
              <div className="mt-1 text-xs text-ink-400">从文档树选择资料，审核后可以检索。科研 Agent 仅依据当前授权的已审核资料回答。</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-200 px-4 py-2">
              <input aria-label="文档标题" value={draftTitle} disabled={!doc.canEdit}
                onChange={(e) => { setDraftTitle(e.target.value); setDirty(e.target.value !== doc.title || draftMd !== doc.contentMd); }}
                className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-ink-900 outline-none disabled:text-ink-700" />
              {/* 模式切换 */}
              <div className="flex overflow-hidden rounded-lg border border-ink-200 text-xs">
                {([
                  ...(doc.sourceFile ? ['original' as const] : []),
                  'wysiwyg' as const,
                  'markdown' as const,
                  'preview' as const,
                ]).map((item) => (
                  <button key={item} onClick={() => setViewMode(item)} disabled={!doc.canEdit && item !== 'preview' && item !== 'original'}
                    className={`px-2.5 py-1 ${viewMode === item ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-50'} disabled:opacity-40`}>
                    {item === 'original' ? '原件' : item === 'wysiwyg' ? '富文本' : item === 'markdown' ? 'Markdown' : '抽取预览'}
                  </button>
                ))}
              </div>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${doc.reviewed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{doc.reviewed ? '已审核·可检索' : '待审核'}</span>
              {doc.safetyLevel === 'warning' && (
                <span className="rounded bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700" title="疑似含行级表格或访谈摘录，请审核后再发布">
                  需重点复核
                </span>
              )}
              <button onClick={() => setShowVersions(true)} className="btn-outline px-2 py-1 text-xs">历史版本</button>
              {((admin && canWrite) || (doc.scope === 'personal' && doc.canEdit && canWrite)) && <button onClick={toggleReview} disabled={dirty || saving || importing || reviewing} aria-busy={reviewing} className="btn-outline px-2 py-1 text-xs">{reviewing ? '审核提交中…' : doc.reviewed ? '撤销审核' : '审核通过'}</button>}
              {doc.canEdit && <button onClick={save} disabled={!dirty || saving} className="btn-primary px-3 py-1 text-xs">{saving ? '保存中…' : dirty ? '保存' : '已保存'}</button>}
              {doc.canEdit && <button onClick={delDoc} className="text-xs text-ink-400 hover:text-red-500">删除</button>}
            </div>
            {doc.safetyLevel === 'warning' && !doc.reviewed && (
              <div className="shrink-0 border-b border-orange-100 bg-orange-50 px-4 py-2 text-xs text-orange-800">
                本文献检测到{formatSafetyCodes(doc.safetyCodes)}；请核对数据授权、使用范围和内容准确性后再审核发布。
              </div>
            )}
            {viewMode === 'original' && doc.sourceFile ? (
              <OriginalDocumentView docId={doc.id} sourceFile={doc.sourceFile} />
            ) : (
              <EditorBoundary resetKeys={[doc.id, viewMode]} onReset={() => setViewMode('markdown')}>
                <Suspense
                  fallback={(
                    <div className="flex min-h-64 items-center justify-center text-sm text-ink-500" role="status">
                      正在加载文档编辑器…
                    </div>
                  )}
                >
                  <WikiEditor value={draftMd} onChange={(md) => { setDraftMd(md); setDirty(md !== doc.contentMd || draftTitle !== doc.title); }} editable={doc.canEdit} mode={viewMode as WikiMode} />
                </Suspense>
              </EditorBoundary>
            )}
          </>
        )}
      </main>

      <KnowledgePaneSeparator
        side="right"
        label="调整科研 Agent 栏宽度"
        value={paneLayout.right}
        min={rightPaneRange.min}
        max={rightPaneRange.max}
        onMove={resizePane}
        onReset={resetPane}
      />

      {/* 右：科研 Agent（知识库接地 + 工具模式：附件解析入库 / 增删改文档） */}
      <aside className={`${tab === 'agent' ? 'block' : 'hidden'} min-h-0 min-w-0 w-full shrink-0 bg-white max-xl:flex-1 xl:block xl:w-auto`}>
        <KbAgentPanel
          kbId={kbId}
          kbName={currentBase?.name}
          onActivity={setAiActivity}
          onOpenDoc={openDoc}
          onKbMutated={() => {
            // Agent 改动了知识库：刷新文档树 + 库计数；当前文档若未有未保存修改则重载（被删则清空）
            void loadTree(kbId);
            void loadBases();
            if (docId && !dirty) {
              reloadDoc(docId).catch(() => { setDocId(''); setDoc(null); });
            }
          }}
        />
      </aside>

      {showVersions && doc && (
        <VersionDrawer
          docId={doc.id}
          canEdit={doc.canEdit}
          onClose={() => setShowVersions(false)}
          onReverted={async (v) => {
            setShowVersions(false);
            try { await reloadDoc(doc.id); } catch { /* noop */ }
            await loadTree(kbId);
            setBanner(`已回滚到版本 v${v}`);
          }}
        />
      )}

      {baseDialog && (
        <KnowledgeBaseDialog
          key={`${baseDialog}-${currentBase?.id || 'new'}`}
          mode={baseDialog}
          initialName={baseDialog === 'edit' ? currentBase?.name || '' : ''}
          initialVisibility={user?.role === 'tenant_admin' ? 'tenant' : 'private'}
          canCreateTenantBase={user?.role === 'tenant_admin'}
          busy={managing}
          error={baseDialogError}
          onInputChange={() => setBaseDialogError('')}
          onClose={() => { setBaseDialog(null); setBaseDialogError(''); }}
          onSubmit={submitBase}
        />
      )}

      {documentTitleDialog && (
        <KnowledgeDocumentTitleDialog
          key={`${documentTitleDialog.mode}-${documentTitleDialog.mode === 'rename' ? documentTitleDialog.docId : documentTitleDialog.parentId || 'root'}`}
          mode={documentTitleDialog.mode}
          initialTitle={documentTitleDialog.mode === 'rename' ? documentTitleDialog.title : ''}
          parentTitle={documentTitleDialog.mode === 'create' ? documentTitleDialog.parentTitle : undefined}
          busy={documentTitleBusy}
          error={documentTitleError}
          onInputChange={() => setDocumentTitleError('')}
          onClose={closeDocumentTitleDialog}
          onSubmit={submitDocumentTitle}
        />
      )}

      {discardDialog && (
        <UnsavedChangesDialog
          currentDocumentTitle={draftTitle || doc?.title || '当前文档'}
          targetLabel={discardDialog.targetLabel}
          onCancel={cancelDiscardNavigation}
          onDiscard={confirmDiscardNavigation}
        />
      )}

      {deleteDocOpen && doc && (
        <KnowledgeDocumentDeleteDialog
          title={doc.title}
          busy={deleteDocBusy}
          error={deleteDocError}
          onClose={() => {
            if (!deleteDocBusy) setDeleteDocOpen(false);
          }}
          onConfirm={() => void confirmDeleteDoc()}
        />
      )}

      {trashOpen && currentBase && (
        <KnowledgeTrashDialog
          key={currentBase.id}
          kbId={currentBase.id}
          kbName={currentBase.name}
          onClose={() => setTrashOpen(false)}
          onRestored={() => {
            void loadTree(kbId);
            void loadBases();
            setBanner('文档已从回收站恢复并重建索引');
          }}
        />
      )}

      {deleteOpen && currentBase && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
          onMouseDown={() => { if (!managing) setDeleteOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-knowledge-base-title"
            className="card w-full max-w-md overflow-hidden shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-ink-200 px-6 py-4">
              <h2 id="delete-knowledge-base-title" className="text-lg font-semibold text-ink-900">删除知识库</h2>
              <p className="mt-1 text-sm text-ink-500">此操作只允许删除空库，且删除后不可恢复。</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
                <div className="text-xs text-ink-400">待删除知识库</div>
                <div className="mt-1 font-semibold text-ink-800">{currentBase.icon || '📚'} {currentBase.name}</div>
                <div className="mt-1 text-sm text-ink-500">当前共 {currentBase.docCount ?? 0} 篇文章</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 text-sm leading-6 ${deleteState.blocked ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-100 bg-red-50 text-red-700'}`}>
                {deleteState.message}
              </div>
              {deleteState.blocked && (
                <p className="text-sm leading-6 text-ink-600">
                  必须先逐篇删除，或将文章迁移到其他知识库，确认文章数量为 0 后才能删除此库。
                </p>
              )}
              {deleteError && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</div>}
              <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
                <button type="button" className="btn-outline" onClick={() => setDeleteOpen(false)} disabled={managing}>取消</button>
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => { void deleteCurrentBase(); }}
                  disabled={deleteState.blocked || managing}
                >
                  {managing ? '删除中…' : '确认删除空库'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function KnowledgePaneSeparator({
  side,
  label,
  value,
  min,
  max,
  onMove,
  onReset,
}: {
  side: KnowledgePaneSide;
  label: string;
  value: number;
  min: number;
  max: number;
  onMove: (side: KnowledgePaneSide, visualDelta: number) => void;
  onReset: (side: KnowledgePaneSide) => void;
}) {
  const lastPointerX = useRef(0);
  const draggingPointer = useRef<number | null>(null);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    draggingPointer.current = event.pointerId;
    lastPointerX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingPointer.current !== event.pointerId) return;
    const delta = event.clientX - lastPointerX.current;
    if (!delta) return;
    lastPointerX.current = event.clientX;
    onMove(side, delta);
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingPointer.current !== event.pointerId) return;
    draggingPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = getKnowledgeSeparatorKeyDelta(event.key, event.shiftKey);
    if (delta === null) return;
    event.preventDefault();
    onMove(side, delta);
  }

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      title="拖动调整宽度；方向键微调；Shift + 方向键大步调整；双击恢复默认"
      onDoubleClick={() => onReset(side)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      className="group relative hidden h-full cursor-col-resize touch-none items-stretch justify-center bg-ink-100 outline-none transition-colors hover:bg-brand-100 focus-visible:bg-brand-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 xl:flex"
    >
      <span aria-hidden="true" className="my-auto h-12 w-0.5 rounded-full bg-ink-300 transition-colors group-hover:bg-brand-500 group-focus-visible:bg-brand-500" />
    </div>
  );
}

function PendingReviewList({ documents, activeId, canWrite, onOpen, onNew, onRename }: {
  documents: PendingKnowledgeDocument[];
  activeId: string;
  canWrite: boolean;
  onOpen: (id: string) => void;
  onNew: (parent: TreeNode) => void;
  onRename: (node: TreeNode) => void;
}) {
  return (
    <ul className="space-y-1">
      {documents.map(({ node, parentPath }) => (
        <li key={node.id} className="group flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(node.id)}
            className={`min-w-0 flex-1 rounded-md border px-2 py-1.5 text-left ${activeId === node.id ? 'border-amber-300 bg-white shadow-sm' : 'border-transparent hover:border-amber-200 hover:bg-white/70'}`}
          >
            <span className="flex items-center gap-1.5">
              <span className={`min-w-0 flex-1 truncate text-xs font-medium ${activeId === node.id ? 'text-amber-900' : 'text-ink-700'}`}>{node.title}</span>
              <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-xs font-semibold text-amber-800">待审</span>
            </span>
            {parentPath && <span className="mt-0.5 block truncate text-xs text-ink-400">位于：{parentPath}</span>}
          </button>
          {canWrite && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => onRename(node)}
                aria-label={`重命名文章“${node.title}”`}
                className="rounded px-1.5 py-1 text-xs text-amber-700 hover:bg-white"
                title="重命名"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => onNew(node)}
                className="rounded px-1.5 py-1 text-xs text-amber-700 hover:bg-white"
                title="新建子文档"
                aria-label={`在文章“${node.title}”下新建子文档`}
              >
                +
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* 文档树递归渲染（缺口#10：可折叠；缺口#5：只读库隐藏新建子文档） */
function Tree({ nodes, depth, activeId, canWrite, collapsed, onOpen, onNew, onRename, onToggle }: {
  nodes: TreeNode[];
  depth: number;
  activeId: string;
  canWrite: boolean;
  collapsed: Set<string>;
  onOpen: (id: string) => void;
  onNew: (parent: TreeNode) => void;
  onRename: (node: TreeNode) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <ul>
      {nodes.map((n) => {
        const hasChildren = !!n.children?.length;
        const isCollapsed = collapsed.has(n.id);
        return (
          <li key={n.id}>
            <div
              onClick={() => onOpen(n.id)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className={`group flex cursor-pointer items-center gap-1 rounded-md py-1 pr-1.5 text-sm ${activeId === n.id ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-700 hover:bg-ink-50'}`}
            >
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(n.id); }}
                  className="shrink-0 text-ink-400 hover:text-ink-700"
                  title={isCollapsed ? '展开' : '折叠'}
                >
                  {isCollapsed ? '▸' : '▾'}
                </button>
              ) : (
                <span className="shrink-0 text-ink-300">·</span>
              )}
              <span className="min-w-0 flex-1 truncate">{n.title}</span>
              {canWrite && (
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onRename(n); }}
                    aria-label={`重命名文章“${n.title}”`}
                    className="rounded px-1 py-0.5 text-xs text-ink-400 hover:bg-white hover:text-brand-600"
                    title="重命名"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onNew(n); }}
                    className="rounded px-1 py-0.5 text-xs text-ink-400 hover:bg-white hover:text-brand-600"
                    title="新建子文档"
                    aria-label={`在文章“${n.title}”下新建子文档`}
                  >
                    +
                  </button>
                </span>
              )}
            </div>
            {hasChildren && !isCollapsed && (
              <Tree nodes={n.children!} depth={depth + 1} activeId={activeId} canWrite={canWrite} collapsed={collapsed} onOpen={onOpen} onNew={onNew} onRename={onRename} onToggle={onToggle} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

