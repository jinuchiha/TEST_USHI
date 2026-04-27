import React, { useState } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';

interface LoginProps {
  onLogin: (userName: string, password?: string) => boolean;
}

const Login: React.FC<LoginProps> = () => {
  const { login: apiLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await apiLogin(email, password);
    setLoading(false);
    if (!success) setError('Invalid email or password.');
  };

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
              <p className="text-3xl font-bold text-white">14</p>
              <p className="text-blue-200/40 text-xs mt-1">AI Modules</p>
            </div>
            <div>
              <p className="text-3xl font-bold" style={{ color: '#F28C28' }}>100+</p>
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
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#1B2A4A' }}>
              Reco<span style={{ color: '#F28C28' }}>V</span>antage
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-xl font-bold mb-1" style={{ color: '#1B2A4A' }}>Welcome back</h2>
            <p className="text-gray-400 text-sm mb-6">Sign in to your account</p>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2.5">{error}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition"
                  placeholder="you@recovantage.com"
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

            <p className="text-center text-gray-400 text-[11px] mt-6">
              Forgot password? Contact your admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
