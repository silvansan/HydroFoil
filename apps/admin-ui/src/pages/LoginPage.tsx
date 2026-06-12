import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TextInput } from '@hydrofoil/ui-kit';
import { useAuth } from '../auth/AuthContext';
import { Eye, EyeOff, LogOut } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login, logout, isAuthenticated, loading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('session') === 'expired';
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isDev = import.meta.env.DEV;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit();
    }
  };

  if (!loading && isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center hf-app-shell relative overflow-hidden">
        <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
          <h1 className="text-2xl font-bold hf-title mb-2">Already signed in</h1>
          <p className="hf-muted text-sm mb-8">
            {user?.displayName || user?.email} is active in this browser.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/system-status"
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold transition-all"
            >
              Continue to console
            </Link>
            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-600 text-slate-200 hover:border-slate-500 font-medium transition-all inline-flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center hf-app-shell relative overflow-hidden">
      {/* Gradient orbs background */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
      
      <div className="w-full max-w-md px-6 py-12 relative z-10">
        {/* Logo Section */}
        <div className="mb-10 flex items-center justify-center">
          <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm w-64 h-40 flex items-center justify-center shadow-xl shadow-cyan-500/5">
            <img
              src="/hydrofoil-logo.png"
              alt="HydroFoil"
              className="w-full max-w-[200px] h-auto object-contain mx-auto"
            />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold hf-title mb-2">HydroFoil Control</h1>
          <p className="hf-muted text-sm">Live streaming platform control plane</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <TextInput
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="admin@hydrofoil.local"
              label="Email Address"
              disabled={isSubmitting}
              autoComplete="email"
              autoFocus
            />
          </div>

          {/* Password Input with Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <Link
                to="/forgot-password"
                className="text-xs text-brand-400 hover:text-brand-300 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <TextInput
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your password"
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          {sessionExpired && !error && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm">
              Your session expired. Sign in again to continue.
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Dev Credentials Hint */}
          {isDev && (
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs">
              <div className="font-semibold mb-1">Development Mode</div>
              <div>Default: admin@hydrofoil.local / change-me-now</div>
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"></circle>
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                </svg>
                Signing in...
              </>
            ) : (
              'Glide in'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm hf-muted">
          No account yet?{' '}
          <Link to="/request-access" className="text-brand-400 hover:text-brand-300 font-medium">
            Request access
          </Link>
        </p>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            HydroFoil • Live Streaming Control Plane
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
