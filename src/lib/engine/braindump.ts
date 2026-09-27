/**
 * Deterministic Brain Dump extraction.
 *
 * This is the fallback (and mock-provider) implementation of natural-language
 * extraction. It never needs a network call, so the product stays functional
 * without an AI key (plan sections 6 & 17). A real provider can replace this
 * behaviour while keeping the exact same output shape.
 */

import type {
  BrainDumpCollaboration,
  BrainDumpExtraction,
  BrainDumpGoal,
  BrainDumpKnowledgeGap,
  BrainDumpTask,
  SubjectItem,
} from '../domain';

export type ExtractionInput = {
  text: string;
  subjects: SubjectItem[];
  now: Date;
};

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  Mathematics: [
    'math',
    'maths',
    'mathematics',
    'calculus',
    'algebra',
    'integration',
    'integral',
    'differentiation',
    'derivative',
    'fourier',
    'differential equation',
    'trigonometry',
    'geometry',
    'statistics',
    'probability',
    'vector',
    'matrix',
    'matrices',
    'complex variable',
  ],
  Physics: [
    'physics',
    'thermodynamics',
    'optics',
    'mechanics',
    'electromagnetism',
    'interferometer',
    'circuit',
    'lab record',
    'practical record',
  ],
  Chemistry: ['chemistry', 'organic chemistry', 'inorganic chemistry', 'mole concept', 'titration'],
  Biology: ['biology', 'cell biology', 'genetics', 'anatomy', 'botany', 'zoology'],
  'Computer Science': [
    'computer science',
    'programming',
    'algorithm',
    'data structure',
    'networking',
    'database',
    'operating system',
    'machine learning',
    'artificial intelligence',
  ],
  English: ['english', 'literature', 'essay', 'grammar', 'comprehension'],
  History: ['history', 'civics', 'geography', 'economics'],
};

const ACTION_VERBS = [
  'have to',
  'need to',
  'must',
  'got to',
  'gotta',
  'should',
  'finish',
  'submit',
  'complete',
  'write',
  'prepare',
  'revise',
  'review',
  'study',
  'solve',
  'record',
  'presentation',
  'assignment',
  'homework',
  'project',
  'report',
  'exam',
  'test',
  'quiz',
  'viva',
  'lab record',
  'record',
];

const GAP_PATTERNS: RegExp[] = [
  /haven'?t understood\s+(.+)/i,
  /have not understood\s+(.+)/i,
  /don'?t understand\s+(.+)/i,
  /do not understand\s+(.+)/i,
  /don'?t get\s+(.+)/i,
  /struggling with\s+(.+)/i,
  /struggle with\s+(.+)/i,
  /weak (?:in|at)\s+(.+)/i,
  /confused about\s+(.+)/i,
  /no idea (?:about|how)\s+(.+)/i,
  /can'?t solve\s+(.+)/i,
  /finding\s+(.+)\s+(?:hard|difficult|tough)/i,
];

const COLLAB_PATTERN =
  /\bwith\s+((?:[A-Z][a-zA-Z]+)(?:\s*,\s*(?:and\s+)?[A-Z][a-zA-Z]+)*(?:\s+and\s+[A-Z][a-zA-Z]+)?)/;

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word, i) =>
      i > 0 && word.toLowerCase() === 'and' ? 'and' : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

function atEvening(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(18, 0, 0, 0);
  return copy;
}

/** Resolve a human deadline phrase into an ISO date, or null when unknown. */
export function resolveDeadline(phrase: string, now: Date): Date | null {
  const text = phrase.toLowerCase().trim();
  if (!text) return null;

  const base = new Date(now);

  if (/\bday after tomorrow\b/.test(text)) {
    base.setDate(base.getDate() + 2);
    return atEvening(base);
  }
  if (/\btomorrow\b/.test(text)) {
    base.setDate(base.getDate() + 1);
    return atEvening(base);
  }
  if (/\b(today|tonight|this evening|this afternoon)\b/.test(text)) {
    return atEvening(base);
  }
  if (/\bnext week\b/.test(text)) {
    base.setDate(base.getDate() + 7);
    return atEvening(base);
  }
  if (/\bthis weekend\b/.test(text) || /\bweekend\b/.test(text)) {
    const daysUntilSaturday = (6 - base.getDay() + 7) % 7 || 7;
    base.setDate(base.getDate() + daysUntilSaturday);
    return atEvening(base);
  }

  const inDays = text.match(/\bin\s+(\d{1,2})\s+(day|days|week|weeks)\b/);
  if (inDays) {
    const amount = parseInt(inDays[1], 10);
    const days = inDays[2].startsWith('week') ? amount * 7 : amount;
    base.setDate(base.getDate() + days);
    return atEvening(base);
  }

  for (let i = 0; i < WEEKDAYS.length; i += 1) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text)) {
      const delta = (i - base.getDay() + 7) % 7 || 7;
      base.setDate(base.getDate() + delta);
      return atEvening(base);
    }
  }

  // "Oct 3", "October 3rd", "3rd October"
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  const order1 = text.match(
    new RegExp(`\\b(${monthNames.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)
  );
  const order2 = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames.join('|')})\\b`)
  );
  const monthToken = order1?.[1] ?? order2?.[2];
  const dayToken = order1?.[2] ?? order2?.[1];
  if (monthToken && dayToken) {
    const month = monthNames.indexOf(monthToken);
    const day = parseInt(dayToken, 10);
    const candidate = new Date(base.getFullYear(), month, day, 18, 0, 0, 0);
    if (candidate.getTime() < now.getTime()) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return candidate;
  }

  return null;
}

