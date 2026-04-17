import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, SubStatus } from '../../types';
import Card from '../shared/Card';

interface StatusMatrixReportProps {
  cases: EnrichedCase[];
  coordinators: User[];
}

type TimeFilter = 'today' | 'week' | 'month' | 'all';

// FIX: Define a type for officer statistics to ensure type safety in the map.
interface OfficerStat {
    name: string;
    stats: Map<SubStatus, number>;
    total: number;
}

const StatusMatrixReport: React.FC<StatusMatrixReportProps> = ({ cases, coordinators }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  
  const matrixData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let filteredCases = cases;

    if (timeFilter !== 'all') {
        filteredCases = cases.filter(c => {
            if (!c.lastActionDate) return false;
            const actionDate = new Date(c.lastActionDate);
            
            switch(timeFilter) {
                case 'today':
                    return actionDate >= today;
                case 'week':
                    return actionDate >= startOfWeek;
                case 'month':
                    return actionDate >= startOfMonth;
                default:
                    return true;
            }
        });
    }

    const usedSubStatuses = [...new Set(filteredCases.map(c => c.subStatus))].sort();

    const officerMap = new Map<string, OfficerStat>(coordinators.map(c => [c.id, { 
        name: c.name, 
        stats: new Map<SubStatus, number>(), 
        total: 0 
    }]));

    for (const c of filteredCases) {
      const officerData = officerMap.get(c.assignedOfficerId);
      if (officerData) {
        const currentCount = officerData.stats.get(c.subStatus) || 0;
        officerData.stats.set(c.subStatus, currentCount + 1);
      }
    }
    
    officerMap.forEach(officerData => {
        officerData.total = Array.from(officerData.stats.values()).reduce((sum, count) => sum + count, 0);
    });

    return { subStatuses: usedSubStatuses, officerMap };
  }, [cases, coordinators, timeFilter]);

  const TH_CLASS = "px-2 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted";
  const TD_CLASS = "px-2 py-4 whitespace-nowrap text-sm text-text-primary";
  
  const FilterButton: React.FC<{label: string, value: TimeFilter}> = ({label, value}) => (
    <button
        onClick={() => setTimeFilter(value)}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${timeFilter === value ? 'bg-primary text-white shadow' : 'bg-surface hover:bg-surface-muted'}`}
    >
        {label}
    </button>
  );

  return (
    <div className="p-6 bg-background min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-text-primary">Status Matrix Report</h1>
            <p className="text-text-secondary mt-1">Breakdown of case sub-statuses across all coordinators.</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-background rounded-lg border border-border">
            <FilterButton label="Today" value="today" />
            <FilterButton label="This Week" value="week" />
            <FilterButton label="This Month" value="month" />
            <FilterButton label="Overall" value="all" />
        </div>
      </div>
      <Card className="!p-0">
        <div className="overflow-x-auto h-[75vh]">
          <table className="min-w-full divide-y divide-border">
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" className={`${TH_CLASS} sticky left-0 bg-surface-muted z-20`}>Description</th>
                {Array.from(matrixData.officerMap.values()).map((officer: OfficerStat) => (
                  <th key={officer.name} scope="col" className={`${TH_CLASS} text-center`}>{officer.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {matrixData.subStatuses.map(status => (
                <tr key={status}>
                  <td className={`${TD_CLASS} font-medium sticky left-0 bg-surface`}>{status}</td>
                  {Array.from(matrixData.officerMap.values()).map((officer: OfficerStat) => (
                    <td key={`${status}-${officer.name}`} className={`${TD_CLASS} text-center`}>
                      {officer.stats.get(status) || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-muted sticky bottom-0">
                <tr>
                    <th scope="row" className={`${TH_CLASS} sticky left-0 bg-surface-muted z-20`}>TOTAL</th>
                    {Array.from(matrixData.officerMap.values()).map((officer: OfficerStat) => (
                        <td key={`total-${officer.name}`} className={`${TD_CLASS} text-center font-bold`}>{officer.total}</td>
                    ))}
                </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StatusMatrixReport;