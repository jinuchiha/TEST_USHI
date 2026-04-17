import React, { useState, useMemo, useEffect } from 'react';
import { EnrichedCase, User, CRMStatus } from '../../types';
import { formatCurrency } from '../../utils';

interface MessageTemplatesProps {
  caseData: EnrichedCase;
  currentUser: User;
}

type Channel = 'sms' | 'whatsapp' | 'email';

interface MessageTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
}

interface SentMessage {
  id: string;
  timestamp: string;
  channel: Channel;
  recipient: string;
  subject?: string;
  content: string;
  status: 'sent';
}

const COMPANY_NAME = 'RecoVantage Private Limited';

const buildTemplates = (
  debtorName: string,
  accountNumber: string,
  bank: string,
  outstandingBalance: string,
  currency: string,
  officerName: string
): MessageTemplate[] => [
  {
    id: 'payment_reminder',
    name: 'Payment Reminder (Soft)',
    subject: 'Friendly Payment Reminder',
    body: `Dear ${debtorName},\n\nThis is a gentle reminder regarding your outstanding balance of ${currency} ${outstandingBalance} on account ${accountNumber} with ${bank}.\n\nPlease arrange the payment at your earliest convenience. If you have already made the payment, kindly disregard this message.\n\nFor assistance, contact ${officerName} at ${COMPANY_NAME}.\n\nThank you.`,
  },
  {
    id: 'payment_due',
    name: 'Payment Due Notice (Firm)',
    subject: 'Payment Due Notice',
    body: `Dear ${debtorName},\n\nWe would like to bring to your attention that the amount of ${currency} ${outstandingBalance} on account ${accountNumber} with ${bank} is now due.\n\nImmediate payment is required to avoid further action. Please contact ${officerName} at ${COMPANY_NAME} to settle this matter.\n\nRegards,\n${officerName}`,
  },
  {
    id: 'ptp_followup',
    name: 'PTP Follow-up',
    subject: 'Follow-up on Payment Promise',
    body: `Dear ${debtorName},\n\nWe are following up on your promise to pay regarding account ${accountNumber} with ${bank}. The outstanding balance is ${currency} ${outstandingBalance}.\n\nKindly confirm the payment date or contact ${officerName} at ${COMPANY_NAME} to discuss further.\n\nThank you.`,
  },
  {
    id: 'overdue_warning',
    name: 'Overdue Payment Warning',
    subject: 'Overdue Payment Warning',
    body: `Dear ${debtorName},\n\nYour account ${accountNumber} with ${bank} is overdue with an outstanding balance of ${currency} ${outstandingBalance}.\n\nFailure to settle this amount may result in escalation. Please contact ${officerName} at ${COMPANY_NAME} immediately.\n\nRegards,\n${officerName}`,
  },
  {
    id: 'settlement_offer',
    name: 'Settlement Offer',
    subject: 'Settlement Offer for Your Account',
    body: `Dear ${debtorName},\n\nWe are pleased to inform you that a settlement option may be available for your account ${accountNumber} with ${bank}. Your current outstanding balance is ${currency} ${outstandingBalance}.\n\nPlease contact ${officerName} at ${COMPANY_NAME} to discuss the settlement terms.\n\nBest regards,\n${officerName}`,
  },
  {
    id: 'legal_warning',
    name: 'Legal Action Warning',
    subject: 'Notice of Potential Legal Action',
    body: `Dear ${debtorName},\n\nDespite our previous communications, account ${accountNumber} with ${bank} remains unpaid with an outstanding balance of ${currency} ${outstandingBalance}.\n\nPlease be advised that failure to resolve this matter may result in legal proceedings. Contact ${officerName} at ${COMPANY_NAME} within 7 days.\n\nRegards,\n${officerName}\n${COMPANY_NAME}`,
  },
  {
    id: 'account_update',
    name: 'Account Update Request',
    subject: 'Account Information Update Required',
    body: `Dear ${debtorName},\n\nWe require updated contact and account information for your account ${accountNumber} with ${bank}. Outstanding balance: ${currency} ${outstandingBalance}.\n\nPlease contact ${officerName} at ${COMPANY_NAME} to update your details.\n\nThank you.`,
  },
  {
    id: 'partial_ack',
    name: 'Partial Payment Acknowledgment',
    subject: 'Partial Payment Received',
    body: `Dear ${debtorName},\n\nThank you for your recent partial payment towards account ${accountNumber} with ${bank}. Your remaining balance is ${currency} ${outstandingBalance}.\n\nPlease arrange payment for the remaining amount. Contact ${officerName} at ${COMPANY_NAME} for assistance.\n\nThank you.`,
  },
  {
    id: 'final_notice',
    name: 'Final Notice Before Legal',
    subject: 'Final Notice Before Legal Proceedings',
    body: `Dear ${debtorName},\n\nThis is a FINAL NOTICE regarding your overdue account ${accountNumber} with ${bank}. Outstanding balance: ${currency} ${outstandingBalance}.\n\nIf payment is not received within 48 hours, we will proceed with legal action without further notice.\n\nContact ${officerName} at ${COMPANY_NAME} immediately.\n\nRegards,\n${officerName}\n${COMPANY_NAME}`,
  },
  {
    id: 'callback_request',
    name: 'Callback Request',
    subject: 'Please Call Us Back',
    body: `Dear ${debtorName},\n\nWe have been trying to reach you regarding account ${accountNumber} with ${bank}. Outstanding balance: ${currency} ${outstandingBalance}.\n\nPlease call back ${officerName} at ${COMPANY_NAME} at your earliest convenience.\n\nThank you.`,
  },
];

