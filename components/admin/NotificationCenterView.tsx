import React, { useState, useMemo } from 'react';
import { Notification, User, Role } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';

interface NotificationCenterViewProps {
  notifications: Notification[];
  users: User[];
  currentUser: User;
}

const NotificationCenterView: React.FC<NotificationCenterViewProps> = ({ notifications, users, currentUser }) => {
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  const managementRoles = [Role.ADMIN, Role.MANAGER, Role.CEO];
  const isFullAdmin = currentUser.role === Role.ADMIN;

  const relevantNotifications = useMemo(() => {
    // Admins see all notifications. Managers/CEOs only see those they sent.
    const filtered = isFullAdmin
      ? notifications
      : notifications.filter(n => n.senderId === currentUser.id);

    return [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, currentUser, isFullAdmin]);

  const getRecipientName = (notif: Notification) => {
    if (notif.recipientId === 'all') {
      return 'All Officers';
    }
    return users.find(u => u.id === notif.recipientId)?.name || 'Unknown User';
  };

  const selectedNotification = useMemo(() => {
    if (!selectedNotificationId) return null;
    return relevantNotifications.find(n => n.id === selectedNotificationId);
  }, [selectedNotificationId, relevantNotifications]);

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted";
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  return (
    <div className="p-6 bg-background min-h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Notification Center</h1>
        <p className="text-text-secondary mt-1">
          A log of all tasks and communications sent to officers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="!p-0 h-[75vh] flex flex-col">
            <div className="p-4 border-b border-border">
                <h2 className="font-semibold">Sent Items ({relevantNotifications.length})</h2>
            </div>
            <div className="overflow-y-auto">
              {relevantNotifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => setSelectedNotificationId(notif.id)}
                  className={`w-full text-left p-4 border-b border-border last:border-b-0 ${selectedNotificationId === notif.id ? 'bg-primary-light' : 'hover:bg-surface-muted'}`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-sm truncate">{notif.message}</p>
                    {notif.priority === 'Urgent' && <span className="text-xs font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">URGENT</span>}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    <span>To: {getRecipientName(notif)}</span>
                    <span className="mx-2">|</span>
                    <span>{new Date(notif.timestamp).toLocaleDateString()}</span>
                  </div>
                  {notif.isTask && (
                     <div className={`mt-2 text-xs font-bold inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${notif.taskStatus === 'done' ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-500'}`}>
                        {notif.taskStatus === 'done' ? '✓ Completed' : '◎ Pending'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
            <Card className="h-[75vh] flex flex-col">
                {selectedNotification ? (
                    <>
                        <div className="p-4 border-b border-border">
                            <h3 className="font-bold text-lg">{selectedNotification.isTask ? 'Task Details' : 'Message Details'}</h3>
                             <p className="text-sm text-text-secondary">Sent by {selectedNotification.senderName} to {getRecipientName(selectedNotification)}</p>
                        </div>
                        <div className="p-4 flex-grow overflow-y-auto space-y-4">
                            <div className="p-4 bg-surface-muted rounded-lg">
                                <p className="font-semibold">Original Message:</p>
                                <p className="text-text-primary whitespace-pre-wrap">{selectedNotification.message}</p>
                            </div>

                            <h4 className="font-semibold pt-4 border-t border-border">Replies ({selectedNotification.replies?.length || 0})</h4>
                            {selectedNotification.replies && selectedNotification.replies.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedNotification.replies.map(reply => (
                                        <div key={reply.id} className="flex items-start gap-3">
                                            <Avatar name={reply.senderName} size="sm" />
                                            <div className="flex-grow p-3 bg-background rounded-lg border border-border">
                                                <div className="flex justify-between items-center">
                                                    <p className="font-semibold text-sm">{reply.senderName}</p>
                                                    <p className="text-xs text-text-secondary">{new Date(reply.timestamp).toLocaleString()}</p>
                                                </div>
                                                <p className="text-sm mt-1">{reply.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-center text-text-secondary py-4">No replies yet.</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary p-8">
                        <svg className="w-16 h-16 mb-4 text-border" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m21.75 0-9-5.25m9 5.25-9 5.25m0-5.25-9 5.25m9-5.25V3.375" /></svg>
                        <h3 className="text-lg font-semibold text-text-primary">Select a Notification</h3>
                        <p>Choose an item from the list to view its details and replies.</p>
                    </div>
                )}
            </Card>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenterView;
