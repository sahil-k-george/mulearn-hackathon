/**
 * Mock / deterministic AI provider.
 *
 * Keeps the entire product functional with no API key (plan section 17).
 * Extraction is real (see engine/braindump.ts); the remaining methods return
 * genuinely useful, deterministic guidance rather than pretending to be a model.
 */

import type {
  AIProviderName,
  AIService,
  BrainDumpContext,
  GoalDecompositionContext,
  NotesSplitContext,
  QuizQuestion,
} from '../types';
import type { BrainDumpExtraction, BrainDumpTask, NotesPrepPlan } from '../../domain';
import { extractBrainDump } from '../../engine/braindump';
import { splitNotesDeterministic } from '../../engine/notes';

export class MockProvider implements AIService {
  readonly name: AIProviderName = 'mock';

  async extractBrainDump(text: string, context: BrainDumpContext): Promise<BrainDumpExtraction> {
    return extractBrainDump({ text, subjects: context.subjects, now: context.now });
  }

  async decomposeGoal(context: GoalDecompositionContext): Promise<BrainDumpTask[]> {
    const { goal, subject, now } = context;
    const topic = subject?.current_topic || goal.title;
    const level = subject?.confidence_score ?? 3;
    const deadline = new Date(goal.target_date).toISOString();

    const drafts: BrainDumpTask[] = [
      {
        title: `Review fundamentals — ${topic}`,
        subject_name: subject?.name ?? goal.subject_name,
        deadline,
        deadline_label: '',
        estimated_minutes: level <= 2 ? 35 : 25,
        priority: 'high',
        confidence: 0.6,
      },
      {
        title: `Practice problems — ${topic}`,
        subject_name: subject?.name ?? goal.subject_name,
        deadline,
        deadline_label: '',
        estimated_minutes: 40,
        priority: 'medium',
        confidence: 0.6,
      },
      {
        title: 'Active recall + mock questions',
        subject_name: subject?.name ?? goal.subject_name,
        deadline,
        deadline_label: '',
        estimated_minutes: 25,
        priority: 'medium',
        confidence: 0.6,
      },
    ];

    // Reflect the goal's own deadline in the labels.
    const label = new Date(goal.target_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return drafts.map((d) => ({ ...d, deadline_label: label, deadline: deadline ?? new Date(now.getTime()).toISOString() }));
  }

  async splitNotes(text: string, context: NotesSplitContext): Promise<NotesPrepPlan> {
    return splitNotesDeterministic(text, {
      subjectName: context.subjectName,
      availableMinutes: context.availableMinutes,
      sourceName: context.sourceName,
    });
  }

  async explainRecommendation(input: {
    title: string;
    reasons: string[];
    minutes: number;
  }): Promise<string> {
    const why = input.reasons.length ? input.reasons.join(' + ') : 'it fits your current workload';
    return `${input.title} — ${input.minutes} min. Prioritised because ${why.toLowerCase()}.`;
  }

  async suggestStudyTechniques(input: {
    topic: string;
    subjectName: string;
    knowledgeLevel: number;
  }): Promise<string[]> {
    const base = [
      `Start with a 5-minute brain dump of everything you already know about ${input.topic}.`,
      'Use active recall: close the notes and write the method from memory before checking.',
      'Space repetition across 3 short sessions rather than one long block.',
    ];
    if (input.knowledgeLevel <= 2) {
      base.unshift(
        `Rebuild the fundamentals of ${input.topic} first — find one worked example per concept.`
      );
      base.push('Teach the concept out loud to a peer; gaps surface immediately.');
    } else if (input.knowledgeLevel >= 4) {
      base.push(`Move to timed exam-style problems in ${input.subjectName} to build speed.`);
    }
    return base;
  }

  async generateQuiz(input: {
    topic: string;
    subjectName: string;
    count: number;
  }): Promise<QuizQuestion[]> {
    // Deterministic scaffold questions. Clearly sample-level, not real content.
    const questions: QuizQuestion[] = [];
    for (let i = 0; i < Math.max(1, input.count); i += 1) {
      questions.push({
        question: `Sample recall ${i + 1}: state the key steps for ${input.topic} in ${input.subjectName}.`,
        options: [
          'I can explain it from memory',
          'I can do it with notes',
          'I recognise it but cannot explain it',
          'I have not learned it yet',
        ],
        answer_index: 0,
        explanation:
          'This is a self-check prompt, not a graded question. Aim to move every topic to "from memory".',
      });
    }
    return questions;
  }
}
