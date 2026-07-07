import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await customFetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.access_token, data.user, data.refresh_token);
        navigate('/');
      } else {
        setError(data.message || 'Error logging in');
      }
    } catch (err: any) {
      console.error("Login fetch error:", err);
      setError(`Connection Error: ${err.message || err} (URL: ${API_BASE_URL})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1014] p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-secondary/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-[#1a1c23] border border-gray-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl bg-opacity-80">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img src="/logo.png" className="w-24 h-24 rounded-3xl shadow-2xl border border-white/10 object-cover" alt="Logo" />
            </div>
            <h1 className="text-3xl font-bold text-primary-light mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-500">Sign in to continue your journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0f1014] border border-gray-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-secondary transition-colors"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0f1014] border border-gray-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-secondary transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:opacity-90 text-on-primary font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-secondary hover:text-secondary font-semibold transition-colors">
                Sign up here
              </Link>
            </p>
          </div>


        </div>
      </div>
    </div>
  );
};

export default LoginPage;
