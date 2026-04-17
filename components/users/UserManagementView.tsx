import React, { useState, useMemo } from 'react';
import { User, Role, EnrichedCase, ActionType, CRMStatus } from '../../types';
import Card from '../shared/Card';
import { ICONS } from '../../constants';
import { formatCurrency, convertToAED } from '../../utils';
import Avatar from '../shared/Avatar';

interface UserManagementViewProps {
  users: User[];
  cases: EnrichedCase[];
  onAddUser: (name: string, role: Role, password: string, target?: number) => void;
  onRemoveUser: (userId: string) => void;
  onUpdateUser: (userId: string, updatedData: Partial<User>) => void;
  currentUser: User;
}

const AddUserCard: React.FC<{
  isAddingUser: boolean;
  setIsAddingUser: (isAdding: boolean) => void;
  newUserName: string;
  setNewUserName: (name: string) => void;
  newUserPassword: string;
  setNewUserPassword: (password: string) => void;
  newUserRole: Role;
  setNewUserRole: (role: Role) => void;
  newUserTarget: string;
  setNewUserTarget: (target: string) => void;
  handleAddUser: (e: React.FormEvent) => void;
}> = ({
  isAddingUser,
  setIsAddingUser,
  newUserName,
  setNewUserName,
  newUserPassword,
  setNewUserPassword,
  newUserRole,
  setNewUserRole,
  newUserTarget,
  setNewUserTarget,
  handleAddUser
}) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
  <Card className="mb-6">
    <div className="p-4 flex justify-between items-center cursor-pointer" onClick={() => setIsAddingUser(!isAddingUser)}>
      <h2 className="text-xl font-semibold text-text-primary">Manage Users</h2>
      <button className="text-accent font-bold text-sm flex items-center gap-1">
        {isAddingUser ? 'Cancel' : 'Add New User'}
        {ICONS.chevronDown(`w-5 h-5 transition-transform ${isAddingUser ? 'rotate-180' : ''}`)}
      </button>
    </div>
    {isAddingUser && (
      <form onSubmit={handleAddUser} className="p-4 border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className={newUserRole === Role.OFFICER ? "md:col-span-1" : "md:col-span-1"}>
              <label htmlFor="new-user-name" className="block text-sm font-medium text-text-secondary">Name</label>
              <input
                  type="text"
                  id="new-user-name"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="mt-1 block w-full shadow-sm sm:text-sm border-border rounded-md p-2 bg-surface text-text-primary"
                  required
              />
          </div>
          <div className="md:col-span-1">
              <label htmlFor="new-user-password" className="block text-sm font-medium text-text-secondary">Password</label>
              <div className="relative mt-1">
                <input
                    type={showPassword ? 'text' : 'password'}
                    id="new-user-password"
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    className="block w-full shadow-sm sm:text-sm border-border rounded-md p-2 bg-surface text-text-primary pr-10"
                    required
                />
                 <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    {showPassword ? ICONS.eyeOff('w-5 h-5') : ICONS.eye('w-5 h-5')}
                </button>
              </div>
          </div>
           <div className="md:col-span-1">
              <label htmlFor="new-user-role" className="block text-sm font-medium text-text-secondary">Role</label>
              <select
                  id="new-user-role"
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as Role)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md bg-surface text-text-primary"
              >
                  {Object.values(Role).map(role => (
                      <option key={role} value={role}>{role}</option>
                  ))}
              </select>
          </div>
          {newUserRole === Role.OFFICER && (
               <div className="md:col-span-1">
                  <label htmlFor="new-user-target" className="block text-sm font-medium text-text-secondary">Monthly Target</label>
                  <input
                      type="number"
                      id="new-user-target"
                      value={newUserTarget}
                      onChange={e => setNewUserTarget(e.target.value)}
                      className="mt-1 block w-full shadow-sm sm:text-sm border-border rounded-md p-2 bg-surface text-text-primary"
                      placeholder="e.g., 150000"
                  />
              </div>
          )}
           <div className={newUserRole === Role.OFFICER ? "md:col-span-full" : "md:col-span-1"}>
              <button
                  type="submit"
                  className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
              >
                  Add User
              </button>
          </div>
        </div>
      </form>
    )}
  </Card>
)};

const UserManagementView: React.FC<UserManagementViewProps> = ({ users, cases, onAddUser, onRemoveUser, onUpdateUser, currentUser }) => {
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>(Role.OFFICER);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserTarget, setNewUserTarget] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);

  const canManageUsers = currentUser.role === Role.ADMIN || currentUser.role === Role.CEO;

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) return;
    if (newUserName.trim() && newUserPassword.trim()) {
      const target = newUserRole === Role.OFFICER ? parseFloat(newUserTarget) : undefined;
      onAddUser(newUserName.trim(), newUserRole, newUserPassword.trim(), target);
      setNewUserName('');
      setNewUserRole(Role.OFFICER);
      setNewUserPassword('');
      setNewUserTarget('');
      setIsAddingUser(false);
    }
  };
  
   const handleResetPassword = (user: User) => {
        const newPassword = prompt(`Enter new password for ${user.name}:`);
        if (newPassword && newPassword.trim() !== "") {
            onUpdateUser(user.id, { password: newPassword });
            alert(`Password for ${user.name} has been updated.`);
        } else if (newPassword !== null) {
            alert("Password cannot be empty.");
        }
    };
  
  const userStats = useMemo(() => {
    return users.map(user => {
      const userCases = cases.filter(c => c.assignedOfficerId === user.id);
      const activeCases = userCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN).length;

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const monthlyCollectionsAED = userCases
        .flatMap(c => c.history)
        .filter(a => 
          a.type === ActionType.PAYMENT_RECEIVED && 
          a.officerId === user.id && 
          a.amountPaid &&
          new Date(a.timestamp) >= firstDayOfMonth
        )
        .reduce((sum, a) => {
          const currency = userCases.find(c => c.id === a.caseId)?.loan.currency || 'AED';
          return sum + convertToAED(a.amountPaid!, currency);
        }, 0);
        
      return {
        ...user,
        activeCases,
        monthlyCollectionsAED
      };
    });
  }, [users, cases]);

  const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted sticky top-0 z-10";
  const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  return (
    <div className="p-6">
       <div className="flex justify-between items-center mb-6 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-text-primary">User Management</h1>
      </div>
      
      {canManageUsers && (
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <AddUserCard
                isAddingUser={isAddingUser}
                setIsAddingUser={setIsAddingUser}
                newUserName={newUserName}
                setNewUserName={setNewUserName}
                newUserPassword={newUserPassword}
                setNewUserPassword={setNewUserPassword}
                newUserRole={newUserRole}
                setNewUserRole={setNewUserRole}
                newUserTarget={newUserTarget}
                setNewUserTarget={setNewUserTarget}
                handleAddUser={handleAddUser}
            />
        </div>
      )}
      
      <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <Card className="!p-0 flex flex-col flex-grow">
            <div className="overflow-auto flex-grow">
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-muted">
                <tr>
                    <th scope="col" className={TH_CLASS}>User</th>
                    <th scope="col" className={TH_CLASS}>Role</th>
                    <th scope="col" className={TH_CLASS}>Active Cases</th>
                    <th scope="col" className={TH_CLASS}>Monthly Paid (AED)</th>
                    <th scope="col" className={TH_CLASS}>Monthly Target (AED)</th>
                    {canManageUsers && <th scope="col" className={TH_CLASS}>Actions</th>}
                </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                {userStats.filter(u => u.id !== 'unassigned-user-id').map(user => {
                    const canRemove = canManageUsers && currentUser.id !== user.id && !(user.role === Role.ADMIN && users.filter(u => u.role === Role.ADMIN).length <= 1);
                    return (
                    <tr key={user.id}>
                        <td className={TD_CLASS}>
                        <div className="flex items-center">
                            <Avatar name={user.name} size="sm" />
                            <div className="ml-4">
                            <div className="font-medium text-text-primary">{user.name}</div>
                            </div>
                        </div>
                        </td>
                        <td className={TD_CLASS}>{user.role}</td>
                        <td className={TD_CLASS}>{user.role === Role.OFFICER ? user.activeCases : 'N/A'}</td>
                        <td className={`${TD_CLASS} font-semibold text-green-600 dark:text-green-400`}>
                        {user.role === Role.OFFICER ? formatCurrency(user.monthlyCollectionsAED, 'AED') : 'N/A'}
                        </td>
                        <td className={TD_CLASS}>
                        {user.role === Role.OFFICER ? formatCurrency(user.target, 'AED') : 'N/A'}
                        </td>
                        {canManageUsers && (
                        <td className={`${TD_CLASS} space-x-2`}>
                            <button 
                            onClick={() => handleResetPassword(user)}
                            className="text-accent hover:text-blue-500 p-1"
                            title="Reset Password"
                            >
                            {ICONS.settings('w-5 h-5')}
                            </button>
                            <button 
                            onClick={() => {
                                if(window.confirm(`Are you sure you want to remove ${user.name}? All their cases will be unassigned.`)) {
                                    onRemoveUser(user.id);
                                }
                            }}
                            disabled={!canRemove}
                            className="text-text-secondary hover:text-danger dark:hover:text-danger p-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-text-secondary"
                            title={canRemove ? "Remove User" : "This user cannot be removed (last admin or yourself)."}
                            >
                            {ICONS.trash('w-5 h-5')}
                            </button>
                        </td>
                        )}
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        </Card>
      </div>
    </div>
  );
};

export default UserManagementView;