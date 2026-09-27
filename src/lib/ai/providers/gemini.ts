/**
 * Google Gemini provider.
 *
 * Only the language-heavy responsibilities use the model; deterministic helpers
 * are inherited from MockProvider.
 */

import type { BrainDumpContext, NotesSplitContext } from '../types';
import type { BrainDumpExtraction, NotesPrepPlan } from '../../domain';
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

export class GeminiProvider extends MockProvider {
  readonly name = 'gemini' as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  private async generateJson(system: string, user: string): Promise<unknown> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return extractJsonObject(content);
  }

  async extractBrainDump(text: string, context: BrainDumpContext): Promise<BrainDumpExtraction> {
    const user = buildExtractionUserPrompt(
      text,
      context.now.toISOString(),
      context.subjects.map((s) => s.name)
    );
    const raw = await this.generateJson(EXTRACTION_SYSTEM_PROMPT, user);
    if (!raw) throw new Error('Gemini returned no parseable JSON');
    return normalizeExtraction(raw, this.name, context.now);
  }

  async splitNotes(text: string, context: NotesSplitContext): Promise<NotesPrepPlan> {
    const user = buildNotesUserPrompt(
      context.subjectName,
      context.availableMinutes,
      context.sourceName,
      text
    );
    const raw = await this.generateJson(NOTES_SYSTEM_PROMPT, user);
    if (!raw) throw new Error('Gemini returned no parseable JSON for the notes');
    const plan = normalizeNotesPlan(raw, this.name, context.subjectName);
    if (!plan.topics.length) throw new Error('Gemini could not derive topics from the notes');
    return plan;
  }
}
