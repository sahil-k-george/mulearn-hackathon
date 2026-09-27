/**
 * Shared prompts + defensive normalization for LLM responses.
 *
 * Providers are allowed to fail or return imperfect JSON; the normalizer makes
 * sure the app only ever sees a `BrainDumpExtraction` with valid fields.
 */

import type {
  BrainDumpCollaboration,
  BrainDumpExtraction,
  BrainDumpGoal,
  BrainDumpKnowledgeGap,
  BrainDumpTask,
  NotesPrepPlan,
  NotesPrepSubtaskKind,
  NotesPrepTopic,
} from '../domain';

export const EXTRACTION_SYSTEM_PROMPT = `You extract structured academic information from a student's messy brain dump.
Return ONLY valid JSON with this exact shape:
{
  "tasks": [{ "title": string, "subject_name": string, "deadline": ISO8601 string, "estimated_minutes": number, "priority": "low"|"medium"|"high"|"urgent" }],
  "knowledge_gaps": [{ "subject_name": string, "topic": string }],
  "collaboration": [{ "activity": string, "members": string[], "deadline": ISO8601 string | null }],
  "goals": [{ "title": string, "subject_name": string, "mode": "FAST_PREP"|"KEEP_UP", "target_date": ISO8601 string }],
  "time_constraints": [{ "label": string, "minutes": number | null }],
  "notes": string[]
}
Rules:
- Exams/tests become goals with mode FAST_PREP, not tasks.
- Deadlines must be resolved to real ISO dates relative to TODAY.
- Never invent subjects the student did not mention.`;

export function buildExtractionUserPrompt(text: string, todayIso: string, subjects: string[]): string {
  return `TODAY is ${todayIso}.
Known subjects: ${subjects.length ? subjects.join(', ') : '(none yet)'}.
Brain dump:
"""${text}"""`;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

export function normalizeExtraction(
  raw: unknown,
  provider: string,
  now: Date
): BrainDumpExtraction {
  const data = (raw ?? {}) as Record<string, unknown>;
  const fallbackDate = new Date(now.getTime() + 2 * 86_400_000).toISOString();
  const safeDate = (value: unknown) => {
    const s = asString(value);
    if (!s) return fallbackDate;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? fallbackDate : d.toISOString();
  };

  const tasks: BrainDumpTask[] = Array.isArray(data.tasks)
    ? (data.tasks as Record<string, unknown>[]).map((t) => ({
        title: asString(t.title, 'Untitled task'),
        subject_name: asString(t.subject_name, 'General'),
        deadline: safeDate(t.deadline),
        deadline_label: '',
        estimated_minutes: Math.max(5, asNumber(t.estimated_minutes, 30)),
        priority: (['low', 'medium', 'high', 'urgent'] as const).includes(
          t.priority as BrainDumpTask['priority']
        )
          ? (t.priority as BrainDumpTask['priority'])
          : 'medium',
        confidence: 0.8,
      }))
    : [];

  const knowledge_gaps: BrainDumpKnowledgeGap[] = Array.isArray(data.knowledge_gaps)
    ? (data.knowledge_gaps as Record<string, unknown>[])
        .map((g) => ({
          subject_name: asString(g.subject_name, 'General'),
          topic: asString(g.topic),
          confidence: 0.8,
        }))
        .filter((g) => g.topic)
    : [];

  const collaboration: BrainDumpCollaboration[] = Array.isArray(data.collaboration)
    ? (data.collaboration as Record<string, unknown>[])
        .map((c) => ({
          activity: asString(c.activity, 'Group activity'),
          members: asStringArray(c.members),
          deadline: c.deadline ? safeDate(c.deadline) : null,
          deadline_label: null,
        }))
        .filter((c) => c.members.length > 0)
    : [];

  const goals: BrainDumpGoal[] = Array.isArray(data.goals)
    ? (data.goals as Record<string, unknown>[]).map((g) => ({
        title: asString(g.title, 'Study goal'),
        subject_name: asString(g.subject_name, 'General'),
        mode: g.mode === 'KEEP_UP' ? 'KEEP_UP' : 'FAST_PREP',
        target_date: safeDate(g.target_date),
        target_label: '',
      }))
    : [];

  const time_constraints = Array.isArray(data.time_constraints)
    ? (data.time_constraints as Record<string, unknown>[]).map((t) => ({
        label: asString(t.label, 'Available time'),
        minutes: t.minutes == null ? null : asNumber(t.minutes, 0),
      }))
    : [];

  return {
    provider,
    tasks,
    knowledge_gaps,
    collaboration,
    goals,
    time_constraints,
    notes: asStringArray(data.notes),
  };
}

/** Extract the first JSON object from a text blob (LLMs sometimes add prose). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notes → prep plan
// ---------------------------------------------------------------------------

const SUBTASK_KINDS: NotesPrepSubtaskKind[] = ['learn', 'practice', 'recall', 'review'];

export const NOTES_SYSTEM_PROMPT = `You split a student's study notes into a realistic preparation plan.
Return ONLY valid JSON with this exact shape:
{
  "topics": [
    {
      "topic": string,
      "summary": string,
      "subtasks": [{ "title": string, "minutes": number, "kind": "learn"|"practice"|"recall"|"review" }]
    }
  ],
  "notes": string[]
}
Rules:
- Produce 3 to 8 topics, ordered as they should be studied (prerequisites first).
- Each topic has 2 to 4 subtasks.
- minutes are realistic: 10 to 45.
- Base everything strictly on the provided notes. Do not invent topics.`;

export function buildNotesUserPrompt(
  subjectName: string,
  availableMinutes: number,
  sourceName: string | undefined,
  text: string
): string {
  const clipped = text.slice(0, 12000);
  return `SUBJECT: ${subjectName}
AVAILABLE MINUTES PER DAY: ${availableMinutes}
SOURCE: ${sourceName ?? 'uploaded notes'}
NOTES:
"""${clipped}"""`;
}

export function normalizeNotesPlan(
  raw: unknown,
  provider: string,
  subjectName: string
): NotesPrepPlan {
  const data = (raw ?? {}) as Record<string, unknown>;
  const rawTopics = Array.isArray(data.topics) ? (data.topics as Record<string, unknown>[]) : [];

  const topics: NotesPrepTopic[] = rawTopics
    .map((t) => {
      const rawSubtasks = Array.isArray(t.subtasks)
        ? (t.subtasks as Record<string, unknown>[])
        : [];
      const subtasks = rawSubtasks
        .map((s) => {
          const kind = SUBTASK_KINDS.includes(s.kind as NotesPrepSubtaskKind)
            ? (s.kind as NotesPrepSubtaskKind)
            : 'learn';
          return {
            title: asString(s.title, 'Study this section'),
            minutes: Math.min(60, Math.max(5, asNumber(s.minutes, 25))),
            kind,
          };
        })
        .filter((s) => s.title);
      return {
        topic: asString(t.topic),
        summary: asString(t.summary, ''),
        subtasks: subtasks.length ? subtasks : [{ title: 'Learn the key concepts', minutes: 25, kind: 'learn' as const }],
      };
    })
    .filter((t) => t.topic);

  const total_minutes = topics.reduce(
    (sum, t) => sum + t.subtasks.reduce((s, st) => s + st.minutes, 0),
    0
  );

  return {
    provider,
    subject_name: subjectName,
    topics,
    total_minutes,
    notes: asStringArray(data.notes),
  };
}