const getSmsSegments = (text: string): { chars: number; segments: number } => {
  const chars = text.length;
  if (chars <= 160) return { chars, segments: 1 };
  return { chars, segments: Math.ceil(chars / 153) };
};

const getStorageKey = (caseId: string) => `rv_messages_${caseId}`;

const loadSentMessages = (caseId: string): SentMessage[] => {
  try {
    const raw = localStorage.getItem(getStorageKey(caseId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveSentMessage = (caseId: string, msg: SentMessage) => {
  const existing = loadSentMessages(caseId);
  existing.unshift(msg);
  localStorage.setItem(getStorageKey(caseId), JSON.stringify(existing));
};

const channelConfig: Record<Channel, { label: string; color: string; icon: string }> = {
  sms: { label: 'SMS', color: 'var(--color-info)', icon: '💬' },
  whatsapp: { label: 'WhatsApp', color: '#25D366', icon: '📱' },
  email: { label: 'Email', color: 'var(--color-warning)', icon: '✉️' },
};

const MessageTemplates: React.FC<MessageTemplatesProps> = ({ caseData, currentUser }) => {
  const { debtor, loan } = caseData;
  const balanceFormatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(loan.currentBalance);
  const currency = loan.currency || 'AED';

  const templates = useMemo(
    () => buildTemplates(debtor.name, loan.accountNumber, loan.bank, balanceFormatted, currency, currentUser.name),
    [debtor.name, loan.accountNumber, loan.bank, balanceFormatted, currency, currentUser.name]
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const [channel, setChannel] = useState<Channel>('sms');
  const [editedBody, setEditedBody] = useState(templates[0].body);
  const [editedSubject, setEditedSubject] = useState(templates[0].subject || '');
  const [selectedContact, setSelectedContact] = useState('');
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const contactOptions = useMemo(() => {
    if (channel === 'email') return debtor.emails || [];
    return debtor.phones || [];
  }, [channel, debtor.emails, debtor.phones]);

  useEffect(() => {
    setSelectedContact(contactOptions[0] || '');
  }, [contactOptions]);

  useEffect(() => {
    setSentMessages(loadSentMessages(caseData.id));
  }, [caseData.id]);

  useEffect(() => {
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (tpl) {
      setEditedBody(tpl.body);
      setEditedSubject(tpl.subject || '');
    }
  }, [selectedTemplateId, templates]);

  const handleSend = () => {
    if (!selectedContact || !editedBody.trim()) return;
    const msg: SentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      channel,
      recipient: selectedContact,
      subject: channel === 'email' ? editedSubject : undefined,
      content: editedBody,
      status: 'sent',
    };
    saveSentMessage(caseData.id, msg);
    setSentMessages(loadSentMessages(caseData.id));
    setSendSuccess(true);
    setTimeout(() => setSendSuccess(false), 2500);
  };

  const smsInfo = getSmsSegments(editedBody);

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          Message Templates
        </h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            fontSize: '12px', color: 'var(--color-primary)', background: 'none', border: 'none',
            cursor: 'pointer', textDecoration: 'underline', padding: 0,
          }}
        >
          {showHistory ? 'Back to Compose' : `Sent History (${sentMessages.length})`}
        </button>
      </div>

      {showHistory ? (
        /* Sent History */
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {sentMessages.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 0' }}>
              No messages sent yet.
            </p>
          ) : (
            sentMessages.map(msg => (
              <div
                key={msg.id}
                style={{
                  padding: '10px', marginBottom: '8px', borderRadius: '6px',
                  border: '1px solid var(--color-border)', background: 'var(--color-background)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
                    color: '#fff',
                    background: channelConfig[msg.channel].color,
                  }}>
                    {channelConfig[msg.channel].label}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {new Date(msg.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: '10px', fontWeight: 500, padding: '2px 8px',
                    borderRadius: '9999px', background: 'var(--color-success-light, rgba(16,185,129,0.1))',
                    color: 'var(--color-success)',
                  }}>
                    Delivered
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0' }}>
                  To: {msg.recipient}
                </p>
                <p style={{
                  fontSize: '12px', color: 'var(--color-text-primary)', margin: '4px 0 0 0',
                  whiteSpace: 'pre-wrap', lineHeight: '1.4',
                  maxHeight: '60px', overflow: 'hidden',
                }}>
                  {msg.content}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Channel Selector */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: 'var(--color-background)', borderRadius: '6px', padding: '3px' }}>
            {(['sms', 'whatsapp', 'email'] as Channel[]).map(ch => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: '12px', fontWeight: 500, borderRadius: '4px',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: channel === ch ? 'var(--color-primary)' : 'transparent',
                  color: channel === ch ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {channelConfig[ch].icon} {channelConfig[ch].label}
              </button>
            ))}
          </div>

          {/* Template Selector */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              style={{
                width: '100%', fontSize: '12px', padding: '6px 8px', borderRadius: '6px',
                border: '1px solid var(--color-border)', background: 'var(--color-background)',
                color: 'var(--color-text-primary)', outline: 'none',
              }}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Contact Selector */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              {channel === 'email' ? 'Email Address' : 'Phone Number'}
            </label>
            {contactOptions.length > 0 ? (
              <select
                value={selectedContact}
                onChange={e => setSelectedContact(e.target.value)}
                style={{
                  width: '100%', fontSize: '12px', padding: '6px 8px', borderRadius: '6px',
                  border: '1px solid var(--color-border)', background: 'var(--color-background)',
                  color: 'var(--color-text-primary)', outline: 'none',
                }}
              >
                {contactOptions.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--color-danger)', margin: 0 }}>
                No {channel === 'email' ? 'email addresses' : 'phone numbers'} on file.
              </p>
            )}
          </div>

          {/* Email Subject */}
          {channel === 'email' && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                Subject
              </label>
              <input
                type="text"
                value={editedSubject}
                onChange={e => setEditedSubject(e.target.value)}
                style={{
                  width: '100%', fontSize: '12px', padding: '6px 8px', borderRadius: '6px',
                  border: '1px solid var(--color-border)', background: 'var(--color-background)',
                  color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Message Preview / Editor */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              Message Preview {channel === 'sms' && (
                <span style={{ fontWeight: 400, marginLeft: '8px' }}>
                  {smsInfo.chars} chars / {smsInfo.segments} segment{smsInfo.segments > 1 ? 's' : ''}
                </span>
              )}
            </label>
            {channel === 'whatsapp' ? (
              <div style={{
                background: '#e5ddd5', borderRadius: '8px', padding: '12px', minHeight: '120px',
              }}>
                <div style={{
                  background: '#dcf8c6', borderRadius: '0 8px 8px 8px', padding: '8px 10px',
                  maxWidth: '92%', fontSize: '12px', lineHeight: '1.5', color: '#303030',
                  whiteSpace: 'pre-wrap', position: 'relative',
                }}>
                  {editedBody}
                  <span style={{
                    fontSize: '10px', color: '#667781', float: 'right', marginTop: '4px', marginLeft: '8px',
                  }}>
                    {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </span>
                </div>
              </div>
            ) : null}
            <textarea
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
              rows={channel === 'whatsapp' ? 4 : 6}
              style={{
                width: '100%', fontSize: '12px', padding: '8px', borderRadius: '6px', lineHeight: '1.5',
                border: '1px solid var(--color-border)', background: 'var(--color-background)',
                color: 'var(--color-text-primary)', outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box',
                marginTop: channel === 'whatsapp' ? '8px' : 0,
              }}
            />
          </div>

          {/* Send Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <button
              onClick={handleSend}
              disabled={!selectedContact || !editedBody.trim()}
              style={{
                flex: 1, padding: '8px 0', fontSize: '13px', fontWeight: 600, borderRadius: '6px',
                border: 'none', cursor: !selectedContact || !editedBody.trim() ? 'not-allowed' : 'pointer',
                background: !selectedContact || !editedBody.trim() ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#fff', transition: 'all 0.15s',
                opacity: !selectedContact || !editedBody.trim() ? 0.5 : 1,
              }}
            >
              Send via {channelConfig[channel].label}
            </button>
            {sendSuccess && (
              <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 500 }}>
                Sent!
              </span>
            )}
          </div>

          {/* Compliance Note */}
          <p style={{
            fontSize: '10px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.4',
            fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: '8px',
          }}>
            Messages are logged and subject to regulatory review.
          </p>
        </>
      )}
    </div>
  );
};

export default MessageTemplates;
