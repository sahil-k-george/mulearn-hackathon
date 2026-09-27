/**
 * Generic OpenAI-compatible chat-completions provider.
 *
 * OpenAI, OpenRouter and Grok (xAI) all speak the same `/chat/completions`
 * shape, so one implementation covers all three. Only the language-heavy
 * responsibilities (brain dump extraction, goal decomposition, notes splitting)
 * use the model; explanations/techniques/quizzes stay deterministic.
 */

import type {
  AIProviderName,
  BrainDumpContext,
  GoalDecompositionContext,
  NotesSplitContext,
} from '../types';
import type { BrainDumpExtraction, BrainDumpTask, NotesPrepPlan } from '../../domain';
import { MockProvider } from './mock';
import {
  EXTRACTION_SYSTEM_PROMPT,
  NOTES_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
  buildNotesUserPrompt,
  extractJsonObject,
  normalizeExtraction,
  normalizeNotesPlan,
} from '../prompts';

export type OpenAICompatibleConfig = {
  name: AIProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  /** Label used in error messages, e.g. "OpenRouter". */
  label?: string;
};

export class OpenAICompatibleProvider extends MockProvider {
  readonly name: AIProviderName;
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private extraHeaders: Record<string, string>;
  private label: string;

  constructor(config: OpenAICompatibleConfig) {
    super();
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.extraHeaders = config.extraHeaders ?? {};
    this.label = config.label ?? config.name;
  }

  private async chatJson(system: string, user: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`${this.label} request failed (${response.status}): ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? '';
    return extractJsonObject(content);
  }

  async extractBrainDump(text: string, context: BrainDumpContext): Promise<BrainDumpExtraction> {
    const user = buildExtractionUserPrompt(
      text,
      context.now.toISOString(),
      context.subjects.map((s) => s.name)
    );
    const raw = await this.chatJson(EXTRACTION_SYSTEM_PROMPT, user);
    if (!raw) throw new Error(`${this.label} returned no parseable JSON`);
    return normalizeExtraction(raw, this.name, context.now);
  }

  async decomposeGoal(context: GoalDecompositionContext): Promise<BrainDumpTask[]> {
    const subject = context.subject;
    const raw = (await this.chatJson(
      `Break academic goals into 3-6 concrete study tasks. Return JSON: { "tasks": [{ "title", "estimated_minutes", "priority" }] }. Only study actions, no admin.`,
      `Goal: ${context.goal.title}. Subject: ${subject?.name ?? context.goal.subject_name}. Current topic: ${
        subject?.current_topic ?? 'unknown'
      }. Knowledge level: ${subject?.confidence_score ?? 3}/5. Target date: ${context.goal.target_date}.`
    )) as { tasks?: Record<string, unknown>[] } | null;

    const tasks = raw?.tasks;
    if (!Array.isArray(tasks) || !tasks.length) return super.decomposeGoal(context);

    return tasks.slice(0, 6).map((t) => ({
      title: typeof t.title === 'string' ? t.title : 'Study task',
      subject_name: subject?.name ?? context.goal.subject_name,
      deadline: context.goal.target_date,
      deadline_label: new Date(context.goal.target_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      estimated_minutes: Number.isFinite(Number(t.estimated_minutes))
        ? Math.max(10, Number(t.estimated_minutes))
        : 30,
      priority: (['low', 'medium', 'high', 'urgent'] as const).includes(
        t.priority as BrainDumpTask['priority']
      )
        ? (t.priority as BrainDumpTask['priority'])
        : 'medium',
      confidence: 0.7,
    }));
  }

  async splitNotes(text: string, context: NotesSplitContext): Promise<NotesPrepPlan> {
    const user = buildNotesUserPrompt(
      context.subjectName,
      context.availableMinutes,
      context.sourceName,
      text
    );
    const raw = await this.chatJson(NOTES_SYSTEM_PROMPT, user);
    if (!raw) throw new Error(`${this.label} returned no parseable JSON for the notes`);

    const plan = normalizeNotesPlan(raw, this.name, context.subjectName);
    if (!plan.topics.length) {
      throw new Error(`${this.label} could not derive topics from the notes`);
    }
    return plan;
  }
}

/** Backwards-compatible OpenAI-named subclass. */
export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, model = 'gpt-4o-mini') {
    super({ name: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey, model, label: 'OpenAI' });
  }
}
