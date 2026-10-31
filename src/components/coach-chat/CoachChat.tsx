'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Bandage, Clock, History, Maximize2, MessageCircle, SquarePen, X } from 'lucide-react';
import {
  ChatAttachmentStrip,
  ChatComposer,
  ChatConversation,
  ChatConversationContent,
  ChatMarkdown,
  ChatMessage,
  ChatScrollButton,
  ChatStatusLine,
  ChatThought,
  ChatTimestamp,
  ChatWelcome,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  ErrorState,
  InlineNotice,
  SkeletonRegion,
  canSend,
  cn,
  timestampIndexes,
  timestampLabel,
} from '@kobo/web';
import CoachMark from '@/components/brand/CoachMark';
import CoachMessage, { fileItems } from './CoachMessage';
import { stepText } from './coachText.mjs';
import { COACH_ACCEPT, useCoachUploads } from './useCoachUploads';
import type { CoachChatState } from './useCoachChat';
import type { ThreadSummary } from './types';

/** The iPhone's SF Symbols for the starter prompts, as lucide icons. */
const PROMPT_ICON: Record<string, React.ReactNode> = {
  bandage: <Bandage />,
  'chart.bar.xaxis': <BarChart3 />,
  clock: <Clock />,
};

const iconButton = cn(
  'inline-flex size-8 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink',
  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

/** Past chats, newest first, read when the menu opens. */
function HistoryMenu({ chat }: { chat: CoachChatState }) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  return (
    <DropdownMenu onOpenChange={(open) => open && void chat.listThreads().then(setThreads)}>
      <DropdownMenuTrigger className={iconButton} aria-label="Past chats" title="Past chats">
        <History aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <DropdownMenuLabel>Past chats</DropdownMenuLabel>
        {threads === null && <p className="px-2 py-1.5 text-footnote text-ink-muted">Loading…</p>}
        {threads?.length === 0 && <p className="px-2 py-1.5 text-footnote text-ink-muted">No past chats yet.</p>}
        {threads?.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => void chat.openThread(t.id)} className="flex flex-col items-start gap-0.5">
            <span className={cn('line-clamp-1 text-subhead', t.id === chat.data?.threadId && 'font-semibold')}>{t.title}</span>
            {t.updatedAt && <span className="text-caption text-ink-muted">{timestampLabel(t.updatedAt)}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = {
  chat: CoachChatState;
  /** `panel`: the side panel (expand and close buttons); `page`: the full /coach page. */
  variant: 'panel' | 'page';
  onClose?: () => void;
};

/** The Coach chat: the thread, the answer as it streams, change cards, and the composer with photos and files. */
export default function CoachChat({ chat, variant, onClose }: Props) {
  const [text, setText] = useState('');
  const uploads = useCoachUploads();
  const { data, live } = chat;
  const messages = data?.messages ?? [];
  const times = timestampIndexes(messages.map((m) => m.createdAt));
  const ready = canSend(text, uploads.items.map((u) => ({ state: u.state ?? 'ready' })), Boolean(live) || data?.ready === false);
  const lastReply = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const lastIsReply = messages.at(-1)?.role === 'assistant';

  const submit = () => {
    if (!ready) return;
    void chat.send(text.trim(), uploads.ready);
    setText('');
    uploads.clear();
  };
  const sendText = (t: string) => void chat.send(t);
  const empty = messages.length === 0 && !live;
  const column = variant === 'page' ? 'max-w-3xl' : 'max-w-none';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-3">
        <MessageCircle aria-hidden className="size-4 text-brand-ink" />
        <h2 className="mr-auto text-headline">Coach</h2>
        <HistoryMenu chat={chat} />
        <button type="button" className={iconButton} aria-label="New chat" title="New chat" onClick={() => void chat.newChat()} disabled={Boolean(live)}>
          <SquarePen aria-hidden className="size-4" />
        </button>
        {variant === 'panel' && (
          <>
            <Link href="/coach" className={iconButton} aria-label="Open Coach full page" title="Open full page">
              <Maximize2 aria-hidden className="size-4" />
            </Link>
            <button type="button" className={iconButton} aria-label="Close Coach" title="Close · c" onClick={onClose}>
              <X aria-hidden className="size-4" />
            </button>
          </>
        )}
      </header>

      {!data && !chat.error && (
        <SkeletonRegion label="Loading the chat" className="flex-1 p-4">
          <div className="h-4 w-2/3 rounded-inner bg-surface-raised" />
        </SkeletonRegion>
      )}
      {!data && chat.error && (
        <div className="flex-1 p-4">
          <ErrorState error={new Error(chat.error)} title="Could not load the chat" onRetry={() => void chat.load()} />
        </div>
      )}

      {data && empty && (
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-4">
          <ChatWelcome
            className={cn('mx-auto w-full', column)}
            mark={<CoachMark className="size-9" />}
            greeting={data.firstName ? `Hi ${data.firstName},` : 'Hi,'}
            title="How can Coach help?"
            prompts={data.prompts.map((p) => ({ title: p.title, icon: PROMPT_ICON[p.symbol] ?? <MessageCircle /> }))}
            onPrompt={(p) => setText(p.title)}
          />
        </div>
      )}

      {data && !empty && (
        <ChatConversation label="Conversation with Coach">
          <ChatConversationContent className={column}>
            {messages.map((m, i) => (
              <Fragment key={m.id}>
                {times.has(i) && m.createdAt && <ChatTimestamp at={m.createdAt} />}
                <CoachMessage message={m} latest={m.id === lastReply && lastIsReply && !live} chat={chat} onSend={sendText} />
              </Fragment>
            ))}
            {live && (
              <>
                <ChatMessage from="user" header={live.user.files.length ? <ChatAttachmentStrip items={fileItems(live.user.files)} className="justify-end" /> : undefined}>
                  {live.user.text || null}
                </ChatMessage>
                <ChatMessage from="assistant" header={live.thought ? <ChatThought thinking={!live.text}>{live.thought}</ChatThought> : undefined}>
                  {live.text ? <ChatMarkdown streaming>{live.text}</ChatMarkdown> : <ChatStatusLine>{stepText(live.step)}</ChatStatusLine>}
                </ChatMessage>
              </>
            )}
            {!live && data.answering && <ChatStatusLine>Coach is still answering</ChatStatusLine>}
            {chat.failed && (
              <InlineNotice tone="danger" title="Coach could not answer">
                {chat.failed}
              </InlineNotice>
            )}
          </ChatConversationContent>
          <ChatScrollButton />
        </ChatConversation>
      )}

      {data && (
        <div className={cn('mx-auto w-full shrink-0 px-3 pt-1 pb-3', column)}>
          {data.notice && (
            <InlineNotice tone="warning" className="mb-2">
              {data.notice}
            </InlineNotice>
          )}
          <ChatComposer
            value={text}
            onValueChange={setText}
            onSubmit={submit}
            canSend={ready}
            busy={Boolean(live)}
            onStop={chat.stop}
            onAttach={uploads.add}
            accept={COACH_ACCEPT}
            disabled={!data.ready}
            autoFocus
            placeholder="Ask Coach anything"
            attachments={<ChatAttachmentStrip size="compact" items={uploads.items} onRemove={uploads.remove} />}
          />
        </div>
      )}
    </div>
  );
}
