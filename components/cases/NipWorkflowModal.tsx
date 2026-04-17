import React, { useState } from 'react';
import { EnrichedCase } from '../../types';
import { ICONS } from '../../constants';

interface NipWorkflowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (caseId: string, reason: 'not_in_portal' | 'paid_closed', notes: string) => void;
    caseData: EnrichedCase;
    initialNotes: string;
}

const NipWorkflowModal: React.FC<NipWorkflowModalProps> = ({ isOpen, onClose, onSubmit, caseData, initialNotes }) => {
    const [step, setStep] = useState<'confirm' | 'reason'>('confirm');
    const [reason, setReason] = useState<'not_in_portal' | 'paid_closed' | ''>('');
    const [notes, setNotes] = useState(initialNotes);

    if (!isOpen) return null;

    const handleConfirm = () => {
        setStep('reason');
    };

    const handleSubmit = () => {
        if (!reason) {
            alert('Please select a reason.');
            return;
        }
        onSubmit(caseData.id, reason, notes);
    };
    
    const renderStep = () => {
        switch(step) {
            case 'confirm':
                return (
                    <>
                        <div className="p-6 text-center">
                            <h3 className="text-lg font-medium text-text-primary">Confirm NIP Status</h3>
                            <p className="mt-2 text-sm text-text-secondary">
                                Are you sure you want to mark this case as Not In Portal (NIP)? This action has significant consequences.
                            </p>
                        </div>
                        <div className="flex justify-end p-4 bg-surface-muted border-t border-border">
                            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm font-medium mr-2">Cancel</button>
                            <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium text-white bg-danger rounded-md hover:bg-red-700">Yes, Continue</button>
                        </div>
                    </>
                );
            case 'reason':
                 return (
                    <>
                        <div className="p-6">
                            <h3 className="text-lg font-medium text-text-primary mb-4">Reason for NIP Status</h3>
                            <div className="space-y-4">
                                <div className="flex items-center">
                                    <input id="reason-not-found" name="nip-reason" type="radio" className="h-4 w-4 text-primary border-gray-300" onChange={() => setReason('not_in_portal')} checked={reason === 'not_in_portal'}/>
                                    <label htmlFor="reason-not-found" className="ml-3 block text-sm font-medium text-text-primary">
                                        Case Not Found in Portal
                                        <p className="text-xs text-text-secondary">Select this if the case does not appear in the bank's system (BCMS). The case will be marked as inactive.</p>
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input id="reason-paid" name="nip-reason" type="radio" className="h-4 w-4 text-primary border-gray-300" onChange={() => setReason('paid_closed')} checked={reason === 'paid_closed'}/>
                                    <label htmlFor="reason-paid" className="ml-3 block text-sm font-medium text-text-primary">
                                        Case Already Paid & Closed
                                        <p className="text-xs text-text-secondary">Select this if the case is NIP because it has already been settled. This will start the payment logging process.</p>
                                    </label>
                                </div>
                                <div className="pt-2">
                                     <label htmlFor="nip-notes" className="block text-sm font-medium text-text-secondary">Notes</label>
                                     <textarea id="nip-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 block w-full shadow-sm sm:text-sm rounded-md"></textarea>
                                </div>
                            </div>
                        </div>
                         <div className="flex justify-end p-4 bg-surface-muted border-t border-border">
                            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm mr-2">Cancel</button>
                            <button type="button" onClick={handleSubmit} disabled={!reason} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Submit</button>
                        </div>
                    </>
                );
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-center items-center p-4" onClick={onClose}>
            <div className="panel rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                 <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        {ICONS.danger('w-6 h-6 text-danger')}
                        Not In Portal (NIP) Workflow
                    </h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        {ICONS.close('h-6 w-6')}
                    </button>
                </div>
                {renderStep()}
            </div>
        </div>
    );
};

export default NipWorkflowModal;