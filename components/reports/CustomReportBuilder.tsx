import React, { useState, useMemo, useCallback } from 'react';
import { EnrichedCase, User, CRMStatus, Role } from '../../types';
import { formatCurrency } from '../../utils';

interface CustomReportBuilderProps {
  cases: EnrichedCase[];
  coordinators: User[];
  currentUser: User;
}

type DataSource = 'cases' | 'officers' | 'banks' | 'payments' | 'ptps';
type GroupBy = 'none' | 'bank' | 'officer' | 'crmStatus' | 'product' | 'month';
type Aggregation = 'sum' | 'average' | 'count' | 'min' | 'max';

interface ColumnDef {
  key: string;
  label: string;
  numeric?: boolean;
  accessor: (c: EnrichedCase) => string | number;
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  crmStatuses: CRMStatus[];
  banks: string[];
  officers: string[];
  balanceMin: string;
  balanceMax: string;
  dpdMin: string;
  dpdMax: string;
}

interface SavedReport {
  id: string;
  name: string;
  createdAt: string;
  lastRun: string;
  selectedColumns: string[];
  filters: ReportFilters;
  dataSources: DataSource[];
  groupBy: GroupBy;
  aggregation: Aggregation;
}

const STORAGE_KEY = 'rv_custom_reports';

const getDPD = (c: EnrichedCase): number => {
  if (!c.loan.lpd) return 0;
  const lpd = new Date(c.loan.lpd);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - lpd.getTime()) / 86400000));
};

const getDaysSinceContact = (c: EnrichedCase): number => {
  if (!c.lastContactDate) return 999;
  const lcd = new Date(c.lastContactDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - lcd.getTime()) / 86400000));
};

const getPTPCount = (c: EnrichedCase): number =>
  c.history.filter(a => a.promisedAmount && a.promisedAmount > 0).length;

const getPTPAmount = (c: EnrichedCase): number =>
  c.history.filter(a => a.promisedAmount).reduce((s, a) => s + (a.promisedAmount || 0), 0);

const getBrokenPTPCount = (c: EnrichedCase): number => {
  return c.history.filter(a => {
    if (!a.promisedDate || !a.promisedAmount) return false;
    const promised = new Date(a.promisedDate);
    return promised < new Date() && c.crmStatus !== CRMStatus.CLOSED;
  }).length;
};

const getTotalPayments = (c: EnrichedCase): number =>
  c.history.filter(a => a.amountPaid).reduce((s, a) => s + (a.amountPaid || 0), 0);

const getPaymentCount = (c: EnrichedCase): number =>
  c.history.filter(a => a.amountPaid && a.amountPaid > 0).length;

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'debtorName', label: 'Debtor Name', accessor: c => c.debtor.name },
  { key: 'accountNumber', label: 'Account Number', accessor: c => c.loan.accountNumber },
  { key: 'bank', label: 'Bank', accessor: c => c.loan.bank },
  { key: 'product', label: 'Product', accessor: c => c.loan.product },
  { key: 'subProduct', label: 'Sub Product', accessor: c => c.loan.subProduct },
  { key: 'outstandingBalance', label: 'Outstanding Balance', numeric: true, accessor: c => c.loan.currentBalance },
  { key: 'originalAmount', label: 'Original Amount', numeric: true, accessor: c => c.loan.originalAmount },
  { key: 'currency', label: 'Currency', accessor: c => c.loan.currency },
  { key: 'crmStatus', label: 'CRM Status', accessor: c => c.crmStatus },
  { key: 'subStatus', label: 'Sub Status', accessor: c => c.subStatus },
  { key: 'contactStatus', label: 'Contact Status', accessor: c => c.contactStatus },
  { key: 'workStatus', label: 'Work Status', accessor: c => c.workStatus },
  { key: 'dpd', label: 'DPD', numeric: true, accessor: c => getDPD(c) },
  { key: 'lpd', label: 'LPD', accessor: c => c.loan.lpd || 'N/A' },
  { key: 'creationDate', label: 'Creation Date', accessor: c => c.creationDate },
  { key: 'lastContactDate', label: 'Last Contact Date', accessor: c => c.lastContactDate || 'N/A' },
  { key: 'officerName', label: 'Officer Name', accessor: c => c.officer.name },
  { key: 'agentCode', label: 'Agent Code', accessor: c => c.officer.agentCode || 'N/A' },
  { key: 'totalPayments', label: 'Total Payments', numeric: true, accessor: c => getTotalPayments(c) },
  { key: 'paymentCount', label: 'Payment Count', numeric: true, accessor: c => getPaymentCount(c) },
  { key: 'ptpCount', label: 'PTP Count', numeric: true, accessor: c => getPTPCount(c) },
  { key: 'ptpAmount', label: 'PTP Amount', numeric: true, accessor: c => getPTPAmount(c) },
  { key: 'brokenPtpCount', label: 'Broken PTP Count', numeric: true, accessor: c => getBrokenPTPCount(c) },
  { key: 'tracingStatus', label: 'Tracing Status', accessor: c => c.tracingStatus || 'N/A' },
  { key: 'cyber', label: 'Cyber', accessor: c => c.cyber },
  { key: 'statusCode', label: 'Status Code', accessor: c => c.statusCode || 'N/A' },
];