function extractDeadlinePhrase(clause: string): string | null {
  const patterns: RegExp[] = [
    /\b(day after tomorrow)\b/i,
    /\b(tomorrow)\b/i,
    /\b(tonight|today|this evening|this afternoon)\b/i,
    /\b(next week)\b/i,
    /\b(this weekend|weekend)\b/i,
    /\bin\s+\d{1,2}\s+(?:day|days|week|weeks)\b/i,
    new RegExp(`\\b(?:on\\s+)?(${WEEKDAYS.join('|')})\\b`, 'i'),
    /\b(?:on\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b/i,
    /\b(?:on\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i,
  ];
  for (const pattern of patterns) {
    const match = clause.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function detectSubject(clause: string, subjects: SubjectItem[]): string | null {
  const lower = clause.toLowerCase();
  // Prefer an explicitly registered subject name.
  for (const subject of subjects) {
    if (lower.includes(subject.name.toLowerCase())) return subject.name;
    const firstWord = subject.name.toLowerCase().split(' ')[0];
    if (firstWord.length > 3 && lower.includes(firstWord)) return subject.name;
  }
  for (const [name, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      // Map to a registered subject when one exists for this family.
      const registered = subjects.find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
      return registered ? registered.name : name;
    }
  }
  return null;
}

function cleanTitle(clause: string): string {
  let title = clause.trim();
  title = title.replace(/^(?:and|but|also|then)\s+/i, '');
  title = title.replace(
    /^(?:i\s+)?(?:have|need|got|gotta|must|should|want|have to|need to)\s+/i,
    ''
  );
  title = title.replace(/^(?:have to|need to|got to|gotta|must|should)\s+/i, '');
  // Strip leading connectives + light verbs so "I need to work on the presentation" -> "Presentation".
  title = title.replace(/^(?:to\s+)?(?:work\s+on|work\s+towards|work\s+on\s+the|get\s+started\s+on|start\s+on|move\s+on\s+to|do)\s+(?:the\s+|our\s+|my\s+|a\s+)?/i, '');
  title = title.replace(/\b(?:is|are)?\s*due\s+(?:by\s+)?(?:on\s+|this\s+)?/i, '');
  title = title.replace(/\b(?:on|by)\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day\b.*$/i, '');
  title = title.replace(/\b(?:today|tonight|tomorrow|next week|this weekend)\b.*$/i, '');
  title = title.replace(/\bwith\s+[A-Z][a-zA-Z]+(?:\s*(?:,|and)\s*[A-Z][a-zA-Z]+)*\s*$/i, '');
  title = title.replace(/\s+/g, ' ').trim();
  title = title.replace(/[.,;:]+$/, '').trim();
  return titleCase(title);
}

function sentenceSplit(text: string): string[] {
  const sentences = text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const clauses: string[] = [];
  for (const sentence of sentences) {
    // Split comma-separated obligations ("... exam Friday, I haven't understood ...").
    const parts = sentence.split(/\s*,\s*/);
    for (const part of parts) {
      // Split "X and I need to Y" style conjunctions.
      const subParts = part.split(
        /\s+and\s+(?=(?:i\s+)?(?:have|need|must|want|got|gotta|should|haven'?t|can'?t)\b)/i
      );
      for (const sub of subParts) {
        const trimmed = sub.trim();
        if (trimmed) clauses.push(trimmed);
      }
    }
  }
  return clauses;
}

function detectPriority(clause: string, deadline: Date | null, now: Date): BrainDumpTask['priority'] {
  const lower = clause.toLowerCase();
  const hours = deadline ? (deadline.getTime() - now.getTime()) / 3_600_000 : Infinity;
  if (/\b(exam|test|quiz|viva|submission|deadline)\b/.test(lower) || hours <= 24) return 'urgent';
  if (hours <= 72 || /\b(important|must|required)\b/.test(lower)) return 'high';
  if (hours <= 168) return 'medium';
  return 'low';
}

function estimateMinutes(clause: string): number {
  const lower = clause.toLowerCase();
  if (/\b(exam|mock test)\b/.test(lower)) return 60;
  if (/\bpresentation|slides|deck\b/.test(lower)) return 30;
  if (/\b(record|report|assignment|project|essay)\b/.test(lower)) return 45;
  if (/\b(revise|review|recall|read)\b/.test(lower)) return 25;
  const explicit = lower.match(/(\d{1,3})\s*(?:min|mins|minute|minutes)/);
  if (explicit) return parseInt(explicit[1], 10);
  const hours = lower.match(/(\d{1,2})\s*(?:hour|hours|hr|hrs)/);
  if (hours) return parseInt(hours[1], 10) * 60;
  return 30;
}

function formatLabel(date: Date, now: Date): string {
  const dayDiff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000
  );
  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'tomorrow';
  if (dayDiff < 7) {
    return `this ${WEEKDAYS[date.getDay()].charAt(0).toUpperCase() + WEEKDAYS[date.getDay()].slice(1)}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function extractBrainDump({ text, subjects, now }: ExtractionInput): BrainDumpExtraction {
  const clauses = sentenceSplit(text);
  const tasks: BrainDumpTask[] = [];
  const knowledge_gaps: BrainDumpKnowledgeGap[] = [];
  const collaboration: BrainDumpCollaboration[] = [];
  const goals: BrainDumpGoal[] = [];
  const time_constraints: { label: string; minutes: number | null }[] = [];
  const notes: string[] = [];
  const seenTasks = new Set<string>();

  // Explicit available-time hints ("I have 2 hours tonight").
  const availMatch = text.match(
    /\b(\d{1,2})\s*(?:hours?|hrs?)\b[^.]*\b(?:tonight|today|available|free)\b/i
  ) || text.match(/\b(?:have|got)\s+(\d{1,2})\s*(?:hours?|hrs?)\b[^.]*\b/i);
  if (availMatch) {
    const minutes = parseInt(availMatch[1], 10) * 60;
    time_constraints.push({ label: availMatch[0].trim(), minutes });
  }

  for (const rawClause of clauses) {
    const clause = rawClause.trim();
    if (!clause) continue;

    const lower = clause.toLowerCase();
    const subjectName = detectSubject(clause, subjects);

    // --- knowledge gaps ---
    let gapMatched = false;
    for (const pattern of GAP_PATTERNS) {
      const match = clause.match(pattern);
      if (match && match[1]) {
        const topic = match[1]
          .replace(/\b(and|but|so)\b.*$/i, '')
          .replace(/[.,;:]+$/, '')
          .trim();
        if (topic) {
          knowledge_gaps.push({
            subject_name: subjectName || 'General',
            topic: titleCase(topic),
            confidence: 0.9,
          });
          gapMatched = true;
        }
        break;
      }
    }
    if (gapMatched) continue;

    // --- collaboration ---
    const collab = clause.match(COLLAB_PATTERN);
    if (collab && collab[1]) {
      const members = collab[1]
        .replace(/\band\b/gi, ',')
        .split(/\s*,\s*/)
        .map((m) => m.trim())
        .filter(Boolean);
      const activity = cleanTitle(clause.replace(COLLAB_PATTERN, '')) || 'Group activity';
      if (members.length) {
        const deadlinePhrase = extractDeadlinePhrase(clause);
        const deadline = deadlinePhrase ? resolveDeadline(deadlinePhrase, now) : null;
        collaboration.push({
          activity,
          members,
          deadline: deadline ? deadline.toISOString() : null,
          deadline_label: deadline ? formatLabel(deadline, now) : null,
        });
      }
    }

    // --- tasks ---
    const isAction = ACTION_VERBS.some((verb) => lower.includes(verb));
    if (!isAction) continue;

    const title = cleanTitle(clause);
    if (!title || title.length < 3) continue;

    const deadlinePhrase = extractDeadlinePhrase(clause);
    const deadline = deadlinePhrase ? resolveDeadline(deadlinePhrase, now) : null;

    // An exam/test becomes a goal, not a task; the study work is derived later.
    if (/\b(exam|test|midterm|final)\b/i.test(lower) && deadline) {
      goals.push({
        title: title.replace(/\b(exam|test)\b/i, (m) => m).trim() || `${subjectName ?? 'Subject'} Exam`,
        subject_name: subjectName || 'General',
        mode: 'FAST_PREP',
        target_date: deadline.toISOString(),
        target_label: formatLabel(deadline, now),
      });
      continue;
    }

    const key = title.toLowerCase();
    if (seenTasks.has(key)) continue;
    seenTasks.add(key);

    tasks.push({
      title,
      subject_name: subjectName || 'General',
      deadline: (deadline ?? atEvening(new Date(now.getTime() + 2 * 86_400_000))).toISOString(),
      deadline_label: formatLabel(deadline ?? new Date(now.getTime() + 2 * 86_400_000), now),
      estimated_minutes: estimateMinutes(clause),
      priority: detectPriority(clause, deadline, now),
      confidence: 0.85,
    });
  }

  if (!tasks.length && !knowledge_gaps.length && !goals.length) {
    notes.push(
      'We could not confidently extract anything. Try naming the subject, the task and when it is due.'
    );
  }
  if (collaboration.length) {
    notes.push(
      `Detected a shared activity with ${collaboration.flatMap((c) => c.members).join(', ')}. Create a team to plan it together.`
    );
  }

  return {
    provider: 'mock',
    tasks,
    knowledge_gaps,
    collaboration,
    goals,
    time_constraints,
    notes,
  };
}
