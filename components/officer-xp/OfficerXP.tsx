import React, { useMemo } from 'react';
import { EnrichedCase, User, Role, ActionType } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';

// ── XP / leveling system ────────────────────────────────────────────────────
// Each successful action earns XP. Levels = sqrt-scaled.
// Achievements unlock at thresholds.

const XP_RULES = {
  call_attempt: 1,
  contact_made: 5,
  ptp_secured: 15,
  payment_collected: 25,    // also bonus = 1 XP per AED 100 recovered
  settlement_closed: 100,
  case_closed_paid: 200,
  recovery_per_aed_100: 1,
};

interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  test: (s: OfficerStats) => boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface OfficerStats {
  totalActions: number;
  callsToday: number;
  callsThisMonth: number;
  ptps: number;
  paymentsCollected: number;
  totalRecovered: number;
  settlementsClosed: number;
  casesClosed: number;
  bestDay: { date: string; recovery: number } | null;
  longestStreak: number;     // days with at least 1 action
  currentStreak: number;
  recoveryByBank: Record<string, number>;
  averagePerCase: number;
  ptpFulfillmentRate: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', emoji: '🎯', name: 'First Blood', description: 'First payment collected', test: s => s.paymentsCollected >= 1, rarity: 'common' },
  { id: 'caller_10', emoji: '📞', name: 'Caller', description: '10 calls in a day', test: s => s.callsToday >= 10, rarity: 'common' },
  { id: 'caller_50', emoji: '📱', name: 'Power Caller', description: '50 calls in a month', test: s => s.callsThisMonth >= 50, rarity: 'rare' },
  { id: 'closer_5', emoji: '🤝', name: 'Closer', description: '5 successful settlements', test: s => s.settlementsClosed >= 5, rarity: 'rare' },
  { id: 'closer_25', emoji: '👔', name: 'Master Negotiator', description: '25 settlements closed', test: s => s.settlementsClosed >= 25, rarity: 'epic' },
  { id: 'lakh', emoji: '💰', name: 'Lakhpati', description: 'Recovered 1 lakh PKR equivalent', test: s => s.totalRecovered >= 100000, rarity: 'rare' },
  { id: 'crore', emoji: '💎', name: 'Crorepati', description: 'Recovered 10 lakh PKR equivalent', test: s => s.totalRecovered >= 1000000, rarity: 'legendary' },
  { id: 'streak_7', emoji: '🔥', name: 'On Fire', description: '7-day work streak', test: s => s.currentStreak >= 7, rarity: 'rare' },
  { id: 'streak_30', emoji: '🌋', name: 'Volcanic', description: '30-day work streak', test: s => s.currentStreak >= 30, rarity: 'legendary' },
  { id: 'ptp_master', emoji: '✋', name: 'PTP Master', description: '50 PTPs secured', test: s => s.ptps >= 50, rarity: 'epic' },
  { id: 'ptp_keeper', emoji: '🎪', name: 'PTP Keeper', description: '70%+ PTP fulfillment rate (10+ PTPs)', test: s => s.ptpFulfillmentRate >= 70 && s.ptps >= 10, rarity: 'epic' },
  { id: 'closer_100', emoji: '🏆', name: 'Centurion', description: '100 cases closed', test: s => s.casesClosed >= 100, rarity: 'legendary' },
  { id: 'banker', emoji: '🏦', name: 'Multi-Bank', description: 'Recovered from 5+ different banks', test: s => Object.keys(s.recoveryByBank).filter(b => s.recoveryByBank[b] > 0).length >= 5, rarity: 'rare' },
  { id: 'big_fish', emoji: '🐋', name: 'Big Fish', description: 'Single payment of 50k+ AED equiv', test: s => s.bestDay !== null && s.bestDay.recovery >= 50000, rarity: 'epic' },
  { id: 'consistent', emoji: '⚖️', name: 'Consistent', description: '30+ actions in current month', test: s => s.callsThisMonth >= 30, rarity: 'common' },
];

const RARITY_COLOR: Record<Achievement['rarity'], string> = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-amber-400 to-orange-500',
};

const RARITY_BORDER: Record<Achievement['rarity'], string> = {
  common: 'border-gray-300',
  rare: 'border-blue-400',
  epic: 'border-purple-400',
  legendary: 'border-amber-400 shadow-lg shadow-amber-400/30',
};

const xpToLevel = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1;
const levelToXp = (level: number) => (level - 1) * (level - 1) * 50;

const TITLES = [
  { min: 1, title: 'Recruit', emoji: '🐣' },
  { min: 5, title: 'Officer', emoji: '🎖️' },
  { min: 10, title: 'Senior Officer', emoji: '⭐' },
  { min: 15, title: 'Specialist', emoji: '🌟' },
  { min: 20, title: 'Expert', emoji: '💫' },
  { min: 30, title: 'Master', emoji: '👑' },
  { min: 40, title: 'Legend', emoji: '🏆' },
  { min: 50, title: 'Mythic', emoji: '🔱' },
];

