'use client';

import { useState } from 'react';
import {
  Sparkles,
  Calendar,
  Book,
  Users,
  Loader2,
  CheckCircle2,
  Clock,
  Trash2,
  PlayCircle,
  Target,
  Upload,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import type { BrainDumpExtraction, NotesPrepPlan } from '@/lib/domain';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';

export default function Planner() {
  const {
    isLoaded,
    plan,
    workload,
    subjects,
    goals,
    preferences,
    aiStatus,
    extractBrainDump,
    commitBrainDump,
    addGoal,
    deleteGoal,
    updatePreferences,
    updateTaskStatus,
    logStudySession,
    notes,
    uploadNotes,
    commitNotesPlan,
    deleteNote,
  } = useApp();

  const [dumpText, setDumpText] = useState(
    "I have maths exam Friday, I haven't understood integration, physics record is due tomorrow and I need to work on the presentation with Arun and Neha."
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extraction, setExtraction] = useState<BrainDumpExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedId, setStartedId] = useState<string | null>(null);

  // Notes (PDF) → prep splitting
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [notesSubject, setNotesSubject] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesPlan, setNotesPlan] = useState<NotesPrepPlan | null>(null);
  const [notesNoteId, setNotesNoteId] = useState<string | null>(null);
  const [notesCreateGoal, setNotesCreateGoal] = useState(true);
  const [notesSpreadDays, setNotesSpreadDays] = useState(3);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalSubject, setGoalSubject] = useState('');
  const [goalMode, setGoalMode] = useState<'FAST_PREP' | 'KEEP_UP'>('FAST_PREP');
  const [goalDate, setGoalDate] = useState('');

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: '900px' }}>
        <LoadingSkeleton type="cards" />
      </div>
    );
  }

  const handleExtract = async () => {
    if (!dumpText.trim()) return;
    setIsExtracting(true);
    setError(null);
    setCommitMessage(null);
    try {
      const result = await extractBrainDump(dumpText.trim());
      setExtraction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that. Try rephrasing.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCommit = async () => {
    if (!extraction) return;
    setBusy(true);
    setError(null);
    try {
      const summary = await commitBrainDump({
        tasks: extraction.tasks,
        goals: extraction.goals,
        knowledge_gaps: extraction.knowledge_gaps,
        collaboration: extraction.collaboration,
        available_minutes: extraction.time_constraints.find((t) => t.minutes)?.minutes ?? undefined,
      });
      setCommitMessage(
        `Added ${summary.created_tasks} task(s), ${summary.created_goals} goal(s)` +
          (summary.created_subjects ? ` and ${summary.created_subjects} new subject(s).` : '.') +
          (summary.suggested_team
            ? ` Tip: create a team "${summary.suggested_team.name}" with ${summary.suggested_team.members.join(', ')}.`
            : '')
      );
      setExtraction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the extraction.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim() || !goalDate) return;
    setBusy(true);
    try {
      await addGoal({
        title: goalTitle.trim(),
        subject_id: goalSubject || null,
        mode: goalMode,
        target_date: new Date(goalDate).toISOString(),
        priority: 'high',
      });
      setGoalTitle('');
      setGoalDate('');
      setShowGoalForm(false);
    } finally {
      setBusy(false);
    }
  };

  const handleNotesGenerate = async () => {
    if (!notesFile) {
      setNotesError('Choose a PDF or text file first.');
      return;
    }
    setNotesBusy(true);
    setNotesError(null);
    setNotesMessage(null);
    try {
      const result = await uploadNotes({ file: notesFile, subjectId: notesSubject || null });
      setNotesPlan(result.plan);
      setNotesNoteId(result.note.id);
      if (!result.plan) setNotesMessage('Notes saved, but no prep plan was generated.');
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Could not read those notes.');
    } finally {
      setNotesBusy(false);
    }
  };

  const handleNotesCommit = async () => {
    if (!notesPlan) return;
    setNotesBusy(true);
    setNotesError(null);
    try {
      const result = await commitNotesPlan({
        plan: notesPlan,
        subject_id: notesSubject || null,
        note_id: notesNoteId,
        create_goal: notesCreateGoal,
        spread_days: notesSpreadDays,
      });
      setNotesMessage(
        `Added ${result.created_tasks} task(s)${result.goal_id ? ' and a goal' : ''} to your plan.`
      );
      setNotesPlan(null);
      setNotesNoteId(null);
      setNotesFile(null);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Could not add the prep plan.');
    } finally {
      setNotesBusy(false);
    }
  };

  const planItems = plan?.items ?? [];

  return (
    <div style={{ maxWidth: '920px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 className="font-brand" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '8px' }}>
          Study Plan
        </h1>
        <p className="font-body" style={{ color: 'var(--text-secondary)' }}>
          Empty your mind. We will extract what matters and turn it into a realistic plan.
        </p>
      </header>

      {/* Brain dump */}
      <div className="card-static" style={{ marginBottom: '28px', padding: '28px' }}>
        <h2 className="font-heading" style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} color="var(--primary)" /> Brain Dump
        </h2>
        <textarea
          className="input-field font-body"
          style={{ height: '120px', resize: 'vertical', marginBottom: '16px', fontSize: '16px', lineHeight: '1.5' }}
          value={dumpText}
          onChange={(e) => setDumpText(e.target.value)}
          disabled={isExtracting}
          placeholder="What's on your mind? Exams, deadlines, topics you don't understand, group work…"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {aiStatus?.mock_fallback
              ? 'Running in deterministic extraction mode (no AI key needed).'
              : `Extraction provider: ${aiStatus?.active ?? 'mock'}.`}
          </span>
          <button className="btn-primary" onClick={handleExtract} disabled={isExtracting}>
            {isExtracting ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
            {isExtracting ? 'Processing…' : 'Extract data'}
          </button>
        </div>
        {error && <p role="alert" style={{ color: 'var(--accent-warning)', fontSize: '14px', marginTop: '12px' }}>{error}</p>}
      </div>

      {/* Notes (PDF) -> prep splitting */}
      <div className="card-static" style={{ marginBottom: '28px', padding: '28px' }}>
        <h2 className="font-heading" style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} color="var(--primary)" /> Notes to Prep
        </h2>
        <p className="font-body" style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          Upload your notes (PDF or text). We split them into a topic-by-topic learn → practice → recall sequence,
          then turn it into real tasks in your plan.
        </p>

        {aiStatus?.requires_key && (
          <div className="card-static" style={{ padding: '14px', marginBottom: '16px', borderColor: 'var(--accent-warning)' }}>
            <p style={{ fontSize: '14px', color: 'var(--accent-warning)' }}>
              Add an AI provider key in{' '}
              <Link href="/settings" style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>
                Settings
              </Link>{' '}
              to split notes with a model. Demo accounts can use the built-in engine.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
            <label className="form-label" htmlFor="notes-file">
              Notes file (PDF, .txt)
            </label>
            <input
              id="notes-file"
              type="file"
              accept="application/pdf,.txt,.md,text/plain"
              className="input-field"
              onChange={(e) => setNotesFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label className="form-label" htmlFor="notes-subject">
              Subject
            </label>
            <select
              id="notes-subject"
              className="input-field"
              value={notesSubject}
              onChange={(e) => setNotesSubject(e.target.value)}
            >
              <option value="">General</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="btn-primary" onClick={handleNotesGenerate} disabled={notesBusy} style={{ marginTop: '8px' }}>
          {notesBusy ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
          {notesBusy ? 'Working…' : 'Split into prep'}
        </button>

        {notesError && (
          <p role="alert" style={{ color: 'var(--accent-warning)', fontSize: '14px', marginTop: '12px' }}>
            {notesError}
          </p>
        )}
        {notesMessage && (
          <p style={{ color: 'var(--accent-success)', fontSize: '14px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} /> {notesMessage}
          </p>
        )}

        {notesPlan && (
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
            <h3 className="font-heading" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>
              Prep from {notesPlan.subject_name} — {notesPlan.topics.length} topic(s), {notesPlan.total_minutes} min total
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notesPlan.topics.map((topic, index) => (
                <div key={index} style={{ padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{topic.topic}</div>
                  {topic.summary && (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      {topic.summary}
                    </p>
                  )}
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {topic.subtasks.map((sub, i) => (
                      <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        • {sub.title} · {sub.minutes}m ({sub.kind})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', margin: '16px 0 12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={notesCreateGoal}
                  onChange={(e) => setNotesCreateGoal(e.target.checked)}
                />
                Create a Fast Prep goal
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                Spread over
                <select
                  className="input-field"
                  style={{ width: 'auto', padding: '6px 10px' }}
                  value={notesSpreadDays}
                  onChange={(e) => setNotesSpreadDays(Number(e.target.value))}
                >
                  {[1, 2, 3, 5, 7].map((d) => (
                    <option key={d} value={d}>
                      {d} day{d === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" onClick={handleNotesCommit} disabled={notesBusy}>
                {notesBusy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} Add to my plan
              </button>
              <button className="btn-secondary" onClick={() => setNotesPlan(null)} disabled={notesBusy}>
                Discard
              </button>
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 700 }}>
              Saved notes
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notes.map((note) => (
                <div key={note.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{note.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {note.page_count ? `${note.page_count} pages · ` : ''}
                      {note.subject_name}
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 10px', color: 'var(--accent-warning)', borderColor: 'var(--accent-warning)' }}
                    onClick={() => deleteNote(note.id)}
                    aria-label={`Delete note ${note.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {commitMessage && (
        <div className="card-static" style={{ marginBottom: '28px', padding: '20px', borderColor: 'var(--accent-success)' }}>
          <p style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
            <CheckCircle2 size={18} /> {commitMessage}
          </p>
        </div>
      )}

      {/* Extraction preview */}
      {extraction && (
        <div className="card-static" style={{ marginBottom: '28px', padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
            <h3 className="font-heading" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 color="var(--accent-success)" size={20} /> Review extracted information
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => setExtraction(null)}>
                Discard
              </button>
              <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={handleCommit} disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} Confirm & create
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: 700 }}>
                Tasks
              </h4>
              {extraction.tasks.length === 0 && (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No tasks detected.</p>
              )}
              {extraction.tasks.map((task, index) => (
                <div key={index} style={{ padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '10px' }}>
                  <input
                    className="input-field"
                    style={{ marginBottom: '8px', padding: '6px 8px', fontSize: '14px' }}
                    value={task.title}
                    onChange={(e) => {
                      const next = [...extraction.tasks];
                      next[index] = { ...task, title: e.target.value };
                      setExtraction({ ...extraction, tasks: next });
                    }}
                  />
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> {new Date(task.deadline).toLocaleDateString()}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Book size={13} /> {task.subject_name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> {task.estimated_minutes}m
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: 700 }}>
                Knowledge gaps & goals
              </h4>
              {extraction.knowledge_gaps.map((gap, index) => (
                <div key={index} style={{ padding: '14px', background: 'rgba(192, 108, 91, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(192, 108, 91, 0.2)', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-warning)', marginBottom: '4px', fontSize: '15px' }}>{gap.topic}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{gap.subject_name}</div>
                </div>
              ))}
              {extraction.goals.map((goal, index) => (
                <div key={index} style={{ padding: '14px', background: 'rgba(82, 121, 111, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(82, 121, 111, 0.2)', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '15px' }}>{goal.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {goal.mode === 'FAST_PREP' ? 'Fast Prep' : 'Keep Up'} · {new Date(goal.target_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {extraction.collaboration.map((c, index) => (
                <div key={index} style={{ padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                    <Users size={14} /> {c.activity}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>With {c.members.join(', ')}</div>
                </div>
              ))}
              {extraction.knowledge_gaps.length === 0 && extraction.goals.length === 0 && (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No gaps or goals detected.</p>
              )}
              {extraction.notes.map((note, i) => (
                <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>{note}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Plan controls */}
      <div className="card-static" style={{ marginBottom: '28px', padding: '24px' }}>
        <h3 className="font-heading" style={{ fontSize: '1.15rem', marginBottom: '16px' }}>
          Plan settings
        </h3>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Available today: {preferences?.available_minutes_per_day ?? 120} min</label>
            <input
              type="range"
              min={15}
              max={480}
              step={15}
              value={preferences?.available_minutes_per_day ?? 120}
              onChange={(e) => updatePreferences({ available_minutes_per_day: Number(e.target.value) })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mode</label>
            <select
              className="input-field"
              value={preferences?.mode ?? 'KEEP_UP'}
              onChange={(e) => updatePreferences({ mode: e.target.value as 'FAST_PREP' | 'KEEP_UP' })}
            >
              <option value="FAST_PREP">Fast Prep (exam focused)</option>
              <option value="KEEP_UP">Keep Up (continuous)</option>
            </select>
          </div>
          {workload && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px' }}>{workload.message}</p>
          )}
        </div>
      </div>

      {/* Generated plan */}
      <div style={{ marginBottom: '28px' }}>
        <h3 className="font-heading" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
          {plan?.headline ?? 'Your plan'}
        </h3>
        <p className="font-body" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          {plan?.summary}
        </p>

        {planItems.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No plan yet"
            description="Run a brain dump or add subjects and a goal, then your plan appears here."
            actionLabel="Open subjects"
            actionHref="/subjects"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {planItems.map((item) => {
              if (item.is_break) {
                return (
                  <div key={item.id} style={{ padding: '10px 16px', color: 'var(--text-secondary)', borderLeft: '2px dashed var(--border-light)', fontSize: '14px' }}>
                    {item.title} · {item.minutes}m
                  </div>
                );
              }
              return (
                <div key={item.id} style={{ padding: '18px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <h4 style={{ fontSize: '16px', marginBottom: '4px' }}>{item.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {item.subject_name} · {item.minutes}m · priority {item.priority_score}
                      </p>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {item.reasons.map((reason) => (
                          <li key={reason} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      {startedId === item.id ? (
                        <button
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: '14px' }}
                          onClick={async () => {
                            await logStudySession({
                              title: item.title,
                              task_id: item.task_id,
                              subject_name: item.subject_name,
                              duration_minutes: item.minutes,
                              actual_minutes: item.minutes,
                              status: 'completed',
                            });
                            if (item.task_id) await updateTaskStatus(item.task_id, 'done', item.minutes);
                            setStartedId(null);
                          }}
                        >
                          <CheckCircle2 size={16} /> Complete
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          style={{ padding: '8px 16px', fontSize: '14px' }}
                          onClick={async () => {
                            if (item.task_id) await updateTaskStatus(item.task_id, 'in_progress');
                            setStartedId(item.id);
                          }}
                        >
                          <PlayCircle size={16} /> Start
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Goals */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>Goals</h3>
          <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => setShowGoalForm((v) => !v)}>
            {showGoalForm ? 'Cancel' : 'Add goal'}
          </button>
        </div>

        {showGoalForm && (
          <form className="card-static" style={{ padding: '20px', marginBottom: '16px' }} onSubmit={handleAddGoal}>
            <div className="form-group">
              <label className="form-label">Goal title</label>
              <input className="input-field" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Engineering Mathematics Exam" required />
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                <label className="form-label">Subject</label>
                <select className="input-field" value={goalSubject} onChange={(e) => setGoalSubject(e.target.value)}>
                  <option value="">General</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                <label className="form-label">Mode</label>
                <select className="input-field" value={goalMode} onChange={(e) => setGoalMode(e.target.value as 'FAST_PREP' | 'KEEP_UP')}>
                  <option value="FAST_PREP">Fast Prep</option>
                  <option value="KEEP_UP">Keep Up</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                <label className="form-label">Target date</label>
                <input type="date" className="input-field" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              <Target size={18} /> Save goal
            </button>
          </form>
        )}

        {goals.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            No goals yet. A goal tells the planner what you are working towards and by when.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {goals.map((goal) => (
              <div key={goal.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <h4 style={{ fontSize: '15px', marginBottom: '2px' }}>{goal.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {goal.subject_name} · {goal.mode === 'FAST_PREP' ? 'Fast Prep' : 'Keep Up'} · due {new Date(goal.target_date).toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  style={{ padding: '8px 12px', color: 'var(--accent-warning)', borderColor: 'var(--accent-warning)' }}
                  onClick={() => deleteGoal(goal.id)}
                  aria-label={`Delete goal ${goal.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
