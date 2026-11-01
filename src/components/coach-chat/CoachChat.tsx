'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Bandage, Clock, History, Maximize2, MessageCircle, SquarePen, X } from 'lucide-react';
import {
  ChatAttachmentStrip,
  ChatComposer,
  ChatConversation,
  ChatConversationContent,
  ChatHistoryList,
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

/** Past chats, newest first (the side panel's menu; the full page lists them on the left). */
function HistoryMenu({ chat, threads, onOpen }: { chat: CoachChatState; threads: ThreadSummary[] | null; onOpen: () => void }) {
  return (
    <DropdownMenu onOpenChange={(open) => open && onOpen()}>
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

/** "Good morning" before noon, "Good afternoon" to six, then "Good evening". */
function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Coach is working: a small ring in the logo's orange, turning. */
function Working() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0 animate-spin">
      <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2" className="stroke-line" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" strokeWidth="2" strokeLinecap="round" stroke="var(--coach-accent)" />
    </svg>
  );
}

type Props = {
  chat: CoachChatState;
  /** `panel`: the side panel (past chats in a menu, expand and close); `page`: the full /coach page with past chats on the left. */
  variant: 'panel' | 'page';
  onClose?: () => void;
};

const HINT = 'Coach can make mistakes. Plan changes wait for your Apply.';

/** The Coach chat: the thread, the answer as it streams, change cards, and the composer with photos and files. */
export default function CoachChat({ chat, variant, onClose }: Props) {
  const [text, setText] = useState('');
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const uploads = useCoachUploads();
  const { data, live } = chat;
  const messages = data?.messages ?? [];
  const times = timestampIndexes(messages.map((m) => m.createdAt));
  // Busy while an answer is on its way here or still finishing on the server (after Stop or a reload). A photo that
  // failed to upload holds Send until it is removed, so a message never goes without it unnoticed.
  const busy = Boolean(live) || Boolean(data?.answering);
  const uploadFailed = uploads.items.some((u) => u.state === 'failed');
  const ready = !uploadFailed && canSend(text, uploads.items.map((u) => ({ state: u.state ?? 'ready' })), busy || data?.ready === false);
  const lastReply = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const lastIsReply = messages.at(-1)?.role === 'assistant';
  const page = variant === 'page';
  const { listThreads } = chat;

  // Past chats: on the page they are always shown, so they reload when a chat starts, changes or gets a reply.
  const loadThreads = () => void listThreads().then(setThreads);
  const threadKey = `${data?.threadId}:${messages.length}`;
  useEffect(() => {
    if (page && data && !live) void listThreads().then(setThreads);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the chat or its length changes
  }, [page, threadKey, Boolean(live)]);

  const submit = () => {
    if (!ready) return;
    const words = text.trim();
    void chat.send(words, uploads.ready).then((r) => {
      // The server never stored it (a dropped connection, too long): the words come back to the composer.
      if (r === 'unsent') setText((now) => now || words);
    });
    setText('');
    uploads.clear();
  };
  const sendText = (t: string) => void chat.send(t);
  const empty = messages.length === 0 && !live;
  const column = page ? 'max-w-[46rem]' : 'max-w-none';
  const firstWords = (live?.user.text || messages.find((m) => m.role === 'user')?.text || '').split('\n')[0];
  const title = threads?.find((t) => t.id === data?.threadId)?.title ?? (firstWords || (empty ? 'New chat' : 'Coach'));

  const composer = data && (
    <ChatComposer
      value={text}
      onValueChange={setText}
      onSubmit={submit}
      canSend={ready}
      busy={busy}
      onStop={live ? chat.stop : undefined}
      onAttach={uploads.add}
      accept={COACH_ACCEPT}
      disabled={!data.ready}
      autoFocus
      placeholder={empty ? 'How can Coach help today?' : 'Reply to Coach'}
      hint={uploadFailed ? 'A file did not upload. Remove it to send without it.' : HINT}
      attachments={<ChatAttachmentStrip size="compact" items={uploads.items} onRemove={uploads.remove} />}
    />
  );

  return (
    <div className="flex h-full min-h-0 bg-background">
      {page && (
        <aside aria-label="Chats" className="hidden w-64 shrink-0 flex-col gap-3 border-r border-line bg-surface-raised/40 p-3 md:flex">
          <button
            type="button"
            onClick={() => void chat.newChat()}
            disabled={Boolean(live)}
            className="flex h-9 items-center gap-2 rounded-control px-2 text-subhead font-medium text-ink transition-colors hover:bg-surface-raised disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SquarePen aria-hidden className="size-4 text-brand-ink" />
            New chat
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads ? (
              <ChatHistoryList items={threads} activeId={data?.threadId} onSelect={(id) => void chat.openThread(id)} disabled={Boolean(live)} />
            ) : (
              <SkeletonRegion label="Loading past chats" className="flex flex-col gap-2 px-2">
                <div className="h-3 w-3/4 rounded-inner bg-surface-raised" />
                <div className="h-3 w-1/2 rounded-inner bg-surface-raised" />
              </SkeletonRegion>
            )}
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-3">
          {!page && <MessageCircle aria-hidden className="size-4 shrink-0 text-brand-ink" />}
          <h2 className={cn('mr-auto min-w-0 truncate text-subhead font-medium text-ink', !page && 'ml-1')} title={title}>{title}</h2>
          {!page && <HistoryMenu chat={chat} threads={threads} onOpen={loadThreads} />}
          <button type="button" className={cn(iconButton, page && 'md:hidden')} aria-label="New chat" title="New chat" onClick={() => void chat.newChat()} disabled={Boolean(live)}>
            <SquarePen aria-hidden className="size-4" />
          </button>
          {!page && (
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
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[12vh]">
            <ChatWelcome
              className={cn('m-auto', column)}
              mark={<CoachMark className={page ? 'size-8' : 'size-7'} />}
              title={data.firstName ? `${greeting()}, ${data.firstName}` : greeting()}
              prompts={data.prompts.map((p) => ({ title: p.title, icon: PROMPT_ICON[p.symbol] ?? <MessageCircle /> }))}
              onPrompt={(p) => setText(p.title)}
            >
              {data.notice && <InlineNotice tone="warning" className="w-full">{data.notice}</InlineNotice>}
              {chat.failed && <InlineNotice tone="danger" title={chat.failed.title} className="w-full">{chat.failed.message}</InlineNotice>}
              {composer}
            </ChatWelcome>
          </div>
        )}

        {data && !empty && (
          <ChatConversation label="Conversation with Coach">
            <ChatConversationContent className={cn('gap-8 pt-8 pb-10', column)}>
              {messages.map((m, i) => (
                <Fragment key={m.id}>
                  {times.has(i) && m.createdAt && <ChatTimestamp at={m.createdAt} className="-mb-4" />}
                  <CoachMessage message={m} latest={m.id === lastReply && lastIsReply && !live} chat={chat} onSend={sendText} />
                </Fragment>
              ))}
              {live && (
                <>
                  <ChatMessage from="user" header={live.user.files.length ? <ChatAttachmentStrip items={fileItems(live.user.files)} className="justify-end" /> : undefined}>
                    {live.user.text || null}
                  </ChatMessage>
                  <ChatMessage from="assistant" header={live.thought ? <ChatThought thinking={!live.text}>{live.thought}</ChatThought> : undefined}>
                    {live.text ? <ChatMarkdown streaming>{live.text}</ChatMarkdown> : live.thought ? null : <ChatStatusLine icon={<Working />}>{stepText(live.step)}</ChatStatusLine>}
                  </ChatMessage>
                </>
              )}
              {!live && data.answering && <ChatStatusLine icon={<Working />}>Coach is still answering</ChatStatusLine>}
              {chat.failed && (
                <InlineNotice tone="danger" title={chat.failed.title}>
                  {chat.failed.message}
                </InlineNotice>
              )}
            </ChatConversationContent>
            <ChatScrollButton />
          </ChatConversation>
        )}

        {data && !empty && (
          <div className={cn('mx-auto w-full shrink-0 px-4 pt-1 pb-3', column)}>
            {data.notice && (
              <InlineNotice tone="warning" className="mb-2">
                {data.notice}
              </InlineNotice>
            )}
            {composer}
          </div>
        )}
      </div>
    </div>
  );
}