const TEMPLATES: { name: string; columns: string[]; filters?: Partial<ReportFilters> }[] = [
  {
    name: 'Officer Daily Performance',
    columns: ['officerName', 'crmStatus', 'ptpCount', 'totalPayments', 'paymentCount'],
  },
  {
    name: 'Bank-wise Outstanding',
    columns: ['bank', 'accountNumber', 'outstandingBalance', 'dpd', 'crmStatus'],
  },
  {
    name: 'PTP Tracker',
    columns: ['debtorName', 'accountNumber', 'ptpAmount', 'ptpCount', 'crmStatus', 'officerName'],
  },
  {
    name: 'High Value Cases',
    columns: ['debtorName', 'bank', 'outstandingBalance', 'dpd', 'crmStatus', 'officerName'],
  },
  {
    name: 'Stale Cases',
    columns: ['debtorName', 'bank', 'lastContactDate', 'crmStatus', 'officerName', 'dpd'],
  },
];

const ITEMS_PER_PAGE = 15;

const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({ cases, coordinators, currentUser }) => {
  const [dataSources, setDataSources] = useState<DataSource[]>(['cases']);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['debtorName', 'accountNumber', 'bank', 'outstandingBalance', 'crmStatus']);
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: '', dateTo: '', crmStatuses: [], banks: [], officers: [],
    balanceMin: '', balanceMax: '', dpdMin: '', dpdMax: '',
  });
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [aggregation, setAggregation] = useState<Aggregation>('sum');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [reportName, setReportName] = useState('');
  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [activePanel, setActivePanel] = useState<'config' | 'saved'>('config');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const allBanks = useMemo(() => [...new Set(cases.map(c => c.loan.bank))].sort(), [cases]);
  const allStatuses = useMemo(() => Object.values(CRMStatus), []);

  const toggleDataSource = (ds: DataSource) => {
    setDataSources(prev => prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds]);
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    setSelectedColumns(prev => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  const toggleFilterStatus = (status: CRMStatus) => {
    setFilters(prev => ({
      ...prev,
      crmStatuses: prev.crmStatuses.includes(status)
        ? prev.crmStatuses.filter(s => s !== status)
        : [...prev.crmStatuses, status],
    }));
  };

  const toggleFilterBank = (bank: string) => {
    setFilters(prev => ({
      ...prev,
      banks: prev.banks.includes(bank) ? prev.banks.filter(b => b !== bank) : [...prev.banks, bank],
    }));
  };

  const toggleFilterOfficer = (id: string) => {
    setFilters(prev => ({
      ...prev,
      officers: prev.officers.includes(id) ? prev.officers.filter(o => o !== id) : [...prev.officers, id],
    }));
  };

  const filteredCases = useMemo(() => {
    let result = [...cases];
    if (filters.dateFrom) result = result.filter(c => c.creationDate >= filters.dateFrom);
    if (filters.dateTo) result = result.filter(c => c.creationDate <= filters.dateTo);
    if (filters.crmStatuses.length > 0) result = result.filter(c => filters.crmStatuses.includes(c.crmStatus));
    if (filters.banks.length > 0) result = result.filter(c => filters.banks.includes(c.loan.bank));
    if (filters.officers.length > 0) result = result.filter(c => filters.officers.includes(c.assignedOfficerId));
    if (filters.balanceMin) result = result.filter(c => c.loan.currentBalance >= Number(filters.balanceMin));
    if (filters.balanceMax) result = result.filter(c => c.loan.currentBalance <= Number(filters.balanceMax));
    if (filters.dpdMin) result = result.filter(c => getDPD(c) >= Number(filters.dpdMin));
    if (filters.dpdMax) result = result.filter(c => getDPD(c) <= Number(filters.dpdMax));
    return result;
  }, [cases, filters]);

  const columnDefs = useMemo(() =>
    selectedColumns.map(k => ALL_COLUMNS.find(c => c.key === k)!).filter(Boolean),
    [selectedColumns]
  );

  const sortedData = useMemo(() => {
    const data = [...filteredCases];
    if (!sortColumn) return data;
    const col = ALL_COLUMNS.find(c => c.key === sortColumn);
    if (!col) return data;
    data.sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return data;
  }, [filteredCases, sortColumn, sortDir]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, EnrichedCase[]> = {};
    sortedData.forEach(c => {
      let key: string;
      switch (groupBy) {
        case 'bank': key = c.loan.bank; break;
        case 'officer': key = c.officer.name; break;
        case 'crmStatus': key = c.crmStatus; break;
        case 'product': key = c.loan.product; break;
        case 'month': key = c.creationDate ? c.creationDate.substring(0, 7) : 'Unknown'; break;
        default: key = 'All';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return groups;
  }, [sortedData, groupBy]);

  const computeAgg = useCallback((items: EnrichedCase[], col: ColumnDef): string => {
    if (!col.numeric) return `${items.length} records`;
    const vals = items.map(i => Number(col.accessor(i))).filter(v => !isNaN(v));
    if (vals.length === 0) return 'N/A';
    switch (aggregation) {
      case 'sum': return formatCurrency(vals.reduce((a, b) => a + b, 0), 'AED');
      case 'average': return formatCurrency(vals.reduce((a, b) => a + b, 0) / vals.length, 'AED');
      case 'count': return String(vals.length);
      case 'min': return formatCurrency(Math.min(...vals), 'AED');
      case 'max': return formatCurrency(Math.max(...vals), 'AED');
      default: return 'N/A';
    }
  }, [aggregation]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const pagedData = sortedData.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const saveReport = () => {
    if (!reportName.trim()) return;
    const report: SavedReport = {
      id: Date.now().toString(),
      name: reportName.trim(),
      createdAt: new Date().toISOString(),
      lastRun: new Date().toISOString(),
      selectedColumns, filters, dataSources, groupBy, aggregation,
    };
    const updated = [...savedReports, report];
    setSavedReports(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setReportName('');
  };

  const loadReport = (report: SavedReport) => {
    setSelectedColumns(report.selectedColumns);
    setFilters(report.filters);
    setDataSources(report.dataSources);
    setGroupBy(report.groupBy);
    setAggregation(report.aggregation);
    const updated = savedReports.map(r => r.id === report.id ? { ...r, lastRun: new Date().toISOString() } : r);
    setSavedReports(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setActivePanel('config');
    setPage(0);
  };

  const deleteReport = (id: string) => {
    const updated = savedReports.filter(r => r.id !== id);
    setSavedReports(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const loadTemplate = (template: typeof TEMPLATES[number]) => {
    setSelectedColumns(template.columns);
    if (template.filters) setFilters(prev => ({ ...prev, ...template.filters }));
    setPage(0);
  };

  const exportCSV = () => {
    const header = columnDefs.map(c => c.label).join(',');
    const rows = sortedData.map(row =>
      columnDefs.map(col => {
        const val = col.accessor(row);
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const tableHTML = `
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:11px;">
        <thead><tr style="background:#1a365d;color:#fff;">
          ${columnDefs.map(c => `<th>${c.label}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${sortedData.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#f7fafc' : '#fff'}">
            ${columnDefs.map(col => {
              const v = col.accessor(row);
              return `<td>${col.numeric ? formatCurrency(Number(v), 'AED') : v}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>`;
    printWin.document.write(`<!DOCTYPE html><html><head><title>RecoVantage Custom Report</title></head><body>
      <h1 style="font-family:Arial;">RecoVantage - Custom Report</h1>
      <p style="font-family:Arial;color:#666;">Generated: ${new Date().toLocaleString()} | Records: ${sortedData.length}</p>
      ${tableHTML}</body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const renderCell = (col: ColumnDef, row: EnrichedCase) => {
    const val = col.accessor(row);
    if (col.numeric && col.key !== 'dpd' && col.key !== 'paymentCount' && col.key !== 'ptpCount' && col.key !== 'brokenPtpCount') {
      return formatCurrency(Number(val), 'AED');
    }
    return String(val);
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', minHeight: 0 }}>
      {/* LEFT PANEL */}
      <div style={{
        width: '340px', minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '0.5rem',
        overflowY: 'auto', background: 'var(--color-surface)', borderRadius: '0.75rem',
        border: '1px solid var(--color-border)', padding: '1rem',
      }}>
        {/* Panel tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
          {(['config', 'saved'] as const).map(tab => (
            <button key={tab} onClick={() => setActivePanel(tab)} style={{
              flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s',
              background: activePanel === tab ? 'var(--color-primary)' : 'var(--color-surface-alt)',
              color: activePanel === tab ? 'var(--color-primary-text)' : 'var(--color-text-secondary)',
            }}>{tab === 'config' ? 'Configure' : `Saved (${savedReports.length})`}</button>
          ))}
        </div>

        {activePanel === 'config' ? (
          <>
            {/* Data Sources */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', color: 'var(--color-text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>Data Sources</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {(['cases', 'officers', 'banks', 'payments', 'ptps'] as DataSource[]).map(ds => (
                  <label key={ds} style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem', borderRadius: '0.375rem', cursor: 'pointer',
                    background: dataSources.includes(ds) ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
                    color: dataSources.includes(ds) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    border: `1px solid ${dataSources.includes(ds) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}>
                    <input type="checkbox" checked={dataSources.includes(ds)} onChange={() => toggleDataSource(ds)}
                      style={{ width: '12px', height: '12px' }} />
                    {ds.charAt(0).toUpperCase() + ds.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Templates */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', color: 'var(--color-text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>Quick Templates</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {TEMPLATES.map(t => (
                  <button key={t.name} onClick={() => loadTemplate(t)} style={{
                    padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)',
                    fontSize: '0.72rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface-alt)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                  >{t.name}</button>
                ))}
              </div>
            </div>

            {/* Available Columns */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', color: 'var(--color-text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                Columns ({selectedColumns.length} selected)
              </h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {ALL_COLUMNS.map(col => {
                  const isSelected = selectedColumns.includes(col.key);
                  return (
                    <button key={col.key} onClick={() => toggleColumn(col.key)} style={{
                      padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
                      fontSize: '0.72rem', textAlign: 'left', transition: 'all 0.15s',
                      background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      fontWeight: isSelected ? 600 : 400,
                    }}>
                      {isSelected ? '\u2713 ' : '+ '}{col.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected column order */}
            {selectedColumns.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.4rem', color: 'var(--color-text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>Column Order</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {selectedColumns.map((key, idx) => {
                    const col = ALL_COLUMNS.find(c => c.key === key);
                    return (
                      <div key={key} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.25rem 0.4rem', background: 'var(--color-surface-alt)', borderRadius: '0.25rem', fontSize: '0.72rem',
                      }}>
                        <span style={{ color: 'var(--color-text-primary)' }}>{col?.label}</span>
                        <span style={{ display: 'flex', gap: '2px' }}>
                          <button onClick={() => moveColumn(idx, 'up')} disabled={idx === 0} style={{
                            border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer',
                            color: idx === 0 ? 'var(--color-text-muted)' : 'var(--color-primary)', fontSize: '0.75rem', padding: '0 4px',
                          }}>{'\u25B2'}</button>
                          <button onClick={() => moveColumn(idx, 'down')} disabled={idx === selectedColumns.length - 1} style={{
                            border: 'none', background: 'none', cursor: idx === selectedColumns.length - 1 ? 'default' : 'pointer',
                            color: idx === selectedColumns.length - 1 ? 'var(--color-text-muted)' : 'var(--color-primary)', fontSize: '0.75rem', padding: '0 4px',
                          }}>{'\u25BC'}</button>
                          <button onClick={() => toggleColumn(key)} style={{
                            border: 'none', background: 'none', cursor: 'pointer',
                            color: 'var(--color-danger)', fontSize: '0.75rem', padding: '0 4px',
                          }}>{'\u2715'}</button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', color: 'var(--color-text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>Filters</h4>
              {/* Date range */}
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <input type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                  style={{ flex: 1, padding: '0.3rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.7rem' }}
                  placeholder="From" />
                <input type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
                  style={{ flex: 1, padding: '0.3rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.7rem' }}
                  placeholder="To" />
              </div>
              {/* Balance range */}
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Balance Range (AED)</label>
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <input type="number" value={filters.balanceMin} onChange={e => setFilters(p => ({ ...p, balanceMin: e.target.value }))}
                  placeholder="Min" style={{ flex: 1, padding: '0.3rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.7rem' }} />
                <input type="number" value={filters.balanceMax} onChange={e => setFilters(p => ({ ...p, balanceMax: e.target.value }))}
                  placeholder="Max" style={{ flex: 1, padding: '0.3rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.7rem' }} />
              </div>
              {/* DPD range */}
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>DPD Range</label>
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <input type="number" value={filters.dpdMin} onChange={e => setFilters(p => ({ ...p, dpdMin: e.target.value }))}
                  placeholder="Min" style={{ flex: 1, padding: '0.3rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.7rem' }} />
                <input type="number" value={filters.dpdMax} onChange={e => setFilters(p => ({ ...p, dpdMax: e.target.value }))}
                  placeholder="Max" style={{ flex: 1, padding: '0.3rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.7rem' }} />
              </div>
              {/* CRM Status multi-select */}
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>CRM Status</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '0.4rem', maxHeight: '80px', overflowY: 'auto' }}>
                {allStatuses.map(s => (
                  <button key={s} onClick={() => toggleFilterStatus(s)} style={{
                    padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.65rem', cursor: 'pointer',
                    border: `1px solid ${filters.crmStatuses.includes(s) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: filters.crmStatuses.includes(s) ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
                    color: filters.crmStatuses.includes(s) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  }}>{s}</button>
                ))}
              </div>
              {/* Bank multi-select */}
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Bank</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '0.4rem', maxHeight: '80px', overflowY: 'auto' }}>
                {allBanks.map(b => (
                  <button key={b} onClick={() => toggleFilterBank(b)} style={{
                    padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.65rem', cursor: 'pointer',
                    border: `1px solid ${filters.banks.includes(b) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: filters.banks.includes(b) ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
                    color: filters.banks.includes(b) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  }}>{b}</button>
                ))}
              </div>
              {/* Officer multi-select */}
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Officer</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxHeight: '80px', overflowY: 'auto' }}>
                {coordinators.map(o => (
                  <button key={o.id} onClick={() => toggleFilterOfficer(o.id)} style={{
                    padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.65rem', cursor: 'pointer',
                    border: `1px solid ${filters.officers.includes(o.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: filters.officers.includes(o.id) ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
                    color: filters.officers.includes(o.id) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  }}>{o.name}</button>
                ))}
              </div>
            </div>

            {/* Grouping */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', color: 'var(--color-text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>Group By</h4>
              <select value={groupBy} onChange={e => { setGroupBy(e.target.value as GroupBy); setPage(0); }} style={{
                width: '100%', padding: '0.35rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.75rem',
              }}>
                <option value="none">None</option>
                <option value="bank">Bank</option>
                <option value="officer">Officer</option>
                <option value="crmStatus">CRM Status</option>
                <option value="product">Product</option>
                <option value="month">Month</option>
              </select>
            </div>

            {/* Aggregation */}
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.4rem', color: 'var(--color-text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>Aggregation</h4>
              <select value={aggregation} onChange={e => setAggregation(e.target.value as Aggregation)} style={{
                width: '100%', padding: '0.35rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '0.75rem',
              }}>
                <option value="sum">Sum</option>
                <option value="average">Average</option>
                <option value="count">Count</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
              </select>
            </div>
          </>
        ) : (
          /* SAVED REPORTS PANEL */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {savedReports.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '2rem 0' }}>
                No saved reports yet. Configure and save your first report.
              </p>
            ) : savedReports.map(r => (
              <div key={r.id} style={{
                padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)',
                background: 'var(--color-surface-alt)', cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div onClick={() => loadReport(r)} style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>{r.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                      {r.selectedColumns.length} columns | Created {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                      Last run: {new Date(r.lastRun).toLocaleString()}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteReport(r.id); }} style={{
                    border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-danger)',
                    fontSize: '0.85rem', padding: '0 0.25rem',
                  }}>{'\u2715'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL - Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
        {/* Actions bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          padding: '0.75rem 1rem', background: 'var(--color-surface)', borderRadius: '0.75rem',
          border: '1px solid var(--color-border)',
        }}>
          <input type="text" value={reportName} onChange={e => setReportName(e.target.value)}
            placeholder="Report name..." style={{
              padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
              background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.8rem', width: '180px',
            }} />
          <button onClick={saveReport} disabled={!reportName.trim()} style={{
            padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: 'none', cursor: reportName.trim() ? 'pointer' : 'default',
            background: reportName.trim() ? 'var(--color-primary)' : 'var(--color-surface-alt)',
            color: reportName.trim() ? 'var(--color-primary-text)' : 'var(--color-text-muted)',
            fontSize: '0.78rem', fontWeight: 600,
          }}>Save</button>
          <div style={{ flex: 1 }} />
          <button onClick={exportCSV} style={{
            padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
            background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500,
          }}>Export CSV</button>
          <button onClick={exportPDF} style={{
            padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
            background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500,
          }}>Export PDF</button>
          <button onClick={() => setShowScheduleModal(true)} style={{
            padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
            background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500,
          }}>Schedule</button>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
            {sortedData.length} records
          </span>
        </div>

        {/* Preview Table */}
        <div style={{
          flex: 1, overflow: 'auto', background: 'var(--color-surface)', borderRadius: '0.75rem',
          border: '1px solid var(--color-border)',
        }}>
          {selectedColumns.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '3rem' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                Select columns from the left panel to build your report, or pick a quick template to get started.
              </p>
            </div>
          ) : groupBy !== 'none' && groupedData ? (
            /* Grouped view */
            <div style={{ padding: '0.5rem' }}>
              {Object.entries(groupedData).map(([groupKey, items]) => (
                <div key={groupKey} style={{ marginBottom: '1rem' }}>
                  <div style={{
                    padding: '0.5rem 0.75rem', background: 'var(--color-primary-light)',
                    borderRadius: '0.5rem 0.5rem 0 0', fontWeight: 700, fontSize: '0.82rem',
                    color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{groupKey}</span>
                    <span style={{ fontWeight: 500 }}>{items.length} cases</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                    <thead>
                      <tr>
                        {columnDefs.map(col => (
                          <th key={col.key} onClick={() => handleSort(col.key)} style={{
                            padding: '0.4rem 0.5rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none',
                            background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)', fontWeight: 600,
                            borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap',
                          }}>
                            {col.label} {sortColumn === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, 10).map((row, i) => (
                        <tr key={row.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-alt)' }}>
                          {columnDefs.map(col => (
                            <td key={col.key} style={{
                              padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)', whiteSpace: 'nowrap',
                            }}>{renderCell(col, row)}</td>
                          ))}
                        </tr>
                      ))}
                      {items.length > 10 && (
                        <tr><td colSpan={columnDefs.length} style={{
                          padding: '0.3rem 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.7rem', fontStyle: 'italic',
                        }}>... and {items.length - 10} more rows</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--color-surface-alt)', fontWeight: 700 }}>
                        {columnDefs.map(col => (
                          <td key={col.key} style={{
                            padding: '0.4rem 0.5rem', color: 'var(--color-primary)', fontSize: '0.72rem',
                            borderTop: '2px solid var(--color-border)',
                          }}>{computeAgg(items, col)}</td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            /* Flat table view */
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    {columnDefs.map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} style={{
                        padding: '0.5rem 0.6rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none',
                        background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)',
                        fontWeight: 600, borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap',
                      }}>
                        {col.label} {sortColumn === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((row, i) => (
                    <tr key={row.id} style={{
                      background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-alt)',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--color-surface-alt)'; }}
                    >
                      {columnDefs.map(col => (
                        <td key={col.key} style={{
                          padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)', whiteSpace: 'nowrap', maxWidth: '200px',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{renderCell(col, row)}</td>
                      ))}
                    </tr>
                  ))}
                  {pagedData.length === 0 && (
                    <tr><td colSpan={columnDefs.length} style={{
                      padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)',
                    }}>No data matches current filters.</td></tr>
                  )}
                </tbody>
              </table>
              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.75rem', borderTop: '1px solid var(--color-border)',
                }}>
                  <button onClick={() => setPage(0)} disabled={page === 0} style={{
                    padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-alt)', color: page === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    cursor: page === 0 ? 'default' : 'pointer', fontSize: '0.72rem',
                  }}>{'\u00AB'} First</button>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{
                    padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-alt)', color: page === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    cursor: page === 0 ? 'default' : 'pointer', fontSize: '0.72rem',
                  }}>{'\u2039'} Prev</button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{
                    padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-alt)', color: page >= totalPages - 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: '0.72rem',
                  }}>Next {'\u203A'}</button>
                  <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} style={{
                    padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-alt)', color: page >= totalPages - 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: '0.72rem',
                  }}>Last {'\u00BB'}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setShowScheduleModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '1.5rem',
            border: '1px solid var(--color-border)', width: '380px', maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 1rem', color: 'var(--color-text-primary)', fontSize: '1rem' }}>Schedule Report Delivery</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Frequency</label>
                <select style={{
                  width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.8rem',
                }}>
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Recipients (email)</label>
                <input type="text" placeholder="email@example.com" style={{
                  width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.8rem', boxSizing: 'border-box',
                }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Format</label>
                <select style={{
                  width: '100%', padding: '0.4rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.8rem',
                }}>
                  <option>CSV</option>
                  <option>PDF</option>
                </select>
              </div>
              <div style={{
                padding: '0.6rem', borderRadius: '0.375rem', background: 'var(--color-warning-light)',
                border: '1px solid var(--color-warning)', fontSize: '0.72rem', color: 'var(--color-text-primary)',
              }}>
                Scheduled delivery is coming soon. This feature will allow automatic email delivery of configured reports.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => setShowScheduleModal(false)} style={{
                padding: '0.4rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)',
                background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)', fontSize: '0.8rem', cursor: 'pointer',
              }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReportBuilder;
