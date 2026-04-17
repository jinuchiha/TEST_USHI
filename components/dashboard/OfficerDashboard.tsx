import React, { useState, useMemo, useEffect } from 'react';
import { Case, CRMStatus, SubStatus, User, EnrichedCase, Role } from '../../types';
import { formatCurrency, getStatusPillClasses, formatDate, getAge, convertToAED, exportToCsv } from '../../utils';
import { ICONS, STATUS_MAP } from '../../constants';
import Card from '../shared/Card';
import ImportCasesModal from '../cases/ImportCasesModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import EmptyState from '../shared/EmptyState';

interface OfficerDashboardProps {
  cases: EnrichedCase[];
  onSelectCase: (caseId: string) => void;
  currentUser: User;
  onAddCase: () => void;
  onImportCases: () => void;
  onBulkInactive: (caseIds: string[]) => void;
  onReassign: (caseIds: string[], newOfficerId: string) => void;
  filters: any;
  clearFilters: () => void;
  coordinators?: User[];
  onQuickLog?: (caseId: string, crm: CRMStatus, sub: SubStatus, contact: 'Contact' | 'Non Contact', work: 'Work' | 'Non Work', note: string) => void;
}

type SortableKey = 'loan.bank' | 'loan.product' | 'loan.accountNumber' | 'debtor.name' | 'loan.currentBalance' | 'crmStatus' | 'officer.name' | 'lastActionDate' | 'creationDate';

type OfficerTab = 'all' | 'thisMonth' | 'newAssigned';

