import React from 'react';
import { Link } from 'react-router-dom';
import { TextInput } from '@hydrofoil/ui-kit';
import { api } from '../api/client';

const RequestAccessPage: React.FC = () => {
  const [email, setEmail] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    message: string;
    smtpConfigured: boolean;
    delivered: boolean;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email address');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.requestAccess({
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        message: message.trim() || undefined,
      });
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
        <h1 className="text-2xl font-bold hf-title mb-2 text-center">Request access</h1>
        <p className="hf-muted text-sm mb-8 text-center">
          Ask for a HydroFoil operator account. An administrator will invite you with a role
          (moderator, admin, or super-admin).
        </p>

        {result ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100 space-y-3">
            <p>{result.message}</p>
            {!result.delivered && (
              <p className="text-emerald-200/80 text-xs">
                SMTP is not configured — your administrator may not have received email. Contact
                them directly.
              </p>
            )}
            <Link to="/login" className="inline-block text-brand-400 hover:underline text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
            />
            <TextInput
              label="Your name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isSubmitting}
            />
            <div>
              <label className="text-sm font-medium text-slate-300">Message (optional)</label>
              <textarea
                className="hf-input mt-1 min-h-[5rem]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Which applications or workflows do you need?"
                disabled={isSubmitting}
              />
            </div>
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
              {isSubmitting ? 'Sending…' : 'Submit request'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm hf-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RequestAccessPage;
