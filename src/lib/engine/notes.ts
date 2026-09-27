/**
 * Deterministic notes → prep splitting.
 *
 * Used by the mock provider and as a safety net if an LLM response is unusable.
 * It does not need a key: it segments the notes by headings/paragraphs and
 * derives learn → practice → recall blocks for each topic.
 */

import type { NotesPrepPlan, NotesPrepTopic, NotesPrepSubtask } from '../domain';

const HEADING_PATTERNS: RegExp[] = [
  /^(chapter|unit|topic|section|module|lesson)\s*[\dIVXivx]*\s*[:.\-)]?\s*(.*)$/i,
  /^\d+(?:\.\d+)*[).:\-]?\s+(.{3,80})$/,
  /^([A-Z][A-Z0-9 &/+'-]{4,70})$/,
];

const MAX_TOPICS = 8;
const MIN_TOPIC_CHARS = 400;

function isHeading(line: string): { heading: string } | null {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 90) return null;
  for (const pattern of HEADING_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const text = (match[2] || match[1] || '').trim();
      if (!text) return null;
      // Avoid treating a normal sentence as a heading.
      if (text.split(' ').length > 9) return null;
      return { heading: toTitle(text) };
    }
  }
  return null;
}

function toTitle(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').replace(/[.:;,-]+$/, '').trim();
  return cleaned
    .split(' ')
    .slice(0, 9)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function firstMeaningfulLine(block: string): string {
  const line = block
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 3 && !isHeading(l));
  if (!line) return 'Notes overview';
  const sentence = line.split(/[.!?]/)[0];
  return toTitle(sentence);
}

function subtasksFor(availableMinutes: number): NotesPrepSubtask[] {
  const compact = availableMinutes > 0 && availableMinutes < 60;
  const blocks: NotesPrepSubtask[] = [
    { title: 'Learn the key concepts', minutes: compact ? 20 : 30, kind: 'learn' },
    { title: 'Work through examples', minutes: compact ? 20 : 30, kind: 'practice' },
    { title: 'Active recall check', minutes: compact ? 10 : 15, kind: 'recall' },
  ];
  return blocks;
}

function summarize(block: string): string {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isHeading(l));
  return lines.join(' ').slice(0, 220).trim();
}

export function splitNotesDeterministic(
  text: string,
  input: { subjectName: string; availableMinutes: number; sourceName?: string }
): NotesPrepPlan {
  const normalized = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

  if (!normalized) {
    return {
      provider: 'mock',
      subject_name: input.subjectName,
      topics: [],
      total_minutes: 0,
      notes: ['No readable text was found in that document.'],
    };
  }

  // Segment into heading-delimited sections.
  const lines = normalized.split('\n');
  const sections: { title: string; body: string }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = isHeading(line);
    if (heading) {
      if (current) sections.push({ title: current.title, body: current.lines.join('\n') });
      current = { title: heading.heading, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      current = { title: '', lines: [line] };
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join('\n') });

  // Merge untitled continuations into the previous section, but never merge
  // across an explicit heading — those are real topic boundaries.
  const merged: { title: string; body: string }[] = [];
  for (const section of sections) {
    const previous = merged[merged.length - 1];
    if (previous && !section.title && section.body.trim().length < MIN_TOPIC_CHARS) {
      previous.body += `\n${section.body}`;
    } else {
      merged.push({ ...section });
    }
  }

  let topics: NotesPrepTopic[] = merged
    .filter((s) => s.body.trim().length > 0)
    .slice(0, MAX_TOPICS)
    .map((s) => ({
      topic: s.title || firstMeaningfulLine(s.body),
      summary: summarize(s.body),
      subtasks: subtasksFor(input.availableMinutes),
    }));

  // No usable headings: chunk the raw text into evenly sized topics.
  if (topics.length === 0) {
    const chunkSize = 1200;
    const chunks = normalized.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, 'g')) ?? [];
    topics = chunks.slice(0, MAX_TOPICS).map((chunk) => ({
      topic: firstMeaningfulLine(chunk),
      summary: summarize(chunk),
      subtasks: subtasksFor(input.availableMinutes),
    }));
  }

  const total_minutes = topics.reduce(
    (sum, t) => sum + t.subtasks.reduce((s, st) => s + st.minutes, 0),
    0
  );

  return {
    provider: 'mock',
    subject_name: input.subjectName,
    topics,
    total_minutes,
    notes: [
      `Split ${input.sourceName ? `"${input.sourceName}" ` : ''}into ${topics.length} topic${topics.length === 1 ? '' : 's'}`,
      'Each topic gets a learn → practice → recall sequence.',
    ],
  };
}