function computeStats(officer: User, allCases: EnrichedCase[]): OfficerStats {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;
  const myCases = allCases.filter(c => c.assignedOfficerId === officer.id);
  const myActions = allCases.flatMap(c => (c.history || []).filter(a => a.officerId === officer.id));

  const callsToday = myActions.filter(a => a.type === ActionType.SOFT_CALL && a.timestamp.startsWith(today)).length;
  const callsThisMonth = myActions.filter(a => a.type === ActionType.SOFT_CALL && a.timestamp >= monthStart).length;
  const ptps = myActions.filter(a => a.promisedAmount && a.promisedAmount > 0).length;
  const payments = myActions.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid && a.amountPaid > 0);
  const totalRecovered = payments.reduce((s, a) => s + (a.amountPaid || 0), 0);
  const settlementsClosed = payments.filter(a => a.paymentType === 'Settlement').length;
  const casesClosed = myCases.filter(c => c.crmStatus === 'Closed' as any).length;

  // Best day
  const dayMap = new Map<string, number>();
  payments.forEach(a => {
    const d = a.timestamp.split('T')[0];
    dayMap.set(d, (dayMap.get(d) || 0) + (a.amountPaid || 0));
  });
  const bestDay = dayMap.size > 0
    ? Array.from(dayMap.entries()).sort(([, a], [, b]) => b - a).map(([date, recovery]) => ({ date, recovery }))[0]
    : null;

  // Streak: days with at least 1 action
  const dayActions = new Set(myActions.map(a => a.timestamp.split('T')[0]));
  let currentStreak = 0;
  const dt = new Date();
  while (dayActions.has(dt.toISOString().split('T')[0])) {
    currentStreak++;
    dt.setDate(dt.getDate() - 1);
  }
  // Longest streak (rough — count consecutive)
  const sortedDays = Array.from(dayActions).sort();
  let longestStreak = 0, run = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) { run = 1; }
    else {
      const prev = new Date(sortedDays[i - 1]);
      const cur = new Date(sortedDays[i]);
      if ((cur.getTime() - prev.getTime()) / 86400000 === 1) run++;
      else run = 1;
    }
    if (run > longestStreak) longestStreak = run;
  }

  // Recovery by bank
  const recoveryByBank: Record<string, number> = {};
  payments.forEach(a => {
    const c = myCases.find(x => (x.history || []).some(h => h.id === a.id));
    if (c) {
      const b = c.loan.bank;
      recoveryByBank[b] = (recoveryByBank[b] || 0) + (a.amountPaid || 0);
    }
  });

  const averagePerCase = myCases.length > 0 ? totalRecovered / myCases.length : 0;
  const ptpFulfillmentRate = ptps > 0 ? (payments.length / ptps) * 100 : 0;

  return {
    totalActions: myActions.length,
    callsToday, callsThisMonth, ptps,
    paymentsCollected: payments.length,
    totalRecovered, settlementsClosed, casesClosed,
    bestDay, longestStreak, currentStreak,
    recoveryByBank, averagePerCase, ptpFulfillmentRate,
  };
}

function computeXP(s: OfficerStats): number {
  return (
    s.totalActions * XP_RULES.call_attempt +
    s.callsThisMonth * XP_RULES.contact_made +
    s.ptps * XP_RULES.ptp_secured +
    s.paymentsCollected * XP_RULES.payment_collected +
    s.settlementsClosed * XP_RULES.settlement_closed +
    s.casesClosed * XP_RULES.case_closed_paid +
    Math.floor(s.totalRecovered / 100) * XP_RULES.recovery_per_aed_100
  );
}

// ── Component ────────────────────────────────────────────────────────────────
interface OfficerXPProps {
  cases: EnrichedCase[];
  users: User[];
  currentUser: User;
}

