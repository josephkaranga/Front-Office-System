import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.message || 'Invalid credentials.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[#f0f2f5]">
      {/* Left: Hotel Image Panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80')`,
        }}>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold mb-2">{settings.hotel_name || 'Welcome'}</h2>
          <p className="text-lg text-white/80 mb-6">{settings.hotel_tagline || 'Hotel Management System'}</p>
          <div className="flex gap-6 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              24/7 Operations
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              Secure Access
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
              Offline Ready
            </div>
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="text-2xl font-bold text-[#1e293b]">{settings.hotel_name || 'HOTEL'}</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">{settings.hotel_tagline || 'Front Office'}</p>
          </div>

          <div className="lg:block hidden mb-8">
            <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to start your shift</p>
          </div>

          {error && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-field" placeholder="Enter email" required autoFocus />
            </div>
            <div>
              <label className="label-field">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input-field" placeholder="Enter password" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">East Africa Hotel Management System</p>
            <div className="flex justify-center gap-3 mt-2 text-[10px] text-gray-400">
              <span>Kenya</span><span>Tanzania</span><span>Uganda</span><span>Rwanda</span><span>Burundi</span><span>Ethiopia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
