import React, { useState } from 'react';
import { ICONS } from '../../constants';
import { User } from '../../types';

interface ImportCasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, officerId?: string) => void;
  title?: string;
  instructions?: string;
  fileType?: string;
  showCoordinatorSelect?: boolean;
  coordinators?: User[];
}

const ImportCasesModal: React.FC<ImportCasesModalProps> = ({
  isOpen,
  onClose,
  onImport,
  title = "Import Cases from CSV",
  instructions = "Please ensure your CSV file has the following columns:",
  fileType = ".csv",
  showCoordinatorSelect = false,
  coordinators = [],
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      if (showCoordinatorSelect && !selectedOfficerId) {
        alert("Please select a coordinator to assign the cases to.");
        return;
      }
      onImport(file, selectedOfficerId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex justify-center items-center p-4">
      <div className="panel w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">{ICONS.close('h-6 w-6')}</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-cyan-600/10 dark:bg-cyan-900/30 border border-cyan-500/30 rounded-md text-sm text-cyan-800 dark:text-cyan-200">
            <h4 className="font-bold mb-2">Instructions</h4>
            <p>{instructions}</p>
            {title.includes("CSV") && (
                <code className="block bg-black/10 dark:bg-black/30 p-2 mt-2 rounded text-xs">name, email, phone, address, passport, cnic, eid, dob, accountNumber, currentBalance, bank, product, subProduct</code>
            )}
          </div>
          
          {showCoordinatorSelect && (
             <div>
                <label htmlFor="coordinator-select" className="block text-sm font-medium text-text-secondary">Assign to Coordinator</label>
                 <select
                    id="coordinator-select"
                    value={selectedOfficerId}
                    onChange={e => setSelectedOfficerId(e.target.value)}
                    required
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base sm:text-sm rounded-md"
                >
                    <option value="" disabled>Select a coordinator...</option>
                    {coordinators.map(coord => (
                        <option key={coord.id} value={coord.id}>{coord.name}</option>
                    ))}
                </select>
            </div>
          )}

          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-text-secondary">Upload File</label>
            <input
              type="file"
              id="file-upload"
              accept={fileType}
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
              required
            />
          </div>

          <div className="flex justify-end pt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-border rounded-md shadow-sm hover:bg-black/5 dark:hover:bg-white/10 mr-3">Cancel</button>
            <button type="submit" disabled={!file} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Import</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportCasesModal;
