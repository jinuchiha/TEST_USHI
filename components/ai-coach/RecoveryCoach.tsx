import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';
import RecoveryCoachPanel from './RecoveryCoachPanel';

interface RecoveryCoachProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const RecoveryCoach: React.FC<RecoveryCoachProps> = ({ cases, currentUser, onSelectCase }) => {
  const [search, setSearch] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const filtered = useMemo(() => {
    if (!search) return myCases.slice(0, 200);
    const q = search.toLowerCase();
    return myCases.filter(c =>
      c.debtor.name.toLowerCase().includes(q) ||
      c.loan.accountNumber.toLowerCase().includes(q) ||
      (c.debtor.cnic || '').toLowerCase().includes(q),
    ).slice(0, 200);
  }, [myCases, search]);

  const selectedCase = cases.find(c => c.id === selectedCaseId);

  return (
    <div className="space-y-4 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.lightbulb('w-7 h-7')}
            Recovery Coach
          </h1>
          <p className="text-sm text-text-secondary mt-1">AI assistant — case ko crack karne ki strategy + ideas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Case list */}
        <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="p-3 border-b border-[var(--color-border)]">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cases..."
              className="w-full px-3 py-2 text-xs rounded-lg"
            />
            <p className="text-[10px] text-text-tertiary mt-1">{filtered.length} cases</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-xs text-text-secondary">No cases.</p>
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`w-full text-left p-3 hover:bg-[var(--color-bg-muted)] ${selectedCaseId === c.id ? 'bg-[var(--color-primary-glow)] border-l-2 border-[var(--color-primary)]' : ''}`}
              >
                <p className="text-sm font-semibold truncate">{c.debtor.name}</p>
                <p className="text-[10px] text-text-tertiary truncate">{c.loan.bank} • {c.loan.accountNumber}</p>
                <p className="text-[10px] text-text-tertiary">{formatCurrency(c.loan.currentBalance, c.loan.currency)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Coach panel */}
        <div className="lg:col-span-3">
          {selectedCase ? (
            <RecoveryCoachPanel case={selectedCase} allCases={cases} />
          ) : (
            <div className="panel p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-3xl mx-auto mb-4">🧠</div>
              <h2 className="text-lg font-bold mb-2">Pick a case to start</h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Coach will analyze the case data — payment history, broken PTPs, status, age — and suggest specific strategies for that debtor. Try asking "kyun nahi de raha?" or "settlement kitna offer karoon?"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecoveryCoach;
