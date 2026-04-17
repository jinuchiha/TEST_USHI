import React, { useEffect, useState, useCallback } from 'react';

interface Notification {
  id: string;
  type: 'ptp_breach' | 'new_assignment' | 'manager_message' | 'payment_received' | 'workflow_triggered';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface PushNotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onClickNotification: (id: string) => void;
}

const AUTO_DISMISS_MS = 8000;

const TYPE_BORDER_COLORS: Record<Notification['type'], string> = {
  ptp_breach: 'var(--color-danger)',
  new_assignment: 'var(--color-primary)',
  payment_received: 'var(--color-success)',
  workflow_triggered: 'var(--color-warning)',
  manager_message: 'var(--color-accent)',
};

const TYPE_ICONS: Record<Notification['type'], string> = {
  ptp_breach: '\u26A0\uFE0F',
  new_assignment: '\uD83D\uDCCB',
  payment_received: '\u2705',
  workflow_triggered: '\u2699\uFE0F',
  manager_message: '\uD83D\uDCAC',
};

const TYPE_LABELS: Record<Notification['type'], string> = {
  ptp_breach: 'PTP Breach',
  new_assignment: 'New Assignment',
  payment_received: 'Payment Received',
  workflow_triggered: 'Workflow Triggered',
  manager_message: 'Manager Message',
};

const PushNotificationToast: React.FC<PushNotificationToastProps> = ({
  notifications,
  onDismiss,
  onClickNotification,
}) => {
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  const handleDismiss = useCallback((id: string) => {
    setDismissing(prev => new Set(prev).add(id));
    setTimeout(() => {
      onDismiss(id);
      setDismissing(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, [onDismiss]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    notifications.filter(n => !n.read).forEach(n => {
      const timer = setTimeout(() => handleDismiss(n.id), AUTO_DISMISS_MS);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, [notifications, handleDismiss]);

  const unread = notifications.filter(n => !n.read).slice(0, 5);
  if (unread.length === 0) return null;

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: 10, maxWidth: 380, width: '100%' }}>
      {unread.map(n => {
        const isDismissing = dismissing.has(n.id);
        return (
          <div
            key={n.id}
            onClick={() => onClickNotification(n.id)}
            style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 12,
              borderLeft: `4px solid ${TYPE_BORDER_COLORS[n.type]}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              animation: isDismissing ? 'rv-toast-out 0.3s ease forwards' : 'rv-toast-in 0.35s ease',
              border: '1px solid var(--color-border)',
              borderLeftWidth: 4,
              borderLeftColor: TYPE_BORDER_COLORS[n.type],
              transition: 'opacity 0.3s, transform 0.3s',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{TYPE_ICONS[n.type]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: TYPE_BORDER_COLORS[n.type] }}>
                  {TYPE_LABELS[n.type]}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{formatTime(n.timestamp)}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); handleDismiss(n.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
              title="Dismiss"
            >
              \u2715
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes rv-toast-in {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes rv-toast-out {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default PushNotificationToast;
