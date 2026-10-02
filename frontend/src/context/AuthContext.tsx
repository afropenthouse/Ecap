import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken } from '../api/client';
import { getMyOrganization, type Organization } from '../api/services';

// Define types for Supabase responses
type User = {
  id: string;
  email: string;
  roles: string[]; // normalized lower-case: ['hr' | 'assessor' | 'employee']
  organizationId?: string;
  firstName?: string;
  lastName?: string;
};

type AuthContextType = {
  user: User | null;
  isInitializing: boolean;
  organization: Organization | null;
  updateOrganization: (organization: Organization) => void;
  signIn: (email: string, password: string, organizationId?: string) => Promise<User>;
  signUp: (params: { organizationName: string; organizationEmail: string; adminEmail: string; adminPassword: string; firstName?: string; lastName?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  // Normalize backend role to lower-case role array
  const normalizeRoles = (role: string | undefined): string[] => {
    if (!role) return ['employee'];
    const r = role.toLowerCase();
    if (r === 'hr' || r === 'assessor' || r === 'employee') return [r];
    return ['employee'];
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('jwt_token');
        if (!token) {
          setUser(null);
          setOrganization(null);
          return;
        }
        const me = await api.get<{ id: string; email: string; role: string; organizationId: string; firstName?: string; lastName?: string }>('/auth/me');
        const roles = normalizeRoles(me.role);
        setUser({ id: me.id, email: me.email, roles, organizationId: me.organizationId, firstName: me.firstName, lastName: me.lastName });
        try {
          setOrganization(await getMyOrganization());
        } catch (organizationError) {
          console.warn('Could not load organization profile for this session:', organizationError);
          setOrganization(null);
        }
      } catch (err) {
        console.error('Session check failed:', err);
        setToken(undefined);
        setUser(null);
        setOrganization(null);
      } finally {
        setIsInitializing(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (email: string, password: string, organizationId?: string): Promise<User> => {
    const result = await api.post<{ token: string; user: { id: string; email: string; role: string; organizationId: string; firstName?: string; lastName?: string }; organization: Organization }>(
      '/auth/login',
      { email, password, ...(organizationId ? { organizationId } : {}) }
    );
    setToken(result.token);
    const roles = normalizeRoles(result.user.role);
    const newUser: User = { id: result.user.id, email: result.user.email, roles, organizationId: result.user.organizationId, firstName: result.user.firstName, lastName: result.user.lastName };
    setUser(newUser);
    setOrganization(result.organization);
    setIsInitializing(false);
    return newUser;
  };

  const signUp = async (params: { organizationName: string; organizationEmail: string; adminEmail: string; adminPassword: string; firstName?: string; lastName?: string }) => {
    await api.post<{ token: string; user: { id: string; email: string; role: string; organizationId: string } }>(
      '/auth/org/signup',
      {
        organizationName: params.organizationName,
        organizationEmail: params.organizationEmail,
        adminEmail: params.adminEmail,
        adminPassword: params.adminPassword,
        firstName: params.firstName,
        lastName: params.lastName,
      }
    );
    // Do not auto-login here; let UI redirect to login/setup
  };

  const signOut = async () => {
    setToken(undefined);
    setUser(null);
    setOrganization(null);
    setIsInitializing(false);
  };

  const resetPassword = async (email: string) => {
    await api.post('/auth/forgot-password', { email });
  };

  return (
    <AuthContext.Provider value={{ user, isInitializing, organization, updateOrganization: setOrganization, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
