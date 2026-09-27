import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { createNote, listNotes } from '@/lib/server/repo';
import { readDb, transact } from '@/lib/server/store';
import { extractPdfText } from '@/lib/server/pdf';
import { requireAIService } from '@/lib/server/ai';
import { getPreferences } from '@/lib/server/repo';
import type { NoteItem } from '@/lib/domain';

/** Client-safe note view: metadata + a short preview, never the whole text. */
function toPublicNote(note: NoteItem) {
  return {
    id: note.id,
    subject_id: note.subject_id,
    subject_name: note.subject_name,
    title: note.title,
    file_name: note.file_name,
    page_count: note.page_count,
    char_count: note.char_count,
    preview: note.text.slice(0, 240),
    created_at: note.created_at,
  };
}

const MAX_TEXT_CHARS = 60_000;

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const notes = await transact((db) => listNotes(db, user.id));
    return json({ notes: notes.map(toPublicNote) });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const contentType = request.headers.get('content-type') ?? '';

    let text = '';
    let fileName = 'Pasted notes';
    let subjectId: string | null = null;
    let title = '';
    let generate = false;
    let availableMinutes: number | undefined;
    let pageCount = 0;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) throw new HttpError('Attach a PDF (or text) file to upload.', 400);

      subjectId = (form.get('subject_id') as string) || null;
      title = ((form.get('title') as string) || '').trim();
      generate = form.get('generate') !== 'false' && form.get('generate') !== null;
      const minutesRaw = form.get('available_minutes');
      if (minutesRaw) availableMinutes = Number(minutesRaw) || undefined;

      fileName = file.name;
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const extracted = await extractPdfText(await file.arrayBuffer());
        text = extracted.text;
        pageCount = extracted.pageCount;
        if (!text.trim()) {
          throw new HttpError(
            'No selectable text was found in that PDF. Scanned pages need OCR first.',
            422
          );
        }
      } else if (file.type.startsWith('text/') || /\.(txt|md|markdown)$/i.test(file.name)) {
        text = (await file.text()).slice(0, MAX_TEXT_CHARS);
      } else {
        throw new HttpError('Unsupported file type. Upload a PDF or a plain text file.', 415);
      }
    } else {
      const body = await readBody<{
        text?: string;
        file_name?: string;
        title?: string;
        subject_id?: string | null;
        generate?: boolean;
        available_minutes?: number;
      }>(request);
      text = (body.text ?? '').slice(0, MAX_TEXT_CHARS);
      fileName = body.file_name?.trim() || 'Pasted notes';
      title = (body.title ?? '').trim();
      subjectId = body.subject_id ?? null;
      generate = body.generate !== false;
      availableMinutes = body.available_minutes;
      if (!text.trim()) throw new HttpError('There is no note text to work with.', 400);
    }

    const note = await transact((db) =>
      createNote(db, user.id, {
        title: title || fileName.replace(/\.(pdf|txt|md|markdown)$/i, ''),
        file_name: fileName,
        subject_id: subjectId,
        page_count: pageCount,
        text,
      })
    );

    // Without a generation request we just save the note.
    if (!generate) {
      return json({ note: toPublicNote(note), plan: null });
    }

    const db = await readDb();
    const { service, status } = requireAIService(db, user);
    const subject = note.subject_id
      ? db.subjects.find((s) => s.id === note.subject_id && s.user_id === user.id) ?? null
      : db.subjects.find(
          (s) => s.user_id === user.id && s.name.toLowerCase() === note.subject_name.toLowerCase()
        ) ?? null;

    const minutes =
      availableMinutes ?? getPreferences(db, user.id).available_minutes_per_day ?? 120;

    const plan = await service.splitNotes(note.text, {
      subject,
      subjectName: subject?.name ?? note.subject_name,
      availableMinutes: minutes,
      now: new Date(),
      sourceName: note.file_name,
    });

    return json({ note: toPublicNote(note), plan, ai: status }, 201);
  });
}
