import React, { useState, useMemo, useEffect } from 'react';
import { EnrichedCase, CRMStatus } from '../../types';
import Card from '../shared/Card';
import { formatCurrency, formatDate, getStatusPillClasses, getAge, convertToAED, exportToCsv } from '../../utils';
import { ICONS } from '../../constants';

interface NewAllocationsViewProps {
  cases: EnrichedCase[];
  onSelectCase: (caseId: string) => void;
}

type SortableKey = 'debtor.name' | 'loan.bank' | 'loan.currentBalance' | 'creationDate' | 'statusCode';

const NewAllocationsView: React.FC<NewAllocationsViewProps> = ({ cases, onSelectCase }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [casesPerPage, setCasesPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
      status: 'all',
      bank: 'all',
      os: 'all',
      age: 'all',
  });
  
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'descending' | 'ascending' }>({ key: 'creationDate', direction: 'descending' });

  const uniqueBanks = useMemo(() => [...new Set(cases.map(c => c.loan?.bank || '').filter(Boolean).sort())], [cases]);
  
  const handleFilterChange = (filterName: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [filterName]: value }));
    setCurrentPage(1);
  }

  const requestSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

  const filteredCases = useMemo(() => {
    let tempCases = cases.filter(c => c.crmStatus !== CRMStatus.WITHDRAWN);

    if (activeFilters.bank !== 'all') {
      tempCases = tempCases.filter(c => c.loan?.bank === activeFilters.bank);
    }
    if (activeFilters.os !== 'all') {
        const [min, max] = activeFilters.os.split('-').map(Number);
        tempCases = tempCases.filter(c => {
            const balance = c.loan?.currentBalance || 0;
            return max ? (balance >= min && balance < max) : (balance >= min);
        });
    }
    if (activeFilters.age !== 'all') {
        const days = parseInt(activeFilters.age, 10);
        const cutoff = new Date(new Date().setDate(new Date().getDate() - days)).toISOString();
        tempCases = tempCases.filter(c => c.creationDate >= cutoff);
    }
    
    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        tempCases = tempCases.filter(c => 
            c.debtor?.name.toLowerCase().includes(lowercasedFilter) ||
            c.loan?.accountNumber.toLowerCase().includes(lowercasedFilter) ||
            c.debtor?.passport.toLowerCase().includes(lowercasedFilter)
        );
    }

    if (sortConfig !== null) {
      tempCases.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (sortConfig.key === 'creationDate') {
            const dateA = new Date(aValue).getTime();
            const dateB = new Date(bValue).getTime();
            if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return tempCases;
  }, [cases, searchTerm, activeFilters, sortConfig]);

  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * casesPerPage;
    return filteredCases.slice(startIndex, startIndex + casesPerPage);
  }, [filteredCases, currentPage, casesPerPage]);
  
  const totalPages = Math.ceil(filteredCases.length / casesPerPage);
  
   const handleExport = () => {
    const headers = {
        'debtor.name': 'Debtor',
        'debtor.passport': 'Passport',
        'loan.accountNumber': 'Account',
        'loan.bank': 'Bank',
        'loan.product': 'Product',
        'loan.currentBalance': 'O/S Balance',
        'loan.currency': 'Currency',
        'creationDate': 'Date Assigned',
        'statusCode': 'Status Code'
    };
    exportToCsv(`new_allocations_${new Date().toISOString().split('T')[0]}`, filteredCases, headers);
  };

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted sticky top-0";
  const SORTABLE_TH_CLASS = `${TH_CLASS} cursor-pointer hover:bg-gray-100 transition-colors`;
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  const getSortIndicator = (key: SortableKey) => {
    if (sortConfig?.key !== key) return null;
    return <span className="ml-1 opacity-70">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
  };
  
  const FilterPanel = () => (
    <div className="bg-background p-4 rounded-lg border border-border mt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-text-secondary">Bank</label>
          <select value={activeFilters.bank} onChange={e => handleFilterChange('bank', e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm focus:outline-none text-sm">
              <option value="all">All Banks</option>
              {uniqueBanks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary">Outstanding Balance</label>
          <select value={activeFilters.os} onChange={e => handleFilterChange('os', e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm focus:outline-none text-sm">
              <option value="all">All Balances</option>
              <option value="0-5000">&lt; 5,000</option>
              <option value="5000-10000">5,000 - 10,000</option>
              <option value="10000-25000">10,000 - 25,000</option>
              <option value="25000">25,000+</option>
          </select>
        </div>
         <div>
          <label className="text-sm font-medium text-text-secondary">Case Age</label>
          <select value={activeFilters.age} onChange={e => handleFilterChange('age', e.target.value)} className="w-full mt-1 py-2 pl-3 pr-8 border border-border bg-surface rounded-md shadow-sm focus:outline-none text-sm">
              <option value="all">Any Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
          </select>
        </div>
      </div>
    </div>
  );
  
  const PaginationControls = () => (
    <div className="flex items-center justify-between flex-shrink-0 pt-4 border-t border-border">
            <div className="flex items-center gap-4">
                <div className="text-sm text-text-secondary">
                    Showing <span className="font-medium text-text-primary">{(currentPage - 1) * casesPerPage + 1}</span> to <span className="font-medium text-text-primary">{Math.min(currentPage * casesPerPage, filteredCases.length)}</span> of <span className="font-medium text-text-primary">{filteredCases.length}</span> results
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
    <div className="p-6 min-h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">New Case Allocations</h1>
          <p className="text-text-secondary">These cases have been assigned to you. Open a case and log an action to move it to your active workload.</p>
        </div>
         <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-md shadow-sm hover:bg-surface-muted flex items-center gap-2">
            {ICONS.export('w-4 h-4')} Export to CSV
        </button>
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
                      placeholder="Search by name, account, or passport..." 
                      className="w-full block text-text-primary bg-surface pl-10 pr-3 py-2 border border-border rounded-md leading-5 placeholder-text-secondary focus:outline-none focus:ring-1 sm:text-sm"
                  />
              </div>
              <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-md shadow-sm hover:bg-surface-muted w-full md:w-auto">
                  {ICONS.filter('w-4 h-4')}
                  <span>Filters</span>
              </button>
          </div>
          {isFilterOpen && <FilterPanel />}
          
          <div className="mt-4"><PaginationControls /></div>


        <div className="overflow-auto border-t border-border flex-grow mt-4">
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-muted">
                    <tr>
                        <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('debtor.name')}>
                            Debtor {getSortIndicator('debtor.name')}
                        </th>
                         <th scope="col" className={TH_CLASS}>
                            Account
                        </th>
                         <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.bank')}>
                            Bank {getSortIndicator('loan.bank')}
                        </th>
                        <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.currentBalance')}>
                            O/S Balance {getSortIndicator('loan.currentBalance')}
                        </th>
                        <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('creationDate')}>
                            Date Assigned {getSortIndicator('creationDate')}
                        </th>
                        <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('statusCode')}>
                            Status Code {getSortIndicator('statusCode')}
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                    {paginatedCases.map(c => {
                        return (
                        <tr key={c.id} onClick={() => onSelectCase(c.id)} className="hover:bg-primary-light cursor-pointer">
                            <td className={TD_CLASS}>
                                <div className="font-medium text-text-primary">{c.debtor.name}</div>
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
                            <td className={TD_CLASS}>{formatDate(c.creationDate)}</td>
                            <td className={TD_CLASS}>
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    c.statusCode === 'NEW' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                    {c.statusCode}
                                </span>
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
             {paginatedCases.length === 0 && <p className="text-center p-8 text-text-secondary">No cases match your criteria.</p>}
        </div>
          {/* Pagination Controls */}
          <div className="mt-4">
            <PaginationControls />
          </div>
      </Card>
    </div>
  );
};

export default NewAllocationsView;