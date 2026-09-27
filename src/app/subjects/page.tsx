'use client';

import { useState } from 'react';
import { BookOpen, AlertCircle, Plus, Trash2, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '@/lib/store';
import { KNOWLEDGE_LEVEL_LABELS } from '@/lib/domain';
import type { SubjectItem } from '@/lib/database.types';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

function levelColor(level: number) {
  if (level <= 2) return 'var(--accent-warning)';
  if (level === 3) return 'var(--accent-info)';
  return 'var(--accent-success)';
}

export default function Subjects() {
  const { isLoaded, subjects, goals, tasks, addSubject, updateSubject, deleteSubject } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState(2);
  const [category, setCategory] = useState('Core Subject');

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: '800px' }}>
        <LoadingSkeleton type="cards" />
      </div>
    );
  }

  const resetForm = () => {
    setName('');
    setTopic('');
    setLevel(2);
    setCategory('Core Subject');
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await updateSubject(editingId, {
          name: name.trim(),
          current_topic: topic.trim(),
          confidence_score: level,
          category,
        });
      } else {
        await addSubject({ name: name.trim(), current_topic: topic.trim(), knowledge_level: level, category });
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the subject.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (subject: SubjectItem) => {
    setEditingId(subject.id);
    setName(subject.name);
    setTopic(subject.current_topic);
    setLevel(subject.confidence_score);
    setCategory(subject.category);
    setShowForm(true);
  };

  return (
    <div style={{ maxWidth: '820px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="font-brand" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '8px' }}>
            Subjects & Knowledge
          </h1>
          <p className="font-body" style={{ color: 'var(--text-secondary)' }}>
            Map your academic landscape so planning can adapt to your confidence.
          </p>
        </div>
        <button className="btn-primary" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          <Plus size={18} /> {showForm ? 'Cancel' : 'Add Subject'}
        </button>
      </div>

      {showForm && (
        <form className="card-static" style={{ marginBottom: '24px', padding: '24px' }} onSubmit={handleSubmit}>
          <h2 className="font-heading" style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
            {editingId ? 'Edit subject' : 'New subject'}
          </h2>
          <div className="form-group">
            <label className="form-label">Subject name</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering Mathematics" required />
          </div>
          <div className="form-group">
            <label className="form-label">Current topic</label>
            <input className="input-field" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Fourier Series & Integration" />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Core Engineering" />
          </div>
          <div className="form-group">
            <label className="form-label">Knowledge level: {level}/5 — {KNOWLEDGE_LEVEL_LABELS[level]}</label>
            <input type="range" min={1} max={5} value={level} onChange={(e) => setLevel(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          {error && <p style={{ color: 'var(--accent-warning)', fontSize: '14px' }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
            {editingId ? 'Save changes' : 'Add subject'}
          </button>
        </form>
      )}

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Add your subjects and set a confidence level. The planner uses this to decide how much time each topic needs."
          actionLabel="Add your first subject"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {subjects.map((subject) => {
            const color = levelColor(subject.confidence_score);
            const subjectTasks = tasks.filter((t) => t.subject_name === subject.name);
            const openTasks = subjectTasks.filter((t) => t.status !== 'done').length;
            const subjectGoals = goals.filter((g) => g.subject_id === subject.id && g.status === 'active');
            return (
              <div key={subject.id} className="card-static" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '16px', flex: 1, minWidth: '240px' }}>
                    <div style={{ padding: '12px', background: 'rgba(43, 58, 74, 0.05)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)', height: 'fit-content' }}>
                      <BookOpen size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 className="font-heading" style={{ fontSize: '1.25rem', marginBottom: '4px' }}>
                        {subject.name}
                      </h3>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        {subject.current_topic ? `Current topic: ${subject.current_topic}` : subject.category}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>Confidence:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <button
                              key={i}
                              aria-label={`Set confidence to ${i}`}
                              onClick={() => updateSubject(subject.id, { confidence_score: i })}
                              style={{
                                width: '20px', height: '8px', borderRadius: '2px', border: 'none', cursor: 'pointer',
                                background: i <= subject.confidence_score ? color : 'var(--border-light)',
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: '13px', color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={14} /> {subject.confidence_score}/5 ({KNOWLEDGE_LEVEL_LABELS[subject.confidence_score]})
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} /> {openTasks} open task{openTasks === 1 ? '' : 's'}
                        </span>
                        <span>{subjectGoals.length} active goal{subjectGoals.length === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => startEdit(subject)}>
                      Edit
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '14px', color: 'var(--accent-warning)', borderColor: 'var(--accent-warning)' }}
                      onClick={() => deleteSubject(subject.id)}
                      aria-label={`Delete ${subject.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
