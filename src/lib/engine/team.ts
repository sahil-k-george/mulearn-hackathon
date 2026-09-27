/**
 * Team intelligence (plan sections 11 & 12).
 *
 * Pure functions over team member knowledge levels. Produces a knowledge map,
 * strengths, shared gaps, and *recommendations* (never mandatory assignments)
 * for peer learning.
 */

import type {
  PeerRecommendation,
  TeamGap,
  TeamIntelligence,
  TeamMemberItem,
  TeamStrength,
} from '../domain';

export function buildTeamIntelligence(
  teamId: string,
  members: TeamMemberItem[]
): TeamIntelligence {
  const activeMembers = members.filter((m) => m.team_id === teamId && m.status !== 'invited');

  const topicMap = new Map<string, { member_id: string; name: string; score: number }[]>();
  for (const member of activeMembers) {
    for (const topic of member.confidence_topics ?? []) {
      const key = topic.topic.trim();
      if (!key) continue;
      const entries = topicMap.get(key) ?? [];
      entries.push({ member_id: member.user_id, name: member.name, score: topic.score });
      topicMap.set(key, entries);
    }
  }

  const knowledge_map = Array.from(topicMap.entries())
    .map(([topic, entries]) => ({
      topic,
      entries: [...entries].sort((a, b) => b.score - a.score),
      average_score:
        Math.round((entries.reduce((sum, e) => sum + e.score, 0) / entries.length) * 10) / 10,
    }))
    .sort((a, b) => a.average_score - b.average_score);

  const strengths: TeamStrength[] = [];
  const gaps: TeamGap[] = [];

  for (const topic of knowledge_map) {
    const best = topic.entries[0];
    if (best && best.score >= 4) {
      strengths.push({
        topic: topic.topic,
        member_id: best.member_id,
        member_name: best.name.replace(/\s*\(You\)$/, ''),
        score: best.score,
      });
    }

    const learners = topic.entries
      .filter((e) => e.score <= 2)
      .map((e) => ({ member_id: e.member_id, name: e.name.replace(/\s*\(You\)$/, ''), score: e.score }));

    if (learners.length && topic.average_score < 4) {
      gaps.push({
        topic: topic.topic,
        average_score: topic.average_score,
        members_needing_help: learners,
      });
    }
  }

  const recommendations: PeerRecommendation[] = [];
  for (const gap of gaps) {
    const topic = knowledge_map.find((t) => t.topic === gap.topic);
    if (!topic) continue;
    const mentor = topic.entries.find((e) => e.score >= 4);
    if (!mentor) continue;
    recommendations.push({
      topic: gap.topic,
      mentor_id: mentor.member_id,
      mentor_name: mentor.name.replace(/\s*\(You\)$/, ''),
      mentor_score: mentor.score,
      learners: gap.members_needing_help,
      suggestion: `Suggested session: ${mentor.name.replace(/\s*\(You\)$/, '')} walks through ${gap.topic} with ${gap.members_needing_help
        .map((l) => l.name)
        .join(' and ')}.`,
    });
  }

  return { team_id: teamId, knowledge_map, strengths, gaps, recommendations };
}
