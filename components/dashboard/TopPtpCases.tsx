import React, { useMemo } from 'react';
import { EnrichedCase } from '../../types';
import Card from '../shared/Card';
import { formatCurrency } from '../../utils';
import { ICONS } from '../../constants';
import EmptyState from '../shared/EmptyState';

interface PtpCasesListProps {
  ptpCases: EnrichedCase[];
  onSelectCase: (caseId: string) => void;
}

const PtpCasesList: React.FC<PtpCasesListProps> = ({ ptpCases, onSelectCase }) => {
  const sortedCases = useMemo(() => {
    return [...ptpCases]
      .sort((a, b) => b.loan.currentBalance - a.loan.currentBalance);
  }, [ptpCases]);

  return (
    <Card className="!p-0 h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-text-primary">PTP Cases ({sortedCases.length})</h3>
        <p className="text-sm text-text-secondary">By outstanding balance</p>
      </div>
      <div className="flex-grow overflow-y-auto max-h-[500px]">
        {sortedCases.length > 0 ? (
          <ul className="divide-y divide-border">
            {sortedCases.map((c) => (
              <li key={c.id} onClick={() => onSelectCase(c.id)} className="p-4 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-text-primary truncate">{c.debtor.name}</p>
                  <p className="text-xs text-text-secondary">{c.loan.bank}</p>
                </div>
                <div className="flex justify-between items-baseline mt-1">
                  <p className="text-sm text-text-secondary">{c.loan.accountNumber}</p>
                  <p className="text-base font-bold text-danger">{formatCurrency(c.loan.currentBalance, c.loan.currency)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 flex items-center justify-center h-full">
            <EmptyState
                icon={ICONS.calendar('w-16 h-16')}
                title="No PTP Cases"
                description="There are currently no active cases with a 'Promise to Pay' status."
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default PtpCasesList;
