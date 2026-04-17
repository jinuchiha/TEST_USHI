import React, { useMemo, useState } from 'react';
import { EnrichedCase, User, CRMStatus } from '../../types';
import { formatCurrency } from '../../utils';

interface Props {
  cases: EnrichedCase[];
  onSelectCase: (id: string) => void;
  currentUser: User;
}

const STAGES = [
  { key: 'CB', label: 'Callback', color: '#6495ED', icon: '📞' },
  { key: 'PTP', label: 'Promise to Pay', color: '#F28C28', icon: '🤝' },
  { key: 'UNDER NEGO', label: 'Negotiation', color: '#9370DB', icon: '💬' },
  { key: 'FIP', label: 'Follow In Progress', color: '#20B2AA', icon: '🔄' },
  { key: 'WIP', label: 'Work In Process', color: '#4682B4', icon: '⚙️' },
  { key: 'Closed', label: 'Closed / Paid', color: '#16A34A', icon: '✅' },
];

const KanbanBoard: React.FC<Props> = ({ cases, onSelectCase, currentUser }) => {
  const [draggedCase, setDraggedCase] = useState<string | null>(null);

  const columns = useMemo(() => {
    return STAGES.map(stage => ({
      ...stage,
      cases: cases.filter(c => c.crmStatus === stage.key).slice(0, 20), // Limit per column for performance
      total: cases.filter(c => c.crmStatus === stage.key).length,
      balance: cases.filter(c => c.crmStatus === stage.key).reduce((s, c) => s + (c.loan?.currentBalance || 0), 0),
    }));
  }, [cases]);

  return (
    <div className="p-4 sm:p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: '#1B2A4A' }}>Pipeline Board</h2>
          <p className="text-xs text-text-secondary">{cases.filter(c => !['Closed', 'Withdrawn'].includes(c.crmStatus)).length} active cases across {STAGES.length} stages</p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {columns.map(col => (
          <div
            key={col.key}
            className="flex-shrink-0 w-64 flex flex-col rounded-xl overflow-hidden border border-[var(--color-border)]"
            style={{ background: 'var(--color-bg-secondary)' }}
            onDragOver={e => e.preventDefault()}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-[var(--color-border)]" style={{ borderTop: `3px solid ${col.color}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>{col.icon}</span>
                  <span className="text-xs font-bold text-text-primary">{col.label}</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${col.color}20`, color: col.color }}>{col.total}</span>
              </div>
              <p className="text-[10px] text-text-tertiary mt-1">{formatCurrency(col.balance, 'AED')} outstanding</p>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: '65vh' }}>
              {col.cases.map(c => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDraggedCase(c.id)}
                  onDragEnd={() => setDraggedCase(null)}
                  onClick={() => onSelectCase(c.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all hover-lift ${
                    draggedCase === c.id ? 'opacity-50 border-dashed' : 'border-[var(--color-border)]'
                  }`}
                  style={{ background: 'var(--color-bg-tertiary)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-text-primary truncate max-w-[140px]">{c.debtor.name}</span>
                    <span className={`w-2 h-2 rounded-full ${c.contactStatus === 'Contact' ? 'bg-emerald-500' : 'bg-red-400'}`} title={c.contactStatus} />
                  </div>
                  <p className="text-[10px] font-mono text-text-tertiary">{c.loan?.accountNumber}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] font-bold" style={{ color: col.color }}>{formatCurrency(c.loan?.currentBalance || 0, c.loan?.currency || 'AED')}</span>
                    <span className="text-[9px] text-text-tertiary">{c.loan?.bank?.split(' ').slice(0, 2).join(' ')}</span>
                  </div>
                  {c.subStatus && (
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-text-tertiary border border-[var(--color-border)]">{c.subStatus}</span>
                  )}
                </div>
              ))}
              {col.cases.length === 0 && (
                <div className="text-center py-8 text-text-tertiary text-[11px]">No cases</div>
              )}
              {col.total > 20 && (
                <div className="text-center py-2 text-[10px] text-text-tertiary">+{col.total - 20} more cases</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
