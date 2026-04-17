import React, { useState, useEffect } from 'react';
import { EnrichedCase, SubStatus, LogPaymentSubmitData } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency, fileToBase64 } from '../../utils';

interface LogPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (caseId: string, data: LogPaymentSubmitData) => void;
    caseData: EnrichedCase;
    initialNotes?: string;
    initialSubStatus?: SubStatus;
}

const LogPaymentModal: React.FC<LogPaymentModalProps> = ({ isOpen, onClose, onSubmit, caseData, initialNotes, initialSubStatus }) => {
    const [amountPaid, setAmountPaid] = useState(caseData.loan.currentBalance.toString());
    const [paymentType, setPaymentType] = useState<'Full Payment' | 'Settlement' | 'Installment'>('Full Payment');
    const [confirmationMethod, setConfirmationMethod] = useState<'Slip' | 'Bank Confirmation'>('Slip');
    const [notes, setNotes] = useState(initialNotes || '');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [settlementFile, setSettlementFile] = useState<File | null>(null);

    useEffect(() => {
        if (paymentType === 'Full Payment') {
            setAmountPaid(caseData.loan.currentBalance.toString());
        } else if (paymentType === 'Settlement' || paymentType === 'Installment') {
            setAmountPaid('');
        }
    }, [paymentType, caseData.loan.currentBalance]);


    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const paidAmount = parseFloat(amountPaid);
        if (isNaN(paidAmount) || paidAmount <= 0) {
            alert('Please enter a valid payment amount.');
            return;
        }
        if (confirmationMethod === 'Slip' && !receiptFile) {
            alert('Please attach the payment slip.');
            return;
        }

        let receiptData;
        if (receiptFile) {
            const dataUrl = await fileToBase64(receiptFile);
            receiptData = { name: receiptFile.name, dataUrl };
        }
        
        let settlementData;
        if (settlementFile) {
             const dataUrl = await fileToBase64(settlementFile);
            settlementData = { name: settlementFile.name, dataUrl };
        }
        
        const finalSubStatus = paidAmount < caseData.loan.currentBalance
            ? SubStatus.PARTIAL_PAYMENT
            : (initialSubStatus || SubStatus.PAID_CLOSED);


        const submissionData: LogPaymentSubmitData = {
            amountPaid: paidAmount,
            paymentType,
            confirmationMethod,
            notes,
            receipt: receiptData,
            settlementLetter: settlementData,
            finalSubStatus,
        };

        onSubmit(caseData.id, submissionData);
    };

    const isPartialPayment = parseFloat(amountPaid) < caseData.loan.currentBalance;


    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
            <form onSubmit={handleSubmit} className="panel rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        {ICONS.money('w-6 h-6 text-success')}
                        {isPartialPayment ? 'Log Partial Payment' : 'Log Payment & Close Case'}
                    </h2>
                    <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        {ICONS.close('h-6 w-6')}
                    </button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="p-3 bg-surface-muted rounded-lg border border-border text-center">
                        <p className="text-sm text-text-secondary">Current Outstanding Balance</p>
                        <p className="text-2xl font-bold text-danger">{formatCurrency(caseData.loan.currentBalance, caseData.loan.currency)}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="amountPaid" className="block text-sm font-medium text-text-primary">Amount Paid</label>
                            <input type="number" id="amountPaid" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} required className="mt-1 block w-full shadow-sm sm:text-sm rounded-md p-2"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-primary">Payment Type</label>
                            <div className="mt-2 flex items-center gap-4">
                               <div className="flex items-center"><input id="full_payment" type="radio" value="Full Payment" checked={paymentType === 'Full Payment'} onChange={() => setPaymentType('Full Payment')} className="h-4 w-4 text-primary" /><label htmlFor="full_payment" className="ml-2 text-sm text-text-primary">Full Payment</label></div>
                               <div className="flex items-center"><input id="settlement" type="radio" value="Settlement" checked={paymentType === 'Settlement'} onChange={() => setPaymentType('Settlement')} className="h-4 w-4 text-primary" /><label htmlFor="settlement" className="ml-2 text-sm text-text-primary">Settlement</label></div>
                               <div className="flex items-center"><input id="installment" type="radio" value="Installment" checked={paymentType === 'Installment'} onChange={() => setPaymentType('Installment')} className="h-4 w-4 text-primary" /><label htmlFor="installment" className="ml-2 text-sm text-text-primary">Installment</label></div>
                            </div>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-primary">Confirmation Method</label>
                        <div className="mt-2 flex gap-4">
                            <div className="flex items-center"><input id="bank_confirmation" type="radio" value="Bank Confirmation" checked={confirmationMethod === 'Bank Confirmation'} onChange={() => setConfirmationMethod('Bank Confirmation')} className="h-4 w-4 text-primary" /><label htmlFor="bank_confirmation" className="ml-2 text-sm text-text-primary">Bank Confirmation</label></div>
                            <div className="flex items-center"><input id="slip_attached" type="radio" value="Slip" checked={confirmationMethod === 'Slip'} onChange={() => setConfirmationMethod('Slip')} className="h-4 w-4 text-primary" /><label htmlFor="slip_attached" className="ml-2 text-sm text-text-primary">Payment Slip Attached</label></div>
                        </div>
                    </div>

                    {confirmationMethod === 'Slip' && (
                        <div>
                            <label htmlFor="receiptFile" className="block text-sm font-medium text-text-primary">Upload Payment Slip</label>
                            <input type="file" id="receiptFile" onChange={e => setReceiptFile(e.target.files ? e.target.files[0] : null)} required className="mt-1 block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"/>
                        </div>
                    )}
                     {paymentType === 'Settlement' && (
                        <div>
                            <label htmlFor="settlementFile" className="block text-sm font-medium text-text-primary">Upload Settlement Letter (Optional)</label>
                            <input type="file" id="settlementFile" onChange={e => setSettlementFile(e.target.files ? e.target.files[0] : null)} className="mt-1 block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"/>
                        </div>
                    )}

                    <div>
                        <label htmlFor="payment-notes" className="block text-sm font-medium text-text-primary">Notes</label>
                        <textarea id="payment-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 block w-full shadow-sm sm:text-sm rounded-md"></textarea>
                    </div>
                </div>

                <div className="flex justify-end p-4 bg-surface-muted border-t border-border mt-auto">
                    <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm font-medium mr-2">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-success rounded-md hover:bg-green-700">Confirm Payment</button>
                </div>
            </form>
        </div>
    );
};

export default LogPaymentModal;