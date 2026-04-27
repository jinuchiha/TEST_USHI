import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';

// ── Types ────────────────────────────────────────────────────────────────────
type LinkType = 'cnic' | 'phone' | 'email' | 'address' | 'name' | 'employer';

interface ConnectionGroup {
  key: string;
  type: LinkType;
  label: string;
  cases: EnrichedCase[];
  totalBalance: number;
  totalRecovered: number;
}

const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s+@-]/g, '');
const normalizePhone = (s: string) => (s || '').replace(/\D/g, '').replace(/^(0092|92|0)/, '');

// Simple Levenshtein for fuzzy name match
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const editDistance = (() => {
    const costs: number[] = [];
    for (let i = 0; i <= longer.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= shorter.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[shorter.length] = lastValue;
    }
    return costs[shorter.length];
  })();
  return (longer.length - editDistance) / longer.length;
}

interface DuplicateDetectorProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const DuplicateDetector: React.FC<DuplicateDetectorProps> = ({ cases, currentUser, onSelectCase }) => {
  const [filterType, setFilterType] = useState<'all' | LinkType>('all');
  const [minCases, setMinCases] = useState(2);
  const [search, setSearch] = useState('');

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const groups = useMemo<ConnectionGroup[]>(() => {
    const result: ConnectionGroup[] = [];

    // ── CNIC duplicates (same person, multiple cases — highest signal) ────
    const byCnic = new Map<string, EnrichedCase[]>();
    myCases.forEach(c => {
      const k = normalize(c.debtor.cnic);
      if (!k || k.length < 5) return;
      if (!byCnic.has(k)) byCnic.set(k, []);
      byCnic.get(k)!.push(c);
    });
    byCnic.forEach((cs, k) => {
      if (cs.length >= 2) result.push({
        key: `cnic-${k}`, type: 'cnic',
        label: `Same CNIC: ${cs[0].debtor.cnic}`,
        cases: cs,
        totalBalance: cs.reduce((s, c) => s + c.loan.currentBalance, 0),
        totalRecovered: 0,
      });
    });

    // ── Phone overlap ─────────────────────────────────────────────────────
    const byPhone = new Map<string, EnrichedCase[]>();
    myCases.forEach(c => {
      (c.debtor.phones || []).forEach(p => {
        const k = normalizePhone(p);
        if (!k || k.length < 8) return;
        if (!byPhone.has(k)) byPhone.set(k, []);
        if (!byPhone.get(k)!.find(x => x.id === c.id)) byPhone.get(k)!.push(c);
      });
    });
    byPhone.forEach((cs, k) => {
      if (cs.length >= 2 && !result.some(r => cs.every(c => r.cases.find(x => x.id === c.id)))) {
        result.push({
          key: `phone-${k}`, type: 'phone',
          label: `Same phone: +92${k}`,
          cases: cs,
          totalBalance: cs.reduce((s, c) => s + c.loan.currentBalance, 0),
          totalRecovered: 0,
        });
      }
    });

    // ── Email overlap ─────────────────────────────────────────────────────
    const byEmail = new Map<string, EnrichedCase[]>();
    myCases.forEach(c => {
      (c.debtor.emails || []).forEach(e => {
        const k = normalize(e);
        if (!k || !k.includes('@')) return;
        if (!byEmail.has(k)) byEmail.set(k, []);
        if (!byEmail.get(k)!.find(x => x.id === c.id)) byEmail.get(k)!.push(c);
      });
    });
    byEmail.forEach((cs, k) => {
      if (cs.length >= 2) result.push({
        key: `email-${k}`, type: 'email',
        label: `Same email: ${k}`,
        cases: cs,
        totalBalance: cs.reduce((s, c) => s + c.loan.currentBalance, 0),
        totalRecovered: 0,
      });
    });

    // ── Address overlap (exact normalized match, min 15 chars to avoid false hits) ─
    const byAddress = new Map<string, EnrichedCase[]>();
    myCases.forEach(c => {
      const k = normalize(c.debtor.address);
      if (!k || k.length < 15) return;
      if (!byAddress.has(k)) byAddress.set(k, []);
      byAddress.get(k)!.push(c);
    });
    byAddress.forEach((cs, k) => {
      if (cs.length >= 2) result.push({
        key: `address-${k.slice(0, 30)}`, type: 'address',
        label: `Same address: ${cs[0].debtor.address.slice(0, 60)}`,
        cases: cs,
        totalBalance: cs.reduce((s, c) => s + c.loan.currentBalance, 0),
        totalRecovered: 0,
      });
    });

    // ── Fuzzy name match (different CNIC/phone but similar name) ─────────
    // Limit comparison to avoid O(n²) explosion — only top 500 cases, only same bank
    const byBank = new Map<string, EnrichedCase[]>();
    myCases.slice(0, 500).forEach(c => {
      if (!byBank.has(c.loan.bank)) byBank.set(c.loan.bank, []);
      byBank.get(c.loan.bank)!.push(c);
    });
    const seenPairs = new Set<string>();
    byBank.forEach(bankCases => {
      for (let i = 0; i < bankCases.length; i++) {
        for (let j = i + 1; j < bankCases.length; j++) {
          const a = bankCases[i], b = bankCases[j];
          if (a.debtor.cnic && b.debtor.cnic && a.debtor.cnic === b.debtor.cnic) continue; // already in CNIC group
          const sim = similarity(normalize(a.debtor.name), normalize(b.debtor.name));
          if (sim > 0.85) {
            const pairKey = [a.id, b.id].sort().join('|');
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);
            const existing = result.find(r => r.type === 'name' && r.cases.find(x => x.id === a.id));
            if (existing) {
              if (!existing.cases.find(x => x.id === b.id)) existing.cases.push(b);
              existing.totalBalance += b.loan.currentBalance;
            } else {
              result.push({
                key: `name-${a.id}-${b.id}`, type: 'name',
                label: `Similar names @ ${a.loan.bank}: ${a.debtor.name} ≈ ${b.debtor.name}`,
                cases: [a, b],
                totalBalance: a.loan.currentBalance + b.loan.currentBalance,
                totalRecovered: 0,
              });
            }
          }
        }
      }
    });

    return result.sort((a, b) => b.cases.length - a.cases.length || b.totalBalance - a.totalBalance);
  }, [myCases]);

  const filtered = useMemo(() => {
    return groups.filter(g => {
      if (filterType !== 'all' && g.type !== filterType) return false;
      if (g.cases.length < minCases) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!g.label.toLowerCase().includes(q) &&
            !g.cases.some(c => c.debtor.name.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [groups, filterType, minCases, search]);

  const stats = useMemo(() => {
    const totalCases = new Set<string>();
    groups.forEach(g => g.cases.forEach(c => totalCases.add(c.id)));
    return {
      groups: groups.length,
      cnic: groups.filter(g => g.type === 'cnic').length,
      phone: groups.filter(g => g.type === 'phone').length,
      email: groups.filter(g => g.type === 'email').length,
      address: groups.filter(g => g.type === 'address').length,
      name: groups.filter(g => g.type === 'name').length,
      uniqueCasesInvolved: totalCases.size,
      totalBalanceLinked: groups.reduce((s, g) => s + g.totalBalance, 0),
    };
  }, [groups]);

  const typeIcon: Record<LinkType, string> = {
    cnic: '🪪', phone: '📞', email: '✉️', address: '🏠', name: '👤', employer: '💼',
  };
  const typeColor: Record<LinkType, string> = {
    cnic: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    phone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    email: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    address: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    name: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    employer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.filter('w-7 h-7')}
            Connected Debtors
          </h1>
          <p className="text-sm text-text-secondary mt-1">Same person across multiple banks, fake numbers, family clusters</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Groups', value: stats.groups, color: 'text-text-primary' },
          { label: 'Same CNIC', value: stats.cnic, color: 'text-red-600' },
          { label: 'Same Phone', value: stats.phone, color: 'text-blue-600' },
          { label: 'Same Email', value: stats.email, color: 'text-purple-600' },
          { label: 'Same Address', value: stats.address, color: 'text-amber-600' },
          { label: 'Cases involved', value: stats.uniqueCasesInvolved, color: 'text-text-primary' },
          { label: 'Linked balance', value: formatCurrency(stats.totalBalanceLinked, 'AED'), color: 'text-text-primary' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-base font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-4 border-l-4 border-blue-400">
        <h3 className="text-xs font-bold text-text-primary mb-1">Why this matters</h3>
        <p className="text-[11px] text-text-secondary leading-relaxed">
          <strong>Same CNIC across cases</strong> = one person defaulted on multiple Gulf bank loans. Bundle settlement / single negotiation.<br />
          <strong>Same phone</strong> = could be family, fake number, or shared household. Cross-leverage.<br />
          <strong>Same address</strong> = household members defaulted together. Plan one field visit.<br />
          <strong>Similar names @ same bank</strong> = data entry errors or shell IDs.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search debtor or link..." className="px-3 py-2 text-sm rounded-lg flex-1 min-w-[200px]" />
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Types</option>
          <option value="cnic">🪪 Same CNIC</option>
          <option value="phone">📞 Same Phone</option>
          <option value="email">✉️ Same Email</option>
          <option value="address">🏠 Same Address</option>
          <option value="name">👤 Similar Names</option>
        </select>
        <select value={minCases} onChange={e => setMinCases(Number(e.target.value))} className="px-3 py-2 text-sm rounded-lg">
          <option value={2}>2+ cases per group</option>
          <option value={3}>3+ cases per group</option>
          <option value={5}>5+ cases per group</option>
        </select>
      </div>

      {/* Groups */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-text-secondary text-sm">No connection groups found. ✓ Portfolio is clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 50).map(g => (
            <div key={g.key} className="panel overflow-hidden">
              <div className="p-3 bg-[var(--color-bg-tertiary)] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{typeIcon[g.type]}</span>
                  <div>
                    <p className="text-sm font-bold">{g.label}</p>
                    <p className="text-[10px] text-text-tertiary">{g.cases.length} linked cases</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${typeColor[g.type]}`}>{g.type.toUpperCase()}</span>
                  <span className="text-xs font-bold">{formatCurrency(g.totalBalance, g.cases[0].loan.currency)}</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {g.cases.map(c => (
                  <div key={c.id} onClick={() => onSelectCase(c.id)} className="p-3 hover:bg-[var(--color-bg-muted)] cursor-pointer flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.debtor.name}</p>
                      <p className="text-[11px] text-text-tertiary truncate">{c.loan.bank} • {c.loan.accountNumber} • {c.crmStatus}/{c.subStatus || '—'}</p>
                    </div>
                    <span className="text-xs font-semibold flex-shrink-0">{formatCurrency(c.loan.currentBalance, c.loan.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length > 50 && <p className="text-center text-xs text-text-tertiary">Showing 50 of {filtered.length} groups</p>}
        </div>
      )}
    </div>
  );
};

export default DuplicateDetector;