const OfficerXP: React.FC<OfficerXPProps> = ({ cases, users, currentUser }) => {
  // For officer view: show own profile. Manager: show team.
  const targetOfficer = currentUser.role === Role.OFFICER ? currentUser : null;

  const myStats = useMemo(() => targetOfficer ? computeStats(targetOfficer, cases) : null, [targetOfficer, cases]);
  const myXp = myStats ? computeXP(myStats) : 0;
  const myLevel = xpToLevel(myXp);
  const xpForCurrent = levelToXp(myLevel);
  const xpForNext = levelToXp(myLevel + 1);
  const progressXp = myXp - xpForCurrent;
  const progressTotal = xpForNext - xpForCurrent;
  const progressPercent = (progressXp / progressTotal) * 100;
  const myTitle = TITLES.slice().reverse().find(t => myLevel >= t.min) || TITLES[0];
  const myAchievements = myStats ? ACHIEVEMENTS.filter(a => a.test(myStats)) : [];

  // Team leaderboard
  const teamLeaderboard = useMemo(() => {
    return users
      .filter(u => u.role === Role.OFFICER)
      .map(u => {
        const s = computeStats(u, cases);
        const xp = computeXP(s);
        const level = xpToLevel(xp);
        const title = TITLES.slice().reverse().find(t => level >= t.min) || TITLES[0];
        const achievements = ACHIEVEMENTS.filter(a => a.test(s));
        return { officer: u, stats: s, xp, level, title, achievementsCount: achievements.length };
      })
      .sort((a, b) => b.xp - a.xp);
  }, [users, cases]);

  const isOfficerView = !!targetOfficer && myStats;

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            Officer XP & Achievements
          </h1>
          <p className="text-sm text-text-secondary mt-1">Level up by recovering more — unlock badges as you grow</p>
        </div>
      </div>

      {/* ── My Profile (Officer view) ─────────────────────────────────── */}
      {isOfficerView && myStats && (
        <>
          <div className="panel p-6 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{myTitle.emoji}</span>
                  <div>
                    <p className="text-[10px] uppercase opacity-70 tracking-widest">Level {myLevel}</p>
                    <p className="text-2xl font-bold">{myTitle.title}</p>
                  </div>
                </div>
                <p className="text-lg font-semibold mt-1">{currentUser.name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase opacity-70 tracking-widest">Total XP</p>
                <p className="text-5xl font-bold">{myXp.toLocaleString()}</p>
                <p className="text-[11px] opacity-70 mt-1">{xpForNext - myXp} XP to next level</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] mb-1 opacity-90">
                <span>Lvl {myLevel}</span>
                <span>{progressXp} / {progressTotal} XP</span>
                <span>Lvl {myLevel + 1}</span>
              </div>
              <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          {/* My stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Actions', value: myStats.totalActions, color: 'text-text-primary' },
              { label: 'Calls (mo)', value: myStats.callsThisMonth, color: 'text-blue-600' },
              { label: 'PTPs', value: myStats.ptps, color: 'text-cyan-600' },
              { label: 'Payments', value: myStats.paymentsCollected, color: 'text-emerald-600' },
              { label: 'Recovered', value: formatCurrency(myStats.totalRecovered, 'AED'), color: 'text-emerald-600' },
              { label: 'Streak', value: `${myStats.currentStreak}d 🔥`, color: 'text-orange-600' },
              { label: 'Best Day', value: myStats.bestDay ? formatCurrency(myStats.bestDay.recovery, 'AED') : '—', color: 'text-amber-600' },
            ].map(k => (
              <div key={k.label} className="panel p-3">
                <p className="text-[10px] text-text-secondary">{k.label}</p>
                <p className={`text-base font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Achievements */}
          <div>
            <h3 className="text-sm font-bold mb-3">🎖️ Achievements ({myAchievements.length} / {ACHIEVEMENTS.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {ACHIEVEMENTS.map(a => {
                const unlocked = myAchievements.includes(a);
                return (
                  <div
                    key={a.id}
                    className={`panel p-3 text-center border-2 ${unlocked ? RARITY_BORDER[a.rarity] : 'border-transparent opacity-40 grayscale'}`}
                  >
                    {unlocked ? (
                      <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${RARITY_COLOR[a.rarity]} flex items-center justify-center text-2xl`}>
                        {a.emoji}
                      </div>
                    ) : (
                      <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-2xl">
                        🔒
                      </div>
                    )}
                    <p className="text-xs font-bold mt-2">{a.name}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">{a.description}</p>
                    <p className={`text-[9px] uppercase font-bold mt-1 ${a.rarity === 'legendary' ? 'text-amber-600' : a.rarity === 'epic' ? 'text-purple-600' : a.rarity === 'rare' ? 'text-blue-600' : 'text-text-tertiary'}`}>{a.rarity}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Team Leaderboard ──────────────────────────────────────────── */}
      <div className="panel">
        <div className="p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-bold">Team Leaderboard</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)]">
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Rank</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Officer</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Title</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Lvl</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">XP</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Actions</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Recovered</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Streak</th>
                <th className="text-left py-3 px-4 text-[10px] font-semibold text-text-secondary">Badges</th>
              </tr>
            </thead>
            <tbody>
              {teamLeaderboard.map((row, i) => (
                <tr key={row.officer.id} className={`border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)] ${row.officer.id === currentUser.id ? 'bg-[var(--color-primary-glow)]' : ''}`}>
                  <td className="py-3 px-4">
                    <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold">{row.officer.name}</td>
                  <td className="py-3 px-4 text-xs">{row.title.emoji} {row.title.title}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[var(--color-primary-glow)] text-[var(--color-primary)]">Lv {row.level}</span></td>
                  <td className="py-3 px-4 text-xs font-bold">{row.xp.toLocaleString()}</td>
                  <td className="py-3 px-4 text-xs">{row.stats.totalActions}</td>
                  <td className="py-3 px-4 text-xs font-semibold text-emerald-600">{formatCurrency(row.stats.totalRecovered, 'AED')}</td>
                  <td className="py-3 px-4 text-xs">{row.stats.currentStreak}d {row.stats.currentStreak >= 7 ? '🔥' : ''}</td>
                  <td className="py-3 px-4 text-xs">{row.achievementsCount} / {ACHIEVEMENTS.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OfficerXP;
