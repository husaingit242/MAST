import api, { assertApiConfigured } from '@/services/api';

export interface AuthUser { id: string; email: string; username: string; full_name: string; role: string; is_active: boolean; }
export interface TokenPair { access_token: string; refresh_token: string; token_type: 'bearer'; user: AuthUser; }

export const authService = {
  async login(username: string, password: string): Promise<TokenPair> {
    assertApiConfigured();
    return (await api.post<TokenPair>('/auth/login', { username, password })).data;
  },
  async register(input: { email: string; username: string; password: string; full_name: string }): Promise<TokenPair> {
    assertApiConfigured();
    return (await api.post<TokenPair>('/auth/register', input)).data;
  },
  async logout(refreshToken: string): Promise<void> {
    assertApiConfigured();
    await api.post('/auth/logout', { refresh_token: refreshToken });
  },
  async me(): Promise<AuthUser> {
    assertApiConfigured();
    return (await api.get<AuthUser>('/auth/me')).data;
  },
};
