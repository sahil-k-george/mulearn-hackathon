"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  UserPlus, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  Shield, 
  Lock, 
  Globe, 
  KeyRound, 
  ArrowRight,
  Sparkles,
  X,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { TeamItem } from '@/lib/database.types';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function TeamsPage() {
  const router = useRouter();
  const { 
    teams, 
    teamMembers, 
    user, 
    createTeam, 
    joinTeamByCode, 
    joinDiscoverableTeam, 
    setActiveTeamId, 
    isLoaded 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'my_teams' | 'join_code' | 'discover'>('my_teams');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Join code state
  const [inputCode, setInputCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  // Create team form state
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamGoal, setTeamGoal] = useState('');
  const [projectTopic, setProjectTopic] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [visibility, setVisibility] = useState<'discoverable' | 'invite_only' | 'private'>('discoverable');
  const [tagsInput, setTagsInput] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: '1000px' }}>
        <LoadingSkeleton type="cards" />
      </div>
    );
  }

  // Filter user's joined teams
  const userTeamIds = teamMembers.filter(m => m.user_id === user.id).map(m => m.team_id);
  const myTeams = teams.filter(t => userTeamIds.includes(t.id));

  // Discoverable teams (that user is not already in)
  const discoverableTeams = teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && t.visibility === 'discoverable';
  });

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !teamGoal.trim()) return;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const newTeam = await createTeam({
      name: teamName.trim(),
      description: teamDesc.trim(),
      goal: teamGoal.trim(),
      projectTopic: projectTopic.trim() || teamName.trim(),
      maxMembers: Number(maxMembers),
      visibility,
      tags,
    });

    setShowCreateModal(false);
    // Reset form
    setTeamName('');
    setTeamDesc('');
    setTeamGoal('');
    setProjectTopic('');
    setTagsInput('');
    
    // Switch to active team workspace
    router.push(`/teams/${newTeam.id}`);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    const result = await joinTeamByCode(inputCode.trim());
    if (result.success) {
      setJoinStatus({ type: 'success', message: result.message });
      setInputCode('');
      setTimeout(() => {
        if (result.team) {
          router.push(`/teams/${result.team.id}`);
        }
      }, 1000);
    } else {
      setJoinStatus({ type: 'error', message: result.message });
    }
  };

  const handleDiscoverJoin = async (teamId: string) => {
    const result = await joinDiscoverableTeam(teamId);
    if (result.success) {
      router.push(`/teams/${teamId}`);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div style={{ maxWidth: '1050px' }}>
      {/* Header */}
      <header style={{ marginBottom: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="font-brand" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '6px' }}>
            Team Collaboration
          </h1>
          <p className="font-body" style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            Form study squads, join project teams, and master complex subjects together.
          </p>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn-primary"
          style={{ padding: '12px 24px', fontSize: '15px' }}
        >
          <PlusCircle size={18} /> Create Team
        </button>
      </header>

      {/* Tabs */}
      <div className="tabs-header">
        <button 
          className={`tab-btn ${activeTab === 'my_teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('my_teams')}
        >
          <Users size={16} /> My Teams ({myTeams.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          <Globe size={16} /> Discover Teams ({discoverableTeams.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'join_code' ? 'active' : ''}`}
          onClick={() => setActiveTab('join_code')}
        >
          <KeyRound size={16} /> Join by Code
        </button>
      </div>

      {/* Tab 1: My Teams */}
      {activeTab === 'my_teams' && (
        <div>
          {myTeams.length === 0 ? (
            <EmptyState 
              icon={Users}
              title="You haven't joined a team yet."
              description="Collaborate with peers, share knowledge maps, and tackle assignments together."
              actionLabel="Create a Team"
              onAction={() => setShowCreateModal(true)}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {myTeams.map((team) => {
                const members = teamMembers.filter(m => m.team_id === team.id);
                const isOwner = team.owner_id === user.id;

                return (
                  <div key={team.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <span className={isOwner ? "tag-warning" : "tag-primary"} style={{ fontSize: '12px' }}>
                        {isOwner ? '👑 Team Owner' : 'Member'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {team.member_count} / {team.max_members} members
                      </span>
                    </div>

                    <h3 className="font-heading" style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '8px' }}>
                      {team.name}
                    </h3>
                    <p className="font-body" style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px', flex: 1 }}>
                      {team.description}
                    </p>

                    {/* Team Goal */}
                    <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                        Target Goal
                      </span>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginTop: '2px' }}>
                        {team.goal}
                      </p>
                    </div>

                    {/* Join Code Display */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '8px 12px', background: 'rgba(43, 58, 74, 0.04)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Invite Code:</span>
                      <button 
                        onClick={() => copyToClipboard(team.join_code)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: 'var(--primary)' }}
                        title="Click to copy code"
                      >
                        {team.join_code}
                        {copiedCode === team.join_code ? <Check size={14} color="var(--accent-success)" /> : <Copy size={14} />}
                      </button>
                    </div>

                    {/* Member Avatars */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {members.slice(0, 4).map((m, idx) => (
                          <div 
                            key={m.id} 
                            style={{ 
                              width: '30px', 
                              height: '30px', 
                              borderRadius: '50%', 
                              background: 'var(--primary)', 
                              color: 'white', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: '12px', 
                              fontWeight: 700,
                              border: '2px solid white',
                              marginLeft: idx > 0 ? '-8px' : '0',
                            }}
                            title={`${m.name} (${m.role})`}
                          >
                            {m.name.charAt(0)}
                          </div>
                        ))}
                      </div>

                      <Link 
                        href={`/teams/${team.id}`}
                        onClick={() => setActiveTeamId(team.id)}
                        className="btn-primary" 
                        style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}
                      >
                        Open Workspace <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Discover Teams */}
      {activeTab === 'discover' && (
        <div>
          <div style={{ marginBottom: '24px', display: 'flex', gap: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '14px' }} />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search discoverable teams by subject, topic, or tags..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '44px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {discoverableTeams.map((team) => {
              const isAlreadyMember = userTeamIds.includes(team.id);
              const isFull = team.member_count >= team.max_members;

              return (
                <div key={team.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="tag-neutral" style={{ fontSize: '12px' }}>
                      {team.category}
                    </span>
                    <span style={{ fontSize: '12px', color: isFull ? 'var(--accent-warning)' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {team.member_count} / {team.max_members} members
                    </span>
                  </div>

                  <h3 className="font-heading" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '8px' }}>
                    {team.name}
                  </h3>
                  <p className="font-body" style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px', flex: 1 }}>
                    {team.description}
                  </p>

                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {team.tags.map((tag) => (
                      <span key={tag} style={{ background: 'var(--bg-main)', color: 'var(--text-secondary)', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Lead: <strong>{team.owner_name}</strong>
                    </span>

                    {isAlreadyMember ? (
                      <Link href={`/teams/${team.id}`} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>
                        View Workspace
                      </Link>
                    ) : (
                      <button 
                        onClick={() => handleDiscoverJoin(team.id)}
                        disabled={isFull}
                        className="btn-primary" 
                        style={{ padding: '8px 18px', fontSize: '13px', opacity: isFull ? 0.6 : 1, cursor: isFull ? 'not-allowed' : 'pointer' }}
                      >
                        {isFull ? 'Team Full' : 'Join Team'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Join by Code */}
      {activeTab === 'join_code' && (
        <div style={{ maxWidth: '540px', margin: '32px auto' }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(43, 58, 74, 0.06)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--primary)' }}>
              <KeyRound size={28} />
            </div>

            <h2 className="font-heading" style={{ fontSize: '1.6rem', color: 'var(--primary)', marginBottom: '8px' }}>
              Join with Invite Code
            </h2>
            <p className="font-body" style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px', lineHeight: '1.5' }}>
              Received a code from your teammate or classmate? Enter it below to immediately sync into the team workspace.
            </p>

            <form onSubmit={handleJoinByCode}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. MATH-7821" 
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setJoinStatus({ type: 'idle', message: '' });
                  }}
                  style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', padding: '14px' }}
                />
              </div>

              {joinStatus.type === 'error' && (
                <div style={{ background: 'rgba(192, 108, 91, 0.1)', color: 'var(--accent-warning)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '16px' }}>
                  {joinStatus.message}
                </div>
              )}

              {joinStatus.type === 'success' && (
                <div style={{ background: 'rgba(82, 121, 111, 0.1)', color: 'var(--accent-success)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> {joinStatus.message}
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                Join Team Workspace
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 className="font-heading" style={{ fontSize: '1.6rem', color: 'var(--primary)' }}>
                  Create New Team
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  You will become the Team Owner and manage workspace permissions.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTeamSubmit}>
              <div className="form-group">
                <label className="form-label">Team Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Smart Agriculture Research" 
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Team Description</label>
                <textarea 
                  className="input-field" 
                  placeholder="Briefly describe what your team will work on..." 
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Primary Academic Goal *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Score 90%+ in Mathematics Internal / Finish Hardware by Nov" 
                  value={teamGoal}
                  onChange={(e) => setTeamGoal(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Maximum Members</label>
                  <select 
                    className="input-field" 
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(Number(e.target.value))}
                  >
                    <option value={3}>3 Members</option>
                    <option value={4}>4 Members</option>
                    <option value={6}>6 Members</option>
                    <option value={8}>8 Members</option>
                    <option value={10}>10 Members</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Visibility</label>
                  <select 
                    className="input-field" 
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                  >
                    <option value="discoverable">Discoverable (Public to peers)</option>
                    <option value="invite_only">Invite Only (Join code required)</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tags / Topics (Comma separated)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. IoT, Embedded AI, Research" 
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create & Launch Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
