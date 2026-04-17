import React, { useMemo } from 'react';
import { EnrichedCase } from '../../types';
import Card from '../shared/Card';
import EmptyState from '../shared/EmptyState';
import { ICONS } from '../../constants';

interface InteractionsViewProps {
  cases: EnrichedCase[];
}

const InteractionsView: React.FC<InteractionsViewProps> = ({ cases }) => {
  const todayInteractions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return cases
      .flatMap(c => 
        c.history
          .filter(h => h.timestamp.startsWith(today))
          .map(h => ({
            ...h,
            debtor: c.debtor,
            loan: c.loan,
            officer: c.officer,
          }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [cases]);
  
  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted sticky top-0 z-10";
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  return (
    <div className="p-6 bg-background min-h-full">
      <h1 className="text-3xl font-bold text-text-primary mb-1">Today's Interaction History</h1>
      <p className="text-text-secondary mb-6">A log of all case activities performed today.</p>
      <Card className="!p-0 flex flex-col flex-grow">
         <div className="overflow-auto flex-grow">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-muted">
                <tr>
                  <th scope="col" className={TH_CLASS}>Time</th>
                  <th scope="col" className={TH_CLASS}>Debtor Name</th>
                  <th scope="col" className={TH_CLASS}>Account No.</th>
                  <th scope="col" className={TH_CLASS}>Action Type</th>
                  <th scope="col" className={`${TH_CLASS} w-1/3`}>Notes</th>
                  <th scope="col" className={TH_CLASS}>Coordinator</th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border">
                {todayInteractions.length > 0 ? todayInteractions.map(interaction => (
                  <tr key={interaction.id}>
                    <td className={TD_CLASS}>{new Date(interaction.timestamp).toLocaleTimeString()}</td>
                    <td className={`${TD_CLASS} font-medium text-text-primary`}>{interaction.debtor?.name}</td>
                    <td className={TD_CLASS}>{interaction.loan?.accountNumber}</td>
                    <td className={TD_CLASS}>{interaction.type}</td>
                    <td className={`${TD_CLASS} whitespace-normal max-w-md truncate`}>{interaction.notes}</td>
                    <td className={TD_CLASS}>{interaction.officer?.name}</td>
                  </tr>
                )) : (
                    <tr>
                        <td colSpan={6} className="p-4">
                            <EmptyState
                                icon={ICONS.interaction('w-16 h-16')}
                                title="No Interactions Logged Today"
                                description="There have been no case activities recorded for the current day."
                            />
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
      </Card>
    </div>
  );
};

export default InteractionsView;
