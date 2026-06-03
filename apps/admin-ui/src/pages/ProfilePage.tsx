import React from 'react';
import { PageHeader, Card, Button, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/Alert';
import { FormError } from '../components/FormError';

const ROLE_LABELS: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  manager: 'Moderator',
};

const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuth();
  const [email, setEmail] = React.useState(user?.email ?? '');
  const [displayName, setDisplayName] = React.useState(user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setEmail(user.email);
      setDisplayName(user.displayName ?? '');
    }
  }, [user]);

  const passwordChangeRequested = newPassword.length > 0 || confirmPassword.length > 0;

  const canSubmit =
    email.trim().length > 0 &&
    (!passwordChangeRequested ||
      (currentPassword.length >= 8 &&
        newPassword.length >= 8 &&
        newPassword === confirmPassword));

  const saveProfile = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    if (passwordChangeRequested && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await api.updateProfile({
        email: email.trim(),
        displayName: displayName.trim() || null,
        currentPassword: passwordChangeRequested ? currentPassword : undefined,
        password: passwordChangeRequested ? newPassword : undefined,
      });

      setUser({
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        role: result.user.role,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Update your account email, display name, and password."
      />

      {error && <Alert>{error}</Alert>}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}

      <Card className="max-w-xl p-6 space-y-5">
        <div>
          <p className="text-xs hf-muted uppercase tracking-wide mb-1">Role</p>
          <p className="text-sm hf-strong">{user ? (ROLE_LABELS[user.role] ?? user.role) : '—'}</p>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-2" htmlFor="profile-email">
            Email address
          </label>
          <TextInput
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-2" htmlFor="profile-display-name">
            Display name
          </label>
          <TextInput
            id="profile-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="pt-2 border-t border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold hf-strong">Change password</h2>
          <p className="text-xs hf-muted">Leave blank to keep your current password.</p>

          <div>
            <label className="block text-sm text-slate-300 mb-2" htmlFor="profile-current-password">
              Current password
            </label>
            <TextInput
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2" htmlFor="profile-new-password">
              New password
            </label>
            <TextInput
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2" htmlFor="profile-confirm-password">
              Confirm new password
            </label>
            <TextInput
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <FormError message={error} />

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={saveProfile} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;
