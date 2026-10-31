// The web Coach chat's view of /api/coach (lift/APP-API.md, "Coach"): the same bodies the iPhone reads.

export type FileRef = {
  id: string; kind: 'image' | 'pdf' | 'text'; name: string; contentType: string; sizeBytes: number;
  width: number | null; height: number | null;
};

export type CardRow = { title: string; sport: string | null; time: string | null; meta: string; tag: string; tone: 'move' | 'new' | 'skip' };
export type CardDay = { date: string | null; label: string; rows: CardRow[] };
export type ChangeItem = { kind: 'added' | 'removed' | 'changed'; title: string; detail: string };

export type Proposal = {
  id: string; title: string; why: string | null; items: ChangeItem[]; warnings: string[];
  status: 'open' | 'applied' | 'undone' | 'dismissed' | 'stale';
  summary: string | null; days: CardDay[] | null; result: string[];
};

export type Question = {
  id: string; title: string; subtitle: string | null; kind: 'single' | 'multi' | 'text' | 'confirm';
  options: string[]; allowOther: boolean; placeholder: string | null; confirm: { primary: string; secondary: string | null } | null;
};

export type Attachment = { kind: 'workout' | 'week' | 'exercise' | 'readiness' | 'day' | 'breakdown' } & Record<string, unknown>;

export type Message = {
  id: string; role: 'user' | 'assistant'; text: string; createdAt: string | null; proposal: Proposal | null;
  attachments: Attachment[]; quickReplies: string[]; files: FileRef[];
  thought: string | null; questions: Question[]; feedback: 'up' | 'down' | null;
};

export type CoachBody = {
  threadId: string | null; messages: Message[]; answering: boolean; ready: boolean; notice: string | null;
  prompts: { title: string; symbol: string }[]; firstName: string | null;
};

export type ThreadSummary = { id: string; title: string; updatedAt: string | null; messageCount: number };

/** A step of the streamed answer (the `status` event). */
export type Step = 'reading' | 'thinking' | 'writing' | 'proposing' | 'card' | 'fixing';

/** The answer on its way: Paolo's message, then what Coach is doing, its thinking and its words so far. */
export type Live = { user: Message; step: Step; thought: string; text: string };
