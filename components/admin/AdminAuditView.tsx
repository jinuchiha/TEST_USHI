import React, { useState, useMemo } from 'react';
import { LoginRecord, User } from '../../types';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';

interface AdminAuditViewProps {
  loginHistory: LoginRecord[];
  users: User[];
}

const AdminAuditView: React.FC<AdminAuditViewProps> = ({ loginHistory, users }) => {
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredHistory = useMemo(() => {
    return [...loginHistory]
      .filter(log => {
        const logDate = new Date(log.timestamp);
        // FIX: Construct dates with explicit time and UTC timezone to avoid local timezone issues.
        const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
        const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;

        const userMatch = selectedUserId === 'all' || log.userId === selectedUserId;
        const startDateMatch = !start || logDate >= start;
        const endDateMatch = !end || logDate <= end;
        
        return userMatch && startDateMatch && endDateMatch;
      })
      .reverse();
  }, [loginHistory, selectedUserId, startDate, endDate]);
  
  const TH_CLASS = "px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider bg-surface-muted";
  const TD_CLASS = "px-6 py-4 whitespace-nowrap text-sm text-text-primary";

  return (
    <div className="p-6 bg-background min-h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">System Audit Trail</h1>
        <p className="text-text-secondary mt-1">Record of user authentications and system events.</p>
      </div>

      <Card className="mb-6 p-4">
        <h3 className="text-lg font-semibold mb-3">Filter Logs</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="user-filter" className="block text-sm font-medium text-text-secondary">User</label>
            <select
              id="user-filter"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border bg-surface sm:text-sm rounded-md"
            >
              <option value="all">All Users</option>
              {users.filter(u => u.id !== 'unassigned-user-id').map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-text-secondary">Start Date</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="mt-1 block w-full shadow-sm sm:text-sm border-border rounded-md p-2 bg-surface"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-text-secondary">End Date</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="mt-1 block w-full shadow-sm sm:text-sm border-border rounded-md p-2 bg-surface"
            />
          </div>
        </div>
      </Card>

      <Card className="!p-0">
        <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">User Login History ({filteredHistory.length} records)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th scope="col" className={TH_CLASS}>User</th>
                <th scope="col" className={TH_CLASS}>Timestamp</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {filteredHistory.map((log, index) => (
                <tr key={`${log.userId}-${index}`}>
                  <td className={TD_CLASS}>
                    <div className="flex items-center">
                        <Avatar name={log.userName} size="sm" />
                        <div className="ml-4">
                            <div className="font-medium">{log.userName}</div>
                        </div>
                    </div>
                  </td>
                  <td className={TD_CLASS}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredHistory.length === 0 && (
            <p className="p-8 text-center text-text-secondary">No login events match the selected criteria.</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminAuditView;
