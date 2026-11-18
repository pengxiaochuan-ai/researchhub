export interface KnowledgeMessage {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

export interface KnowledgeQueueJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  position: number | null;
  userMessageId: string;
  assistantMessageId?: string | null;
  roleSnapshot?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  kbMutated?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type KnowledgeConversationItem =
  | {
      kind: 'turn';
      id: string;
      userMessage: KnowledgeMessage;
      assistantMessage?: KnowledgeMessage;
      job?: KnowledgeQueueJob;
    }
  | {
      kind: 'message';
      id: string;
      message: KnowledgeMessage;
    };

export interface KnowledgeChatScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

const LATEST_CONTENT_THRESHOLD_PX = 80;

function messageOrder(left: KnowledgeMessage, right: KnowledgeMessage) {
  const byTime = String(left.createdAt ?? '').localeCompare(
    String(right.createdAt ?? ''),
  );
  return byTime || left.id.localeCompare(right.id);
}

export function mergeKnowledgeMessages(
  current: readonly KnowledgeMessage[],
  incoming: readonly KnowledgeMessage[],
): KnowledgeMessage[] {
  const merged = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) merged.set(message.id, message);
  return [...merged.values()].sort(messageOrder);
}

export function mergeKnowledgeJobs(
  current: readonly KnowledgeQueueJob[],
  incoming: readonly KnowledgeQueueJob[],
): KnowledgeQueueJob[] {
  const merged = new Map(current.map((job) => [job.id, job]));
  for (const job of incoming) merged.set(job.id, job);
  return [...merged.values()].sort(
    (left, right) =>
      String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')) ||
      left.id.localeCompare(right.id),
  );
}

export function isKnowledgeChatNearBottom(
  metrics: KnowledgeChatScrollMetrics,
  threshold = LATEST_CONTENT_THRESHOLD_PX,
) {
  return (
    metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= threshold
  );
}

export function buildKnowledgeConversationItems(
  messages: readonly KnowledgeMessage[],
  jobs: readonly KnowledgeQueueJob[],
): KnowledgeConversationItem[] {
  const orderedMessages = [...messages].sort(messageOrder);
  const messageById = new Map(
    orderedMessages.map((message) => [message.id, message]),
  );
  const jobByUserMessage = new Map(
    jobs.map((job) => [job.userMessageId, job]),
  );
  const pairedAssistantIds = new Set(
    jobs
      .filter(
        (job) =>
          messageById.has(job.userMessageId) &&
          Boolean(
            job.assistantMessageId && messageById.has(job.assistantMessageId),
          ),
      )
      .map((job) => job.assistantMessageId as string),
  );

  const items: KnowledgeConversationItem[] = [];
  for (const message of orderedMessages) {
    if (pairedAssistantIds.has(message.id)) continue;
    if (message.role !== 'user') {
      items.push({ kind: 'message', id: message.id, message });
      continue;
    }
    const job = jobByUserMessage.get(message.id);
    const assistantMessage = job?.assistantMessageId
      ? messageById.get(job.assistantMessageId)
      : undefined;
    items.push({
      kind: 'turn',
      id: job?.id ?? message.id,
      userMessage: message,
      assistantMessage,
      job,
    });
  }
  return items;
}

export function summarizeKnowledgeQueue(
  jobs: readonly Pick<KnowledgeQueueJob, 'status'>[],
) {
  return jobs.reduce(
    (summary, job) => {
      if (job.status === 'processing') summary.processing += 1;
      if (job.status === 'queued') summary.queued += 1;
      if (job.status === 'failed') summary.failed += 1;
      return summary;
    },
    { processing: 0, queued: 0, failed: 0 },
  );
}
