'use client';

import {
  ChatAttachmentStrip,
  ChatChangeCard,
  ChatFeedbackRow,
  ChatMarkdown,
  ChatMessage,
  ChatQuestionCard,
  ChatQuickReplies,
  ChatThought,
  type ChatChangeDay,
} from '@kobo/web';
import SportIcon from '@/components/SportIcon';
import CoachCard from './CoachCards';
import type { CoachChatState } from './useCoachChat';
import type { FileRef, Message, Proposal } from './types';

/** A message's files as tiles; photos and files open from /api/coach/files. */
export function fileItems(files: FileRef[]) {
  return files.map((f) => {
    const href = `/api/coach/files/${f.id}`;
    return { id: f.id, name: f.name, kind: f.kind, previewUrl: f.kind === 'image' ? href : null, href, state: 'ready' as const };
  });
}

/** The card by day, or the flat rows of a card from before 2026-10-29 as one group. */
function changeDays(p: Proposal): ChatChangeDay[] {
  if (p.days?.length) {
    return p.days.map((d) => ({
      label: d.label,
      rows: d.rows.map((r) => ({ title: r.title, meta: r.meta, tag: r.tag, tone: r.tone, icon: r.sport ? <SportIcon id={r.sport} /> : undefined })),
    }));
  }
  const tone = { added: 'new', removed: 'skip', changed: 'move' } as const;
  const tag = { added: 'New', removed: 'Removed', changed: 'Changed' };
  return [{ label: 'Changes', rows: p.items.map((i) => ({ title: i.title, meta: i.detail, tag: tag[i.kind], tone: tone[i.kind] })) }];
}

type Props = {
  message: Message;
  /** The newest reply: only it shows quick replies and question cards. */
  latest: boolean;
  chat: CoachChatState;
  /** Sends a quick reply or the answers to the question cards. */
  onSend: (text: string) => void;
};

/** One message of the Coach chat: Paolo's words and files, or Coach's reply with its cards. */
export default function CoachMessage({ message: m, latest, chat, onSend }: Props) {
  if (m.role === 'user') {
    return (
      <ChatMessage from="user" header={m.files.length ? <ChatAttachmentStrip items={fileItems(m.files)} className="justify-end" /> : undefined}>
        {m.text || null}
      </ChatMessage>
    );
  }
  const busy = Boolean(chat.live);
  const p = m.proposal;
  const ask = p && chat.undoAsk?.proposalId === p.id ? chat.undoAsk : null;
  return (
    <ChatMessage
      from="assistant"
      header={m.thought ? <ChatThought>{m.thought}</ChatThought> : undefined}
      footer={
        <div className="flex w-full flex-col items-start gap-3">
          {m.attachments.map((a, i) => <CoachCard key={`${a.kind}-${i}`} card={a} />)}
          {p && (
            <ChatChangeCard
              title={p.title}
              summary={p.summary ?? p.why}
              days={changeDays(p)}
              warnings={p.warnings}
              checked={p.status === 'open' && !p.warnings.length ? 'Checked against your plan: no clashes, no doubles' : null}
              status={p.status}
              count={Number(/^(\d+) change/.exec(p.summary ?? '')?.[1]) || null}
              result={p.result}
              pending={chat.pending[p.id] ?? null}
              onApply={() => chat.decide(p.id, 'apply')}
              onDismiss={() => chat.decide(p.id, 'dismiss')}
              onUndo={() => chat.decide(p.id, 'undo')}
              undoConfirm={ask ? { message: ask.message, count: ask.count, onConfirm: () => chat.decide(p.id, 'undo', true), onCancel: chat.cancelUndo } : null}
            />
          )}
          {latest && m.questions.length > 0 && <ChatQuestionCard questions={m.questions} onSubmit={onSend} disabled={busy} />}
          {latest && <ChatQuickReplies replies={m.quickReplies} onReply={onSend} disabled={busy} />}
          <ChatFeedbackRow
            text={m.text}
            rating={m.feedback}
            onRate={(r) => chat.rate(m.id, r)}
            className="opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 [[data-latest]_&]:opacity-100"
          />
        </div>
      }
      data-latest={latest || undefined}
    >
      <ChatMarkdown>{m.text}</ChatMarkdown>
    </ChatMessage>
  );
}
