import React, { useState } from 'react';
import { USERS } from '../../constants';
import { useAuth } from '../../src/contexts/AuthContext';

interface LoginProps {
  onLogin: (userName: string, password?: string) => boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { useApi, setUseApi, login: apiLogin } = useAuth();
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (useApi) {
      const success = await apiLogin(email, password);
      setLoading(false);
      if (!success) setError('Invalid email or password.');
    } else {
      const success = onLogin(userName, password);
      setLoading(false);
      if (!success) setError('Invalid username or password.');
    }
  };

  const quickLogin = async (name: string, pass: string, quickEmail?: string) => {
    setError('');
    setLoading(true);
    if (useApi && quickEmail) {
      const success = await apiLogin(quickEmail, 'password123');
      setLoading(false);
      if (!success) setError('Backend not reachable. Switch to Demo Mode.');
    } else {
      const success = onLogin(name, pass);
      setLoading(false);
      if (!success) setError('Login failed.');
    }
  };

  const apiUsers = [
    { label: 'CEO', email: 'ceo@crm.com', desc: 'Executive dashboard' },
    { label: 'Manager', email: 'sarah@crm.com', desc: 'Team operations' },
    { label: 'Officer', email: 'ahmed@crm.com', desc: 'Case management' },
    { label: 'Accountant', email: 'finance@crm.com', desc: 'Payment verification' },
  ];

  const testUsers = {
    manager: USERS.find(u => u.name === 'Samantha Jones'),
    officer: USERS.find(u => u.name === 'Maria Garcia'),
    accountant: USERS.find(u => u.name === 'Accountant User'),
    ceo: USERS.find(u => u.name === 'CEO User'),
  };

  const demoQuickUsers = [
    { key: 'ceo', label: 'CEO', desc: 'Executive dashboard', user: testUsers.ceo },
    { key: 'manager', label: 'Manager', desc: 'Team operations', user: testUsers.manager },
    { key: 'officer', label: 'Officer', desc: 'Case management', user: testUsers.officer },
    { key: 'accountant', label: 'Accountant', desc: 'Payment verification', user: testUsers.accountant },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#1B2A4A' }}>
      {/* Left side — Brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, #F28C28 0%, transparent 70%)' }} />
          <div className="absolute bottom-20 right-20 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#F28C28' }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3.58-.5 5.07-1.38" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 12l3 3 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Reco<span style={{ color: '#F28C28' }}>V</span>antage
            </h1>
          </div>
          <p className="text-blue-200/40 text-sm">Private Limited</p>
        </div>
        <div className="relative space-y-8">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Intelligent Debt<br />Recovery Platform
          </h2>
          <p className="text-blue-200/60 text-base max-w-md leading-relaxed">
            AI-powered case management, real-time analytics, and automated workflows designed for Gulf collection agencies.
          </p>
          <div className="grid grid-cols-3 gap-6 pt-4">
            <div>
              <p className="text-3xl font-bold text-white">9</p>
              <p className="text-blue-200/40 text-xs mt-1">AI Engines</p>
            </div>
            <div>
              <p className="text-3xl font-bold" style={{ color: '#F28C28' }}>90+</p>
              <p className="text-blue-200/40 text-xs mt-1">API Endpoints</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">8</p>
              <p className="text-blue-200/40 text-xs mt-1">Currencies</p>
            </div>
          </div>
        </div>
        <p className="relative text-blue-200/20 text-xs">&copy; {new Date().getFullYear()} RecoVantage Pvt Ltd. All rights reserved.</p>
      </div>

      {/* Right side — Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8" style={{ background: '#F7F8FC' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#1B2A4A' }}>
              Reco<span style={{ color: '#F28C28' }}>V</span>antage
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-xl font-bold mb-1" style={{ color: '#1B2A4A' }}>Welcome back</h2>
            <p className="text-gray-400 text-sm mb-6">Sign in to your account</p>

            {/* Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              <button
                onClick={() => setUseApi(false)}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${!useApi ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
              >
                Demo Mode
              </button>
              <button
                onClick={() => setUseApi(true)}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${useApi ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
              >
                API Mode
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2.5">{error}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {useApi ? 'Email' : 'Username'}
                </label>
                <input
                  type={useApi ? 'email' : 'text'}
                  value={useApi ? email : userName}
                  onChange={(e) => useApi ? setEmail(e.target.value) : setUserName(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition"
                  placeholder={useApi ? 'you@company.com' : 'Enter username'}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50"
                style={{ background: loading ? '#94A3B8' : '#F28C28' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Quick Access */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest text-center mb-3">Quick Access</p>
              <div className="grid grid-cols-2 gap-2">
                {useApi ? (
                  apiUsers.map(u => (
                    <button
                      key={u.email}
                      disabled={loading}
                      onClick={() => quickLogin('', '', u.email)}
                      className="flex flex-col items-center py-3 px-2 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition group"
                    >
                      <span className="text-xs font-bold text-gray-700 group-hover:text-orange-600">{u.label}</span>
                      <span className="text-[10px] text-gray-300 mt-0.5">{u.desc}</span>
                    </button>
                  ))
                ) : (
                  demoQuickUsers.filter(u => u.user).map(u => (
                    <button
                      key={u.key}
                      disabled={loading}
                      onClick={() => quickLogin(u.user!.name, u.user!.password!)}
                      className="flex flex-col items-center py-3 px-2 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition group"
                    >
                      <span className="text-xs font-bold text-gray-700 group-hover:text-orange-600">{u.label}</span>
                      <span className="text-[10px] text-gray-300 mt-0.5">{u.desc}</span>
                    </button>
                  ))
                )}
              </div>
              {useApi && (
                <p className="text-center text-gray-300 text-[10px] mt-3">
                  Password: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">password123</code>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
