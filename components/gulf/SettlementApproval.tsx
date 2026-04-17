import React, { useState, useMemo } from 'react';
import { SettlementRequest, SETTLEMENT_AUTHORITY, EnrichedCase, User, Role } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

interface SettlementApprovalProps {
    caseData: EnrichedCase;
    currentUser: User;
    onSubmitSettlement: (request: Omit<SettlementRequest, 'id' | 'status' | 'requestedAt'>) => void;
    pendingRequests?: SettlementRequest[];
    onApprove?: (requestId: string) => void;
    onReject?: (requestId: string, reason: string) => void;
}

const SettlementApproval: React.FC<SettlementApprovalProps> = ({ caseData, currentUser, onSubmitSettlement, pendingRequests = [], onApprove, onReject }) => {
    const [proposedAmount, setProposedAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const balance = caseData.loan.currentBalance;
    const currency = caseData.loan.currency;
    const maxDiscount = SETTLEMENT_AUTHORITY[currentUser.role] || 0;
    const minAcceptable = balance * (1 - maxDiscount / 100);

    const discountPercent = useMemo(() => {
        const amt = parseFloat(proposedAmount);
        if (isNaN(amt) || amt <= 0 || amt >= balance) return 0;
        return Math.round(((balance - amt) / balance) * 100);
    }, [proposedAmount, balance]);

    const needsApproval = discountPercent > maxDiscount;
    const canAutoApprove = discountPercent <= maxDiscount && discountPercent > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(proposedAmount);
        if (isNaN(amt) || amt <= 0) return;
        onSubmitSettlement({
            caseId: caseData.id,
            debtorName: caseData.debtor.name,
            accountNumber: caseData.loan.accountNumber,
            bank: caseData.loan.bank,
            originalBalance: balance,
            proposedAmount: amt,
            discountPercent,
            currency,
            requestedBy: currentUser.id,
            notes,
        });
        setProposedAmount('');
        setNotes('');
    };

    return (
        <div className="space-y-4">
            {/* Settlement Calculator */}
            <div className="panel p-4 rounded-lg">
                <h3 className="text-sm font-bold" style={{ color: '#1B2A4A' }}>Settlement Calculator</h3>
                <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase">Outstanding</p>
                        <p className="text-sm font-bold text-red-600">{formatCurrency(balance, currency)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase">Your Authority</p>
                        <p className="text-sm font-bold" style={{ color: '#F28C28' }}>Up to {maxDiscount}% off</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase">Min Acceptable</p>
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(minAcceptable, currency)}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wide">Proposed Settlement Amount ({currency})</label>
                        <input
                            type="number"
                            value={proposedAmount}
                            onChange={e => setProposedAmount(e.target.value)}
                            placeholder={`Min: ${minAcceptable.toFixed(0)}`}
                            className="w-full mt-1 px-3 py-2 text-sm rounded-lg"
                            min="1"
                            max={balance}
                            step="0.01"
                            required
                        />
                    </div>

                    {proposedAmount && parseFloat(proposedAmount) > 0 && (
                        <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${
                            canAutoApprove ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            needsApproval ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}>
                            {canAutoApprove && <span>✓ {discountPercent}% discount — within your authority. Auto-approved.</span>}
                            {needsApproval && <span>⚠ {discountPercent}% discount — exceeds your {maxDiscount}% limit. Needs manager approval.</span>}
                            {discountPercent === 0 && <span>Full amount — no discount applied.</span>}
                        </div>
                    )}

                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Settlement notes (reason for discount)..."
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-lg"
                    />

                    <button
                        type="submit"
                        disabled={!proposedAmount || parseFloat(proposedAmount) <= 0}
                        className="w-full py-2 text-xs font-bold rounded-lg text-white disabled:opacity-50 transition"
                        style={{ background: canAutoApprove ? '#16A34A' : '#F28C28' }}
                    >
                        {canAutoApprove ? 'Approve & Create Settlement' : needsApproval ? 'Submit for Approval' : 'Create Settlement Offer'}
                    </button>
                </form>
            </div>

            {/* Pending Approvals (Manager/CEO only) */}
            {(currentUser.role === Role.MANAGER || currentUser.role === Role.CEO) && pendingRequests.length > 0 && (
                <div className="panel p-4 rounded-lg">
                    <h3 className="text-sm font-bold" style={{ color: '#1B2A4A' }}>Pending Settlement Approvals ({pendingRequests.length})</h3>
                    <div className="mt-3 space-y-2">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-bold text-gray-800">{req.debtorName}</p>
                                        <p className="text-[10px] text-gray-500">{req.accountNumber} · {req.bank}</p>
                                    </div>
                                    <span className="text-xs font-bold text-amber-600">{req.discountPercent}% off</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="text-[10px] text-gray-500">
                                        {formatCurrency(req.originalBalance, req.currency)} → <strong className="text-emerald-600">{formatCurrency(req.proposedAmount, req.currency)}</strong>
                                    </div>
                                    {rejectingId === req.id ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                placeholder="Reason..."
                                                className="text-[10px] px-2 py-1 rounded border w-32"
                                            />
                                            <button onClick={() => { onReject?.(req.id, rejectReason); setRejectingId(null); setRejectReason(''); }} className="text-[10px] px-2 py-1 bg-red-500 text-white rounded">Confirm</button>
                                            <button onClick={() => setRejectingId(null)} className="text-[10px] px-2 py-1 bg-gray-200 rounded">Cancel</button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1">
                                            <button onClick={() => onApprove?.(req.id)} className="text-[10px] px-2.5 py-1 bg-emerald-500 text-white rounded font-bold">Approve</button>
                                            <button onClick={() => setRejectingId(req.id)} className="text-[10px] px-2.5 py-1 bg-red-100 text-red-600 rounded font-bold">Reject</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettlementApproval;
