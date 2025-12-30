import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../services/mockSupabase';
import { Lock, User as UserIcon, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState(false);

  // Register state
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regName, setRegName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { user, error: loginError } = await db.login(username, password);
    setLoading(false);
    
    if (user) {
      onLogin(user);
    } else {
      // Check for common Supabase setup errors
      // Postgres error: relation "public.users" does not exist
      if (loginError && (loginError.includes('does not exist') || loginError.includes('Could not find') || loginError.includes('relation'))) {
        setError('Database error: Tables are missing. Please run the SQL script in Supabase.');
      } else {
        setError(loginError || 'Invalid credentials or user does not exist. (凭据无效或用户不存在)');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regUser.length < 3 || regPass.length < 6) {
      setError('Username 3+ chars, Password 6+ chars.');
      return;
    }
    
    setLoading(true);
    const { success, error: regError } = await db.register({
      username: regUser,
      password: regPass,
      fullName: regName,
      role: 'Visitor', // Default
      permissions: []
    });
    setLoading(false);

    if (success) {
      alert('Registration successful! Please login. (注册成功！请登录)');
      setMode('LOGIN');
      setRegUser('');
      setRegPass('');
      setRegName('');
    } else {
       if (regError && (regError.includes('does not exist') || regError.includes('Could not find') || regError.includes('relation'))) {
        setError('Database error: Tables are missing. Please run the SQL script.');
      } else {
        setError(regError || 'Username already exists or system error. (用户名已存在或系统错误)');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-[url('https://wallpapers.com/images/featured/haval-089etj9zc9genyvy.jpg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md bg-slate-900/80 p-8 rounded-2xl shadow-2xl border border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-wider">GWM VTS</h1>
          <p className="text-slate-400 text-sm mt-1">Vehicle Traceability System (车辆追溯系统)</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-6 flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {mode === 'LOGIN' ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2 block">Username (用户名)</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition"
                  placeholder="Enter login..."
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2 block">Password (密码)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition"
                  placeholder="Enter password..."
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-lg shadow-blue-600/20 disabled:opacity-50">
              {loading ? 'Logging in...' : 'LOGIN (登录)'}
            </button>
            
            <button 
              type="button" 
              onClick={() => setMode('REGISTER')}
              className="w-full bg-transparent border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 py-2 rounded-lg transition text-sm"
            >
              Register New Account (注册新账户)
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <h3 className="text-white text-lg font-bold mb-4">Register (注册)</h3>
            <input
              type="text"
              placeholder="Full Name (全名)"
              value={regName}
              onChange={e => setRegName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
            />
            <input
              type="text"
              placeholder="Login (3 alphanumeric)"
              value={regUser}
              onChange={e => setRegUser(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={regPass}
              onChange={e => setRegPass(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
            />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setMode('LOGIN')} className="flex-1 bg-slate-700 py-2 rounded text-white">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-green-600 py-2 rounded text-white font-bold">{loading ? 'Creating...' : 'Sign Up'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}