// FIX: Changed to a named export to resolve module import error.
export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({ cases, onSelectCase, currentUser, onAddCase, onImportCases, onBulkInactive, onReassign, filters, clearFilters, coordinators, onQuickLog }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [casesPerPage, setCasesPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [targetReassignOfficerId, setTargetReassignOfficerId] = useState('');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isBulkInactiveModalOpen, setIsBulkInactiveModalOpen] = useState(false);
  const [isConfirmReassignOpen, setIsConfirmReassignOpen] = useState(false);
  const [isConfirmInactiveOpen, setIsConfirmInactiveOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<OfficerTab>('all');

  const [activeFilters, setActiveFilters] = useState({
      status: 'all',
      subStatus: 'all',
      bank: 'all',
      product: 'all',
      age: 'all',
      ladStartDate: '',
      ladEndDate: '',
      coordinatorId: 'all',
      dpdMin: '',
      dpdMax: '',
      balanceMin: '',
      balanceMax: '',
      contactStatus: 'all',
      workStatus: 'all',
      tracingStatus: 'all',
      cyber: 'all',
  });

  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'ascending' | 'descending' }>({ key: 'lastActionDate', direction: 'descending' });

  const isManager = useMemo(() => currentUser.role === Role.MANAGER || currentUser.role === Role.ADMIN, [currentUser.role]);
  const isOfficer = useMemo(() => currentUser.role === Role.OFFICER, [currentUser.role]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);


  useEffect(() => {
    // Handle global search term passed via filters
    if (filters?.globalSearch) {
      setSearchTerm(filters.globalSearch);
      clearFilters(); // Clear the filter from App state so it's not sticky
    }
  }, [filters]);

  const currentYearMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const uniqueBanks = useMemo(() => [...new Set(cases.map(c => c.loan?.bank || '').filter(Boolean).sort())], [cases]);
  const uniqueProducts = useMemo(() => [...new Set(cases.map(c => c.loan?.product || '').filter(Boolean).sort())], [cases]);
  const uniqueTracingStatuses = useMemo(() => [...new Set(cases.map(c => c.tracingStatus || '').filter(Boolean).sort())], [cases]);
  const availableSubStatuses = useMemo(() => activeFilters.status !== 'all' ? STATUS_MAP[activeFilters.status as CRMStatus] || [] : [], [activeFilters.status]);

  const handleFilterChange = (filterName: string, value: string) => {
    setActiveFilters(prev => {
        const newFilters = { ...prev, [filterName]: value };
        if (filterName === 'status' && value === 'all') {
            newFilters.subStatus = 'all';
        }
        return newFilters;
    });
    setCurrentPage(1);
  }

  const handleClearAllFilters = () => {
      clearFilters();
      setActiveFilters({
          status: 'all',
          subStatus: 'all',
          bank: 'all',
          product: 'all',
          age: 'all',
          ladStartDate: '',
          ladEndDate: '',
          coordinatorId: 'all',
          dpdMin: '',
          dpdMax: '',
          balanceMin: '',
          balanceMax: '',
          contactStatus: 'all',
          workStatus: 'all',
          tracingStatus: 'all',
          cyber: 'all',
      });
      setSearchTerm('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.status !== 'all') count++;
    if (activeFilters.subStatus !== 'all') count++;
    if (activeFilters.bank !== 'all') count++;
    if (activeFilters.product !== 'all') count++;
    if (activeFilters.age !== 'all') count++;
    if (activeFilters.ladStartDate) count++;
    if (activeFilters.ladEndDate) count++;
    if (activeFilters.coordinatorId !== 'all') count++;
    if (activeFilters.dpdMin) count++;
    if (activeFilters.dpdMax) count++;
    if (activeFilters.balanceMin) count++;
    if (activeFilters.balanceMax) count++;
    if (activeFilters.contactStatus !== 'all') count++;
    if (activeFilters.workStatus !== 'all') count++;
    if (activeFilters.tracingStatus !== 'all') count++;
    if (activeFilters.cyber !== 'all') count++;
    return count;
  }, [activeFilters]);

  const requestSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'descending'; // Default direction
    if (sortConfig.key === key) {
        // If it's the same key, toggle direction
        direction = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    } else {
        // If it's a new key, set a smart default direction
        switch(key) {
            case 'debtor.name':
            case 'loan.bank':
            case 'loan.product':
            case 'loan.accountNumber':
            case 'crmStatus':
            case 'officer.name':
                direction = 'ascending';
                break;
            case 'loan.currentBalance':
            case 'lastActionDate':
            case 'creationDate':
            default:
                direction = 'descending';
                break;
        }
    }
    setSortConfig({ key, direction });
  };


  const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

  // Helper: compute DPD from a case
  const getDpd = (c: EnrichedCase): number => {
    const lpd = c.loan?.lpd ? new Date(c.loan.lpd) : null;
    return lpd ? Math.max(0, Math.floor((Date.now() - lpd.getTime()) / 86400000)) : 0;
  };

  // Pre-compute tab datasets for counts and filtering
  const allCasesBase = useMemo(() => {
    let tempCases = cases;
    if (currentUser.role === Role.OFFICER) {
      tempCases = tempCases.filter(c => c.assignedOfficerId === currentUser.id && c.statusCode !== 'NEW' && c.statusCode !== 'RE-ASSIGN');
    } else {
      tempCases = tempCases.filter(c => c.statusCode !== 'NEW' && c.statusCode !== 'RE-ASSIGN' && c.statusCode !== 'UNASSIGNED');
    }
    tempCases = tempCases.filter(c => c.crmStatus !== CRMStatus.WITHDRAWN && c.crmStatus !== CRMStatus.CLOSED);
    return tempCases;
  }, [cases, currentUser]);

  const thisMonthCasesBase = useMemo(() => {
    if (!isOfficer) return [];
    return cases.filter(c => {
      if (c.assignedOfficerId !== currentUser.id) return false;
      if (c.crmStatus === CRMStatus.WITHDRAWN || c.crmStatus === CRMStatus.CLOSED) return false;
      // Must have at least 1 history entry this month
      return c.history.some(h => {
        const ts = h.attributionDate || h.timestamp || '';
        return ts.startsWith(currentYearMonth);
      });
    });
  }, [cases, currentUser, currentYearMonth, isOfficer]);

  const newAssignedCasesBase = useMemo(() => {
    if (!isOfficer) return [];
    return cases.filter(c =>
      c.assignedOfficerId === currentUser.id &&
      (c.statusCode === 'NEW' || c.statusCode === 'RE-ASSIGN')
    );
  }, [cases, currentUser, isOfficer]);

  // Get the base set for current tab
  const tabBaseCases = useMemo(() => {
    if (!isOfficer) return allCasesBase;
    switch (activeTab) {
      case 'thisMonth': return thisMonthCasesBase;
      case 'newAssigned': return newAssignedCasesBase;
      case 'all':
      default: return allCasesBase;
    }
  }, [activeTab, allCasesBase, thisMonthCasesBase, newAssignedCasesBase, isOfficer]);

  // Apply filters on top of tab base
  const applyFilters = (inputCases: EnrichedCase[]): EnrichedCase[] => {
    let tempCases = [...inputCases];

    if (filters && Object.keys(filters).length > 0) {
      if (filters.crmStatus) {
        tempCases = tempCases.filter(c => c.crmStatus === filters.crmStatus);
      }
    }

    if (currentUser.role !== Role.OFFICER && activeFilters.coordinatorId !== 'all') {
      tempCases = tempCases.filter(c => c.assignedOfficerId === activeFilters.coordinatorId);
    }
    if (activeFilters.status !== 'all') {
      tempCases = tempCases.filter(c => c.crmStatus === activeFilters.status);
    }
    if (activeFilters.subStatus !== 'all') {
      tempCases = tempCases.filter(c => c.subStatus === activeFilters.subStatus);
    }
    if (activeFilters.bank !== 'all') {
      tempCases = tempCases.filter(c => c.loan?.bank === activeFilters.bank);
    }
    if (activeFilters.product !== 'all') {
      tempCases = tempCases.filter(c => c.loan?.product === activeFilters.product);
    }
    if (activeFilters.age !== 'all') {
      const days = parseInt(activeFilters.age, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      tempCases = tempCases.filter(c => new Date(c.creationDate) >= cutoff);
    }
    if (activeFilters.ladStartDate) {
      const startDate = new Date(activeFilters.ladStartDate + 'T00:00:00');
      tempCases = tempCases.filter(c => c.lastActionDate && new Date(c.lastActionDate) >= startDate);
    }
    if (activeFilters.ladEndDate) {
      const endDate = new Date(activeFilters.ladEndDate + 'T23:59:59');
      tempCases = tempCases.filter(c => c.lastActionDate && new Date(c.lastActionDate) <= endDate);
    }

    // DPD Range
    if (activeFilters.dpdMin) {
      const min = parseInt(activeFilters.dpdMin, 10);
      if (!isNaN(min)) {
        tempCases = tempCases.filter(c => getDpd(c) >= min);
      }
    }
    if (activeFilters.dpdMax) {
      const max = parseInt(activeFilters.dpdMax, 10);
      if (!isNaN(max)) {
        tempCases = tempCases.filter(c => getDpd(c) <= max);
      }
    }

    // Balance Range
    if (activeFilters.balanceMin) {
      const min = parseFloat(activeFilters.balanceMin);
      if (!isNaN(min)) {
        tempCases = tempCases.filter(c => (c.loan?.currentBalance ?? 0) >= min);
      }
    }
    if (activeFilters.balanceMax) {
      const max = parseFloat(activeFilters.balanceMax);
      if (!isNaN(max)) {
        tempCases = tempCases.filter(c => (c.loan?.currentBalance ?? 0) <= max);
      }
    }

    // Contact Status
    if (activeFilters.contactStatus !== 'all') {
      tempCases = tempCases.filter(c => c.contactStatus === activeFilters.contactStatus);
    }

    // Work Status
    if (activeFilters.workStatus !== 'all') {
      tempCases = tempCases.filter(c => c.workStatus === activeFilters.workStatus);
    }

    // Tracing Status
    if (activeFilters.tracingStatus !== 'all') {
      tempCases = tempCases.filter(c => c.tracingStatus === activeFilters.tracingStatus);
    }

    // Cyber
    if (activeFilters.cyber !== 'all') {
      tempCases = tempCases.filter(c => c.cyber === activeFilters.cyber);
    }

    // Search
    if (debouncedSearchTerm) {
      const lowercasedFilter = debouncedSearchTerm.toLowerCase();
      tempCases = tempCases.filter(c => {
        const searchIn = [
          c.debtor?.name, c.loan?.accountNumber, c.debtor?.passport,
          c.debtor?.eid, c.debtor?.cnic, c.loan?.cif,
          c.debtor?.address, c.officer?.name,
          c.crmStatus, c.subStatus,
          ...(c.debtor?.phones || []), ...(c.debtor?.emails || []),
          c.history[0]?.notes, c.id,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchIn.includes(lowercasedFilter);
      });
    }

    return tempCases;
  };

  const filteredCases = useMemo(() => {
    let tempCases = applyFilters(tabBaseCases);

    if (sortConfig !== null) {
      tempCases.sort((a, b) => {
          const aValue = getNestedValue(a, sortConfig.key);
          const bValue = getNestedValue(b, sortConfig.key);

          if (aValue === bValue) return 0;
          if (aValue === undefined || aValue === null) return 1;
          if (bValue === undefined || bValue === null) return -1;

          let comparison = 0;
          if (typeof aValue === 'number' && typeof bValue === 'number') {
              comparison = aValue > bValue ? 1 : -1;
          } else {
              comparison = String(aValue).localeCompare(String(bValue));
          }

          return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }

    return tempCases;
  }, [tabBaseCases, debouncedSearchTerm, activeFilters, currentUser, filters, sortConfig, currentYearMonth]);

  // Tab counts — apply filters to each base to get accurate counts
  const allCasesCount = useMemo(() => applyFilters(allCasesBase).length, [allCasesBase, debouncedSearchTerm, activeFilters, filters, currentUser]);
  const thisMonthCount = useMemo(() => applyFilters(thisMonthCasesBase).length, [thisMonthCasesBase, debouncedSearchTerm, activeFilters, filters, currentUser]);
  const newAssignedCount = useMemo(() => applyFilters(newAssignedCasesBase).length, [newAssignedCasesBase, debouncedSearchTerm, activeFilters, filters, currentUser]);

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
        'crmStatus': 'CRM Status',
        'subStatus': 'Sub Status',
        'officer.name': 'Coordinator',
        'lastActionDate': 'Last Action Date',
        'history.0.notes': 'Last Note'
    };
    exportToCsv(`all_cases_export_${new Date().toISOString().split('T')[0]}`, filteredCases, headers);
  };

  const handleBulkImport = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                const caseIds = text.split('\n').map(id => id.trim()).filter(Boolean);
                onBulkInactive(caseIds);
            }
        };
        reader.readAsText(file);
        setIsBulkInactiveModalOpen(false);
    };

    const handleToggleSelect = (caseId: string) => {
        setSelectedCaseIds(prev => {
            if (prev.includes(caseId)) {
                return prev.filter(id => id !== caseId);
            } else {
                return [...prev, caseId];
            }
        });
    };

    const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pageCaseIds = paginatedCases.map(c => c.id);
        if (e.target.checked) {
            setSelectedCaseIds(prev => [...new Set([...prev, ...pageCaseIds])]);
        } else {
            setSelectedCaseIds(prev => prev.filter(id => !pageCaseIds.includes(id)));
        }
    };

    const areAllOnPageSelected = useMemo(() => {
        const pageCaseIds = paginatedCases.map(c => c.id);
        return pageCaseIds.length > 0 && pageCaseIds.every(id => selectedCaseIds.includes(id));
    }, [selectedCaseIds, paginatedCases]);

    const handleBulkReassign = () => {
        if (!targetReassignOfficerId) {
            alert('Please select a coordinator to assign cases to.');
            return;
        }
        setIsConfirmReassignOpen(true);
    }

    const confirmBulkReassign = () => {
        onReassign(selectedCaseIds, targetReassignOfficerId);
        setSelectedCaseIds([]);
        setTargetReassignOfficerId('');
        setIsConfirmReassignOpen(false);
    }

    const confirmBulkInactive = () => {
        onBulkInactive(selectedCaseIds);
        setSelectedCaseIds([]);
        setIsConfirmInactiveOpen(false);
    }

    const handleTabChange = (tab: OfficerTab) => {
      setActiveTab(tab);
      setCurrentPage(1);
      setSelectedCaseIds([]);
    };


  const TH_CLASS = "px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wider sticky top-0 bg-[var(--color-bg-tertiary)] z-10 border-b border-[var(--color-border)]";
  const SORTABLE_TH_CLASS = `${TH_CLASS} cursor-pointer hover:text-text-primary transition-colors`;
  const TD_CLASS = "px-3 py-2 whitespace-nowrap text-xs text-text-primary";

  const getSortIndicator = (key: SortableKey) => {
    if (sortConfig?.key !== key) return null;
    return <span className="ml-1 opacity-70">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
  };

  const FilterPanel = () => (
    <div className="p-4 rounded-lg border border-border mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-text-secondary">CRM Status</label>
          <select value={activeFilters.status} onChange={e => handleFilterChange('status', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">All Statuses</option>
              {Object.values(CRMStatus).filter(s => s !== CRMStatus.WITHDRAWN).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
         <div>
          <label className="block text-sm font-medium text-text-secondary">Sub Status</label>
          <select value={activeFilters.subStatus} onChange={e => handleFilterChange('subStatus', e.target.value)} disabled={availableSubStatuses.length === 0} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md disabled:bg-slate-800 disabled:cursor-not-allowed">
              <option value="all">All Sub-Statuses</option>
              {availableSubStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Bank</label>
          <select value={activeFilters.bank} onChange={e => handleFilterChange('bank', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">All Banks</option>
              {uniqueBanks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Product</label>
          <select value={activeFilters.product} onChange={e => handleFilterChange('product', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">All Products</option>
              {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Case Age</label>
          <select value={activeFilters.age} onChange={e => handleFilterChange('age', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">Any Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
          </select>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-2 items-end">
            <div>
                <label className="block text-sm font-medium text-text-secondary">LAD Start Date</label>
                <input type="date" value={activeFilters.ladStartDate} onChange={e => handleFilterChange('ladStartDate', e.target.value)} className="mt-1 block w-full py-2 text-base sm:text-sm rounded-md"/>
            </div>
             <div>
                <label className="block text-sm font-medium text-text-secondary">LAD End Date</label>
                <input type="date" value={activeFilters.ladEndDate} onChange={e => handleFilterChange('ladEndDate', e.target.value)} className="mt-1 block w-full py-2 text-base sm:text-sm rounded-md"/>
            </div>
        </div>
        {currentUser.role !== Role.OFFICER && coordinators && (
            <div>
              <label className="block text-sm font-medium text-text-secondary">Coordinator</label>
              <select
                  value={activeFilters.coordinatorId}
                  onChange={e => handleFilterChange('coordinatorId', e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md"
              >
                  <option value="all">All Coordinators</option>
                  {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
        )}

        {/* DPD Range */}
        <div className="grid grid-cols-2 gap-2 items-end">
            <div>
                <label className="block text-sm font-medium text-text-secondary">Min DPD</label>
                <input type="number" min="0" placeholder="0" value={activeFilters.dpdMin} onChange={e => handleFilterChange('dpdMin', e.target.value)} className="mt-1 block w-full py-2 text-base sm:text-sm rounded-md"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary">Max DPD</label>
                <input type="number" min="0" placeholder="999" value={activeFilters.dpdMax} onChange={e => handleFilterChange('dpdMax', e.target.value)} className="mt-1 block w-full py-2 text-base sm:text-sm rounded-md"/>
            </div>
        </div>

        {/* Balance Range */}
        <div className="grid grid-cols-2 gap-2 items-end">
            <div>
                <label className="block text-sm font-medium text-text-secondary">Min Balance</label>
                <input type="number" min="0" placeholder="0" value={activeFilters.balanceMin} onChange={e => handleFilterChange('balanceMin', e.target.value)} className="mt-1 block w-full py-2 text-base sm:text-sm rounded-md"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary">Max Balance</label>
                <input type="number" min="0" placeholder="Any" value={activeFilters.balanceMax} onChange={e => handleFilterChange('balanceMax', e.target.value)} className="mt-1 block w-full py-2 text-base sm:text-sm rounded-md"/>
            </div>
        </div>

        {/* Contact Status */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">Contact Status</label>
          <select value={activeFilters.contactStatus} onChange={e => handleFilterChange('contactStatus', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">All</option>
              <option value="Contact">Contact</option>
              <option value="Non Contact">Non Contact</option>
          </select>
        </div>

        {/* Work Status */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">Work Status</label>
          <select value={activeFilters.workStatus} onChange={e => handleFilterChange('workStatus', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">All</option>
              <option value="Work">Work</option>
              <option value="Non Work">Non Work</option>
          </select>
        </div>

        {/* Tracing Status */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">Tracing Status</label>
          <select value={activeFilters.tracingStatus} onChange={e => handleFilterChange('tracingStatus', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">All</option>
              {uniqueTracingStatuses.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Cyber */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">Cyber</label>
          <select value={activeFilters.cyber} onChange={e => handleFilterChange('cyber', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md">
              <option value="all">All</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
          </select>
        </div>
      </div>

      {/* Reset button */}
      <div className="mt-4 flex justify-end">
        <button onClick={handleClearAllFilters} className="px-4 py-2 text-sm font-medium rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors">
          Reset Filters
        </button>
      </div>
    </div>
  );

  return (
    <>
    <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">CASES</h1>
          </div>
          <div className="flex items-center space-x-2 mt-4 sm:mt-0">
            {(currentUser.role === Role.OFFICER || currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) && (
                 <button onClick={onAddCase} className="btn-primary px-4 py-2 text-sm">
                    + Add New Case
                </button>
            )}
             {currentUser.role === Role.ADMIN && (
                <button onClick={onImportCases} className="px-4 py-2 text-sm btn-secondary">
                    Import Cases
                </button>
            )}
             {(currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) && (
                <button onClick={() => setIsBulkInactiveModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-md hover:bg-danger/20">
                    {ICONS.upload('w-5 h-5')}
                    Bulk Inactivate
                </button>
            )}
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm font-medium btn-secondary">
                {ICONS.export('w-4 h-4')}
                Export CSV
            </button>
          </div>
      </div>

      {/* Officer Tabs */}
      {isOfficer && (
        <div className="flex items-center gap-1 mb-4 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          {([
            { key: 'all' as OfficerTab, label: 'All Cases', count: allCasesCount },
            { key: 'thisMonth' as OfficerTab, label: 'This Month', count: thisMonthCount },
            { key: 'newAssigned' as OfficerTab, label: 'New Assigned', count: newAssignedCount },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`relative px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'text-white border-[#F28C28] bg-[#1B2A4A]'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  activeTab === tab.key
                    ? 'bg-[#F28C28] text-white'
                    : 'bg-white/10 text-text-secondary'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="panel-dark p-4 rounded-lg flex-grow flex flex-col">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                <div className="relative w-full md:flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {ICONS.search('h-5 w-5 text-text-secondary')}
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by name, account, passport, or notes..."
                        className="block w-full pl-10 pr-3 py-2 leading-5 rounded-md"
                    />
                </div>
                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="relative inline-flex items-center justify-center px-4 py-2 border border-border shadow-sm text-sm font-medium rounded-md text-text-primary bg-background hover:bg-white/5 w-full md:w-auto">
                    {ICONS.filter('w-5 h-5 text-text-secondary mr-2 -ml-1')}
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full text-white" style={{ background: '#F28C28' }}>
                        {activeFilterCount}
                      </span>
                    )}
                </button>
            </div>

            {isFilterOpen && <FilterPanel />}

            <div className="overflow-auto border-t border-border flex-grow">
                <table className="min-w-full divide-y divide-border">
                <thead>
                    <tr>
                    {(
                        <th scope="col" className={TH_CLASS}>
                        <input
                            type="checkbox"
                            className="rounded border-border text-primary shadow-sm"
                            checked={areAllOnPageSelected}
                            onChange={handleSelectAllOnPage}
                        />
                        </th>
                    )}
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('debtor.name')}>
                        Debtor {getSortIndicator('debtor.name')}
                    </th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.accountNumber')}>
                        Account {getSortIndicator('loan.accountNumber')}
                    </th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.bank')}>
                        Bank {getSortIndicator('loan.bank')}
                    </th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.currentBalance')}>
                        O/S Balance {getSortIndicator('loan.currentBalance')}
                    </th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('crmStatus')}>
                        Status {getSortIndicator('crmStatus')}
                    </th>
                    <th scope="col" className={TH_CLASS}>Contact</th>
                    <th scope="col" className={TH_CLASS}>Work</th>
                    <th scope="col" className={TH_CLASS}>Phone</th>
                    {currentUser.role !== Role.OFFICER && (
                        <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('officer.name')}>
                            Officer {getSortIndicator('officer.name')}
                        </th>
                    )}
                    <th scope="col" className={TH_CLASS}>DPD</th>
                    <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('lastActionDate')}>
                        Last Activity {getSortIndicator('lastActionDate')}
                    </th>
                    <th scope="col" className={TH_CLASS}>
                        Last Note
                    </th>
                    {onQuickLog && currentUser.role === Role.OFFICER && (
                        <th scope="col" className={TH_CLASS}>Quick Log</th>
                    )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {paginatedCases.length > 0 ? paginatedCases.map(c => {
                        const statusClasses = getStatusPillClasses(c.crmStatus);
                        const isSelected = selectedCaseIds.includes(c.id);
                        return (
                            <tr key={c.id} className={`transition-colors cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-[var(--color-bg-tertiary)]'}`} onClick={() => onSelectCase(c.id)}>
                            {(
                                <td className={TD_CLASS} onClick={(e) => { e.stopPropagation(); handleToggleSelect(c.id); }}>
                                <input type="checkbox" className="rounded border-border text-primary shadow-sm" checked={isSelected} readOnly />
                                </td>
                            )}
                                <td className={TD_CLASS}>
                                    <div className="font-semibold text-text-primary leading-tight">{c.debtor.name}</div>
                                    <div className="text-[10px] text-text-tertiary mt-0.5">{c.debtor.eid || c.debtor.cnic || '—'} · {getAge(c.debtor.dob)}y</div>
                                </td>
                                <td className={TD_CLASS}>
                                    <div className="font-mono text-[11px]">{c.loan.accountNumber}</div>
                                    <div className="text-[10px] text-text-tertiary">{c.loan.cif || c.debtor.passport || '—'}</div>
                                </td>
                                <td className={TD_CLASS}>
                                    <div className="leading-tight">{c.loan.bank}</div>
                                    <div className="text-[10px] text-text-tertiary">{c.loan.product}{c.loan.bucket ? ` · ${c.loan.bucket}` : ''}</div>
                                </td>
                                <td className={`${TD_CLASS} font-bold text-danger`}>
                                    <div>{formatCurrency(c.loan.currentBalance, c.loan.currency)}</div>
                                    <div className="text-[10px] font-normal text-text-tertiary">Orig: {formatCurrency(c.loan.originalAmount, c.loan.currency)}</div>
                                </td>
                                <td className={TD_CLASS}>
                                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${statusClasses}`}>{c.crmStatus}</span>
                                    {c.subStatus && <div className="text-[10px] text-text-tertiary mt-0.5 truncate max-w-[80px]">{c.subStatus}</div>}
                                </td>
                                <td className={TD_CLASS}>
                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${c.contactStatus === 'Contact' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {c.contactStatus === 'Contact' ? 'C' : 'NC'}
                                    </span>
                                </td>
                                <td className={TD_CLASS}>
                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${c.workStatus === 'Work' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                        {c.workStatus === 'Work' ? 'W' : 'NW'}
                                    </span>
                                </td>
                                <td className={TD_CLASS}>
                                    <div className="text-[11px] font-mono">{c.debtor.phones?.[0] || '—'}</div>
                                </td>
                                {currentUser.role !== Role.OFFICER && (
                                    <td className={TD_CLASS}>
                                        <div className="text-[11px]">{c.officer.name}</div>
                                        {c.officer.agentCode && <div className="text-[10px] text-text-tertiary">{c.officer.agentCode}</div>}
                                    </td>
                                )}
                                <td className={TD_CLASS}>
                                    {(() => {
                                        const dpd = getDpd(c);
                                        const color = dpd > 180 ? 'text-red-600 font-bold' : dpd > 90 ? 'text-orange-600 font-semibold' : dpd > 30 ? 'text-amber-600' : 'text-text-secondary';
                                        return <span className={`text-[11px] ${color}`}>{dpd > 0 ? dpd : '—'}</span>;
                                    })()}
                                </td>
                                <td className={TD_CLASS}>
                                    <div className="text-[11px]">{formatDate(c.lastActionDate)}</div>
                                    <div className="text-[10px] text-text-tertiary">{c.history[0]?.type || '—'}</div>
                                </td>
                                <td className={`${TD_CLASS} max-w-[180px]`}>
                                    <div className="text-[11px] text-text-secondary truncate">{c.history[0]?.notes || '—'}</div>
                                </td>
                                {onQuickLog && currentUser.role === Role.OFFICER && (
                                    <td className={TD_CLASS} onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => onQuickLog(c.id, CRMStatus.NCC, SubStatus.RNR, 'Non Contact', 'Non Work', 'Ring no response')}
                                                title="Ring No Response" className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-100 text-red-700 hover:bg-red-200 transition">RNR</button>
                                            <button onClick={() => onQuickLog(c.id, CRMStatus.NCC, SubStatus.NOT_CONTACTABLE, 'Non Contact', 'Non Work', 'Not contactable')}
                                                title="Not Contactable" className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition">NC</button>
                                            <button onClick={() => onQuickLog(c.id, CRMStatus.NCC, SubStatus.VMAIL, 'Non Contact', 'Non Work', 'Left voicemail')}
                                                title="Left Voicemail" className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-sky-100 text-sky-700 hover:bg-sky-200 transition">LVM</button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        )
                    }) : (
                        <tr>
                            <td colSpan={isManager ? 13 : (onQuickLog ? 13 : 12)} className="p-4">
                                <EmptyState
                                    icon={ICONS.search('w-16 h-16')}
                                    title="No Cases Found"
                                    description="Your search and filter combination did not return any results. Try adjusting your criteria."
                                    action={<button onClick={handleClearAllFilters} className="btn-secondary px-4 py-2 text-sm">Clear All Filters</button>}
                                />
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>

            <div className="mt-4 flex items-center justify-between flex-shrink-0 pt-4 border-t border-border">
                <div className="flex items-center gap-4">
                <div className="text-sm text-text-secondary">
                    Showing <span className="font-medium text-text-primary">{filteredCases.length > 0 ? (currentPage - 1) * casesPerPage + 1 : 0}</span> to <span className="font-medium text-text-primary">{Math.min(currentPage * casesPerPage, filteredCases.length)}</span> of <span className="font-medium text-text-primary">{filteredCases.length}</span> results
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="cases-per-page" className="text-sm text-text-secondary">Per Page:</label>
                    <select id="cases-per-page" value={casesPerPage} onChange={e => setCasesPerPage(Number(e.target.value))} className="text-sm rounded-md p-1">
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
                        className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-text-secondary">Page {currentPage} of {totalPages}</span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
      </div>
    {selectedCaseIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-auto rounded-xl shadow-2xl z-50 flex items-center p-3 gap-3 animate-fade-in-up border" style={{ background: '#1B2A4A', borderColor: '#2D4470' }}>
            <span className="text-sm font-bold text-white px-2">{selectedCaseIds.length} selected</span>

            <div className="w-px h-8 bg-white/10" />

            {/* Bulk Quick Dispositions — available to ALL roles */}
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-blue-200/50 mr-1">Bulk:</span>
                {[
                    { label: 'RNR', color: 'bg-red-500' },
                    { label: 'SO', color: 'bg-orange-500' },
                    { label: 'NC', color: 'bg-gray-500' },
                    { label: 'LVM', color: 'bg-sky-500' },
                ].map(d => (
                    <button key={d.label} onClick={() => { alert(`Bulk ${d.label} applied to ${selectedCaseIds.length} cases`); setSelectedCaseIds([]); }}
                        className={`${d.color} text-white text-[10px] font-bold px-2 py-1 rounded transition hover:brightness-110`}>
                        {d.label}
                    </button>
                ))}
            </div>

            {isManager && (
                <>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="flex items-center gap-2">
                        <select
                            value={targetReassignOfficerId}
                            onChange={e => setTargetReassignOfficerId(e.target.value)}
                            className="text-xs rounded-md py-1.5 pl-2 pr-6 bg-white/10 text-white border-white/10"
                        >
                            <option value="" disabled>Reassign to...</option>
                            {coordinators?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button
                            onClick={handleBulkReassign}
                            disabled={!targetReassignOfficerId}
                            className="text-xs font-bold px-3 py-1.5 rounded-md text-white disabled:opacity-50"
                            style={{ background: '#F28C28' }}
                        >
                            Assign
                        </button>
                    </div>
                </>
            )}

            <button
                onClick={() => setIsConfirmInactiveOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-danger bg-danger/20 border border-danger/30 rounded-md hover:bg-danger/30"
            >
                Mark Inactive
            </button>

            <div className="h-8 border-l border-border"></div>

            <button onClick={() => setSelectedCaseIds([])} className="p-2 text-text-secondary hover:text-text-primary">
                {ICONS.close('w-5 h-5')}
            </button>
        </div>
    )}
    </div>
    {isBulkInactiveModalOpen && (
         <ImportCasesModal
            isOpen={isBulkInactiveModalOpen}
            onClose={() => setIsBulkInactiveModalOpen(false)}
            onImport={handleBulkImport}
            title="Bulk Inactivate Cases"
            instructions="Upload a text or CSV file with one Case ID per line. All found cases will be marked as inactive."
            fileType=".csv, .txt"
         />
    )}
    <ConfirmationModal
        isOpen={isConfirmReassignOpen}
        onClose={() => setIsConfirmReassignOpen(false)}
        onConfirm={confirmBulkReassign}
        title="Confirm Reassignment"
        message={<p>Are you sure you want to reassign <strong>{selectedCaseIds.length}</strong> cases?</p>}
        confirmText="Yes, Reassign"
    />
     <ConfirmationModal
        isOpen={isConfirmInactiveOpen}
        onClose={() => setIsConfirmInactiveOpen(false)}
        onConfirm={confirmBulkInactive}
        title="Confirm Inactivation"
        message={<p>Are you sure you want to mark <strong>{selectedCaseIds.length}</strong> cases as inactive? This will move them to the archive.</p>}
        confirmText="Yes, Mark as Inactive"
        confirmButtonClass="bg-danger hover:bg-red-700 text-white"
    />
    </>
  );
};
