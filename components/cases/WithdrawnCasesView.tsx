import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, CRMStatus, Role, SubStatus } from '../../types';
import Card from '../shared/Card';
import { formatCurrency, formatDate, getAge, exportToCsv, convertToAED } from '../../utils';
import { ICONS } from '../../constants';
import ImportCasesModal from './ImportCasesModal';
import KpiCard from '../shared/KpiCard';


interface WithdrawnCasesViewProps {
  cases: EnrichedCase[];
  coordinators: User[];
  onReactivate: (caseId: string, newOfficerId: string) => void;
  onSelectCase: (caseId: string) => void;
  currentUser: User;
  onBulkReactivate: (caseIds: string[], newOfficerId: string) => void;
}

const ReactivateModal: React.FC<{
    caseInfo: EnrichedCase;
    coordinators: User[];
    onClose: () => void;
    onConfirm: (caseId: string, officerId: string) => void;
}> = ({ caseInfo, coordinators, onClose, onConfirm }) => {
    const [selectedOfficerId, setSelectedOfficerId] = useState('');

    const handleConfirm = () => {
        if (!selectedOfficerId) {
            alert("Please select a coordinator to reactivate the case.");
            return;
        }
        onConfirm(caseInfo.id, selectedOfficerId);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-md transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between p-5 border-b border-border rounded-t">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 bg-primary-light h-12 w-12 rounded-full flex items-center justify-center">
                            {ICONS.reactivate('h-6 w-6 text-primary dark:text-accent')}
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-text-primary">
                                Reactivate Case
                            </h3>
                            <p className="text-sm text-text-secondary">Reassign this case to an active workload.</p>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="space-y-3 p-4 bg-background rounded-lg border border-border">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-text-secondary">Debtor:</span>
                            <span className="font-semibold text-text-primary">{caseInfo.debtor.name}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-text-secondary">Account:</span>
                            <span className="font-semibold text-text-primary">{caseInfo.loan.accountNumber}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-text-secondary">O/S Balance:</span>
                            <span className="font-bold text-red-600">{formatCurrency(caseInfo.loan.currentBalance, caseInfo.loan.currency)}</span>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="coordinator-select" className="block text-sm font-medium text-text-secondary mb-2">Assign to:</label>
                        <select
                            id="coordinator-select"
                            value={selectedOfficerId}
                            onChange={e => setSelectedOfficerId(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2.5 text-text-primary bg-surface border-border focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent sm:text-sm rounded-md shadow-sm"
                        >
                            <option value="" disabled>Select a coordinator...</option>
                            {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="flex items-center justify-end p-4 gap-3 bg-surface-muted border-t border-border rounded-b">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-text-primary bg-surface rounded-lg border border-border hover:bg-surface-muted/50">Cancel</button>
                    <button onClick={handleConfirm} disabled={!selectedOfficerId} className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark focus:ring-4 focus:outline-none focus:ring-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed">Reactivate & Assign</button>
                </div>
            </div>
        </div>
    );
};


const WithdrawnCasesView: React.FC<WithdrawnCasesViewProps> = ({ cases, coordinators, onReactivate, onSelectCase, currentUser, onBulkReactivate }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [casesPerPage, setCasesPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [reactivateCase, setReactivateCase] = useState<EnrichedCase | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isBulkReactivateModalOpen, setIsBulkReactivateModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
      bank: 'all',
      subStatus: 'all',
      coordinatorId: 'all',
  });

  const uniqueBanks = useMemo(() => [...new Set(cases.map(c => c.loan?.bank || '').filter(Boolean).sort())], [cases]);
  const uniqueSubStatuses = useMemo(() => [...new Set(cases.map(c => c.subStatus || '').filter(Boolean).sort())], [cases]);

  const handleFilterChange = (filterName: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [filterName]: value }));
    setCurrentPage(1);
  };
  
  const withdrawnCases = useMemo(() => {
    let tempCases = cases.filter(c => c.crmStatus === CRMStatus.WITHDRAWN);

    // Hide archived cases from non-admins
    if (currentUser.role !== Role.ADMIN) {
        tempCases = tempCases.filter(c => c.subStatus !== SubStatus.ARCHIVED_BANK_RECALL && c.subStatus !== SubStatus.ARCHIVED_PAID_AND_WITHDRAWN);
    }
    
    if (activeFilters.bank !== 'all') {
      tempCases = tempCases.filter(c => c.loan?.bank === activeFilters.bank);
    }
    if (activeFilters.subStatus !== 'all') {
      tempCases = tempCases.filter(c => c.subStatus === activeFilters.subStatus);
    }
    if (currentUser.role !== Role.OFFICER && activeFilters.coordinatorId !== 'all') {
      tempCases = tempCases.filter(c => c.assignedOfficerId === activeFilters.coordinatorId);
    }

    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        return tempCases.filter(c => 
            (c.debtor?.name || '').toLowerCase().includes(lowercasedFilter) ||
            (c.loan?.accountNumber || '').toLowerCase().includes(lowercasedFilter)
        );
    }
    return tempCases;
  }, [cases, searchTerm, activeFilters, currentUser.role]);

    const stats = useMemo(() => {
        const totalInactive = withdrawnCases.length;
        const totalInactiveOS = withdrawnCases.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);
        return { totalInactive, totalInactiveOS };
    }, [withdrawnCases]);

  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * casesPerPage;
    return withdrawnCases.slice(startIndex, startIndex + casesPerPage);
  }, [withdrawnCases, currentPage, casesPerPage]);
  
  const totalPages = Math.ceil(withdrawnCases.length / casesPerPage);
  
  const handleBulkReactivateImport = (file: File, officerId?: string) => {
    if (!officerId) {
        alert("You must select a coordinator to assign the reactivated cases to.");
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
            const caseIds = text.split('\n').map(id => id.trim()).filter(Boolean);
            onBulkReactivate(caseIds, officerId);
        }
    };
    reader.readAsText(file);
    setIsBulkReactivateModalOpen(false);
  };

  const handleExport = () => {
    const headers = {
        'debtor.name': 'Debtor',
        'debtor.passport': 'Passport',
        'loan.accountNumber': 'Account',
        'loan.bank': 'Bank',
        'loan.currentBalance': 'O/S Balance',
        'loan.currency': 'Currency',
        'subStatus': 'Reason',
        'history.0.notes': 'Last Note',
        'officer.name': 'Last Officer'
    };
    exportToCsv(`inactive_cases_${new Date().toISOString().split('T')[0]}`, withdrawnCases, headers);
  };

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted sticky top-0";
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";
  
  const FilterPanel = () => (
    <div className="bg-background p-4 rounded-lg border border-border mt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-text-secondary">Bank</label>
          <select value={activeFilters.bank} onChange={e => handleFilterChange('bank', e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm text-sm">
              <option value="all">All Banks</option>
              {uniqueBanks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary">Reason</label>
          <select value={activeFilters.subStatus} onChange={e => handleFilterChange('subStatus', e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm text-sm">
              <option value="all">All Reasons</option>
              {uniqueSubStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {currentUser.role !== Role.OFFICER && (
             <div>
                <label className="text-sm font-medium text-text-secondary">Coordinator</label>
                <select value={activeFilters.coordinatorId} onChange={e => handleFilterChange('coordinatorId', e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm text-sm">
                    <option value="all">All Coordinators</option>
                    {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="p-6 bg-background min-h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-1">Inactive Cases Archive</h1>
            <p className="text-text-secondary">This is a record of all cases that have been marked as inactive or withdrawn.</p>
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-md shadow-sm hover:bg-surface-muted flex items-center gap-2">
                {ICONS.export('w-4 h-4')} Export to CSV
            </button>
            {(currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) && (
                <button onClick={() => setIsBulkReactivateModalOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 flex items-center gap-2">
                    {ICONS.upload('w-4 h-4')} Bulk Reactivate
                </button>
            )}
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <KpiCard title="Total Inactive Cases" value={stats.totalInactive.toLocaleString()} icon={ICONS.archive('w-7 h-7 text-danger')} valueColor="text-danger" iconBg="bg-danger/10" />
            <KpiCard title="Total O/S in Archive" value={formatCurrency(stats.totalInactiveOS, 'AED')} icon={ICONS.money('w-7 h-7 text-warning')} valueColor="text-warning" iconBg="bg-warning/10" />
        </div>
        
        <Card className="!p-4 flex-grow flex flex-col">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                 <div className="relative w-full md:flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {ICONS.search('h-5 w-5 text-text-secondary')}
                  </div>
                  <input 
                      type="text" 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      placeholder="Search by name or account..." 
                      className="block w-full text-text-primary bg-surface pl-10 pr-3 py-2 border border-border rounded-md leading-5 placeholder-text-secondary focus:outline-none focus:ring-1 sm:text-sm"
                  />
              </div>
                 <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="inline-flex items-center justify-center px-4 py-2 border border-border shadow-sm text-sm font-medium rounded-md text-text-primary bg-surface hover:bg-surface-muted w-full md:w-auto">
                  {ICONS.filter('w-5 w-5 text-text-secondary mr-2 -ml-1')}
                  Filters
              </button>
            </div>
             {isFilterOpen && <FilterPanel />}

          <div className="overflow-auto border-t border-border flex-grow">
              <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface-muted">
                      <tr>
                          <th scope="col" className={TH_CLASS}>Debtor</th>
                          <th scope="col" className={TH_CLASS}>Account</th>
                          <th scope="col" className={TH_CLASS}>Bank</th>
                          <th scope="col" className={TH_CLASS}>O/S Balance</th>
                          <th scope="col" className={TH_CLASS}>Sub Status</th>
                          <th scope="col" className={TH_CLASS + " w-1/4"}>Last Note</th>
                          <th scope="col" className={TH_CLASS}>Last Officer</th>
                          {(currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) && (
                            <th scope="col" className={TH_CLASS}>Action</th>
                          )}
                      </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-border">
                      {paginatedCases.map(c => (
                          <tr key={c.id} className="transition-colors hover:bg-surface-muted">
                              <td onClick={() => onSelectCase(c.id)} className={`${TD_CLASS} font-medium text-text-primary cursor-pointer hover:text-accent`}>
                                  <div>{c.debtor.name}</div>
                                  <div className="text-xs text-text-secondary">{getAge(c.debtor.dob)} years old</div>
                              </td>
                              <td className={TD_CLASS}>
                                  <div>{c.loan.accountNumber}</div>
                                  <div className="text-xs text-text-secondary">{c.debtor.passport}</div>
                              </td>
                              <td className={TD_CLASS}>
                                  <div>{c.loan.bank}</div>
                                  <div className="text-xs text-text-secondary">{c.loan.product}</div>
                              </td>
                              <td className={`${TD_CLASS} font-semibold text-red-500`}>{formatCurrency(c.loan.currentBalance, c.loan.currency)}</td>
                              <td className={TD_CLASS}>{c.subStatus}</td>
                              <td className={`${TD_CLASS} whitespace-normal`}>{c.history[0]?.notes || 'N/A'}</td>
                              <td className={TD_CLASS}>{c.officer.name}</td>
                              {(currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) && (
                                <td className={TD_CLASS}>
                                    {c.subStatus !== SubStatus.ARCHIVED_BANK_RECALL && c.subStatus !== SubStatus.ARCHIVED_PAID_AND_WITHDRAWN && (
                                        <button onClick={() => setReactivateCase(c)} className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                                            Reactivate
                                        </button>
                                    )}
                                </td>
                              )}
                          </tr>
                      ))}
                  </tbody>
              </table>
               {paginatedCases.length === 0 && <p className="text-center p-8 text-text-secondary">No withdrawn cases match your criteria.</p>}
          </div>

            <div className="mt-4 flex items-center justify-between flex-shrink-0 pt-4 border-t border-border">
                <div className="flex items-center gap-4">
                    <div className="text-sm text-text-primary">
                        Showing <span className="font-medium">{(currentPage - 1) * casesPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * casesPerPage, withdrawnCases.length)}</span> of <span className="font-medium">{withdrawnCases.length}</span> results
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
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-md hover:bg-surface-muted disabled:opacity-50">Previous</button>
                  <span className="text-sm text-text-secondary">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-md hover:bg-surface-muted disabled:opacity-50">Next</button>
              </div>
            </div>
        </Card>
      </div>
      {reactivateCase && (
        <ReactivateModal 
            caseInfo={reactivateCase}
            coordinators={coordinators}
            onClose={() => setReactivateCase(null)}
            onConfirm={onReactivate}
        />
      )}
      {isBulkReactivateModalOpen && (
          <ImportCasesModal 
            isOpen={isBulkReactivateModalOpen}
            onClose={() => setIsBulkReactivateModalOpen(false)}
            onImport={handleBulkReactivateImport}
            title="Bulk Reactivate Cases"
            instructions="Upload a text file with one Case ID per line. All found cases will be reactivated and assigned to the selected coordinator."
            fileType=".txt"
            showCoordinatorSelect={true}
            coordinators={coordinators}
          />
      )}
    </>
  );
};

export default WithdrawnCasesView;