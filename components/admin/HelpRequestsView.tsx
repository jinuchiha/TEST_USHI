import React, { useState } from 'react';
import { HelpRequest, User } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import { ICONS } from '../../constants';

interface HelpRequestsViewProps {
  helpRequests: HelpRequest[];
  onResolveHelpRequest: (userId: string) => void;
  users: User[];
  onAdminReply: (userId: string, message: string) => void;
}

const RequestCard: React.FC<{
    req: HelpRequest;
    onResolveHelpRequest: (userId: string) => void;
    onAdminReply: (userId: string, message: string) => void;
}> = ({ req, onResolveHelpRequest, onAdminReply }) => {
    const [reply, setReply] = useState('');

    const handleReply = () => {
        if (reply.trim()) {
            onAdminReply(req.userId, reply.trim());
            setReply('');
        }
    };
    
    return (
        <Card key={req.userId} className="flex flex-col">
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <Avatar name={req.userName} size="sm" />
                    <div>
                        <p className="font-semibold text-text-primary">{req.userName}</p>
                        <p className="text-xs text-text-secondary">{req.userRole}</p>
                    </div>
                </div>
                <p className="text-xs text-text-secondary mt-2">
                    Requested on: {new Date(req.timestamp).toLocaleString()}
                </p>
            </div>
            <div className="p-4 flex-grow overflow-y-auto space-y-3">
                <p className="text-sm font-semibold">User's Query:</p>
                <p className="text-sm text-text-primary bg-background p-3 rounded-md border border-border">
                    {req.query}
                </p>
                {req.adminReplies && req.adminReplies.length > 0 && (
                    <div className="space-y-2 pt-2">
                        <p className="text-sm font-semibold">Admin Replies:</p>
                        {req.adminReplies.map((reply, index) => (
                             <div key={index} className="text-sm text-text-primary bg-primary-light p-3 rounded-md border border-blue-200">
                                <p className="font-bold">{reply.adminName}: <span className="font-normal">{reply.message}</span></p>
                                <p className="text-xs text-text-secondary text-right">{new Date(reply.timestamp).toLocaleTimeString()}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
             <div className="p-4 border-t border-border space-y-3">
                 <div>
                    <textarea 
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        placeholder="Type a reply to the user..."
                        rows={2}
                        className="w-full text-sm bg-surface border border-border rounded-md p-2 focus:ring-1"
                    />
                    <button onClick={handleReply} className="w-full mt-2 px-4 py-2 text-sm font-medium text-white bg-accent border border-transparent rounded-md shadow-sm hover:bg-blue-700">
                        Send Reply
                    </button>
                 </div>
                 <button
                    onClick={() => onResolveHelpRequest(req.userId)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-success border border-transparent rounded-md shadow-sm hover:bg-emerald-700"
                >
                    {ICONS.success('w-5 h-5')} Mark as Resolved
                </button>
             </div>
        </Card>
    )
}

const HelpRequestsView: React.FC<HelpRequestsViewProps> = ({ helpRequests, onResolveHelpRequest, users, onAdminReply }) => {
  const pendingRequests = helpRequests.filter(req => req.status === 'pending');
  const resolvedRequests = helpRequests
    .filter(req => req.status === 'resolved')
    .sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime());

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted";
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  return (
    <div className="p-6 bg-background min-h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Help Requests</h1>
        <p className="text-text-secondary mt-1">
          Review and resolve assistance requests from users.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-text-primary mb-4">Pending Requests ({pendingRequests.length})</h2>
        {pendingRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingRequests.map(req => (
              <RequestCard 
                key={req.userId}
                req={req}
                onResolveHelpRequest={onResolveHelpRequest}
                onAdminReply={onAdminReply}
              />
            ))}
          </div>
        ) : (
          <Card className="text-center p-12">
            {ICONS.bell('w-16 h-16 mx-auto text-border')}
            <h2 className="mt-4 text-xl font-semibold text-text-primary">All Clear!</h2>
            <p className="mt-1 text-text-secondary">There are no pending help requests.</p>
          </Card>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold text-text-primary mb-4">Resolved Log</h2>
         <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th scope="col" className={TH_CLASS}>Requester</th>
                  <th scope="col" className={TH_CLASS}>Query</th>
                  <th scope="col" className={TH_CLASS}>Requested At</th>
                  <th scope="col" className={TH_CLASS}>Resolved By</th>
                  <th scope="col" className={TH_CLASS}>Resolved At</th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border">
                {resolvedRequests.map(req => {
                    const resolver = users.find(u => u.id === req.resolvedBy);
                    return (
                        <tr key={req.userId + req.timestamp}>
                            <td className={TD_CLASS}>
                                <div className="font-medium">{req.userName}</div>
                                <div className="text-xs text-text-secondary">{req.userRole}</div>
                            </td>
                            <td className={`${TD_CLASS} whitespace-normal max-w-sm`}>{req.query}</td>
                            <td className={TD_CLASS}>{new Date(req.timestamp).toLocaleString()}</td>
                            <td className={TD_CLASS}>{resolver?.name || 'N/A'}</td>
                            <td className={TD_CLASS}>{req.resolvedAt ? new Date(req.resolvedAt).toLocaleString() : 'N/A'}</td>
                        </tr>
                    )
                })}
              </tbody>
            </table>
             {resolvedRequests.length === 0 && <p className="text-center p-8 text-text-secondary">No resolved requests yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HelpRequestsView;