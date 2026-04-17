import React, { useState, useMemo } from 'react';
import { AllocationLogEntry, User, EnrichedCase, Role } from '../../types';
import Card from '../shared/Card';
import { formatDate, formatCurrency } from '../../utils';
import EmptyState from '../shared/EmptyState';
import { ICONS } from '../../constants';

interface AllocationReportViewProps {
  allocationLog: AllocationLogEntry[];
  users: User[];
  onOpenImportModal: () => void;
  cases: EnrichedCase[];
}

const AllocationReportView: React.FC<AllocationReportViewProps> = ({ allocationLog, users, onOpenImportModal, cases }) => {
  const [filters, setFilters] = useState({
    allocatorId: 'all',
    recipientId: 'all',
    startDate: '',
    endDate: '',
  });
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const managers = useMemo(() => users.filter(u => u.role === 'Manager' || u.role === 'Admin'), [users]);
  const officers = useMemo(() => users.filter(u => u.role === 'Officer' && u.id !== 'unassigned-user-id'), [users]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const filteredLog = useMemo(() => {
    return [...allocationLog]
      .filter(log => {
        const logDate = new Date(log.timestamp);
        const start = filters.startDate ? new Date(`${filters.startDate}T00:00:00.000Z`) : null;
        const end = filters.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : null;

        const allocatorMatch = filters.allocatorId === 'all' || log.allocatorId === filters.allocatorId;
        const recipientMatch = filters.recipientId === 'all' || log.recipientId === filters.recipientId;
        const startDateMatch = !start || logDate >= start;
        const endDateMatch = !end || logDate <= end;
        
        return allocatorMatch && recipientMatch && startDateMatch && endDateMatch;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allocationLog, filters]);
  
  const monthlySummary = useMemo(() => {
    const summary: { [officerId: string]: { name: string; months: number[] } } = {};
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(currentYear, i).toLocaleString('default', { month: 'short' }));

    officers.forEach(officer => {
        summary[officer.id] = { name: officer.name, months: Array(12).fill(0) };
    });

    allocationLog.forEach(log => {
        const logDate = new Date(log.timestamp);
        if (logDate.getFullYear() === currentYear) {
            const monthIndex = logDate.getMonth();
            if (summary[log.recipientId]) {
                summary[log.recipientId].months[monthIndex] += log.count;
            }
        }
    });

    const officerData = Object.values(summary).filter(d => d.months.some(m => m > 0));
     officerData.forEach(d => {
      // @ts-ignore
      d.total = d.months.reduce((a, b) => a + b, 0);
    });
    // @ts-ignore
    officerData.sort((a,b) => b.total - a.total);

    const monthTotals = Array(12).fill(0);
    officerData.forEach(d => {
        d.months.forEach((count, i) => {
            monthTotals[i] += count;
        });
    });

    return { officerData, months, monthTotals };
  }, [allocationLog, officers]);


  const getUserName = (userId: string) => users.find(u => u.id === userId)?.name || 'System';
  
  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted";
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";
  const SUB_TH_CLASS = "px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider bg-surface-muted";
  const SUB_TD_CLASS = "px-2 py-2 whitespace-nowrap text-xs text-text-primary";

  return (
    <div className="p-6 bg-background min-h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-text-primary">Allocation Report</h1>
            <p className="text-text-secondary mt-1">Track all case assignment and re-assignment history.</p>
        </div>
        <button 
          onClick={onOpenImportModal}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2 mt-4 sm:mt-0"
        >
          {ICONS.upload('w-5 h-5')}
          Import Allocations
        </button>
      </div>

      <Card className="!p-0">
          <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">Monthly Allocation Summary ({new Date().getFullYear()})</h2>
          </div>
          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                  <thead>
                      <tr>
                          <th scope="col" className={TH_CLASS}>Officer</th>
                          {monthlySummary.months.map(m => <th key={m} scope="col" className={`${TH_CLASS} text-center`}>{m}</th>)}
                          <th scope="col" className={`${TH_CLASS} text-center`}>Total</th>
                      </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-border">
                      {monthlySummary.officerData.map(d => (
                          <tr key={d.name}>
                              <td className={`${TD_CLASS} font-semibold`}>{d.name}</td>
                              {d.months.map((count, i) => <td key={i} className={`${TD_CLASS} text-center`}>{count || '-'}</td>)}
                              <td className={`${TD_CLASS} text-center font-bold`}>{(d as any).total}</td>
                          </tr>
                      ))}
                  </tbody>
                   <tfoot className="bg-surface-muted font-bold">
                      <tr>
                          <td className={TD_CLASS}>Total</td>
                          {monthlySummary.monthTotals.map((total, i) => <td key={i} className={`${TD_CLASS} text-center`}>{total}</td>)}
                          <td className={`${TD_CLASS} text-center`}>{monthlySummary.monthTotals.reduce((a,b) => a+b, 0)}</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3 text-text-primary">Filter Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="allocatorId" className="block text-sm font-medium text-text-secondary">Allocated By</label>
            <select name="allocatorId" id="allocatorId" value={filters.allocatorId} onChange={handleFilterChange} className="mt-1 block w-full text-sm rounded-md border-border bg-surface p-2">
              <option value="all">All Managers</option>
              {managers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="recipientId" className="block text-sm font-medium text-text-secondary">Allocated To</label>
            <select name="recipientId" id="recipientId" value={filters.recipientId} onChange={handleFilterChange} className="mt-1 block w-full text-sm rounded-md border-border bg-surface p-2">
              <option value="all">All Officers</option>
              {officers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-text-secondary">Start Date</label>
            <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={handleFilterChange} className="mt-1 block w-full text-sm rounded-md border-border bg-surface p-2"/>
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-text-secondary">End Date</label>
            <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={handleFilterChange} className="mt-1 block w-full text-sm rounded-md border-border bg-surface p-2"/>
          </div>
        </div>
      </Card>

      <Card className="!p-0">
        <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Allocation Log ({filteredLog.length} records)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th scope="col" className={TH_CLASS}>Timestamp</th>
                <th scope="col" className={TH_CLASS}>Allocated By</th>
                <th scope="col" className={TH_CLASS}>Allocated To</th>
                <th scope="col" className={TH_CLASS}># of Cases</th>
                <th scope="col" className={TH_CLASS}>Type</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {filteredLog.length > 0 ? filteredLog.map((log) => (
                <React.Fragment key={log.id}>
                    <tr onClick={() => setExpandedLogId(prev => prev === log.id ? null : log.id)} className="cursor-pointer hover:bg-surface-muted">
                    <td className={TD_CLASS}>
                        <div className="flex items-center gap-2">
                            {ICONS.chevronDown(`w-4 h-4 transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`)}
                            {new Date(log.timestamp).toLocaleString()}
                        </div>
                    </td>
                    <td className={`${TD_CLASS} font-medium`}>{getUserName(log.allocatorId)}</td>
                    <td className={`${TD_CLASS} font-medium`}>{getUserName(log.recipientId)}</td>
                    <td className={`${TD_CLASS} font-bold text-primary`}>{log.count}</td>
                    <td className={TD_CLASS}>
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.type === 'Initial Assignment' ? 'bg-blue-100 text-blue-800' : 
                            log.type === 'Re-Assignment' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                            {log.type}
                        </span>
                    </td>
                    </tr>
                     {expandedLogId === log.id && (
                        <tr>
                            <td colSpan={5} className="p-2 bg-background">
                                <div className="p-2 border rounded-md">
                                    <h4 className="font-semibold text-sm mb-2 px-2">Cases in this allocation:</h4>
                                    <div className="max-h-60 overflow-y-auto">
                                        <table className="min-w-full text-xs">
                                            <thead>
                                                <tr>
                                                    <th className={SUB_TH_CLASS}>Debtor</th>
                                                    <th className={SUB_TH_CLASS}>Account</th>
                                                    <th className={SUB_TH_CLASS}>Bank</th>
                                                    <th className={SUB_TH_CLASS}>O/S Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {log.caseIds.map(caseId => {
                                                    const caseData = cases.find(c => c.id === caseId);
                                                    if (!caseData) return <tr key={caseId}><td colSpan={4} className={SUB_TD_CLASS}>Case data not found.</td></tr>;
                                                    return (
                                                        <tr key={caseId}>
                                                            <td className={SUB_TD_CLASS}>{caseData.debtor.name}</td>
                                                            <td className={SUB_TD_CLASS}>{caseData.loan.accountNumber}</td>
                                                            <td className={SUB_TD_CLASS}>{caseData.loan.bank}</td>
                                                            <td className={`${SUB_TD_CLASS} font-semibold text-danger`}>{formatCurrency(caseData.loan.currentBalance, caseData.loan.currency)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                </React.Fragment>
              )) : (
                <tr>
                    <td colSpan={5} className="p-4">
                        <EmptyState
                            icon={ICONS.team('w-16 h-16')}
                            title="No Allocation Events"
                            description="There are no allocation records matching your current filter criteria."
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

export default AllocationReportView;
