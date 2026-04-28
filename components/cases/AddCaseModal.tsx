import React, { useState, useMemo } from 'react';
import { useEscKey } from '../../hooks/useEscKey';
import { Debtor, Loan, User, EnrichedCase, CRMStatus, Role } from '../../types';
import { ICONS } from '../../constants';

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    debtor: Omit<Debtor, 'id'>;
    loan: Omit<Loan, 'id' | 'debtorId'>;
    caseInfo: { assignedOfficerId: string };
  }) => boolean;
  coordinators: User[];
  allCases: EnrichedCase[];
  currentUser: User;
}

const InputField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  required?: boolean;
  type?: string;
  options?: { value: string; label: string }[];
  className?: string;
}> = ({ label, name, value, onChange, required = false, type = 'text', options, className = '' }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-text-secondary">
      {label}
    </label>
    {type === 'select' ? (
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={`mt-1 block w-full pl-3 pr-10 py-2 text-base shadow-sm ${className}`}
      >
        <option value="" disabled>Select...</option>
        {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    ) : (
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={`mt-1 block w-full px-3 py-2 text-base shadow-sm ${className}`}
      />
    )}
  </div>
);

const AddCaseModal: React.FC<AddCaseModalProps> = ({ isOpen, onClose, onSubmit, coordinators, allCases, currentUser }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    passport: '',
    cnic: '',
    eid: '',
    dob: '',
    accountNumber: '',
    originalAmount: '',
    currentBalance: '',
    product: 'Credit Card',
    bank: 'DIB',
    subProduct: 'VISA CARD',
    bucket: 'Recovery',
    assignedOfficerId: '',
  });
  const [formError, setFormError] = useState('');

  useEscKey(onClose, isOpen);
  
  const isOfficer = currentUser.role === Role.OFFICER;

  const coordinatorsWithWorkload = useMemo(() => {
    return coordinators
        .map(coordinator => {
            const caseCount = allCases.filter(c => c.assignedOfficerId === coordinator.id && c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN).length;
            return { ...coordinator, caseCount };
        })
        .sort((a, b) => a.caseCount - b.caseCount);
  }, [coordinators, allCases]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const existingCase = allCases.find(c => c.loan.accountNumber === formData.accountNumber);
    if (existingCase) {
        setFormError('A case with this account number already exists.');
        return;
    }

    const assignedOfficerId = isOfficer ? currentUser.id : formData.assignedOfficerId;

    if (!assignedOfficerId) {
        setFormError("An officer must be assigned to the case.");
        return;
    }

    const bankCurrencyMap: Record<string, 'AED' | 'SAR' | 'BHD' | 'KWD'> = {
        'ALAB': 'AED',
        'DIB': 'AED',
        'SAB': 'SAR',
        'SNB': 'SAR',
        'AL-RAJHI': 'SAR',
        'ALSALAM-BAH': 'BHD',
        'CrediMax': 'BHD',
    };
    const currency: 'AED' | 'SAR' | 'BHD' | 'KWD' = bankCurrencyMap[formData.bank as keyof typeof bankCurrencyMap] || 'AED';

    const submissionData = {
        // FIX: Replaced `email` and `phone` with `emails` and `phones` arrays, and added `tracingHistory` to match the Debtor type.
        debtor: {
            name: formData.name,
            emails: [formData.email],
            phones: [formData.phone],
            address: formData.address,
            passport: formData.passport,
            cnic: formData.cnic,
            eid: formData.eid,
            dob: formData.dob,
            tracingHistory: [],
        },
        loan: {
            accountNumber: formData.accountNumber,
            originalAmount: parseFloat(formData.originalAmount),
            currentBalance: parseFloat(formData.currentBalance),
            product: formData.product,
            bank: formData.bank,
            subProduct: formData.subProduct,
            bucket: formData.bucket,
            currency,
        },
        caseInfo: {
            assignedOfficerId,
        },
    };
    
    if(onSubmit(submissionData)) {
        // Reset form on successful submission if needed
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex justify-center items-start p-4 pt-10">
      <div className="panel w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-border sticky top-0 z-10 bg-inherit rounded-t-lg">
          <h2 className="text-xl font-bold text-text-primary">Add New Case</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            {ICONS.close('h-6 w-6')}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="bg-black/5 dark:bg-black/20 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Debtor Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Full Name" name="name" value={formData.name} onChange={handleChange} />
                <InputField label="Email" name="email" value={formData.email} onChange={handleChange} type="email" />
                <InputField label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} />
                <div>
                   <label htmlFor="dob" className="block text-sm font-medium text-text-secondary">Date of Birth</label>
                   <div className="relative mt-1">
                        <input
                            type="date"
                            id="dob"
                            name="dob"
                            value={formData.dob}
                            onChange={handleChange}
                            className="block w-full px-3 py-2 rounded-md text-base shadow-sm pr-10"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            {ICONS.calendar('h-5 w-5 text-text-secondary')}
                        </div>
                   </div>
                </div>
                <InputField label="Passport" name="passport" value={formData.passport} onChange={handleChange} />
                <InputField label="EID" name="eid" value={formData.eid} onChange={handleChange} />
                <InputField label="CNIC" name="cnic" value={formData.cnic} onChange={handleChange} />
                 <div className="md:col-span-2">
                    <InputField label="Address" name="address" value={formData.address} onChange={handleChange} />
                </div>
            </div>
          </div>
          
          <div className="bg-black/5 dark:bg-black/20 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Loan Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Account Number" name="accountNumber" value={formData.accountNumber} onChange={handleChange} required />
                <InputField label="Bank" name="bank" value={formData.bank} onChange={handleChange} required />
                <InputField label="Current Balance (O/S)" name="currentBalance" value={formData.currentBalance} onChange={handleChange} type="number" required />
                <InputField label="Product" name="product" value={formData.product} onChange={handleChange} />
                <InputField label="Sub Product" name="subProduct" value={formData.subProduct} onChange={handleChange} />
            </div>
          </div>
          
          {!isOfficer && (
              <div className="bg-black/5 dark:bg-black/20 p-4 rounded-lg border border-border">
                 <h3 className="text-lg font-semibold text-text-primary mb-4">Case Assignment</h3>
                 <InputField 
                    label="Assign to Coordinator" 
                    name="assignedOfficerId" 
                    value={formData.assignedOfficerId} 
                    onChange={handleChange} 
                    required 
                    type="select" 
                    options={coordinatorsWithWorkload.map(o => ({ value: o.id, label: `${o.name} - (${o.caseCount} active cases)` }))}
                />
              </div>
          )}
          
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-2.5">
              ⚠️ {formError}
            </div>
          )}

          <div className="flex justify-end pt-4 sticky bottom-0 bg-inherit py-4 rounded-b-lg">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-border rounded-md shadow-sm hover:bg-black/5 dark:hover:bg-white/10 mr-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Create Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCaseModal;