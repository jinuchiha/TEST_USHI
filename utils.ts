import { CRMStatus, Loan, SubStatus } from './types';

export const formatDate = (isoString: string | null | undefined): string => {
    if (!isoString) return 'N/A';
    try {
        // Check for YYYY-MM-DD format which might not parse correctly as UTC on all browsers
        if (isoString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            isoString = `${isoString}T00:00:00Z`;
        }
        const date = new Date(isoString);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }); // e.g., "2 Sep 2025"
    } catch (e) {
        return 'Invalid Date';
    }
};


export const getAge = (dobString: string | null | undefined): number | string => {
    if (!dobString) return 'N/A';
    const birthDate = new Date(dobString);
    const today = new Date();
    if (isNaN(birthDate.getTime())) return 'N/A';
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

export const formatCurrency = (amount: number | null | undefined, currency: string | null | undefined): string => {
    if (amount === null || typeof amount === 'undefined' || isNaN(amount)) return 'N/A';
    const finalCurrency = currency || 'AED';
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
    return `${finalCurrency} ${formatted}`;
};

export const EXCHANGE_RATES: Record<string, number> = {
  'AED': 1,
  'SAR': 0.98,
  'BHD': 9.74,
  'KWD': 11.95,
  'QAR': 1.01,
  'OMR': 9.55,
  'EGP': 0.071,
  'JOD': 5.18,
  'USD': 3.67,
};

export const convertToAED = (amount: number, currency: Loan['currency']): number => {
  return amount * (EXCHANGE_RATES[currency] || 1);
};

export const getExchangeRateDate = (): string => {
  return '1 April 2026';
};

export const formatCurrencyOriginal = (amount: number | null | undefined, currency: string | null | undefined): string => {
  if (amount === null || typeof amount === 'undefined' || isNaN(amount)) return 'N/A';
  const finalCurrency = currency || 'AED';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${finalCurrency} ${formatted}`;
};

export const getAllCurrencies = (): string[] => {
  return Object.keys(EXCHANGE_RATES);
};


export const getStatusPillClasses = (status: CRMStatus | string) => {
    const lowerStatus = status ? String(status).toLowerCase() : '';
    switch(lowerStatus) {
        case 'dispute':
        case 'nitp':
        case 'expire':
             return 'pill-danger';
        case 'under nego':
        case 'fip':
        case 'wip':
        case 'wds':
            return 'pill-warning';
        case 'ptp':
        case 'closed':
             return 'pill-success';
        case 'cb':
        case 'ncc':
        case 'utr':
        case 'dxb':
            return 'pill-primary';
        case 'withdrawn':
        case 'nip':
        default:
             return 'pill-secondary';
    }
};

export const getSubStatusPillClasses = (status: SubStatus | string) => {
    const lowerStatus = status ? String(status).toLowerCase() : '';
     if (lowerStatus.includes('paid')) {
        return 'pill-success';
    }
    if (lowerStatus.includes('promise') || lowerStatus.includes('negotiation') || lowerStatus.includes('follow up')) {
        return 'pill-primary';
    }
    if (lowerStatus.includes('issue') || lowerStatus.includes('refuse') || lowerStatus.includes('not intrested') || lowerStatus.includes('return')) {
         return 'pill-danger';
    }
    if (lowerStatus.includes('tracing') || lowerStatus.includes('process') || lowerStatus.includes('mail')) {
        return 'pill-warning';
    }
    return 'pill-secondary';
};


export const getStatusPillStyle = (status: 'PTP' | 'Under Nego' | 'Follow Up' | 'WIP'): string => {
    switch (status) {
        case 'PTP':
            return 'bg-pill-green-bg text-pill-green-text';
        case 'Under Nego':
            return 'bg-pill-orange-bg text-pill-orange-text';
        case 'Follow Up':
            return 'bg-pill-blue-bg text-pill-blue-text';
        case 'WIP':
            return 'bg-pill-red-bg text-pill-red-text';
        default:
            return 'bg-gray-200 text-gray-800';
    }
};

const escapeCsvCell = (cellData: any): string => {
    const stringData = String(cellData ?? '');
    if (stringData.includes('"') || stringData.includes(',') || stringData.includes('\n')) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
};

export const exportToCsv = (filename: string, rows: object[], headers: Record<string, string>) => {
    const headerKeys = Object.keys(headers);
    const headerValues = Object.values(headers);

    let csvContent = "data:text/csv;charset=utf-8," + headerValues.map(escapeCsvCell).join(',') + '\r\n';

    rows.forEach(row => {
        const rowValues = headerKeys.map(key => {
            const value = key.split('.').reduce((o: any, i) => (o ? o[i] : ''), row);
            return escapeCsvCell(value);
        });
        csvContent += rowValues.join(',') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });