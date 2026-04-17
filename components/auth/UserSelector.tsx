
import React, { useState } from 'react';
import { User, Role } from '../../types';
import { ICONS } from '../../constants';

interface UserSelectorProps {
  users: User[];
  onLogin: (userId: string) => void;
}

const UserSelector: React.FC<UserSelectorProps> = ({ users, onLogin }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserId) {
      onLogin(selectedUserId);
    }
  };
  
  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
      <div className="p-8">
        <div className="flex items-center justify-center mb-6">
          {ICONS.case('h-12 w-12 text-brand-primary')}
          <h2 className="text-3xl font-bold text-gray-800 ml-4">Recovery CRM</h2>
        </div>
        <p className="text-center text-gray-500 mb-8">Please select a user to log in.</p>
        <form onSubmit={handleLogin}>
          <div className="mb-6">
            <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 mb-2">
              User Role
            </label>
            <div className="relative">
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="block w-full pl-4 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm rounded-md appearance-none"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
               <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!selectedUserId}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-secondary hover:bg-brand-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserSelector;
