import React from 'react';
import { Link } from 'react-router-dom';
import { TextInput } from '@hydrofoil/ui-kit';
import { api } from '../api/client';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ message: string; smtpConfigured: boolean } | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your account email');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.forgotPassword({ email: email.trim() });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center hf-app-shell px-6">
      <div className="w-full max-w-md relative z-10">
        <h1 className="text-2xl font-bold hf-title mb-2 text-center">Forgot password</h1>
        <p className="hf-muted text-sm mb-8 text-center">
          We will notify your HydroFoil administrator. Self-service email reset links are planned;
          until then an admin can set a new password under Users.
        </p>

        {result ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100 space-y-3">
            <p>{result.message}</p>
            {!result.smtpConfigured && (
              <p className="text-emerald-200/80 text-xs">
                Email delivery is not configured on this server (SMTP). Contact your administrator
                directly.
              </p>
            )}
            <Link to="/login" className="inline-block text-brand-400 hover:underline text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextInput
              label="Account email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={isSubmitting}
              autoComplete="email"
            />
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold disabled:opacity-60"
            >
              {isSubmitting ? 'Sending…' : 'Request password help'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm hf-muted">
          Need an account?{' '}
          <Link to="/request-access" className="text-brand-400 hover:underline">
            Request access
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
