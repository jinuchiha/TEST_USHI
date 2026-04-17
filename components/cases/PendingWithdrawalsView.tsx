import React, { useState, useMemo } from 'react';
import { EnrichedCase, CRMStatus } from '../../types';
import Card from '../shared/Card';
import { formatCurrency } from '../../utils';
import { ICONS } from '../../constants';

interface PendingWithdrawalsViewProps {
  cases: EnrichedCase[];
  onConfirmWithdrawal: (caseId: string) => void;
}

const PendingWithdrawalsView: React.FC<PendingWithdrawalsViewProps> = ({ cases, onConfirmWithdrawal }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [casesPerPage, setCasesPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');

  const pendingCases = useMemo(() => {
    let tempCases = cases.filter(c => c.crmStatus === CRMStatus.WDS);
    
    if (!searchTerm) return tempCases;
    const lowercasedFilter = searchTerm.toLowerCase();
    return tempCases.filter(c => 
        (c.debtor?.name || '').toLowerCase().includes(lowercasedFilter) ||
        (c.loan?.accountNumber || '').toLowerCase().includes(lowercasedFilter)
    );
  }, [cases, searchTerm]);

  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * casesPerPage;
    return pendingCases.slice(startIndex, startIndex + casesPerPage);
  }, [pendingCases, currentPage, casesPerPage]);
  
  const totalPages = Math.ceil(pendingCases.length / casesPerPage);

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted sticky top-0";
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";
  
  const PaginationControls = () => (
     <div className="flex items-center justify-between flex-shrink-0 pt-4 border-t border-border">
            <div className="flex items-center gap-4">
                <div className="text-sm text-text-primary">
                    Showing <span className="font-medium">{(currentPage - 1) * casesPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * casesPerPage, pendingCases.length)}</span> of <span className="font-medium">{pendingCases.length}</span> results
                </div>
                 <div className="flex items-center gap-2">
                    <label htmlFor="cases-per-page" className="text-sm text-text-secondary">Per Page:</label>
                    <select id="cases-per-page" value={casesPerPage} onChange={e => setCasesPerPage(Number(e.target.value))} className="text-sm bg-surface border border-border rounded-md p-1 focus:ring-1">
                        <option value={50}>50</option>
                        <option value={70}>70</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-md hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                <span className="text-sm text-text-secondary">Page {currentPage} of {totalPages}</span>
                <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-md hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        </div>
  );

  return (
    <div className="p-6 bg-background min-h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-1">Pending Withdrawals</h1>
        <p className="text-text-secondary">These cases have been marked for withdrawal by officers and are awaiting bank confirmation.</p>
      </div>
      
      <Card className="!p-4 flex-grow flex flex-col">
          <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
              <div className="relative w-full md:flex-grow">
                   <div className="flex items-center bg-surface border border-border rounded-md shadow-sm focus-within:ring-2 focus-within:ring-accent focus-within:border-accent transition-shadow duration-200">
                      <span className="pl-3 pr-2 text-text-secondary">
                          {ICONS.case('h-5 w-5')}
                      </span>
                      <input 
                          type="text" 
                          value={searchTerm} 
                          onChange={e => setSearchTerm(e.target.value)} 
                          placeholder="Search by name or account..." 
                          className="w-full pr-4 py-2 border-0 focus:outline-none bg-transparent text-text-primary"
                      />
                  </div>
              </div>
          </div>
          
          <div className="mt-4"><PaginationControls /></div>

        <div className="overflow-auto border-t border-border flex-grow mt-4">
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-muted">
                    <tr>
                        <th scope="col" className={TH_CLASS}>Debtor Name</th>
                        <th scope="col" className={TH_CLASS}>Bank</th>
                        <th scope="col" className={TH_CLASS}>Account No.</th>
                        <th scope="col" className={TH_CLASS}>O/S Balance</th>
                        <th scope="col" className={TH_CLASS}>Requested By</th>
                        <th scope="col" className={TH_CLASS}>Action</th>
                    </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                    {paginatedCases.map(c => (
                        <tr key={c.id} className="hover:bg-surface-muted">
                            <td className={`${TD_CLASS} font-medium text-text-primary`}>{c.debtor.name}</td>
                            <td className={TD_CLASS}>{c.loan.bank}</td>
                            <td className={TD_CLASS}>{c.loan.accountNumber}</td>
                            <td className={`${TD_CLASS} font-semibold text-red-600`}>{formatCurrency(c.loan.currentBalance, c.loan.currency)}</td>
                            <td className={TD_CLASS}>{c.officer.name}</td>
                            <td className={TD_CLASS}>
                              <button 
                                onClick={() => {
                                    if(window.confirm(`Are you sure you want to confirm the withdrawal for ${c.debtor.name}? This action cannot be undone.`)) {
                                        onConfirmWithdrawal(c.id)
                                    }
                                }} 
                                className="px-3 py-1 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
                              >
                                  Confirm Withdrawal
                              </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
             {paginatedCases.length === 0 && <p className="text-center p-8 text-text-secondary">No cases are pending withdrawal.</p>}
        </div>

        <div className="mt-4">
            <PaginationControls />
        </div>
      </Card>
    </div>
  );
};
export default PendingWithdrawalsView;