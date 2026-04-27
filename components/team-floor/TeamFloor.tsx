import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Role, EnrichedCase } from '../../types';
import { ICONS } from '../../constants';

// ── Types ────────────────────────────────────────────────────────────────────
type PresenceStatus = 'available' | 'on_call' | 'in_meeting' | 'away' | 'offline';

interface PresenceRecord {
  userId: string;
  status: PresenceStatus;
  currentView?: string;
  lastActivity: string; // ISO
  isWfh: boolean;
}

interface TeamFloorProps {
  users: User[];
  cases: EnrichedCase[];
  currentUser: User;
  activeView: string;
  onSelectCase: (caseId: string) => void;
}

const PRESENCE_KEY = 'rv_presence';
const HEARTBEAT_MS = 15_000;
const ONLINE_THRESHOLD_MS = 60_000;

const loadPresence = (): Record<string, PresenceRecord> => {
  try { return JSON.parse(localStorage.getItem(PRESENCE_KEY) || '{}'); } catch { return {}; }
};
const savePresence = (data: Record<string, PresenceRecord>) => {
  try { localStorage.setItem(PRESENCE_KEY, JSON.stringify(data)); } catch {}
};

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: 'Available',
  on_call: 'On Call',
  in_meeting: 'In Meeting',
  away: 'Away',
  offline: 'Offline',
};
const STATUS_COLOR: Record<PresenceStatus, string> = {
  available: 'bg-emerald-500',
  on_call: 'bg-blue-500',
  in_meeting: 'bg-purple-500',
  away: 'bg-amber-500',
  offline: 'bg-gray-400',
};

