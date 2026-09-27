/**
 * Workload awareness (plan section 15).
 *
 * A non-medical workload check: compares planned study time with the student's
 * actual available time and flags overload with a concrete suggestion.
 */

import type { WorkloadAssessment, WorkloadLevel } from '../domain';

export function assessWorkload(params: {
  plannedMinutes: number;
  availableMinutes: number;
  preferredLevel?: WorkloadLevel | null;
}): WorkloadAssessment {
  const { plannedMinutes, availableMinutes, preferredLevel } = params;
  const safeAvailable = Math.max(1, availableMinutes);
  const ratio = plannedMinutes / safeAvailable;

  let level: WorkloadLevel;
  if (ratio <= 0.7) level = 'comfortable';
  else if (ratio <= 0.95) level = 'manageable';
  else if (ratio <= 1.25) level = 'heavy';
  else level = 'overloaded';

  // A student who explicitly says they are overloaded is respected.
  if (preferredLevel === 'overloaded' && level !== 'overloaded') {
    level = ratio > 0.9 ? 'overloaded' : level;
  }

  const format = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const messages: Record<WorkloadLevel, string> = {
    comfortable: `You have ${format(plannedMinutes)} planned against ${format(
      availableMinutes
    )} available — a comfortable pace.`,
    manageable: `You have ${format(plannedMinutes)} planned against ${format(
      availableMinutes
    )} available. That is manageable.`,
    heavy: `You have ${format(plannedMinutes)} planned against ${format(
      availableMinutes
    )} available. It is a heavy but possible day.`,
    overloaded: `You have ${format(plannedMinutes)} of planned work but only about ${format(
      availableMinutes
    )} available.`,
  };

  const suggestions: Record<WorkloadLevel, string> = {
    comfortable:
      'You have room to get ahead. Consider a short recall session on your weakest topic.',
    manageable: 'Protect your breaks and stop at the planned time.',
    heavy:
      'Trim the lowest-priority block if you start slipping. Quality beats quantity tonight.',
    overloaded:
      'Rebalance to fit your available time and move the lower-priority work to tomorrow.',
  };

  return {
    level,
    planned_minutes: plannedMinutes,
    available_minutes: availableMinutes,
    ratio: Math.round(ratio * 100) / 100,
    message: messages[level],
    suggestion: suggestions[level],
    should_rebalance: level === 'heavy' || level === 'overloaded',
  };
}

/** Minutes to plan when a student accepts a rebalance. */
export function rebalancedMinutes(availableMinutes: number): number {
  // Keep a little headroom so the day is achievable rather than full.
  return Math.max(15, Math.round(availableMinutes * 0.85));
}
