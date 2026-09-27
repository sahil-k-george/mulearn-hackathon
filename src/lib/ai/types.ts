/**
 * AI provider abstraction (plan section 17).
 *
 * The application talks to `AIService` only. Concrete providers (mock, OpenAI,
 * Gemini, OpenRouter, Grok) are swappable through configuration or per-user
 * settings. The mock provider keeps the demo functional without any API key.
 */

import type {
  BrainDumpExtraction,
  GoalItem,
  NotesPrepPlan,
  SubjectItem,
  BrainDumpTask,
} from '../domain';

export type AIProviderName = 'mock' | 'openai' | 'gemini' | 'openrouter' | 'grok';

export type BrainDumpContext = {
  /** Known subjects so extraction can match against real data. */
  subjects: SubjectItem[];
  /** ISO date used to resolve relative deadlines like "tomorrow". */
  now: Date;
  timezone?: string;
};

export type GoalDecompositionContext = {
  goal: GoalItem;
  subject: SubjectItem | null;
  now: Date;
};

export type NotesSplitContext = {
  subject: SubjectItem | null;
  subjectName: string;
  /** Available minutes per day, used to size the prep blocks. */
  availableMinutes: number;
  now: Date;
  /** Optional extraction notes / filename for context. */
  sourceName?: string;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
};

export interface AIService {
  readonly name: AIProviderName;
  /** Natural-language brain dump -> structured academic information. */
  extractBrainDump(text: string, context: BrainDumpContext): Promise<BrainDumpExtraction>;
  /** Break a large goal into concrete tasks. */
  decomposeGoal(context: GoalDecompositionContext): Promise<BrainDumpTask[]>;
  /** Split uploaded notes into topics and study subtasks (prep plan). */
  splitNotes(text: string, context: NotesSplitContext): Promise<NotesPrepPlan>;
  /** Explain, in one or two sentences, why an item was recommended. */
  explainRecommendation(input: {
    title: string;
    reasons: string[];
    minutes: number;
  }): Promise<string>;
  /** Suggest study techniques for a topic / knowledge gap. */
  suggestStudyTechniques(input: {
    topic: string;
    subjectName: string;
    knowledgeLevel: number;
  }): Promise<string[]>;
  /** Generate lightweight recall questions for a topic. */
  generateQuiz(input: {
    topic: string;
    subjectName: string;
    count: number;
  }): Promise<QuizQuestion[]>;
}
