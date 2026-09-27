'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  PlayCircle,
  Brain,
  Clock,
  Users2,
  Sparkles,
  CircleDot,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const {
    isLoaded,
    user,
    plan,
    workload,
    tasks,
    teams,
    activeTeamId,
    updateTaskStatus,
    logStudySession,
    checkInWorkload,
  } = useApp();

  const [startedId, setStartedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: '1000px' }}>
        <LoadingSkeleton type="cards" />
      </div>
    );
  }

  const nextStep = plan?.items.find((item) => !item.is_break && item.status === 'planned') ?? null;
  const planItems = plan?.items ?? [];
  const subjectsNeedingFocus = plan?.focus_areas ?? [];
  const activeTeam = teams.find((t) => t.id === activeTeamId);

  const startSession = async () => {
    if (!nextStep) return;
    setBusy(true);
    try {
      if (nextStep.task_id) await updateTaskStatus(nextStep.task_id, 'in_progress');
      setStartedId(nextStep.id);
    } finally {
      setBusy(false);
    }
  };

  const completeSession = async () => {
    if (!nextStep) return;
    setBusy(true);
    try {
      await logStudySession({
        title: nextStep.title,
        task_id: nextStep.task_id,
        subject_name: nextStep.subject_name,
        duration_minutes: nextStep.minutes,
        actual_minutes: nextStep.minutes,
        status: 'completed',
      });
      if (nextStep.task_id) {
        await updateTaskStatus(nextStep.task_id, 'done', nextStep.minutes);
      }
      setStartedId(null);
    } finally {
      setBusy(false);
    }
  };

  const rebalance = async () => {
    if (!workload) return;
    const target = Math.max(15, Math.round(workload.available_minutes * 0.85));
    setBusy(true);
    try {
      await checkInWorkload('overloaded', target);
    } finally {
      setBusy(false);
    }
  };

  const workloadColor =
    workload?.level === 'overloaded' || workload?.level === 'heavy'
      ? 'var(--accent-warning)'
      : 'var(--accent-success)';

  return (
    <div style={{ maxWidth: '1000px' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 className="font-brand" style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>
          {greeting()}, {user.name.split(' ')[0]}.
        </h1>
        <p className="font-body" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          {plan
            ? `${plan.available_minutes} minutes available · ${plan.mode === 'FAST_PREP' ? 'Fast Prep' : 'Keep Up'} mode.`
            : 'Tell us what is going on and we will build your plan.'}
        </p>
      </header>

      {/* Next step hero */}
      {nextStep ? (
        <div className="card" style={{ marginBottom: '32px', background: 'var(--primary)', color: 'white', border: 'none' }}>
          <p style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', color: '#94A3B8', fontWeight: 600 }}>
            Your next step
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <h2 className="font-heading" style={{ fontSize: '2rem', color: 'white', marginBottom: '8px' }}>
                {nextStep.title}
              </h2>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#CBD5E1' }}>
                  <Clock size={16} /> {nextStep.minutes} minutes
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#CBD5E1' }}>
                  <CircleDot size={16} /> {nextStep.subject_name}
                </span>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {nextStep.reasons.map((reason) => (
                  <li key={reason} style={{ fontSize: '13px', color: '#CBD5E1' }}>
                    • {reason}
                  </li>
                ))}
              </ul>
            </div>
            {startedId === nextStep.id ? (
              <button
                onClick={completeSession}
                disabled={busy}
                style={{ background: '#52796F', color: 'white', border: 'none', borderRadius: '50px', padding: '16px 28px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CheckCircle2 size={20} /> Mark complete
              </button>
            ) : (
              <button
                onClick={startSession}
                disabled={busy}
                style={{ background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '50px', padding: '16px 28px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <PlayCircle size={22} /> Start session
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '32px' }}>
          <EmptyState
            icon={Sparkles}
            title="Nothing planned yet"
            description="Run a brain dump so we can turn your workload into a realistic plan."
            actionLabel="Open Brain Dump"
            actionHref="/planner"
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '32px' }}>
        {/* Today's plan */}
        <div>
          <h3 className="font-heading" style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
            Today&apos;s plan
          </h3>

          {planItems.length === 0 ? (
            <p className="font-body" style={{ color: 'var(--text-secondary)' }}>
              Your plan is empty. Add subjects and a goal, or run a brain dump.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {planItems.slice(0, 9).map((item) => {
                const task = item.task_id ? tasks.find((t) => t.id === item.task_id) : undefined;
                const isDone = task?.status === 'done';
                if (item.is_break) {
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: 'var(--text-secondary)', borderLeft: '2px dashed var(--border-light)' }}>
                      <Clock size={16} />
                      <span style={{ fontSize: '14px' }}>{item.title} · {item.minutes}m</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                      background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                      border: item.id === nextStep?.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      opacity: isDone ? 0.6 : 1,
                    }}
                  >
                    <button
                      aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
                      onClick={() =>
                        item.task_id &&
                        updateTaskStatus(item.task_id, isDone ? 'todo' : 'done', isDone ? undefined : item.minutes)
                      }
                      disabled={!item.task_id}
                      style={{ background: 'none', border: 'none', cursor: item.task_id ? 'pointer' : 'default', padding: 0, display: 'flex' }}
                    >
                      {isDone ? (
                        <CheckCircle2 color="var(--accent-success)" size={22} />
                      ) : (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid var(--border-light)' }} />
                      )}
                    </button>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ textDecoration: isDone ? 'line-through' : 'none', fontSize: '15px' }}>{item.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {item.subject_name} · {item.minutes}m
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {plan && plan.deferred.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Moved to tomorrow
              </h4>
              {plan.deferred.map((item) => (
                <p key={item.task_id} style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {item.title} · {item.minutes}m — {item.reason}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {workload && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 className="font-heading" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
                Workload awareness
              </h3>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Brain color={workloadColor} />
                <div>
                  <p className="font-body" style={{ fontWeight: 600, color: workloadColor, marginBottom: '4px', textTransform: 'capitalize' }}>
                    {workload.level}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {workload.message}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    {workload.suggestion}
                  </p>
                  {workload.should_rebalance && (
                    <button className="btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '14px' }} onClick={rebalance} disabled={busy}>
                      <RotateCcw size={15} /> Rebalance plan
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {subjectsNeedingFocus.length > 0 && (
            <div className="card-static" style={{ padding: '24px' }}>
              <h3 className="font-heading" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>
                Focus areas
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {subjectsNeedingFocus.map((area) => (
                  <div key={area.topic}>
                    <p style={{ fontSize: '14px', fontWeight: 600 }}>{area.topic}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{area.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-static" style={{ padding: '24px' }}>
            <h3 className="font-heading" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>
              Your spaces
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Solo — personal plan</p>
            {activeTeam ? (
              <Link href={`/teams/${activeTeam.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--primary)', textDecoration: 'none' }}>
                <Users2 size={16} /> {activeTeam.name}
              </Link>
            ) : (
              <Link href="/teams" style={{ fontSize: '14px', color: 'var(--primary)', textDecoration: 'none' }}>
                Join or create a team →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
