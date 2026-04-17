import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import Card from '../shared/Card';
import { ICONS } from '../../constants';
import { formatCurrency, convertToAED, formatDate, getAge } from '../../utils';

interface CaseSearchViewProps {
  allCases: EnrichedCase[];
  coordinators: User[];
  onSelectCase: (caseId: string) => void;
  currentUser: User;
}

const initialSearchParams = {
    caseName: '',
    passportNo: '',
    accountNo: '',
    bucketOrRecovery: '',
    company: '',
    sortBy: '',
    osAedValue: '',
    osAedOperator: '>=',
    contactDetails: '',
    assignedTo: 'all',
    onlyMyItems: false,
    myFavouriteList: false,
    sortOrder: '',
    mobile: '',
    caseType: '',
};

const FormInput: React.FC<{label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string}> = ({ label, name, value, onChange, type = "text"}) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-subtle-text">{label}</label>
        <input id={name} name={name} value={value} onChange={onChange} type={type} className="mt-1 block w-full shadow-sm sm:text-sm border-border-color rounded-md" />
    </div>
);

const FormSelect: React.FC<{label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, children: React.ReactNode}> = ({ label, name, value, onChange, children }) => (
     <div>
        <label htmlFor={name} className="block text-sm font-medium text-subtle-text">{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border-color sm:text-sm rounded-md">
            {children}
        </select>
    </div>
);


const CaseSearchView: React.FC<CaseSearchViewProps> = ({ allCases, coordinators, onSelectCase, currentUser }) => {
    const [activeTab, setActiveTab] = useState('General');
    const [searchParams, setSearchParams] = useState(initialSearchParams);
    const [filteredCases, setFilteredCases] = useState<EnrichedCase[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [casesPerPage] = useState(20);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setSearchParams(prev => ({ ...prev, [name]: checked }));
        } else {
            setSearchParams(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSearch = () => {
        let results = [...allCases];
        
        if (searchParams.caseName) {
            results = results.filter(c => c.debtor.name.toLowerCase().includes(searchParams.caseName.toLowerCase()));
        }
        if (searchParams.passportNo) {
             results = results.filter(c => c.debtor.passport?.toLowerCase().includes(searchParams.passportNo.toLowerCase()));
        }
        if (searchParams.accountNo) {
             results = results.filter(c => c.loan.accountNumber.toLowerCase().includes(searchParams.accountNo.toLowerCase()));
        }
        if (searchParams.mobile) {
             // FIX: Changed to search the `phones` array instead of the non-existent `phone` property.
             results = results.filter(c => c.debtor.phones?.some(phone => phone.includes(searchParams.mobile)));
        }
         if (currentUser.role !== Role.OFFICER && searchParams.assignedTo !== 'all') {
             results = results.filter(c => c.assignedOfficerId === searchParams.assignedTo);
        }
        if (searchParams.onlyMyItems || currentUser.role === Role.OFFICER) {
            results = results.filter(c => c.assignedOfficerId === currentUser.id);
        }
        if (searchParams.osAedValue) {
            const val = parseFloat(searchParams.osAedValue);
            if (!isNaN(val)) {
                results = results.filter(c => {
                    const balance = convertToAED(c.loan.currentBalance, c.loan.currency);
                    switch (searchParams.osAedOperator) {
                        case '>=': return balance >= val;
                        case '<=': return balance <= val;
                        case '=': return balance === val;
                        default: return true;
                    }
                });
            }
        }

        setFilteredCases(results);
        setHasSearched(true);
        setCurrentPage(1);
    };

    const handleClear = () => {
        setSearchParams(initialSearchParams);
        setFilteredCases([]);
        setHasSearched(false);
        setCurrentPage(1);
    };
    
    const totalSumAED = useMemo(() => {
        return filteredCases.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);
    }, [filteredCases]);

    const paginatedCases = useMemo(() => {
        const startIndex = (currentPage - 1) * casesPerPage;
        return filteredCases.slice(startIndex, startIndex + casesPerPage);
    }, [filteredCases, currentPage, casesPerPage]);

    const totalPages = Math.ceil(filteredCases.length / casesPerPage);

    const tabs = ['General', 'Bank Center', 'Other Search', 'Date Search', 'Bucket Search', 'Advance Search', 'Multiselect Search'];
    
    const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-subtle-text uppercase tracking-wider bg-gray-50";
    const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-base-text";

    const renderGeneralSearchForm = () => (
         <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            {/* Column 1 */}
            <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-subtle-text">Case Name</label>
                     <div className="mt-1 flex rounded-md shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border-color bg-background text-subtle-text text-sm">Exact</span>
                        <input name="caseName" value={searchParams.caseName} onChange={handleInputChange} type="text" className="flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-border-color" />
                    </div>
                </div>
                <FormInput label="Passport No" name="passportNo" value={searchParams.passportNo} onChange={handleInputChange} />
                <FormInput label="Account No" name="accountNo" value={searchParams.accountNo} onChange={handleInputChange} />
                <FormSelect label="Bucket or Recovery" name="bucketOrRecovery" value={searchParams.bucketOrRecovery} onChange={handleInputChange}><option>--Select--</option></FormSelect>
                <FormSelect label="Company" name="company" value={searchParams.company} onChange={handleInputChange}><option>--Select--</option></FormSelect>
                <FormInput label="Sort By" name="sortBy" value={searchParams.sortBy} onChange={handleInputChange} />
            </div>
            {/* Column 2 */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-subtle-text">OS AED</label>
                     <div className="mt-1 flex rounded-md shadow-sm">
                        <select name="osAedOperator" value={searchParams.osAedOperator} onChange={handleInputChange} className="block rounded-none rounded-l-md sm:text-sm border-border-color bg-surface">
                            <option>{'>='}</option><option>{'<='}</option><option>=</option>
                        </select>
                        <input name="osAedValue" value={searchParams.osAedValue} onChange={handleInputChange} type="number" className="flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-border-color" />
                    </div>
                </div>
                <FormInput label="Contact Details" name="contactDetails" value={searchParams.contactDetails} onChange={handleInputChange} />
                 {currentUser.role !== Role.OFFICER && (
                    <FormSelect label="Assigned To" name="assignedTo" value={searchParams.assignedTo} onChange={handleInputChange}>
                        <option value="all">--Select--</option>
                        {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </FormSelect>
                )}
                <div className="pt-5 space-y-3">
                    <div className="flex items-center">
                        <input id="onlyMyItems" name="onlyMyItems" type="checkbox" checked={searchParams.onlyMyItems} onChange={handleInputChange} className="h-4 w-4 rounded border-border-color text-primary" />
                        <label htmlFor="onlyMyItems" className="ml-3 block text-sm font-medium text-base-text">Only my items</label>
                    </div>
                    <div className="flex items-center">
                        <input id="myFavouriteList" name="myFavouriteList" type="checkbox" checked={searchParams.myFavouriteList} onChange={handleInputChange} className="h-4 w-4 rounded border-border-color text-primary" />
                        <label htmlFor="myFavouriteList" className="ml-3 block text-sm font-medium text-base-text">My Favourite List</label>
                    </div>
                </div>
                 <FormSelect label="Sort Order" name="sortOrder" value={searchParams.sortOrder} onChange={handleInputChange}><option>--Select--</option></FormSelect>
            </div>
            {/* Column 3 */}
            <div className="space-y-4">
                 <FormInput label="Mobile" name="mobile" value={searchParams.mobile} onChange={handleInputChange} />
                 <FormSelect label="Case Type" name="caseType" value={searchParams.caseType} onChange={handleInputChange}><option>--Select--</option></FormSelect>
            </div>
         </div>
    );

    return (
        <div className="p-6 min-h-full">
            <h1 className="text-3xl font-bold text-secondary mb-4">Advanced Case Search</h1>
            <Card className="!p-0">
                <div className="border-b border-border-color bg-surface rounded-t-lg">
                    <nav className="-mb-px flex space-x-2 px-4" aria-label="Tabs">
                        {tabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`${ activeTab === tab ? 'border-primary text-secondary' : 'border-transparent text-subtle-text hover:text-secondary hover:border-gray-500'} whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm`}>
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>
                
                {activeTab === 'General' ? (
                    <div>
                        {renderGeneralSearchForm()}
                        <div className="p-4 bg-background flex justify-center gap-2 border-t border-border-color">
                            <button onClick={handleSearch} className="px-6 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark">Search</button>
                            <button onClick={handleClear} className="px-6 py-2 text-sm font-medium text-base-text bg-surface border border-border-color rounded-md shadow-sm hover:bg-background">Clear</button>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-subtle-text">
                        <p>Search options for '{activeTab}' are under development.</p>
                    </div>
                )}
                
                {hasSearched && (
                    <div className="p-4">
                        <h2 className="text-lg font-semibold text-secondary">Search Results ({filteredCases.length})</h2>
                        <div className="overflow-x-auto border-t border-border-color mt-4">
                            <table className="min-w-full divide-y divide-border-color">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className={TH_CLASS}>Debtor</th>
                                        <th className={TH_CLASS}>Account</th>
                                        <th className={TH_CLASS}>Bank</th>
                                        <th className={TH_CLASS}>O/S Balance (AED)</th>
                                        <th className={TH_CLASS}>Coordinator</th>
                                        <th className={TH_CLASS}>Date Added</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-surface divide-y divide-border-color">
                                    {paginatedCases.map(c => (
                                        <tr key={c.id} onClick={() => onSelectCase(c.id)} className="hover:bg-primary-light/50 cursor-pointer">
                                            <td className={TD_CLASS}>
                                                <div className="font-medium text-secondary">{c.debtor.name}</div>
                                                <div className="text-xs text-subtle-text">{getAge(c.debtor.dob)} years old</div>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <div>{c.loan.accountNumber}</div>
                                                <div className="text-xs text-subtle-text">{c.debtor.passport}</div>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <div>{c.loan.bank}</div>
                                                <div className="text-xs text-subtle-text">{c.loan.product}</div>
                                            </td>
                                            <td className={`${TD_CLASS} font-semibold text-value-red`}>{formatCurrency(convertToAED(c.loan.currentBalance, c.loan.currency), 'AED')}</td>
                                            <td className={TD_CLASS}>{c.officer.name}</td>
                                            <td className={TD_CLASS}>{formatDate(c.creationDate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {paginatedCases.length === 0 && <p className="text-center p-8 text-subtle-text">No cases match your search criteria.</p>}
                        </div>

                        <div className="mt-4 flex items-center justify-between flex-shrink-0 pt-4 border-t border-border-color bg-background -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                            <div className="text-sm font-bold text-secondary">
                                SUM OF AED = {formatCurrency(totalSumAED, 'AED').replace('AED ','')}
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="text-sm text-subtle-text">
                                  Showing <span className="font-medium">{(currentPage - 1) * casesPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * casesPerPage, filteredCases.length)}</span> of <span className="font-medium">{filteredCases.length}</span>
                                </div>
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm font-medium text-base-text bg-surface border border-border-color rounded-md hover:bg-background disabled:opacity-50">
                                    {'<'}
                                </button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 text-sm font-medium text-base-text bg-surface border border-border-color rounded-md hover:bg-background disabled:opacity-50">
                                    {'>'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CaseSearchView;