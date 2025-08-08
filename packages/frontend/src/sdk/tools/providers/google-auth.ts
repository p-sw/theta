import { localStorage } from "@/lib/storage";
import { dispatchEvent } from "@/lib/utils";

// Keep keys generic to share across all Google tool providers
export const GOOGLE_AUTH_STATE_KEY = "google-auth-state";

type TokenResponse = {
  accessToken: string;
  expiresAt: number; // epoch ms
  scope: string; // space-delimited scopes returned by GIS
};

type GoogleAuthConfig = {
  clientId: string;
  apiKey: string; // not strictly required for OAuth, but may be used for other Google APIs
};

/**
 * Minimal loader for Google Identity Services (GIS)
 */
async function loadGisClient(): Promise<void> {
  if ((window as never as { __gisLoaded?: boolean }).__gisLoaded) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as never as { __gisLoaded?: boolean }).__gisLoaded = true;
      resolve();
    };
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

function getStoredToken(): TokenResponse | null {
  const raw = localStorage.getItem(GOOGLE_AUTH_STATE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TokenResponse;
    return parsed;
  } catch {
    return null;
  }
}

function setStoredToken(token: TokenResponse | null): void {
  if (token) {
    localStorage.setItem(GOOGLE_AUTH_STATE_KEY, JSON.stringify(token));
  } else {
    localStorage.removeItem(GOOGLE_AUTH_STATE_KEY);
  }
}

function isExpired(token: TokenResponse): boolean {
  // add a small skew to proactively refresh
  return Date.now() + 5_000 >= token.expiresAt;
}

function scopesSatisfied(existing: string, requested: string[]): boolean {
  const existingSet = new Set(existing.split(" ").filter(Boolean));
  return requested.every((s) => existingSet.has(s));
}

class GoogleAuthManager {
  private config: GoogleAuthConfig | null = null;

  setup(config: GoogleAuthConfig) {
    this.config = config;
  }

  /**
   * Ensure an access token exists with the requested scopes. Incremental auth will be requested if needed.
   */
  async ensureAccessToken(scopes: string[]): Promise<string> {
    if (!this.config) throw new Error("GoogleAuthManager not configured");
    await loadGisClient();

    const existing = getStoredToken();
    if (
      existing &&
      !isExpired(existing) &&
      scopesSatisfied(existing.scope, scopes)
    ) {
      return existing.accessToken;
    }

    // Use GIS token client for implicit OAuth
    const scopeString = Array.from(
      new Set([...(existing?.scope.split(" ") ?? []), ...scopes])
    ).join(" ");

    const accessToken = await new Promise<string>((resolve, reject) => {
      const googleAny = (window as unknown as { google?: any }).google;
      if (!googleAny?.accounts?.oauth2) {
        reject(new Error("Google Identity Services not available"));
        return;
      }
      const client = googleAny.accounts.oauth2.initTokenClient({
        client_id: this.config!.clientId,
        scope: scopeString,
        include_granted_scopes: true,
        callback: (resp: {
          access_token?: string;
          error?: string;
          error_description?: string;
        }) => {
          if (resp.error || !resp.access_token) {
            reject(
              new Error(
                resp.error_description ||
                  resp.error ||
                  "Failed to obtain Google access token"
              )
            );
            return;
          }
          resolve(resp.access_token);
        },
      });
      client.requestAccessToken();
    });

    const tokenInfo = await this.fetchTokenInfo(accessToken);
    const token: TokenResponse = {
      accessToken,
      expiresAt: Date.now() + tokenInfo.expires_in * 1000,
      scope: tokenInfo.scope,
    };
    setStoredToken(token);
    // dispatch via localStorage wrapper already triggers events, but additionally fire a custom event for listeners if needed
    dispatchEvent(GOOGLE_AUTH_STATE_KEY, { detail: token });
    return token.accessToken;
  }

  private async fetchTokenInfo(
    accessToken: string
  ): Promise<{ expires_in: number; scope: string }> {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    if (!res.ok) {
      // fallback if tokeninfo is unavailable; set short lifetime
      return { expires_in: 300, scope: "" };
    }
    const data = (await res.json()) as { expires_in: number; scope: string };
    return data;
  }

  getAuthorizationHeader(): string | null {
    const token = getStoredToken();
    if (!token || isExpired(token)) return null;
    return `Bearer ${token.accessToken}`;
  }
}

export const googleAuth = new GoogleAuthManager();