const TeamFloor: React.FC<TeamFloorProps> = ({ users, cases, currentUser, activeView, onSelectCase }) => {
  const [presence, setPresence] = useState<Record<string, PresenceRecord>>(loadPresence);
  const [myStatus, setMyStatus] = useState<PresenceStatus>('available');
  const [myWfh, setMyWfh] = useState<boolean>(() => localStorage.getItem('rv_wfh') === 'true');
  const [showVideo, setShowVideo] = useState(false);
  const [roomName, setRoomName] = useState('recovantage-team-' + (new Date().toISOString().split('T')[0]));
  const [chatMsg, setChatMsg] = useState('');
  const [chat, setChat] = useState<{ id: string; userName: string; msg: string; ts: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('rv_team_chat') || '[]'); } catch { return []; }
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Heartbeat: write own presence ─────────────────────────────────────────
  useEffect(() => {
    const beat = () => {
      const cur = loadPresence();
      cur[currentUser.id] = {
        userId: currentUser.id,
        status: myStatus,
        currentView: activeView,
        lastActivity: new Date().toISOString(),
        isWfh: myWfh,
      };
      savePresence(cur);
      setPresence(cur);
    };
    beat();
    const h = setInterval(beat, HEARTBEAT_MS);
    const onUnload = () => {
      const cur = loadPresence();
      if (cur[currentUser.id]) { cur[currentUser.id].status = 'offline'; savePresence(cur); }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => { clearInterval(h); window.removeEventListener('beforeunload', onUnload); };
  }, [currentUser.id, myStatus, myWfh, activeView]);

  // ── Refresh other users' presence ─────────────────────────────────────────
  useEffect(() => {
    const refresh = () => setPresence(loadPresence());
    const h = setInterval(refresh, HEARTBEAT_MS);
    return () => clearInterval(h);
  }, []);

  // ── Refresh chat ──────────────────────────────────────────────────────────
  useEffect(() => {
    const refresh = () => {
      try {
        const c = JSON.parse(localStorage.getItem('rv_team_chat') || '[]');
        setChat(c);
      } catch {}
    };
    refresh();
    const h = setInterval(refresh, 5000);
    return () => clearInterval(h);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.length]);

  const sendChat = () => {
    if (!chatMsg.trim()) return;
    const newMsg = { id: `m-${Date.now()}`, userName: currentUser.name, msg: chatMsg, ts: new Date().toISOString() };
    const updated = [...chat, newMsg].slice(-100);
    setChat(updated);
    localStorage.setItem('rv_team_chat', JSON.stringify(updated));
    setChatMsg('');
  };

  const getUserStatus = (userId: string): PresenceStatus => {
    const p = presence[userId];
    if (!p) return 'offline';
    const age = Date.now() - new Date(p.lastActivity).getTime();
    if (age > ONLINE_THRESHOLD_MS) return 'offline';
    return p.status;
  };

  const officers = useMemo(() => users.filter(u => u.role === Role.OFFICER), [users]);
  const team = useMemo(() => users.filter(u => u.role !== Role.ADMIN), [users]);

  const onlineCount = team.filter(u => getUserStatus(u.id) !== 'offline').length;
  const wfhCount = team.filter(u => presence[u.id]?.isWfh && getUserStatus(u.id) !== 'offline').length;
  const onCallCount = team.filter(u => getUserStatus(u.id) === 'on_call').length;
  const inMeetingCount = team.filter(u => getUserStatus(u.id) === 'in_meeting').length;

  const officerCaseCount = (officerId: string) => cases.filter(c => c.assignedOfficerId === officerId).length;
  const officerActionsToday = (officerId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return cases.reduce((s, c) => s + (c.history || []).filter(h => h.officerId === officerId && h.timestamp.startsWith(today)).length, 0);
  };

  const toggleWfh = () => {
    const next = !myWfh;
    setMyWfh(next);
    localStorage.setItem('rv_wfh', next ? 'true' : 'false');
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.team('w-7 h-7')}
            Team Floor
          </h1>
          <p className="text-sm text-text-secondary mt-1">Live team presence, activity, and conference room</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={myStatus} onChange={e => setMyStatus(e.target.value as PresenceStatus)} className="px-3 py-2 text-xs rounded-lg">
            <option value="available">🟢 Available</option>
            <option value="on_call">🔵 On Call</option>
            <option value="in_meeting">🟣 In Meeting</option>
            <option value="away">🟡 Away</option>
          </select>
          <button onClick={toggleWfh} className={`px-3 py-2 text-xs font-semibold rounded-lg ${myWfh ? 'bg-blue-500 text-white' : 'bg-[var(--color-bg-tertiary)] text-text-secondary'}`}>
            🏠 {myWfh ? 'WFH ON' : 'WFH OFF'}
          </button>
          <button onClick={() => setShowVideo(!showVideo)} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
            📹 {showVideo ? 'Hide' : 'Join'} Conference
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Team Size', value: team.length, color: 'text-text-primary' },
          { label: 'Online Now', value: onlineCount, color: 'text-emerald-600' },
          { label: 'WFH Active', value: wfhCount, color: 'text-blue-600' },
          { label: 'On Call', value: onCallCount, color: 'text-blue-500' },
          { label: 'In Meeting', value: inMeetingCount, color: 'text-purple-600' },
          { label: 'Offline', value: team.length - onlineCount, color: 'text-gray-500' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Video conference */}
      {showVideo && (
        <div className="panel p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-text-primary">Team Conference Room</h3>
            <div className="flex items-center gap-2">
              <input value={roomName} onChange={e => setRoomName(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))} className="px-3 py-1.5 text-xs rounded-lg w-64" placeholder="Room name" />
              <a href={`https://meet.jit.si/${roomName}`} target="_blank" rel="noopener" className="text-xs text-[var(--color-primary)] hover:underline">Open in new tab ↗</a>
            </div>
          </div>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              key={roomName}
              src={`https://meet.jit.si/${roomName}#userInfo.displayName="${encodeURIComponent(currentUser.name)}"&config.prejoinPageEnabled=false`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full h-full border-0"
              title="Team Conference"
            />
          </div>
          <p className="text-[11px] text-text-tertiary">Free Jitsi room • E2E encrypted • Share room name with team to join</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Officers grid */}
        <div className="lg:col-span-2 panel overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Officers ({officers.length})</h3>
            <p className="text-xs text-text-secondary">Live activity</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)]">
            {officers.map(o => {
              const status = getUserStatus(o.id);
              const p = presence[o.id];
              return (
                <div key={o.id} className="p-4 hover:bg-[var(--color-bg-muted)]">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        {o.name.charAt(0)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[var(--color-bg-primary)] ${STATUS_COLOR[status]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{o.name}</p>
                        {p?.isWfh && status !== 'offline' && <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded font-bold">WFH</span>}
                      </div>
                      <p className="text-[11px] text-text-tertiary">{STATUS_LABEL[status]} • {officerCaseCount(o.id)} cases • {officerActionsToday(o.id)} actions today</p>
                      {p?.currentView && status !== 'offline' && (
                        <p className="text-[10px] text-text-tertiary mt-0.5">📍 {p.currentView}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team chat */}
        <div className="panel flex flex-col h-[500px]">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold text-text-primary">Team Chat</h3>
            <p className="text-[11px] text-text-tertiary">Quick messages • last 100 kept</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chat.length === 0 ? (
              <p className="text-center text-xs text-text-tertiary py-8">No messages yet. Be the first.</p>
            ) : chat.map(m => {
              const isMe = m.userName === currentUser.name;
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)]'}`}>
                    {!isMe && <p className="text-[10px] font-bold opacity-80">{m.userName}</p>}
                    <p className="text-xs">{m.msg}</p>
                    <p className={`text-[9px] mt-1 ${isMe ? 'text-white/60' : 'text-text-tertiary'}`}>
                      {new Date(m.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-[var(--color-border)] flex gap-2">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Type message..." className="flex-1 px-3 py-2 text-xs rounded-lg" />
            <button onClick={sendChat} className="btn-primary px-3 py-2 text-xs">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamFloor;
