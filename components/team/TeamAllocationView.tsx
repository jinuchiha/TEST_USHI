import React, { useState, useMemo } from 'react';
import { User, EnrichedCase } from '../../types';
import Card from '../shared/Card';
import { formatCurrency, formatDate, exportToCsv } from '../../utils';
import KpiCard from '../shared/KpiCard';
import { ICONS, UNASSIGNED_USER } from '../../constants';
import EmptyState from '../shared/EmptyState';

interface TeamAllocationViewProps {
  cases: EnrichedCase[];
  coordinators: User[];
  onSelectCase: (caseId: string) => void;
  onReassign: (caseIds: string[], newOfficerId: string) => void;
}

type SortableKey = 'debtor.name' | 'loan.bank' | 'loan.currentBalance' | 'creationDate';

const TeamAllocationView: React.FC<TeamAllocationViewProps> = ({ cases, coordinators, onSelectCase, onReassign }) => {
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [targetOfficerId, setTargetOfficerId] = useState<string>('');
  const [numCasesToAssign, setNumCasesToAssign] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'descending' | 'ascending' }>({ key: 'creationDate', direction: 'descending' });

  const requestSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

  const assignableCases = useMemo(() => {
    let sortedCases = cases.filter(c => c.statusCode === 'UNASSIGNED' || c.assignedOfficerId === UNASSIGNED_USER.id);

    if (sortConfig !== null) {
        sortedCases.sort((a, b) => {
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

    return sortedCases;
  }, [cases, sortConfig]);

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseIds(prev =>
      prev.includes(caseId) ? prev.filter(id => id !== caseId) : [...prev, caseId]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCaseIds(assignableCases.map(c => c.id));
    } else {
      setSelectedCaseIds([]);
    }
  };

  const handleAssign = () => {
    if (selectedCaseIds.length === 0 || !targetOfficerId) {
      alert('Please select at least one case and a coordinator to assign.');
      return;
    }
    onReassign(selectedCaseIds, targetOfficerId);
    setSelectedCaseIds([]);
    setTargetOfficerId('');
  };

  const handleAutoAssign = () => {
    if (numCasesToAssign <= 0 || coordinators.length === 0) {
        alert("Please enter a valid number of cases to assign and ensure there are coordinators available.");
        return;
    }

    const shuffledCases = [...assignableCases].sort(() => 0.5 - Math.random());
    let caseIndex = 0;

    if (shuffledCases.length < numCasesToAssign * coordinators.length) {
        if (!window.confirm("There aren't enough new cases to assign the desired amount to every coordinator. Continue with available cases?")) {
            return;
        }
    }
    
    coordinators.forEach(coordinator => {
        const casesForThisCoordinator = [];
        for (let i = 0; i < numCasesToAssign; i++) {
            if (caseIndex < shuffledCases.length) {
                casesForThisCoordinator.push(shuffledCases[caseIndex].id);
                caseIndex++;
            }
        }
        if (casesForThisCoordinator.length > 0) {
            onReassign(casesForThisCoordinator, coordinator.id);
        }
    });

    alert(`Auto-assignment process completed. ${caseIndex} cases were distributed.`);
    setSelectedCaseIds([]);
  };
  
  const handleExport = () => {
    const headers = {
        'debtor.name': 'Debtor',
        'loan.bank': 'Bank',
        'loan.currentBalance': 'O/S Balance',
        'loan.currency': 'Currency',
        'creationDate': 'Date Added',
        'statusCode': 'Reason'
    };
    exportToCsv(`unassigned_cases_${new Date().toISOString().split('T')[0]}`, assignableCases, headers);
  };

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted sticky top-0";
  const SORTABLE_TH_CLASS = `${TH_CLASS} cursor-pointer hover:bg-gray-100 transition-colors`;
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  const getSortIndicator = (key: SortableKey) => {
    if (sortConfig?.key !== key) return null;
    return <span className="ml-1 opacity-70">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="p-6 bg-background min-h-full">
        <div className="flex justify-between items-center mb-1">
            <h1 className="text-3xl font-bold text-text-primary">Case Allocation Tool</h1>
        </div>
      <p className="text-text-secondary mb-6">Assign new and unassigned cases to your coordinators.</p>
      
      <div className="mb-6">
        <KpiCard
          title="Unassigned Cases"
          value={assignableCases.length.toLocaleString()}
          icon={ICONS.case('w-7 h-7 text-warning')}
          valueColor="text-warning"
          iconBg="bg-warning/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <Card className="!p-0 flex flex-col h-[70vh]">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-text-primary">New Cases Queue ({assignableCases.length})</h2>
                    <button onClick={handleExport} className="px-3 py-1.5 text-xs font-medium text-text-primary bg-surface border border-border rounded-md shadow-sm hover:bg-surface-muted flex items-center gap-1.5">
                        Export List
                    </button>
                </div>
                <div className="overflow-y-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead>
                            <tr>
                                <th scope="col" className={`${TH_CLASS} w-10`}>
                                    <input type="checkbox" onChange={handleSelectAll} checked={selectedCaseIds.length === assignableCases.length && assignableCases.length > 0} className="rounded border-border text-accent shadow-sm focus:border-accent focus:ring focus:ring-offset-0 focus:ring-accent/50" />
                                </th>
                                <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('debtor.name')}>
                                    Debtor Name {getSortIndicator('debtor.name')}
                                </th>
                                <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.bank')}>
                                    Bank {getSortIndicator('loan.bank')}
                                </th>
                                <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('loan.currentBalance')}>
                                    O/S Balance {getSortIndicator('loan.currentBalance')}
                                </th>
                                <th scope="col" className={SORTABLE_TH_CLASS} onClick={() => requestSort('creationDate')}>
                                    Date Added {getSortIndicator('creationDate')}
                                </th>
                                <th scope="col" className={TH_CLASS}>
                                    Reason
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface divide-y divide-border">
                            {assignableCases.length > 0 ? assignableCases.map(c => (
                                <tr key={c.id} className={`${selectedCaseIds.includes(c.id) ? 'bg-accent/10' : ''} hover:bg-surface-muted`}>
                                    <td className={TD_CLASS}>
                                        <input type="checkbox" checked={selectedCaseIds.includes(c.id)} onChange={() => handleSelectCase(c.id)} className="rounded border-border text-accent shadow-sm focus:border-accent focus:ring focus:ring-offset-0 focus:ring-accent/50" />
                                    </td>
                                    <td className={`${TD_CLASS} font-medium text-text-primary cursor-pointer hover:text-accent`} onClick={() => onSelectCase(c.id)}>
                                        {c.debtor?.name || 'N/A'}
                                    </td>
                                    <td className={TD_CLASS}>{c.loan?.bank}</td>
                                    <td className={`${TD_CLASS} font-semibold text-red-600`}>{formatCurrency(c.loan?.currentBalance, c.loan?.currency)}</td>
                                    <td className={TD_CLASS}>{formatDate(c.creationDate)}</td>
                                    <td className={TD_CLASS}>
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            c.statusCode === 'NEW' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {c.statusCode}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="p-4">
                                        <EmptyState
                                            icon={ICONS.success('w-16 h-16')}
                                            title="Queue is Clear!"
                                            description="There are currently no unassigned cases waiting for allocation."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
        <div className="lg:col-span-1">
            <Card className="sticky top-6 p-6">
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-text-primary">Manual Assignment</h3>
                    <p className="text-sm text-text-secondary">
                        Selected Cases: <span className="font-bold text-primary text-lg">{selectedCaseIds.length}</span>
                    </p>
                    <div>
                        <label htmlFor="coordinator-select" className="block text-sm font-medium text-text-secondary mb-1">Assign To</label>
                        <select
                            id="coordinator-select"
                            value={targetOfficerId}
                            onChange={e => setTargetOfficerId(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2.5 text-text-primary bg-surface border-border focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md shadow-sm"
                        >
                            <option value="" disabled>Select a coordinator...</option>
                            {coordinators.map(coord => (
                                <option key={coord.id} value={coord.id}>{coord.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleAssign}
                        disabled={selectedCaseIds.length === 0 || !targetOfficerId}
                        className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Assign Case(s)
                    </button>
                </div>

                <hr className="my-6 border-border" />

                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-text-primary">Auto-Assign</h3>
                    <div>
                        <label htmlFor="num-cases" className="block text-sm font-medium text-text-secondary mb-1">No. of cases per officer</label>
                        <input
                            type="number"
                            id="num-cases"
                            value={numCasesToAssign}
                            onChange={e => setNumCasesToAssign(parseInt(e.target.value, 10))}
                            className="mt-1 block w-full shadow-sm sm:text-sm border-border bg-surface rounded-md p-2.5"
                            placeholder="10"
                        />
                    </div>
                     <button
                        onClick={handleAutoAssign}
                        disabled={assignableCases.length === 0}
                        className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-success hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Assign Randomly & Equally
                    </button>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default TeamAllocationView;