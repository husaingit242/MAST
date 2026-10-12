import { create } from 'zustand';
import { authService, type AuthUser, type TokenPair } from '@/services/authService';
import { getRefreshToken, setSessionTokens } from '@/services/authSession';

type AuthState = {
  user: AuthUser | null;
  refreshToken: string | null;
  authenticate: (request: Promise<TokenPair>) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  refreshToken: null,
  authenticate: async request => {
    const session = await request;
    setSessionTokens(session.access_token, session.refresh_token);
    set({ user: session.user, refreshToken: session.refresh_token });
  },
  logout: async () => {
    const refreshToken = getRefreshToken();
    try { if (refreshToken) await authService.logout(refreshToken); }
    finally { setSessionTokens(null, null); set({ user: null, refreshToken: null }); }
  },
}));
