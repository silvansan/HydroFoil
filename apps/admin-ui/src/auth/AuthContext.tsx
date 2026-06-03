import React from 'react';

import { useNavigate } from 'react-router-dom';

import { api, AUTH_SESSION_EXPIRED_EVENT } from '../api/client';

import type { User, UserAccess } from '../api/types';



type UserRole = User['role'];



export type AuthUser = Pick<User, 'id' | 'email' | 'displayName' | 'role'>;



const EMPTY_ACCESS: UserAccess = {
  allApplications: false,
  applicationIds: [],
  allRecordingPolicies: true,
  recordingPolicyIds: [],
  allVodRoutes: true,
  vodRouteIds: [],
  allDomainBlocks: true,
  domainBlockIds: [],
  allStorageLocations: true,
  storageLocationIds: [],
};



type AuthContextValue = {

  user: AuthUser | null;

  access: UserAccess;

  isAuthenticated: boolean;

  loading: boolean;

  login: (email: string, password: string) => Promise<void>;

  logout: () => void;

  setUser: (user: AuthUser) => void;

};



const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);



const STORAGE_KEY = 'hf_auth_user';

const ACCESS_KEY = 'hf_auth_access';

const TOKEN_KEY = 'hf_auth_token';



function toAuthUser(user: User): AuthUser {

  return {

    id: user.id,

    email: user.email,

    displayName: user.displayName,

    role: user.role,

  };

}



function persistUser(user: AuthUser | null) {

  try {

    if (user) {

      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));

    } else {

      localStorage.removeItem(STORAGE_KEY);

    }

  } catch {

    // ignore

  }

}



function persistAccess(access: UserAccess | null) {

  try {

    if (access) {

      localStorage.setItem(ACCESS_KEY, JSON.stringify(access));

    } else {

      localStorage.removeItem(ACCESS_KEY);

    }

  } catch {

    // ignore

  }

}



export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUserState] = React.useState<AuthUser | null>(() => {

    try {

      const raw = localStorage.getItem(STORAGE_KEY);

      return raw ? (JSON.parse(raw) as AuthUser) : null;

    } catch {

      return null;

    }

  });

  const [access, setAccess] = React.useState<UserAccess>(() => {

    try {

      const raw = localStorage.getItem(ACCESS_KEY);

      return raw ? (JSON.parse(raw) as UserAccess) : EMPTY_ACCESS;

    } catch {

      return EMPTY_ACCESS;

    }

  });

  const [loading, setLoading] = React.useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));



  const navigate = useNavigate();



  const setUser = React.useCallback((next: AuthUser) => {

    setUserState(next);

    persistUser(next);

  }, []);



  const applySession = React.useCallback((nextUser: AuthUser, nextAccess: UserAccess) => {

    setUserState(nextUser);

    setAccess(nextAccess);

    persistUser(nextUser);

    persistAccess(nextAccess);

  }, []);



  const clearSession = React.useCallback(() => {

    localStorage.removeItem(STORAGE_KEY);

    localStorage.removeItem(ACCESS_KEY);

    localStorage.removeItem(TOKEN_KEY);

    setUserState(null);

    setAccess(EMPTY_ACCESS);

  }, []);



  React.useEffect(() => {

    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {

      if (localStorage.getItem(STORAGE_KEY) || localStorage.getItem(ACCESS_KEY)) {

        clearSession();

      }

      setLoading(false);

      return;

    }



    setLoading(true);

    api

      .getCurrentUser()

      .then((result) => {

        applySession(toAuthUser(result.user), result.access);

      })

      .catch(() => {

        clearSession();

      })

      .finally(() => setLoading(false));

  }, [applySession, clearSession]);



  React.useEffect(() => {

    const onExpired = () => {

      clearSession();

      navigate('/login', { replace: true });

    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);

    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);

  }, [clearSession, navigate]);



  const login = React.useCallback(

    async (email: string, password: string) => {

      const result = await api.login({ email, password });

      applySession(toAuthUser(result.user), result.access);

      try {

        localStorage.setItem(TOKEN_KEY, result.token);

      } catch {

        // ignore

      }

      navigate('/system-status', { replace: true });

    },

    [navigate, applySession]

  );



  const logout = React.useCallback(() => {

    clearSession();

    navigate('/login', { replace: true });

  }, [clearSession, navigate]);



  const value = React.useMemo(

    () => ({ user, access, isAuthenticated: Boolean(user), loading, login, logout, setUser }),

    [user, access, loading, login, logout, setUser]

  );



  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

};



export function useAuth() {

  const ctx = React.useContext(AuthContext);

  if (!ctx) throw new Error('useAuth must be used within AuthProvider');

  return ctx;

}



export function canManageUsers(role: UserRole | undefined) {

  return role === 'super-admin' || role === 'admin';

}



export function canManageApplications(role: UserRole | undefined) {

  return role === 'super-admin' || role === 'admin';

}



export function canSeeVodNav(role: UserRole | undefined, access: UserAccess) {
  if (canManageApplications(role)) return true;
  return access.vodRouteIds.length > 0;
}

export function canSeeDomainBlocksNav(role: UserRole | undefined, access: UserAccess) {
  if (canManageApplications(role)) return true;
  return access.domainBlockIds.length > 0;
}

export function canSeeStorageNav(role: UserRole | undefined, access: UserAccess) {
  if (canManageApplications(role)) return true;
  return access.storageLocationIds.length > 0;
}

export function canManageRecordingPolicyDefinitions(
  role: UserRole | undefined,
  access: UserAccess
) {
  if (canManageApplications(role)) return true;
  return access.recordingPolicyIds.length > 0;
}



export default AuthContext;

