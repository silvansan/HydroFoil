import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/Alert';
import { FormError } from '../components/FormError';
import UserAccessFields from '../components/UserAccessFields';
import { useResourceList } from '../hooks/useResourceList';
import type { UserAccessAssignment } from '../api/types';

const EMPTY_ACCESS: UserAccessAssignment = {
  applicationIds: [],
  recordingPolicyIds: [],
  vodRouteIds: [],
  domainBlockIds: [],
  storageLocationIds: [],
};

const ROLE_LABELS: Record<User['role'], string> = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  manager: 'Moderator',
};

type UserRole = User['role'];

type UserFormState = {
  email: string;
  displayName: string;
  password: string;
  role: UserRole;
  isActive: boolean;
};

const INITIAL_FORM_STATE: UserFormState = {
  email: '',
  displayName: '',
  password: '',
  role: 'manager',
  isActive: true,
};

function assignableRoles(actorRole: UserRole | undefined): Array<{ value: UserRole; label: string }> {
  const all = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({
    value,
    label: ROLE_LABELS[value],
  }));
  if (actorRole === 'super-admin') return all;
  return all.filter((option) => option.value !== 'super-admin');
}

const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { items, isLoading, error, reload } = useResourceList<User>(() => api.listUsers());
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<UserFormState>(INITIAL_FORM_STATE);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [accessForm, setAccessForm] = React.useState<UserAccessAssignment>(EMPTY_ACCESS);

  const roleOptions = assignableRoles(currentUser?.role);
  const showAccessFields = form.role === 'manager';

  const openInviteModal = () => {
    setSelectedUser(null);
    setForm({ ...INITIAL_FORM_STATE, role: 'manager' });
    setAccessForm(EMPTY_ACCESS);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setForm({
      email: user.email,
      displayName: user.displayName ?? '',
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    setAccessForm(EMPTY_ACCESS);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setForm(INITIAL_FORM_STATE);
    setAccessForm(EMPTY_ACCESS);
    setSubmitError(null);
  };

  const canEditUser = (user: User) => {
    if (currentUser?.role === 'super-admin') return true;
    return user.role !== 'super-admin';
  };

  const saveUser = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let userId = selectedUser?.id;
      if (selectedUser) {
        await api.updateUser(selectedUser.id, {
          email: form.email.trim(),
          displayName: form.displayName.trim() || null,
          password: form.password.trim() || undefined,
          role: form.role,
          isActive: form.isActive,
        });
      } else {
        const created = await api.createUser({
          email: form.email.trim(),
          displayName: form.displayName.trim() || undefined,
          password: form.password.trim(),
          role: form.role,
          isActive: form.isActive,
        });
        userId = created.id;
      }

      if (form.role === 'manager' && userId) {
        await api.updateUserAccess(userId, accessForm);
      }

      await reload();
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      setSubmitError('You cannot delete your own account.');
      return;
    }

    if (!window.confirm(`Remove access for ${user.email}? This cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteUser(user.id);
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const canSubmit =
    form.email.trim().length > 0 &&
    form.role.length > 0 &&
    (selectedUser ? true : form.password.trim().length >= 8);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Invite admins and moderators to your organization. Share their temporary password securely—they can change it under My profile."
        action={
          <Button variant="primary" onClick={openInviteModal}>
            + Invite user
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}
      {submitError && <Alert>{submitError}</Alert>}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Team members</h2>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading users…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">
            No team members yet. Invite an admin or moderator to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-sm text-slate-100">
                      {user.email}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs hf-muted">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{user.displayName ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {user.isActive ? 'Active' : 'Disabled'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {canEditUser(user) ? (
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEditModal(user)}>
                            Edit
                          </Button>
                          {user.id !== currentUser?.id && (
                            <Button size="sm" variant="danger" onClick={() => deleteUser(user)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs hf-muted">Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        title={selectedUser ? 'Edit team member' : 'Invite team member'}
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2" htmlFor="user-email">
              Email address
            </label>
            <TextInput
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2" htmlFor="user-display-name">
              Display name
            </label>
            <TextInput
              id="user-display-name"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({ ...current, displayName: event.target.value }))
              }
              placeholder="Optional display name"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2" htmlFor="user-password">
              {selectedUser ? 'New password' : 'Temporary password'}
            </label>
            <TextInput
              id="user-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={
                selectedUser
                  ? 'Leave blank to keep existing password'
                  : 'Minimum 8 characters — share securely'
              }
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2" htmlFor="user-role">
              Role
            </label>
            <select
              id="user-role"
              className="hf-select"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as UserRole }))
              }
            >
              {roleOptions.map((roleOption) => (
                <option key={roleOption.value} value={roleOption.value}>
                  {roleOption.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs hf-muted">
              Admins manage the control plane. Moderators operate assigned applications and stream keys.
            </p>
          </div>

          {showAccessFields && (
            <UserAccessFields
              userId={selectedUser?.id ?? null}
              value={accessForm}
              onChange={setAccessForm}
              disabled={isSubmitting}
            />
          )}

          <div className="flex items-center gap-3">
            <input
              id="user-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              className="accent-brand-400"
            />
            <label htmlFor="user-active" className="text-sm text-slate-200">
              Account active
            </label>
          </div>

          <FormError message={submitError} />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveUser} disabled={!canSubmit || isSubmitting}>
              {selectedUser ? 'Save changes' : 'Send invite'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UsersPage;
