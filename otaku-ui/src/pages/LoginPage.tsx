import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Network Diagnostics States
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagIp, setDiagIp] = useState(() => localStorage.getItem('diag_ip') || '192.168.1.85');
  const [diagPort, setDiagPort] = useState(() => localStorage.getItem('diag_port') || '3001');
  const [diagStatus, setDiagStatus] = useState<{ success?: boolean; message?: string; loading?: boolean }>({});

  const testarConectividade = async () => {
    localStorage.setItem('diag_ip', diagIp);
    localStorage.setItem('diag_port', diagPort);
    setDiagStatus({ loading: true });

    try {
      console.log(`A tentar ligar a: http://${diagIp}:${diagPort}/teste-rede/ping`);
      
      const resposta = await fetch(`http://${diagIp}:${diagPort}/teste-rede/ping`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) 
      });

      if (!resposta.ok) {
        throw new Error(`Erro do Servidor: ${resposta.status}`);
      }

      const dados = await resposta.json();
      setDiagStatus({ success: true, message: `LIGAÇÃO BEM SUCEDIDA! 🎉\nMensagem: ${dados.mensagem}` });
      showToast(`LIGAÇÃO BEM SUCEDIDA! 🎉`, 'success');
      console.log("Dados recebidos:", dados);

    } catch (erro: any) {
      let errMsg = '';
      if (erro.name === 'TimeoutError') {
        errMsg = "❌ O pedido expirou (Timeout). Verifique a Firewall ou Wi-Fi.";
      } else if (erro.message && (erro.message.includes("Failed to fetch") || erro.message.includes("NetworkError"))) {
        errMsg = "❌ Erro de Rede ou CORS. Verifique o IP do PC.";
      } else {
        errMsg = `❌ Erro: ${erro.message || erro}`;
      }
      setDiagStatus({ success: false, message: errMsg });
      showToast(errMsg, 'error');
      console.error("Erro de conectividade:", erro);
    }
  };

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
        login(data.access_token, data.user);
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
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-pink-600/10 blur-[120px] rounded-full"></div>
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
                  className="w-full bg-[#0f1014] border border-gray-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-purple-500 transition-colors"
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
                  className="w-full bg-[#0f1014] border border-gray-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-purple-500 transition-colors"
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
              <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
                Sign up here
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-800/60">
            <button
              type="button"
              onClick={() => setDiagOpen(!diagOpen)}
              className="text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              <span>{diagOpen ? '▲ Fechar Diagnóstico de Rede' : '▼ Ferramenta de Diagnóstico de Rede'}</span>
            </button>

            {diagOpen && (
              <div className="mt-4 p-4 rounded-2xl bg-[#0f1014] border border-gray-800 text-left animate-slide-up space-y-3">
                <p className="text-xs text-gray-400 font-medium">
                  Testa a ligação entre o telemóvel e o PC através do Wi-Fi.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">IP do PC</label>
                    <input
                      type="text"
                      value={diagIp}
                      onChange={(e) => setDiagIp(e.target.value)}
                      placeholder="192.168.1.85"
                      className="w-full bg-[#1a1c23] border border-gray-850 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Porta</label>
                    <input
                      type="text"
                      value={diagPort}
                      onChange={(e) => setDiagPort(e.target.value)}
                      placeholder="3001"
                      className="w-full bg-[#1a1c23] border border-gray-850 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={testarConectividade}
                  disabled={diagStatus.loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {diagStatus.loading ? 'A testar...' : '📡 Testar Ligação Wi-Fi'}
                </button>

                {diagStatus.message && (
                  <div className={`p-3 rounded-lg text-xs border ${
                    diagStatus.success 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  } whitespace-pre-line`}>
                    {diagStatus.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
