let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null { return accessToken; }
export function getRefreshToken(): string | null { return refreshToken; }
export function setSessionTokens(access: string | null, refresh: string | null): void { accessToken = access; refreshToken = refresh; }
